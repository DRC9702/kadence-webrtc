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

    this.nodeToPeer = {};
    this.nodeToCallbacks = {};
    this._options = merge(WebRTCTransport.DEFAULTS, options);
    this.nodeID = options.nodeID;   
    console.log(`NodeId: ${this.nodeID}`);

    this.socket = io.connect('http://localhost:8080');
    this.signalClient = new simpleSignalClient(this.socket,this.nodeID.toString('hex'));
    this.signalClient.on('request', ((request) => {
      request.accept(null, this.nodeID); // Accept a request to connect
    }).bind(this));

    this.signalClient.on('peer', ((peer) => {
      this.nodeToPeer[peer.metadata]=peer;
      console.log('Connected!');

      peer.on('connect', (() => {
        var connectingID = peer.metadata;
        console.log(`Peer OnConnect! - ${connectingID}`);
        if(this.nodeToCallbacks[connectingID]) {
          this.nodeToCallbacks[connectingID].forEach((callback) => {
            callback();
          });
        }
        delete this.nodeToCallbacks[connectingID];

        peer.on('error', (err) => {
          console.log('error', err);
        });

        peer.on('data', ((data) => {
          this.push(data);
        }).bind(this));

      }).bind(this));
    }).bind(this));

  }

  /**
   * Implements the writable interface
   * @private
   */
  _write([id, buffer, target], encoding, callback) {
    var targetID = target[0];
    if(this.nodeID==targetID){
      this.push(buffer)
      callback();
    }
    else if(this.nodeToPeer[targetID]){
      this.nodeToPeer[targetID].write(buffer, encoding, callback);
    } else {
      this.signalClient.connect(targetID, null, this.nodeID);
      // try to wait for the connect. connect API does not support callback
      this.nodeToCallbacks[targetID] = [(() => {
        this.nodeToPeer[targetID].write(buffer, encoding, callback);
      }).bind(this)];
    }
  }

  /**
   * Implements the readable interface
   * @private
   */
  _read() {
  }


  /**
   * Not entirely sure what to pass here
   */
  listen() {
  }
}

module.exports = WebRTCTransport;
