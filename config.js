var lib = require("./lib/lib"),
    argv = require('optimist').argv,
    fs = require("fs"),
    overwrite = {};

if(argv.config){
    overwrite = JSON.parse(fs.readFileSync(argv.config,"utf-8"));
}

module.exports = {
    server_key: argv.skey || overwrite.server_key || '26E!7=NE=79)6!9-Xrt=4F)1205x-$Va',
    server_version: "0.1.0",
    docroot: argv.docroot || overwrite.docroot || __dirname+"/docroot",
    ssl:{
        key: fs.readFileSync(argv.key || (overwrite.ssl && overwrite.ssl.key) || __dirname+"/data/PRIVATE_KEY.PEM"),
        certificate: fs.readFileSync(argv.cert ||  (overwrite.ssl && overwrite.ssl.certificate) || __dirname+"/data/CERTIFICATE.PEM"),
    },
    http:{
        port: argv.http_port || (overwrite.http && overwrite.http.port) || 12345,
        ip: argv.http_ip || (overwrite.http && overwrite.http.ip) || "127.0.0.1"
    },
    https:{
        port: argv.https_port || (overwrite.https && overwrite.https.port) || 12346,
        ip: argv.https_ip || (overwrite.https && overwrite.https.ip) || "127.0.0.1"
    },
    server_signature: argv.server_signature || overwrite.server_signature || lib.SERVER_SIGNATURE,
    user: {
        uid: argv.uid || (overwrite.user && overwrite.user.uid) || "nobody",
        gid: argv.gid || (overwrite.user && overwrite.user.gid) || "nogroup"
    },
    passwords:[]
}