const coupler = require('./coupler');
var SimplePeer = require('simple-peer');
var cuid = require('cuid');
var EventEmitter = require('nanobus');
const io = require('socket.io-client');
const merge = require('merge');


/**
 * SignalCoupler listens to signal packets from the signal-server and generates peers accordingly.
 */
class SignalCoupler extends coupler{

  constructor(options){
    super(options);
    console.log("signalCoupler constructor");

    this.nodeID = options.nodeID;
    this.nodeToRequest = {};
    this.nodeToHalfPeer = {};

    this.socket = io.connect('http://'+options.host+':'+options.port, { transports: ['websocket'] });
    this.socket.on('connect', ()=>{
      console.log(`Transport: SocketId: ${this.socket.id}`);
    });

    this.connect = this.connect.bind(this);
    this.socket.on('connect', this.onConnect.bind(this));

  }

  /**
   * onConnect is called when the websocket between signalCoupler and the signal-server is connected
   * @param data
   */
  onConnect(data) {
    console.log("signalCoupler onConnect");
    this.socket.emit('discover', this.nodeID);

    this.socket.on('discover', this.onDiscover.bind(this));
    this.socket.on('offer', this.onOffer.bind(this));
    this.socket.on('answer', this.onAnswer.bind(this));
  }

  /**
   * onDiscover is called when the signal-server returns "onDiscover" information
   * @param data
   */
  onDiscover(otherID) {
    console.log("signalCoupler onDiscover");
    if(otherID !== null){
      console.log(`Got an ID to connect to: ${otherID}`);
      // this.connect(otherID, null, {priority: true});
    }
    else{
      console.log("No other nodes found by signalServer");
    }
  }

  /**
   * onOffer is called when an offer through the signal-server arrives from a different node.
   * A peer is created and signalling information is exchanged.
   * @param data
   */
  onOffer(data) {
    console.log("signalCoupler onOffer");
    var self = this;
    if(data.dstID !== self.nodeID) return;

    // Check if request is already in progress for this nodeID
    if(self.nodeToRequest[data.srcID]){
      // Check if there's already a peer in progress for this nodeID
      if(self.nodeToHalfPeer[data.srcID]){
        self.nodeToHalfPeer[data.srcID].signal(data.signal);
      } // There's no peer yet, but there is a request in progress
      else {
        // Store the signal to pass when half-peer is established
        self.nodeToRequest[data.srcID].push(data.signal);
      }
      return;
    }

    // No request in progress for this nodeID, start recording signalling data
    self.nodeToRequest[data.srcID] = [data.signal];

    self.emit('request', { // Let the connectionManager decide whether or not to connect
      priority: data.metadata.priority,
      srcID: data.srcID,
      accept: function(opts, metadata){
        opts = opts || {};
        metadata = metadata || {};
        metadata = merge(data.metadata, metadata);
        opts.initiator = false;
        var peer = new SimplePeer(opts);

        peer.metadata = data.metadata;
        peer.nodeID = data.srcID;
        self.nodeToHalfPeer[data.srcID] = peer;
        self.emit('peer', peer); // Peer is created and sent up to connection manager!

        // When the peer is ready to answer, send it through socket
        peer.on('signal', function(signal){
          self.socket.emit('answer', {
            signal: signal,
            srcID: self.nodeID,
            dstID: data.srcID,
            metadata: metadata
          });
        });

        // When the half-peer has been established, feed it all the requests
        self.nodeToRequest[data.srcID].forEach(function(signal){
          peer.signal(signal);
        });
        self.nodeToRequest[data.srcID] = [];
      }
    });
  }

  /**
   * onAnswer is called when an answer is through the signal-server is received.
   * The corresponding peer is now fully connected and emitted.
   * @param data
   */
  onAnswer(data) {
    console.log("signalCoupler onAnswer")
    var self = this;
    var peer = self.nodeToHalfPeer[data.srcID];
    if(!peer) return;

    if(peer.nodeID) {
      peer.nodeID = data.srcID;
    } else{
      peer.nodeID = data.srcID;
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
  }

  /**
   * Connect is called when the signalCoupler wants to create a peer connection to a different node.
   * A new peer is created and an offer is sent.
   * @param dstID
   * @param opts
   * @param metadata
   */
  connect(dstID, opts, metadata) {
    console.log("signalCoupler connect");
    var self = this;
    var options = merge({initiator: true, trickle: false }, opts);
    var peer = new SimplePeer(options);
    peer.metadata = metadata;
    self.nodeToHalfPeer[dstID] = peer;
    peer.on('signal', ((signal)=>{
      self.socket.emit('offer', {
        signal: signal,
        srcID: self.nodeID,
        dstID: dstID,
        metadata: metadata
      });
    }).bind(self));
  }

  /**
   * rediscover is called to re-obtain discovery info
   * @param metadata
   */
  rediscover(metadata) {
  }

  /**
   * getRandomNodeId requests a random nodeID of a different node in the network fomr signal-server
   * @param nodeId
   */
  getRandomNodeId (nodeId) {
  }

  packetHandler(packet) {
    // Do Nothing. signalCoupler doesn't need to intercept signalPackets
  }
}


module.exports = SignalCoupler;
