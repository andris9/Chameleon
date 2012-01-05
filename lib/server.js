var config = require("./../config"),
    lib = require("./lib"),
    http = require('http'),
    https = require('https'),
    serverList = {},
    fs = require("fs"),
    commander = require('commander'),
    urllib = require("url"),
    swig  = require('swig'),
    zlib = require('zlib'),
    cryptoStream = require("./cipher");

swig.init({
    allowErrors: false,
    encoding: 'utf8',
    autoescape: true,
    filters: {},
    root: __dirname+"/../templates/",
    tags: {}
});

module.exports.start = function(router, callback){
    startServer(router, function(err){
        if(err){
            if(callback){
                return callback(err);
            }else{
                throw err;
            }
        }
        
        process.setgid(config.user.gid);
        process.setuid(config.user.uid);
        
        if(callback){
            callback(null, true);
        }else{
            console.log("Server running on port "+config.http.port+" (http) and "+config.https.port+" (https)")
            console.log("Identifying as "+config.server_signature);
        }
    });
}

module.exports.version = config.server_version;

module.exports.readPasswords = readPasswords;
module.exports.staticRouter = staticRouter;
module.exports.sendOutput = sendOutput;
module.exports.redirect = redirect;
module.exports.showError = showError;

function startHTTPServer(router, callback){
    var server = http.createServer(router);
    server.listen(config.http.port, config.http.ip, callback);
    serverList.HTTP = server;
}

function startHTTPSServer(router, callback){
    var server = https.createServer({ 
        key: config.ssl.key,
        cert: config.ssl.certificate
    },router);
    server.listen(config.https.port, config.https.ip, callback);
    serverList.HTTPS = server;
}

function startServer(router, callback){
    killServer();
    startHTTPServer(router, function(err){
        if(err){
            return callback(err);
        }
        startHTTPSServer(router, function(err){
            if(err){
                return callback(err);
            }
            callback(null, true);
        });
    });
}

function killServer(){
    if(serverList.HTTP){
        try{
            serverList.HTTP.close();
        }catch(E){}
    }
    if(serverList.HTTPS){
        try{
            serverList.HTTPS.close();
        }catch(E){}
    }
    serverList = {};
}

function readPasswords(callback){
    fs.stat(__dirname+"/../data/passcache", function(err, stats){
        if(!err && stats.isFile()){
            fs.readFile(__dirname+"/../data/passcache", "utf-8", function(err, data){
                askForPasswords(data, callback);
            });
        }else{
            console.log("SETUP SERVER PASSWORDS");
            console.log("Enter new server password #1");
            commander.password('Password: ', function(pass1){
                console.log("Enter new server password #2");
                commander.password('Password: ', function(pass2){
                    process.stdin.destroy();
                    
                    var data = lib.hmac(pass1+pass2);
                    fs.writeFile(__dirname+"/../data/passcache", data, "utf-8", function(err){
                        if(err){
                            return callback(err);
                        }
                        config.passwords = [pass1, pass2];
                        
                        callback(null, true);
                    });
                    
                });
            });   
        }
    });
}

function askForPasswords(data, callback){
    console.log("Enter server password #1");
    commander.password('Password: ', function(pass1){
        console.log("Enter server password #2");
        commander.password('Password: ', function(pass2){
            process.stdin.destroy();
            if(data == lib.hmac(pass1+pass2)){
                config.passwords = [pass1, pass2];
                callback(null, true);
            }else{
                return callback(new Error("Invalid password(s)"));
            }
        });
    });    
}

function staticRouter(request, response){
    var url = urllib.parse(request.url || "/", true, true),
        docroot = config.docroot+ (config.docroot.substr(-1)!="/"?"/":""),
        target_url = lib.resolvePath(url.pathname, docroot),
        out;
    
    if(target_url.substr(-1)=="/"){
        target_url = target_url+"index.html";
    }
    
    if(target_url.substr(0, docroot.length) != docroot){
        return showError(request, response, 500);
    }

    checkEncrypted(request, response, target_url, function(){
        fs.stat(target_url, function(err, stats){
            if(err){
                return showError(request, response, 404);
            }
            
            if(stats.isDirectory()){
                redirect(request, response, target_url.substr(docroot.length)+"/");
                return;
            }
            
            if(stats.isFile()){
                
                if(request.headers['if-modified-since'] == stats.mtime){
                    response.writeHead(304);
                    return response.end();
                }
                
                sendOutput(request, response, target_url, 200, {
                    contentType: lib.detectMimeType(target_url),
                    stream: true,
                    decrypt: false,
                    lastModified: stats.mtime.toUTCString()
                });
            }
            
        });
    });
}

function checkEncrypted(request, response, target_url, callback){
    var crypted_target = target_url+".cr";
    fs.stat(crypted_target, function(err, stats){
        if(err || stats.isDirectory()){
            return callback();
        }
        
        if(stats.isFile()){
            
            if(request.headers['if-modified-since'] == stats.mtime){
                response.writeHead(304);
                return response.end();
            }
            
            sendOutput(request, response, crypted_target, 200, {
                contentType: lib.detectMimeType(target_url),
                stream: true,
                decrypt: true,
                lastModified: stats.mtime.toUTCString()
            });
        }
    });
}

function redirect(request, response, target){
    var templateFile, hostname, protocol, html;
    
    hostname = request.headers.host || "unknown";
    protocol = request.socket.pair?"https":"http";
    
    templateFile = swig.compileFile("moved.html");
    
    response.setHeader("Location", protocol+"://"+hostname+target);
    
    html = templateFile.render({
        hostname: hostname,
        protocol: protocol,
        path: target
    });
    
    sendOutput(request, response, html, 301, {contentType: "text/html; charset=utf-8"});
}

function showError(request, response, code, message){
    var title, template, templateFile, hostname, public_port, html;
    
    code = code || 500;
    
    if(!message){
        switch(code){
            case 404:
                title = "Not Found";
                message = "The requested URL "+request.url+" was not found on this server.";
                template = "error.html";
                break;
            case 500:
                title = "Internal Server Error";
                message = "Error occured";
                template =  "error500.html";
                break;
            default:
                title = "Error";
                message = code + " Error";
                template =  "error.html";
        }
    }
    
    hostname = (request.headers.host || "unknown").split(":").shift();
    
    templateFile = swig.compileFile(template);
    
    public_port = request.socket.pair?443:80;
    
    html = templateFile.render({
        title: title,
        message: message,
        email: "admin@"+hostname,
        server_signature: config.server_signature,
        hostname: hostname,
        public_port: public_port
    });
    
    sendOutput(request, response, html, code, {contentType: "text/html; charset=utf-8"});
}

function sendOutput(request, response, output, code, options){
    var acceptEncoding, zip;
    
    code = code || 200;
    output = output || "";
    
    options = options || {};
    
    response.setHeader("Date", new Date().toUTCString());
    response.setHeader("Server",config.server_signature);
    response.setHeader("Vary","Accept-Encoding");
    
    response.setHeader("Content-Type", options.contentType || lib.detectMimeType(urllib.parse(request.url, true, true).pathname));
    
    if(options.lastModified){
        response.setHeader("Last-Modified", options.lastModified);
    }
    
    if(options.eTag){
        response.setHeader("ETag", options.eTag);
    }
    
    acceptEncoding = request.headers['accept-encoding'];
    if (!acceptEncoding) {
        acceptEncoding = '';
    }
    
    if(acceptEncoding.match(/\bgzip\b/)){
        response.setHeader("Content-Encoding", "gzip");
        response.writeHead(code);
        zip = zlib.createGzip();
        zip.pipe(response);
    }else if (acceptEncoding.match(/\bdeflate\b/)){
        response.setHeader("Content-Encoding", "deflate");
        response.writeHead(code);
        zip = zlib.createDeflate();
        zip.pipe(response);
    }else{
        response.writeHead(code);
        zip = response;
    }
    
    if(options.stream){
        if(options.decrypt){
            var decipher1 = new cryptoStream.DecipherStream(config.passwords[0]),
                decipher2 = new cryptoStream.DecipherStream(config.passwords[1], "cast5-cbc");
            fs.createReadStream(output).pipe(decipher2).pipe(decipher1).pipe(zip);
        }else{
            fs.createReadStream(output).pipe(zip);
        }
    }else{
        zip.end(output);
    }
    
}