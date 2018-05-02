var EventEmitter = require('nanobus');
var randomInt = require('random-int');


class SignalServer extends EventEmitter {
  constructor (ioServer) {
    super();
    var self = this;
    
    self.sockets = {};
    self.nodeArray = [];
    self.nodeToSocket = {};
  
    ioServer.on('connection', self.onConnect.bind(self));

  }

  onConnect(socket) {
    var self = this;
    self.sockets[socket.id] = socket;
  
    socket.on('disconnect', self.onDisconnect.bind(self, socket));
    socket.on('discover', self.onDiscover.bind(self, socket));
    socket.on('getRandomNodeId', self.onGetRandomNodeId.bind(self, socket));
    socket.on('offer', self.onOffer.bind(self, socket));
    socket.on('answer', self.onAnswer.bind(self, socket));
  }

  onGetRandomNodeId(socket, nodeId) {

    console.log("signal-server: onGetRandomNodeId is called!");
    var self = this;

    const size = self.nodeArray.length;
    var nodeIdRandom = 0;
    if (size > 1) {
      do {
        nodeIdRandom = randomInt(size - 1);
      }
      while (self.nodeArray[nodeIdRandom] === nodeId);
    } 
    socket.emit('dispatch', {
      sourceId: nodeId,
      targetId: self.nodeArray[nodeIdRandom]
    });
  }

  onDisconnect(socket) {
    var self = this;
  
    delete self.sockets[socket.id];
    self.emit('disconnect', socket);
  }

  onDiscover(socket, nodeId) {
    var self = this;

    self.nodeArray.push(nodeId);
    self.nodeToSocket[nodeId] = socket.id;
    // console.log(JSON.stringify(self.nodeToSocket));
  }

  onOffer(socket, data) {
    console.log("signal-server: onOffer");
    var self = this;

    const targetSocketId = self.nodeToSocket[data.targetId];
    if (!self.sockets[targetSocketId]) return;
    self.sockets[targetSocketId].emit('offer', {
      id: socket.id,
      trackingNumber: data.trackingNumber,
      signal: data.signal,
      metadata: data.metadata
    });
    
  }

  onAnswer(socket, data) {
    var self = this;
  
    // Answers are always forwarded
    if (!self.sockets[data.target]) return;
    self.sockets[data.target].emit('answer', {
      id: socket.id,
      trackingNumber: data.trackingNumber,
      signal: data.signal,
      metadata: data.metadata
    });
  }
}

module.exports = SignalServer;
