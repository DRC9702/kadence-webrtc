var SimplePeer = require('simple-peer');
const utils = require('./utils');
const EventEmitter = require('events');

/**
 * NetworkCoupler listens to signal packets from the Peer-Network and generates peers accordingly.
 */
class NetworkCoupler extends EventEmitter{
  constructor(connectionManager, options) {
    super();
    this.connectionManager = connectionManager;
    this.options = options;
    this.nodeID = options.nodeID;
    this.nodeToHalfPeer = {};
    this.nodeToPath = {};

    this.sendSignal = this.sendSignal.bind(this);
    this.joinWithPeers = this.joinWithPeers.bind(this);
    this.handleSignal = this.handleSignal.bind(this);
    this.handleOffer = this.handleOffer.bind(this);
    this.handleAnswer = this.handleAnswer.bind(this);
    this.keepOrPass = this.keepOrPass.bind(this);
  }

  /**
   * joinWithPeers creates a Peer and sends signalling info for a connection
   * to be established with the intended destination
   * @param targetID
   */
  joinWithPeers(targetID){
    console.log("joinWithPeers");
    var peer = new SimplePeer({initiator: true, trickle: false });
    peer.metadata = targetID;
    this.nodeToHalfPeer[targetID] = peer;
    peer.on('signal', (function (data) {
      this.sendSignal(targetID, data);
    }).bind(this));

    this.emit('peer', peer);
  }

  /**
   * sendSignal wraps a peerSignal in a signal packet and sends it with the signalType:
   * - "forward": There already exists a path established to the destination
   * - "find": A path needs to be established as the signal reaches the destination
   * @param targetID
   * @param signal
   */
  sendSignal(targetID, signal) {
    console.log("Sending a signal [offer/answer]");
    if(this.nodeToPath[targetID]){
      var path = this.nodeToPath[targetID]
      var wrappedBuffer = JSON.stringify({packetType: 'signal',
        signalType: 'forward',
        path: path,
        source: this.nodeID,
        destination: targetID,
        data: signal});
      this.connectionManager.send(path[1],wrappedBuffer,null,null);
    }
    else {
      var wrappedBuffer = JSON.stringify({packetType: 'signal',
        signalType: 'find',
        path: [this.nodeID],
        source: this.nodeID,
        destination: targetID,
        data: signal});
      this.connectionManager.broadcast(wrappedBuffer, [], null, null);
    }
  }

  /**
   * handleSignal reads a signal packet and calls the proper handler depending
   * on whether the signal is an "offer" or "answer".
   * @param packet
   */
  handleSignal(packet) {
    console.log("handleSignal");
    var packetData = utils.getPacketData(packet);
    var sourceID = utils.getPacketSource(packet);
    if(packetData.type == "offer") {
      this.handleOffer(sourceID, packetData);
    }
    else if(packetData.type == "answer") {
      this.handleAnswer(sourceID, packetData);
    }
  }

  /**
   * handleOffer is called when a different node wants to establish a connection with this node - "offer" signal.
   * A peer is created with the signalling info passed in and returned back.
   * @param sourceID
   * @param signal
   */
  handleOffer(sourceID, signal) {
    console.log("handleOffer");
    // Check if a peer already exists (this means a peer here already sent an offer as well)
    // Compare nodeIds.
    // Lower id -> throw away offer and let other answer.
    // Higher id -> throw away peer and create peer to answer
    if(this.nodeToHalfPeer[sourceID] && this.nodeID < sourceID){
      console.log("THROWING AWAY OFFER!");
      return;
    }
    var peer = new SimplePeer({trickle: false});
    peer.metadata = sourceID;
    this.nodeToHalfPeer[sourceID] = peer;

    peer.on('signal', (function (data) {
      this.sendSignal(sourceID, data);
    }).bind(this));

    this.emit('peer', peer);
    peer.signal(signal);
  }

  /**
   * handleAnswer is called as a reply to this node's attempt to connect to a different node - "answer" signal.
   * The peer signals the answer directly and then emits a 'connect' event indicating the 2 peers are fully connected.
   * @param sourceID
   * @param signal
   */
  handleAnswer(sourceID, signal) {
    console.log("handleAnswer");
    console.log(this.constructor.name)
    var peer = this.nodeToHalfPeer[sourceID];
    peer.signal(signal);
  }

  /**
   * keepOrPass reads a signalPacket and determines whether to keep it (and handle it)
   * or pass it along in the proper fashion.
   * @param packet
   * @param nodeList
   */
  keepOrPass(packet, nodeList) {
    console.log("keepOrPass");
    var signalType = utils.getPacketSignalType(packet);
    var destination = utils.getPacketDestination(packet);
    var source = utils.getPacketSource(packet);
    if(signalType == 'forward'){
      if(destination == this.nodeID){
        console.log("KEEP");
        if (nodeList.includes(source)){
          //There already exists a peer between these two. Throw this away
          return
        }
        else{
          // Set the reverse path
          var path = utils.getPacketPath(packet);
          path.reverse();
          this.nodeToPath[source] = path;
          //Process Signal
          this.handleSignal(packet);
        }
      }
      else {
        console.log("PASS");
        var interNode = packet.path[packet.path.indexOf(this.nodeID) + 1];
        this.connectionManager.send(interNode, JSON.stringify(packet), null, null)
        // this.nodeToPeer[interNode].send(JSON.stringify(packet));
      }
    }
    else if(signalType == 'find') {
      if(destination == this.nodeID){
        console.log("KEEP");
        if (this.nodeToPath[source]){
          //There already exists a path channel between the two, throw this away
          return
        }
        else{
          // Set the path
          var path = utils.getPacketPath(packet);
          path.push(this.nodeID);
          path = path.reverse();
          this.nodeToPath[source] = path;
          //Process signal
          this.handleSignal(packet);
        }
      }
      else if(utils.getPacketPath(packet).length <= this.options.searchLimit) {
        console.log("PASS");
        //Append this node id to the path
        packet.path.push(this.nodeID);
        //Recurse find to all neighbors not in path (avoid cycles)
        this.connectionManager.broadcast(JSON.stringify(packet),utils.getPacketPath(packet),null, null);
      }
    }
  }

}

module.exports = NetworkCoupler;