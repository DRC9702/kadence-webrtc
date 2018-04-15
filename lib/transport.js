'use strict';

const { Duplex : DuplexStream } = require('stream');
const merge = require('merge');
var kadence = require('@kadenceproject/kadence');
var simpleSignalClient = require("simple-signal-client")

class WebRTCTransport extends DuplexStream {

  static get DEFAULTS() {
    return {connectionLimit : 10};
  }


  constructor(options) {
    super({ objectMode: true });

    this.nodeToPeer = {};
    this.nodeToCallbacks = {};
    this.nodeList = [];
    this.hasNodeConnection = this.hasNodeConnection.bind(this);
    this.removeNodeConnection = this.removeNodeConnection.bind(this);
    this.updateNodeConnectionList = this.updateNodeConnectionList.bind(this);
    this.addNodeConnection = this.addNodeConnection.bind(this);

    this._options = merge(WebRTCTransport.DEFAULTS, options);
    this.nodeID = options.nodeID;
    console.log(`NodeId: ${this.nodeID}`);

    this.socket = io.connect('http://160.39.246.52:8080');
    this.signalClient = new simpleSignalClient(this.socket,this.nodeID.toString('hex'));
    this.signalClient.on('request', ((request) => {
      request.accept(null, this.nodeID); // Accept a request to connect
    }).bind(this));

    this.signalClient.on('peer', ((peer) => {
      this.addNodeConnection(peer.metadata,peer);
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
          this.updateNodeConnectionList(connectingID);
          this.push(data);
        }).bind(this));

        peer.on('close', (() => {
          this.removeNodeConnection(connectingID);
        }).bind(this));

      }).bind(this));
    }).bind(this));

  }

  removeNodeConnection(targetID) {
    if(this.nodeToPeer[targetID]){
      this.nodeToPeer[targetID].destroy()
    }
    if(this.nodeList.includes(targetID)){
      var index = this.nodeList.indexOf(targetID);
      this.nodeList.splice(index,1);
    }
    delete this.nodeToPeer[targetID];
  }

  hasNodeConnection(targetID) {
    if(!this.nodeToPeer[targetID]) {
      return false;
    }
    else if(this.nodeToPeer[targetID].destroyed){
        this.removeNodeConnection(targetID);
        return false;
    } else{
      return true;
    }
  }

  updateNodeConnectionList(targetID){
    if(this.nodeList.includes(targetID)){
      var index = this.nodeList.indexOf(targetID);
      this.nodeList.splice(index,1);
      this.nodeList.unshift(targetID);
    }
  }

  addNodeConnection(targetID, peer){
    if(this.nodeList.length <= this._options.connectionLimit){
      this.nodeToPeer[targetID]=peer;
      this.nodeList.unshift(targetID);
    }
    else{
      var removedID = this.nodeList.peekBack();
      this.removeNodeConnection(removedID)
      his.nodeToPeer[targetID]=peer;
      this.nodeList.unshift(targetID);
    }
    //this._options
  }

  /**
   * Implements the writable interface
   * @private
   */
  _write([id, buffer, target], encoding, callback) {
    var targetID = target[0];

    // If id is this node, push directly into stream
    if(this.nodeID==targetID){
      this.push(buffer);
      callback();
    }
    // If there is already a peer for this id, use it
    else if(this.hasNodeConnection(targetID)){
      this.nodeToPeer[targetID].write(buffer, encoding, callback);
    } // If there is no peer for this id, make one
    else {
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
