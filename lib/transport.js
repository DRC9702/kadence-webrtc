'use strict';

const { Duplex : DuplexStream } = require('stream');
const merge = require('merge');
var kadence = require('@kadenceproject/kadence');
var signalClient = require('./signal-client');

class WebRTCTransport extends DuplexStream {

  static get DEFAULTS() {
    return {connectionLimit : 10};
  }


  constructor(options) {
    super({ objectMode: true });

    this._options = merge(WebRTCTransport.DEFAULTS, options);
    this.nodeID = options.nodeID;
    console.log(`NodeId: ${this.nodeID}`);

    this.socket = io.connect('http://localhost:8080', { transports: ['websocket'] });
    this.signalClient = new signalClient(this.socket, this.nodeID.toString('hex'), this, this._options);
  }


  /**
   * Implements the writable interface
   * @private
   */
  _write([id, buffer, target], encoding, callback) {
    var targetID = target[0];
    this.signalClient.send(this.nodeID, targetID, buffer, encoding, callback);
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
