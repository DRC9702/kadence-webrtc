var EventEmitter = require('nanobus');

class SignalServer extends EventEmitter {
  constructor (io) {
    super();
    var self = this;

    if (!(self instanceof SignalServer)) return new SignalServer(io);
  
    EventEmitter.call(self);
  
    self._sockets = {};
    self.peers = [];
  
    io.on('connection', self._onConnect.bind(self));
  }

  _onConnect(socket) {
    var self = this;
    self._sockets[socket.id] = socket;
  
    socket.on('disconnect', self._onDisconnect.bind(self, socket));
    socket.on('simple-signal[discover]', self._onDiscover.bind(self, socket));
    socket.on('simple-signal[getRandomNodeId]', self._onGetRandomNodeId.bind(self, socket));
    socket.on('simple-signal[offer]', self._onOffer.bind(self, socket));
    socket.on('simple-signal[answer]', self._onAnswer.bind(self, socket));
  
    self.emit('connect', socket);
  }


  _onGetRandomNodeId(socket, metadata) {
    console.log("signal-server: _onGetRandomNodeId is called!");
    var self = this;

    self.emit('dispatch', {
      initiator: { // Duplicate to match request.initiator.id
        id: socket.id
      },
      id: socket.id,
      metadata: metadata,
      dispatch: function (data) {
        console.log("signal-server: dispatch is called, about to emit simple-signal[dispatch]");
        socket.emit('simple-signal[dispatch]', {
          id: data.selfId,
          targetId: data.targetId
        })
      }
    });
  }


  _onDisconnect(socket) {
    var self = this;
  
    delete self._sockets[socket.id];
    self.emit('disconnect', socket);
  }

  _onDiscover(socket, metadata) {
    var self = this;
  
    if (self.listeners('discover').length === 0) {
      socket.emit('simple-signal[discover]', {
        id: socket.id
      });
      return;
    }

    self.emit('discover', {
      initiator: { // Duplicate to match request.initiator.id
        id: socket.id
      },
      id: socket.id,
      metadata: metadata,
      discover: function (metadata) {
        socket.emit('simple-signal[discover]', {
          id: socket.id,
          metadata: metadata
        })
      }
    });
    self.peers.push(socket.id);
  }

  _onOffer(socket, data) {
    var self = this;
  
    if (self.listeners('request').length === 0) {
      // Automatically forward if no handlers
      if (!self._sockets[data.target]) return;
      self._sockets[data.target].emit('simple-signal[offer]', {
        id: socket.id,
        trackingNumber: data.trackingNumber,
        signal: data.signal,
        metadata: data.metadata || {}
      });
      return;
    }
  
    self.emit('request', {
      initiator: {
        id: socket.id
      },
      receiver: {
        id: data.target
      },
      metadata: data.metadata || {},
      forward: function (target, metadata) {
        target = target || data.target || {}
        metadata = metadata || data.metadata || {}
        if (!self._sockets[target]) return;
        self._sockets[target].emit('simple-signal[offer]', {
          id: socket.id,
          trackingNumber: data.trackingNumber,
          signal: data.signal,
          metadata: metadata
        })
      }
    });
  }

  _onAnswer(socket, data) {
    var self = this;
  
    // Answers are always forwarded
    if (!self._sockets[data.target]) return;
    self._sockets[data.target].emit('simple-signal[answer]', {
      id: socket.id,
      trackingNumber: data.trackingNumber,
      signal: data.signal,
      metadata: data.metadata || {}
    });
  }
}

module.exports = SignalServer;
