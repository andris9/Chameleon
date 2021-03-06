var Stream = require("stream").Stream,
    utillib = require("util"),
    crypto = require('crypto');

module.exports.CipherStream = CipherStream;
module.exports.DecipherStream = DecipherStream;

function CipherStream(password, algorithm){
    Stream.call(this);

    algorithm = algorithm || "aes192";

    this.writable = true;

    this.cipher = crypto.createCipher(algorithm, password);
}
utillib.inherits(CipherStream, Stream);

CipherStream.prototype.write = function(chunk){
    if(typeof chunk == "string"){
        chunk = new Buffer(chunk, "utf-8");
    }
    var data = this.cipher.update(chunk.toString("binary")) || "";
    if(data)this.emit("data", new Buffer(data, "binary"));
}

CipherStream.prototype.end = function(){
    var data = this.cipher.final() || "";
    if(data)this.emit("data", new Buffer(data, "binary"));
    this.emit("end");
}

function DecipherStream(password, algorithm){
    Stream.call(this);

    algorithm = algorithm || "aes192";

    this.writable = true;

    this.decipher = crypto.createDecipher(algorithm, password);
}
utillib.inherits(DecipherStream, Stream);

DecipherStream.prototype.write = function(chunk){
    var data = this.decipher.update(chunk.toString("binary")) || "";
    if(data)this.emit("data", new Buffer(data, "binary"));
}

DecipherStream.prototype.end = function(){
    var data = this.decipher.final("binary") || "";
    if(data)this.emit("data", new Buffer(data, "binary"));
    this.emit("end");
}