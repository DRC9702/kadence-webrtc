`use strict`

const EventEmitter = require('events');
const randomInt = require('random-int');

class SignalServer extends EventEmitter {
  constructor (ioServer) {
    super();
    
    this.sockets = {};
    this.nodeArray = [];
    this.nodeToSocket = {};

    ioServer.on('connection', this.onConnect.bind(this));
  }

  /**
   * connection event handler
   */
  onConnect(socket) {
    this.sockets[socket.id] = socket;
  
    socket.on('disconnect', this.onDisconnect.bind(this, socket));
    socket.on('discover', this.onDiscover.bind(this, socket));
    socket.on('getRandomNodeId', this.onGetRandomNodeId.bind(this, socket));
    socket.on('offer', this.onOffer.bind(this, socket));
    socket.on('answer', this.onAnswer.bind(this, socket));
  }

  /**
   * getRandomNodeId event handler
   */
  onGetRandomNodeId(socket, nodeId) {

    console.log("signal-server: onGetRandomNodeId is called!");

    const size = this.nodeArray.length;
    var nodeIdRandom = 0;
    if (size > 1) {
      do {
        nodeIdRandom = randomInt(size - 1);
      }
      while (this.nodeArray[nodeIdRandom] === nodeId);
    } 

    socket.emit('dispatch', {
      sourceId: nodeId,
      targetId: this.nodeArray[nodeIdRandom]
    });
  }

  /**
   * disconnect event handler
   */
  onDisconnect(socket) {
    delete this.sockets[socket.id];
    this.emit('disconnect', socket);
  }

  /**
   * discover event handler
   */
  onDiscover(socket, nodeId) {
    this.nodeArray.push(nodeId);
    this.nodeToSocket[nodeId] = socket.id;
  }

  /**
   * offer event handler
   */
  onOffer(socket, data) {
    const targetSocketId = this.nodeToSocket[data.targetId];
    if (!this.sockets[targetSocketId]) return;
    this.sockets[targetSocketId].emit('offer', {
      id: socket.id,
      trackingNumber: data.trackingNumber,
      signal: data.signal,
      metadata: data.metadata
    });
    
  }

  /**
   * answer event handler
   */
  onAnswer(socket, data) {  
    if (!this.sockets[data.target]) return;
    this.sockets[data.target].emit('answer', {
      id: socket.id,
      trackingNumber: data.trackingNumber,
      signal: data.signal,
      metadata: data.metadata
    });
  }
}

module.exports = SignalServer;