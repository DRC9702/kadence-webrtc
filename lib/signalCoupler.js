var SimplePeer = require('simple-peer')
var cuid = require('cuid')
var EventEmitter = require('nanobus')

/**
 * SignalCoupler listens to signal packets from the signal-server and generates peers accordingly.
 */
class SignalCoupler extends EventEmitter{

  constructor(socket, nodeID){
    super();
    var self = this;
    self.nodeID = nodeID;
    self._peers = {};
    self._requests = {};
    self.socket = socket;

    if (self.socket.connected) {
      self.socket.emit('discover', self.nodeID);
    }

    // I think these are necessary but they aren't fixing my problem
    self.connect = self.connect.bind(self);
    self.rediscover = self.rediscover.bind(self);
    self.getRandomNodeId = self.getRandomNodeId.bind(self);
    

    self.socket.on('connect', self.onConnect.bind(self));
    self.socket.on('discover', self.onDiscover.bind(self));
    self.socket.on('offer', self.onOffer.bind(self));
    self.socket.on('answer', self.onAnswer.bind(self));
    self.socket.on('dispatch', self.onDispatch.bind(self));
  }

  /**
   * onConnect is called when the websocket between signalCoupler and the signal-server is connected
   * @param data
   */
  onConnect(data) {
    console.log("onConnect");

    var self = this;
    self.socket.emit('discover', self.nodeID);
  }

  /**
   * onDiscover is called when the signal-server returns "onDiscover" information
   * @param data
   */
  onDiscover(data) {
    console.log("onDiscover");
    self.emit('ready', data.metadata);
  }

  /**
   * onOffer is called when an offer through the signal-server arrives from a different node.
   * A peer is created and signalling information is exchanged.
   * @param data
   */
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
          self.socket.emit('answer', {
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

  /**
   * onAnswer is called when an answer is through the signal-server is received.
   * The corresponding peer is now fully connected and emitted.
   * @param data
   */
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

  /**
   * onDispatch is called when a different nodeID of the network is returned as a response to getRandomNodeId
   * @param data
   */
  onDispatch(data) {
    console.log("signal-client onDispatch");
    var self = this;
    self.emit('dispatch', {selfId: data.sourceId, targetId: data.targetId});
  }

  /**
   * Connect is called when the signalCoupler wants to create a peer connection to a different node.
   * A new peer is created and an offer is sent.
   * @param id
   * @param opts
   * @param metadata
   */
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
      self.socket.emit('offer', {
        signal: signal,
        trackingNumber: trackingNumber,
        targetId: id,
        metadata: metadata
      });
    });
  }

  /**
   * rediscover is called to re-obtain discovery info
   * @param metadata
   */
  rediscover(metadata) {
    console.log("rediscover");
    var self = this;
    metadata = metadata || {};
    self.socket.emit('discover', metadata);
  }

  /**
   * getRandomNodeId requests a random nodeID of a different node in the network fomr signal-server
   * @param nodeId
   */
  getRandomNodeId (nodeId) {
    var self = this;
    console.log("signal-client: getRandomNodeId");
    self.socket.emit('getRandomNodeId', nodeId);
  }
}


module.exports = SignalCoupler;
