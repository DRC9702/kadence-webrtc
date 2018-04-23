var signalClient = require("./signal-client");
var SimplePeer = require('simple-peer');
const EventEmitter = require('events');

class MessageClient extends EventEmitter{

  constructor(socket, nodeID, writableStream, options) {
    super();
    this.writableStream = writableStream;
    this._options = options;
    this.nodeID = options.nodeID;
    this.socket = socket;
    this.signalClient = new signalClient(socket, nodeID);
    this.nodeToPeer = {};
    this.nodeToHalfPeer = {};
    this.nodeToCallbacks = {};
    this.nodeList = [];
    this.nodeToPath = {};
    this.hasNodeConnection = this.hasNodeConnection.bind(this);
    this.removeNodeConnection = this.removeNodeConnection.bind(this);
    this.updateNodeConnectionList = this.updateNodeConnectionList.bind(this);
    this.addNodeConnection = this.addNodeConnection.bind(this);

    this.joinWithPeers = this.joinWithPeers.bind(this);
    this.sendSignal = this.sendSignal.bind(this);
    this.keepOrPass = this.keepOrPass.bind(this);
    this.handleSignal = this.handleSignal.bind(this);
    this.handleOffer = this.handleOffer.bind(this);
    this.handleAnswer = this.handleAnswer.bind(this);

    this.signalClient.on('request', ((request) => {
      request.accept(null, this.nodeID); // Accept a request to connect
    }).bind(this));

    this.signalClient.on('peer', ((peer) => {
      console.log('Connected!');

      peer.on('connect', this.peerConnectHandler.bind(this, peer));
    }).bind(this));

  }

  joinWithPeers(nodeID, targetID){
    console.log("joinWithPeers");
    var peer = new SimplePeer({initiator: true, trickle: false });
    peer.metadata = targetID;
    this.nodeToHalfPeer[targetID] = peer;
    peer.on('signal', (function (data) {
      this.sendSignal(nodeID, targetID, data);
    }).bind(this));

    peer.on('connect', this.peerConnectHandler.bind(this, peer));
  }

  sendSignal(nodeID, targetID, signal) {
    console.log("Sending a signal [offer/answer]");
    if(this.nodeList.length == 0){
      throw err("Nope!");
    }
    else if(this.nodeToPath[targetID]){
      var path = this.nodeToPath[targetID]
      var wrappedBuffer = JSON.stringify({packetType: 'signal',
        signalType: 'forward',
        path: path,
        source: nodeID,
        destination: targetID,
        data: signal});
      this.nodeToPeer[path[1]].send(wrappedBuffer);
    }
    else {
      var wrappedBuffer = JSON.stringify({packetType: 'signal',
        signalType: 'find',
        path: [this.nodeID],
        source: nodeID,
        destination: targetID,
        data: signal});
      this.nodeList.forEach((node) => {
        this.nodeToPeer[node].send(wrappedBuffer);
      });
    }
  }

  keepOrPass(packet) {
    console.log("keepOrPass");
    var signalType = this.getSignalType(packet);
    var destination = this.getPacketDestination(packet);
    var source = this.getPacketSource(packet);
    if(signalType == 'forward'){
      if(destination == this.nodeID){
        console.log("KEEP");
        if (this.nodeList.includes(source)){
          //There already exists a peer between these two. Throw this away
          return
        }
        else{
          // Set the reverse path
          var path = this.getPacketPath(packet);
          path.reverse();
          this.nodeToPath[source] = path;
          //Process Signal
          this.handleSignal(packet);
        }
      }
      else {
        console.log("PASS");
        var interNode = packet.path[packet.path.indexOf(this.nodeID) + 1];
        this.nodeToPeer[interNode].send(JSON.stringify(packet));
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
          var path = this.getPacketPath(packet);
          path.push(this.nodeID);
          path = path.reverse();
          this.nodeToPath[source] = path;
          //Process signal
          this.handleSignal(packet);
        }
      }
      else if(this.getPacketPath(packet).length <= this._options.searchLimit) {
        console.log("PASS");
        //Append this node id to the path
        packet.path.push(this.nodeID);
        //Recurse find to all neighbors not in path (avoid cycles)
        this.nodeList.forEach((node) => {
          if(!this.getPacketPath(packet).includes(node)) {
            this.nodeToPeer[node].send(JSON.stringify(packet));
          }
        });
      }
    }
  }

  handleSignal(packet) {
    var packetData = this.getPacketData(packet);
    var sourceID = this.getPacketSource(packet);
    if(packetData.type == "offer") {
      this.handleOffer(sourceID, packetData);
    }
    else if(packetData.type == "answer") {
      this.handleAnswer(sourceID, packetData);
    }
  }

  handleOffer(sourceID, signal) {
    console.log("handleOffer");
    var peer = new SimplePeer({trickle: false});
    peer.metadata = sourceID;
    this.nodeToHalfPeer[sourceID] = peer;

    peer.on('signal', (function (data) {
      this.sendSignal(this.nodeID, sourceID, data);
    }).bind(this));

    peer.on('connect', this.peerConnectHandler.bind(this, peer));

    peer.signal(signal);
  }

  handleAnswer(sourceID, signal) {
    console.log("handleAnswer");
    var peer = this.nodeToHalfPeer[sourceID];
    peer.signal(signal);
  }

  // 4 types of signals: find, request, findReply
  getSignalType(packet){
    return packet.signalType;
  }

  // Tells you 'message' or 'signal'
  getPacketType(packet) {
    return packet.packetType;
  }

  // Get's the data from packet
  getPacketData(packet) {
    return packet.data;
  }

  getPacketSource(packet){
    return packet.source;
  }

  getPacketDestination(packet){
    return packet.destination;
  }

  getPacketPath(packet){
    return packet.path;
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
    delete this.nodeToPath[targetID];
    //this._options
  }

  // Wraps the buffer in 'message' and sends it up
  // {packetType: 'message', data: buffer}
  sendMessage(nodeID, targetID, buffer, encoding, callback){
    // If id is this node, push directly into stream
    var wrappedBuffer = JSON.stringify({packetType: 'message', data: buffer});
    if(nodeID==targetID){
      this.writableStream.push(buffer);
      callback();
    }
    // If there is already a peer for this id, use it
    else if(this.hasNodeConnection(targetID)){
      this.nodeToPeer[targetID].write(wrappedBuffer, encoding, callback);
    } 
    // If there is no peer for this id, make one
    else {
      // If there currently aren't any peers, signal the server
      if(this.nodeList.length == 0) {
        this.signalClient.connect(targetID, null, nodeID);
      }
      else {
        console.log("USING PEER CONNECTIONS!");
        this.joinWithPeers(nodeID, targetID);
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
      var packetType = this.getPacketType(wrappedPacket);
      if (packetType == 'message') {
        var buffer = Buffer.from(this.getPacketData(wrappedPacket));
        this.writableStream.push(buffer);
      }
      else if (packetType == 'signal') {
        this.keepOrPass(wrappedPacket);
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

module.exports = MessageClient;