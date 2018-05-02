var signalCoupler = require("./signalCoupler");
var networkCoupler = require("./networkCoupler");
var SimplePeer = require('simple-peer');
const utils = require('./utils');
const EventEmitter = require('events');

class ConnectionManager extends EventEmitter{

  constructor(writableStream, options) {
    super();
    this.writableStream = writableStream;
    this.options = options;
    this.nodeID = options.nodeID;

    this.socket = this.socket = io.connect('http://localhost:8080', { transports: ['websocket'] });
    this.socket.on('connect', ()=>{
      console.log(`Transport: SocketId: ${this.socket.id}`);
    });

    this.networkCoupler = new networkCoupler(this, options);
    this.signalCoupler = new signalCoupler(this.socket, this.nodeID);
    this.nodeToPeer = {};
    this.nodeToCallbacks = {};
    this.nodeList = [];
    this.hasNodeConnection = this.hasNodeConnection.bind(this);
    this.removeNodeConnection = this.removeNodeConnection.bind(this);
    this.updateNodeConnectionList = this.updateNodeConnectionList.bind(this);
    this.addNodeConnection = this.addNodeConnection.bind(this);

    this.signalCoupler.on('request', ((request) => {
      request.accept(null, this.nodeID); // Accept a request to connect
    }).bind(this));

    this.signalCoupler.on('peer', ((peer) => {
      console.log('Connected By SignalCoupler!');

      peer.on('connect', this.peerConnectHandler.bind(this, peer));
    }).bind(this));

    this.networkCoupler.on('peer', ((peer) => {
      console.log('Connected By NetworkCoupler!');
      peer.on('connect', this.peerConnectHandler.bind(this, peer));
    }).bind(this));

  }


  removeNodeConnection(targetID) {
    if(this.nodeToPeer[targetID]){
      this.nodeToPeer[targetID].destroy()
    }
    if(this.nodeList.includes(targetID)){
      var index = this.nodeList.indexOf(targetID);
      this.nodeList.splice(index, 1);
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
      this.nodeList.splice(index, 1);
      this.nodeList.unshift(targetID);
    }
  }

  addNodeConnection(targetID, peer){
    if(this.nodeList.length <= this.options.connectionLimit){
      this.nodeToPeer[targetID]=peer;
      this.nodeList.unshift(targetID);
    }
    else{
      var removedID = this.nodeList.peekBack();
      this.removeNodeConnection(removedID)
      his.nodeToPeer[targetID]=peer;
      this.nodeList.unshift(targetID);
    }
    delete this.networkCoupler.nodeToPath[targetID];
  }


  // Wraps the buffer in 'message' and sends it up
  // {packetType: 'message', data: buffer}
  sendMessage(targetID, buffer, encoding, callback) {
    var wrappedBuffer = JSON.stringify({packetType: 'message', data: buffer});
    // If id is this node, push directly into stream
    if(this.nodeID==targetID){
      this.writableStream.push(buffer);
      callback();
    }
    else {
      this.send(targetID, wrappedBuffer, encoding, callback)
    }
  }

  broadcast(wrappedBuffer, excludeList, encoding, callback) {
    this.nodeList.forEach((nodeID) => {
      if(!excludeList.includes(nodeID)) {
        this.send(nodeID, wrappedBuffer, null, null);
      }
    });
  }

  send(targetID, wrappedBuffer, encoding, callback){
    // If there is already a peer for this id, use it
    if(this.hasNodeConnection(targetID)){
      this.nodeToPeer[targetID].write(wrappedBuffer, encoding, callback);
    } 
    // If there is no peer for this id, make one
    else {
      // If there currently aren't any peers, signal the server
      if(this.nodeList.length == 0) {
        this.signalCoupler.connect(targetID, null, this.nodeID);
      }
      else {
        console.log("USING PEER CONNECTIONS!");
        console.log(this.nodeID);
        this.networkCoupler.joinWithPeers(this.nodeID, targetID);
      }
      // Once connected, send the message
      this.nodeToCallbacks[targetID] = [(() => {
        this.nodeToPeer[targetID].write(wrappedBuffer, encoding, callback);
      }).bind(this)];
    }
  }

  peerConnectHandler(peer){
    var connectingID = peer.metadata;
    this.addNodeConnection(connectingID,peer);
    console.log(`Peer OnConnect! - ${connectingID}`);
    if(this.nodeToCallbacks[connectingID]) {
      this.nodeToCallbacks[connectingID].forEach((callback) => {
        callback();
      });
    }
    delete this.nodeToCallbacks[connectingID];

    var peerErrorHandler = function(err) {
      console.log('error', err);
    };

    var peerDataHandler = function (wrappedBuffer) {
      var wrappedPacket = JSON.parse(wrappedBuffer.toString());
      var packetType = utils.getPacketType(wrappedPacket);
      if (packetType == 'message') {
        var buffer = Buffer.from(utils.getPacketData(wrappedPacket));
        this.writableStream.push(buffer);
      }
      else if (packetType == 'signal') {
        this.networkCoupler.keepOrPass(wrappedPacket, this.nodeList);
      }
      this.updateNodeConnectionList(connectingID);
    };

    var peerCloseHandler = function() {
      var connectingID = peer.metadata;
      this.removeNodeConnection(connectingID);
    };

    peer.on('error', peerErrorHandler);

    peer.on('data', peerDataHandler.bind(this));

    peer.on('close', peerCloseHandler.bind(this));
  }
}

module.exports = ConnectionManager;