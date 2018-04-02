'use strict';

const { Duplex : DuplexStream } = require('stream');
const merge = require('merge');
var kadence = require('@kadenceproject/kadence');
var simpleSignalClient = require("simple-signal-client")

class WebRTCTransport extends DuplexStream {

  static get DEFAULTS() {
    return {};
  }


  constructor(options) {
    super({ objectMode: true });
    this._options = merge(WebRTCTransport.DEFAULTS, options);
    this.nodeID = options.nodeID;
    console.log("Transport Says this is the nodeid: " + this.nodeID);
    this.nodeToPeer = {};
    this.nodeToCallbacks = {};
    this.socket = io.connect('http://localhost:8080');
    this.signalClient = new simpleSignalClient(this.socket,this.nodeID.toString('hex'));

    this.on('data', function(chunk) {
      console.log(chunk);
    });

    this.signalClient.on('request', (function (request) {
      request.accept(null,this.nodeID); // Accept a request to connect
    }).bind(this));

    this.signalClient.on('peer', (function (peer) {
      this.nodeToPeer[peer.metadata]=peer;
      console.log('Connected!');

      peer.on('connect', (function(){
        var connectingID = peer.metadata;
        console.log("Peer Onconnect! - " + connectingID);
        if(this.nodeToCallbacks[connectingID]) {
          this.nodeToCallbacks[connectingID].forEach(function (callback) {
            callback();
          });
        }
        delete this.nodeToCallbacks[connectingID];


        peer.on('error', function(err) {
          console.log('error', err);
        });

        peer.on('data', (function (data) {
          console.log("got data!!!!!!");
          // peer.send("GOT HELLO!");
          console.log(data.constructor.name);
          console.log(data.toString());
          console.log(data)

          // push looks like it is failing
          this.push(Buffer.from(data.toString('utf8')));
        }).bind(this));

        peer.on('finish', function() {
          console.log("PEER FINISHED");
        });


      }).bind(this));



    }).bind(this));

  }

  /**
   * Implements the writable interface
   * @private
   */
  _write([id, buffer, target], encoding, callback) {
    console.log("Callback Info:");
    console.log(callback.constructor.name);
    console.log(callback.toString());
    // if(!this.nodeID) {
    //   this.nodeID = JSON.parse(buffer.toString())[0]['params'][0];
    //   console.log(this.nodeID)
    //   this.signalClient.connect(null,null,this.nodeID);
    // }
    var targetID = target[0];
    if(this.nodeToPeer[targetID]){
      // this.nodeToPeer[targetID].once('error', callback);
      this.nodeToPeer[targetID].write(buffer,encoding,callback);
      console.log("SENDING BUFFER!");
    }
    else {
      this.signalClient.connect(targetID,null,this.nodeID);
      // try to wait for the connect. connect API does not support callback
      this.nodeToCallbacks[targetID] = [(function () {
        this.nodeToPeer[targetID].write(buffer,encoding,callback);
        console.log("SENDING BUFFER!");
      }).bind(this)];
    }
  }

  /**
   * Implements the readable interface
   * @private
   */
  _read() {
    console.log("CALLING READ");
  }


  /**
   * Not entirely sure what to pass here
   */
  listen() {
    console.log("CALLING LISTEN");
  }
}

module.exports = WebRTCTransport;
