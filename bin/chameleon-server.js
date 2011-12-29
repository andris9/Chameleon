#!/usr/local/bin/node

var config = require("./../config"),
    server = require("./../lib/server"),
    lib = require("./../lib/lib");

lib.prettyPrint(["Welcome to CHAMELEON/"+config.server_version,"~~~"]);

server.readPasswords(function(err){
    if(err){
        throw err;
    }
    server.start(server.staticRouter);
});