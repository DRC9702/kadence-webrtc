var signalClient = require("./signal-client");
const EventEmitter = require('events');

class MessageClient extends EventEmitter{

  constructor(socket, nodeID, writableStream, options) {
    super();
    this.writableStream = writableStream;
    this._options = options;
    this.nodeID = options.nodeID;
    this.socket = socket;
    this.simpleSignalClient = new signalClient(this, nodeID);
    this.nodeToPeer = {};
    this.nodeToCallbacks = {};
    this.nodeList = [];
    this.nodeToPath = {};
    this.trackingNumberToNode = {}
    this.hasNodeConnection = this.hasNodeConnection.bind(this);
    this.removeNodeConnection = this.removeNodeConnection.bind(this);
    this.updateNodeConnectionList = this.updateNodeConnectionList.bind(this);
    this.addNodeConnection = this.addNodeConnection.bind(this);

    this.on('sc[discover]', this.handleDiscover.bind(this));
    this.on('sc[dispatch]', this.handleDispatch.bind(this));
    this.on('sc[getRandomNodeId]', this.handleGetRandomNodeId.bind(this));
    this.on('sc[offer]', this.handleOffer.bind(this));
    // this.on('sc[offer]', (metadata)=>{socket.emit('simple-signal[offer]',metadata)});
    this.on('sc[answer]', this.handleAnswer.bind(this));
    // this.on('sc[answer]', (metadata)=>{socket.emit('simple-signal[answer]',metadata)});

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
            var signalType = this.getSignalType(wrappedPacket);
            if(signalType == 'find'){
              if(this.getPacketDestination(wrappedPacket) == this.nodeID) {
                if(this.nodeToPath[wrappedPacket.path[0]]){ // Already have a channel, throw this one away
                  return
                }
                wrappedPacket.path.push(this.nodeID);
                var data = this.getPacketData(wrappedPacket);
                this.nodeToPath[wrappedPacket.path[0]] = wrappedPacket.path;
                this.trackingNumberToNode[data.trackingNumber] = wrappedPacket.path[0];
                wrappedPacket.path = wrappedPacket.path.reverse();
                console.log("Found destination with path: " + this.getPacketPath(wrappedPacket));
                this.emit(wrappedPacket.wrtcType, data);
              }
              else if(this.getPacketPath(wrappedPacket).length <= this._options.searchLimit){
                wrappedPacket.path.push(this.nodeID);
                console.log(wrappedPacket);
                this.nodeList.forEach((node) => {
                  if(!this.getPacketPath(wrappedPacket).includes(node)) {
                    this.nodeToPeer[node].send(JSON.stringify(wrappedPacket));
                  }
                });
              }
            }
            else if (signalType == 'forward'){
              if(this.getPacketDestination(wrappedPacket) == this.nodeID) {
                if (this.nodeList.includes(wrappedPacket.path[0])){ //Already have a peer between these two, stop accepting stuff
                  return
                }
                var data = this.getPacketData(wrappedPacket);
                this.nodeToPath[wrappedPacket.path[0]] = wrappedPacket.path;
                this.trackingNumberToNode[data.trackingNumber] = wrappedPacket.path[0];
                wrappedPacket.path = wrappedPacket.path.reverse();
                console.log("Arrived at destination with path: " + this.getPacketPath(wrappedPacket));
                this.emit(wrappedPacket.wrtcType, data);
              }
              else {
                var interNode = wrappedPacket.path[wrappedPacket.path.indexOf(this.nodeID) + 1];
                this.nodeToPeer[interNode].send(JSON.stringify(wrappedPacket));
              }
            }
            else {
              console.log("SIGNAL TYPE: " + signalType)
            }
            console.log(this.getPacketType(wrappedPacket));
            console.log(wrappedPacket)
          }
          //this.writableStream.push(wrappedBuffer);
        }).bind(this));

        peer.on('close', (() => {
          this.removeNodeConnection(connectingID);
        }).bind(this));

      }).bind(this));
    }).bind(this));

  }

  handleDiscover(metadata) {
    this.socket.emit('simple-signal[discover]',metadata);
  }

  handleGetRandomNodeId(metadata) {
    this.socket.emit('simple-signal[getRandomNodeId]',metadata);
  }

  handleDispatch(metadata) {
    this.socket.emit('simple-signal[dispatch]',metadata);
  }

  handleOffer(metadata) {
    console.log("Sending an offer");
    console.log("Type: " + metadata.constructor.name)
    console.log(metadata);
    if(this.nodeList.length == 0){
      this.socket.emit('simple-signal[offer]', metadata);
    }
    else if(this.nodeToPath[metadata.target]){
      var path = this.nodeToPath[metadata.target]
      var wrappedBuffer = JSON.stringify({packetType: 'signal',
        signalType: 'forward',
        wrtcType: 'simple-signal[offer]',
        path: path,
        destination: metadata.target,
        data: metadata});
      this.nodeToPeer[path[1]].send(wrappedBuffer);
    }
    else {
      var wrappedBuffer = JSON.stringify({packetType: 'signal',
        signalType: 'find',
        wrtcType: 'simple-signal[offer]',
        path: [this.nodeID],
        destination: metadata.target,
        data: metadata});
      this.nodeList.forEach((node) => {
        this.nodeToPeer[node].send(wrappedBuffer);
      });
    }
  }

  handleAnswer(data) {
    if(this.trackingNumberToNode[data.trackingNumber]){
      var targetNode = this.trackingNumberToNode[data.trackingNumber];
      var path = this.nodeToPath[targetNode];
      var wrappedBuffer = JSON.stringify({packetType: 'signal',
        signalType: 'forward',
        wrtcType: 'simple-signal[answer]',
        path: path,
        destination: targetNode,
        data: data});
      this.nodeToPeer[path[1]].send(wrappedBuffer);
    }
    else {
      this.socket.emit('simple-signal[answer]', data);
    }
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

  on2(event, handler) {
    this.socket.on(event,handler);
    this.on(event,handler);
  }

  // emit(event, data) {
  //   this.socket.emit(event,data);
  // }

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
      this.simpleSignalClient.connect(targetID, null, nodeID);
      // try to wait for the connect. connect API does not support callback
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