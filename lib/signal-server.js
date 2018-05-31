`use strict`

const EventEmitter = require('events');
const randomInt = require('random-int');

class SignalServer extends EventEmitter {
  constructor (ioServer) {
    super();

    // this.sockets = {};
    this.nodeArray = [];
    this.nodeToSocket = {};
    this.socketToNode = {};

    ioServer.on('connection', this.onConnect.bind(this));
  }

  /**
   * connection event handler
   */
  onConnect(socket) {
    // this.sockets[socket.id] = socket;

    socket.on('disconnect', this.onDisconnect.bind(this, socket));
    socket.on('discover', this.onDiscover.bind(this, socket));
    socket.on('getRandomNodeId', this.onGetRandomNodeId.bind(this, socket));
    socket.on('offer', this.onOffer.bind(this, socket));
    socket.on('answer', this.onAnswer.bind(this, socket));
  }

  /**
   * disconnect event handler
   */
  onDisconnect(socket) {
    var self = this;
    var nodeID = self.socketToNode[socket];
    delete self.socketToNode[socket];
    delete self.nodeToSocket[nodeID];
    self.nodeArray = self.nodeArray.filter(e => e !== nodeID);
    this.emit('disconnect', socket);
  }

  /**
   * discover event handler
   */
  onDiscover(socket, nodeID) {
    console.log(`signalServer onDiscover - ${nodeID}`);
    var otherID = null;
    if(this.nodeArray.length > 0) {
      otherID = this.nodeArray[Math.floor(Math.random() * this.nodeArray.length)];
    }
    this.nodeArray.push(nodeID);
    this.nodeToSocket[nodeID] = socket;
    this.socketToNode[socket] = nodeID;

    console.log("nodeToSocket:");
    console.log(Object.keys(this.nodeToSocket));

    socket.emit('discover', otherID);
  }

  /**
   * getRandomNodeId event handler
   */
  onGetRandomNodeId(socket, nodeId) {
  }

  /**
   * offer event handler
   */
  onOffer(socket, data) {
    var self = this;
    console.log(`signalServer onOffer - ${data.srcID} -> ${data.dstID}`);

    console.log("nodeToSocket:");
    console.log(Object.keys(self.nodeToSocket));

    if(!self.nodeToSocket[data.dstID]) return;
    this.nodeToSocket[data.dstID].emit('offer', data);
  }

  /**
   * answer event handler
   */
  onAnswer(socket, data) {
    console.log(`signalServer onAnswer - ${data.srcID} -> ${data.dstID}`);
    if(!this.nodeToSocket[data.dstID]) return;
    this.nodeToSocket[data.dstID].emit('answer', data);
  }
}

module.exports = SignalServer;