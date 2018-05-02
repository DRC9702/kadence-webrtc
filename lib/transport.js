'use strict';

const { Duplex : DuplexStream } = require('stream');
const merge = require('merge');
var kadence = require('@kadenceproject/kadence');
var ConnectionManager = require('./connectionManager');

class WebRTCTransport extends DuplexStream {

  static get DEFAULTS() {
    return {connectionLimit : 10,
            searchLimit: 5};
  }


  constructor(options) {
    super({ objectMode: true });

    this.options = merge(WebRTCTransport.DEFAULTS, options);
    this.nodeID = options.nodeID;
    console.log(`Transport: NodeId: ${this.nodeID}`);

    this.connectionManager = new ConnectionManager(this, this.options);
  }

  /**
   * Implements the writable interface
   * @private
   */
  _write([id, buffer, target], encoding, callback) {
    var targetID = target[0];
    this.connectionManager.sendMessage(targetID, buffer, encoding, callback);
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
