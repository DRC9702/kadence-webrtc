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
    this.simpleSignalClient = new signalClient(socket, nodeID);
    this.nodeToPeer = {};
    this.nodeToCallbacks = {};
    this.nodeList = [];
    this.nodeToPath = {};
    this.trackingNumberToNode = {}
    this.hasNodeConnection = this.hasNodeConnection.bind(this);
    this.removeNodeConnection = this.removeNodeConnection.bind(this);
    this.updateNodeConnectionList = this.updateNodeConnectionList.bind(this);
    this.addNodeConnection = this.addNodeConnection.bind(this);


    this.joinWithPeers = this.joinWithPeers.bind(this);
    this.sendOffer = this.sendOffer.bind(this);

    this.handleSignal = this.handleSignal.bind(this);
    this.handleOffer = this.handleOffer.bind(this);

    this.simpleSignalClient.on('request', ((request) => {
      request.accept(null, this.nodeID); // Accept a request to connect
    }).bind(this));

    this.simpleSignalClient.on('peer', ((peer) => {
      console.log('Connected!');

      peer.on('connect', (() => {
        var connectingID = peer.metadata;
        this.addNodeConnection(connectingID,peer);
        console.log(`Peer OnConnect! - ${connectingID}`);
        if(this.nodeToCallbacks[connectingID]) {
          this.nodeToCallbacks[connectingID].forEach((callback) => {
            callback();
          });
        }
        delete this.nodeToCallbacks[connectingID];

        peer.on('error', (err) => {
          console.log('error', err);
        });

        peer.on('data', ((wrappedBuffer) => {
          this.updateNodeConnectionList(connectingID);
          var wrappedPacket = JSON.parse(wrappedBuffer.toString());
          var packetType = this.getPacketType(wrappedPacket);
          if (packetType == 'message') {
            var buffer = Buffer.from(this.getPacketData(wrappedPacket));
            this.writableStream.push(buffer);
          }
          else if (packetType == 'signal') {
            this.handleSignal(wrappedPacket);
          }
          //this.writableStream.push(wrappedBuffer);
        }).bind(this));

        peer.on('close', (() => {
          this.removeNodeConnection(connectingID);
        }).bind(this));

      }).bind(this));
    }).bind(this));

  }

  joinWithPeers(nodeID, targetID){
    console.log("joinWithPeers");
    console.log(this.constructor.name);
    var peer = new SimplePeer({initiator: true, trickle: false });
    peer.on('signal', (function (data) {
      console.log(this.constructor.name);
      this.sendOffer(nodeID, targetID, data);
    }).bind(this));
  }

  sendOffer(nodeID, targetID, signal) {
    console.log("Sending an offer");
    console.log("Type: " + signal.constructor.name)
    console.log(signal);
    if(this.nodeList.length == 0){
      throw err("Nope!");
    }
    else if(this.nodeToPath[targetID]){
      var path = this.nodeToPath[targetID]
      var wrappedBuffer = JSON.stringify({packetType: 'signal',
        signalType: 'forward',
        wrtcType: 'peer-network[offer]',
        path: path,
        destination: targetID,
        data: signal});
      this.nodeToPeer[path[1]].send(wrappedBuffer);
    }
    else {
      var wrappedBuffer = JSON.stringify({packetType: 'signal',
        signalType: 'find',
        wrtcType: 'peer-network[offer]',
        path: [this.nodeID],
        destination: targetID,
        data: signal});
      this.nodeList.forEach((node) => {
        this.nodeToPeer[node].send(wrappedBuffer);
      });
    }
  }

  handleSignal(packet) {
    var buffer = Buffer.from(this.getPacketData(packet));
    var signalType = this.getSignalType(packet);
    console.log(signalType);
    this.handleOffer(buffer);

    console.log(JSON.stringify(buffer));
  }

  handleOffer(signal) {
    console.log("handleOffer");
    console.log(signal.constructor.name);
    console.log(signal.toString())
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
      // THIS IS TEMPORARY FIX FOR VICTOR
      if(true || this.nodeList.length == 0) {
        this.simpleSignalClient.connect(targetID, null, nodeID);
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



  // {packetType: STRING, signalType: STRING, path: ARRAY[HEXSTRING], destination: HEXSTRING, data: data}
  // {packetType: 'signal', signalType: 'search', path: [A,B], destination: D, data: data}
  // {packetType: 'signal', signalType: 'request', path: [A,B,C,D], destination: D, data:data}
  // {packetType: 'signal', signalType: 'found', path: [D,C,B,A], destination: A, data:data}


  _read() {
    //Nothing
  }


  listen() {
    //Nothing
  }

}

module.exports = MessageClient;