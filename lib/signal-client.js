var SimplePeer = require('simple-peer')
var cuid = require('cuid')
var EventEmitter = require('nanobus')

class SignalClient extends EventEmitter{

  constructor(socket, metadata){
    super();
    var self = this;
    metadata = metadata || {};
    this._peers = {};
    self._requests = {};
    self.socketID = null;
    self.socket = socket;

    // Get own socket.id
    socket.on2('connect', function () {
      socket.emit('sc[discover]', metadata)
    })
    if (socket.socket.connected) {
      socket.emit('sc[discover]', metadata)
    }

    // I think these are necessary but they aren't fixing my problem
    this.connect = this.connect.bind(this);
    this.rediscover = this.rediscover.bind(this);

    socket.on2('simple-signal[discover]', self.onDiscover.bind(self));
    socket.on2('simple-signal[offer]', self.onOffer.bind(self));
    socket.on2('simple-signal[answer]', self.onAnswer.bind(self));
    socket.on2('simple-signal[dispatch]', self.onDispatch.bind(self));

  }

  onDiscover(data) {
    console.log("onDiscover");
    var self = this;

    self.socketID = data.id;
    self.emit('ready', data.metadata);
  }

  onOffer(data) {
    console.log("onOffer");
    var self = this;

    // Check if request already exists for this tracking number
    if (self._requests[data.trackingNumber]) {
      // Check if peer exists for this tracking number
      if (self._peers[data.trackingNumber]) {
        self._peers[data.trackingNumber].signal(data.signal);
      } // There's no peer for this tracking number but the request exists
      else {
        // Add signalling data to record for this request
        self._requests[data.trackingNumber].push(data.signal);
      }
      return
    }

    // No request in progress for this tracking number, start recording signalling data
    self._requests[data.trackingNumber] = [data.signal];
    // Emit the request
    // Create 'request' event handler that will create the peer for the tracking number
    self.emit('request', {
      id: data.id,
      metadata: data.metadata || {},
      accept: function(opts, metadata) {
        opts = opts || {};
        metadata = metadata || {};
        opts.initator = false;
        var peer = new SimplePeer(opts);

        peer.id = data.id;
        peer.metadata = data.metadata || {};
        self._peers[data.trackingNumber] = peer;
        self.emit('peer', peer); //Peer created!

        peer.on('signal', function(signal) {
          self.socket.emit('sc[answer]', {
            signal: signal,
            trackingNumber: data.trackingNumber,
            target: data.id,
            metadata: metadata
          });
        });

        // Resolve all the signals recorded for this request's tracking number
        self._requests[data.trackingNumber].forEach(function(request) {
          peer.signal(request);
        });
        self._requests[data.trackingNumber] = [];
      }
    });
  }

  onAnswer(data) {
    console.log("onAnswer")
    var self = this;
    var peer = self._peers[data.trackingNumber];
    // If there's no peer for this, return because you can't answer without offer
    if (!peer) {
      return;
    }
    // Update id. If this peer didn't already have an id,  give it metadata
    if(peer.id) {
      peer.id = data.id
    } else {
      peer.id = data.id;
      peer.metadata = data.metadata;
      self.emit('peer', peer);
    }

    peer.signal(data.signal);
  }

  onDispatch(data) {
    console.log("signal-client onDispatch");
    var self = this;
    self.emit('dispatch', {selfId: data.id, targetId: data.targetId});
  }

  connect(id, opts, metadata) {
    console.log("connect");
    var self = this;

    opts = opts || {};
    metadata = metadata || {};

    opts.initiator = true;
    var trackingNumber = cuid();

    var peer = new SimplePeer(opts);
    self._peers[trackingNumber] = peer;

    peer.on('signal', function (signal) {
      self.socket.emit('sc[offer]', {
        signal: signal,
        trackingNumber: trackingNumber,
        target: id,
        metadata: metadata
      });
    });
  }

  rediscover(metadata) {
    console.log("rediscover");
    var self = this;
    metadata = metadata || {};
    self.socket.emit('sc[discover]', metadata);
  }

  getRandomNodeId (metadata) {
    var self = this;
    console.log("signal-client: getRandomNodeId");
    self.socket.emit('sc[getRandomNodeId]', metadata);
  }

}


module.exports = SignalClient;
SignalClient.SimplePeer = SimplePeer