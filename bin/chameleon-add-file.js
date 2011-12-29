#!/usr/local/bin/node

var config = require("./../config"),
    server = require("./../lib/server"),
    lib = require("./../lib/lib"),
    argv = require("optimist").argv,
    fs = require("fs"),
    cryptoStream = require("./../lib/cipher");

server.readPasswords(function(err){
    if(err){
        throw err;
    }
    
    if(!argv.source){
        throw new Error("Source file missing, usage:  --source=path/to/file [--destination=/path/in/docroot/]");
    }
    
    var docroot = config.docroot+ (config.docroot.substr(-1)!="/"?"/":""),
        target = argv.destination || argv.source.split("/").pop();
    
    dest_url = lib.resolvePath(target, docroot);
    if(dest_url.substr(-1)=="/"){
        dest_url += target;
    }
    
    if(dest_url.substr(0, docroot.length) != docroot){
        throw Error("Invalid target");
    }
    
    var inp = fs.createReadStream(argv.source),
        out = fs.createWriteStream(dest_url+".cr"),
        cipher1 = new cryptoStream.CipherStream(config.passwords[0]),
        cipher2 = new cryptoStream.CipherStream(config.passwords[1], "cast5-cbc");
    
    inp.pipe(cipher1).pipe(cipher2).pipe(out);
    
});