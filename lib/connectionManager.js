var SignalCoupler = require("./signalCoupler");
var networkCoupler = require("./networkCoupler");
var SimplePeer = require('simple-peer');
const utils = require('./utils');
const EventEmitter = require('events');

class ConnectionManager extends EventEmitter{

  constructor(writableStream, options) {
    super();
    var self = this;
    self.writableStream = writableStream;
    self.options = options;
    self.nodeID = options.nodeID;
    self.nodeToPath = {}; //Mapping from nodeID -> path to node
    self.nodeToPeer = {}; //Mapping from directly adjacent nodeIDs -> simplepeer object
    self.reachableNodeList = []; //List of nodeIDs with paths to them
    self.nodeList = []; //List of directly adjacent nodeIDs
    self.priorityNodeList = []; //List of directly adjacent priority nodeIDs
    self.nodeToCallbacks = {}; //Mapping of nodeID -> list of callbacks to be executed for that nodeID

    var signalCoupler = new SignalCoupler(options);
    self.couplers = [signalCoupler];

    self.couplers.forEach(function(coupler){
      coupler.on('request', (request) => {
        if(!self.hasConnection(request.srcID)){
          // Check if this is a priority connection request
          if(request.priority){
            request.accept(null, null);
          } // If not a priority connection request, check if free space
          else if(self.nodeList.length < self.options.connectionLimit) {
            request.accept(null, null);
          }
        }
      });

      coupler.on('peer', (peer) => {
        console.log(`Connected By ${coupler.constructor.name}!`);
        peer.on('connect', self.peerConnectHandler.bind(self,peer));
      });
    })



  }


  /**
   * Store the peer for a direct connection to a node and add to lists/maps
   * @param peer
   * @param nodeID
   * @param priority
   */
  addConnection(peer, nodeID, priority) {
    var self = this;
    if(self.hasConnection(nodeID)){
      console.log("Already has connection");
      return;
    }
    // nodeList less than connection limit
    else if(self.nodeList.length < self.options.connectionLimit) {
      self.nodeToPath[nodeID] = [self.nodeID, nodeID];
      self.nodeToPeer[nodeID] = peer;
      self.reachableNodeList.unshift(nodeID);
      self.nodeList.unshift(nodeID);
      if(priority){
        self.priorityNodeList.unshift(nodeID);
      }
    }
    // priority connection but nodeList is full (doesn't matter if priorityNodeList is full or not)
    else if(priority && self.priorityNodeList.length < self.options.connectionLimit) {
      var remID = self.nodeList[self.nodeList.length-1];
      self.removeConnection(remID);
      self.nodeToPath[nodeID] = [self.nodeID, nodeID];
      self.nodeToPeer[nodeID] = peer;
      self.reachableNodeList.unshift(nodeID);
      self.nodeList.unshift(nodeID);
      self.priorityNodeList.unshift(nodeID);
    }
  }

  /**
   * Check whether a nodeID is directly adjacent (has a webrtc connection)
   * @param nodeID
   * @returns {boolean}
   */
  hasConnection(nodeID) {
    var self = this;
    return self.nodeList.includes(nodeID);
  }

  /**
   * Remove nodeID and peer from lists/maps
   * @param nodeID
   */
  removeConnection(nodeID) {
    var self = this;

    self.nodeToPeer = {};
    self.nodeToCallbacks = [];

    // Delete all paths using this nodeID
    // Delete nodes reachable with this nodeID
    for (var destID in self.nodeToPath) {
      if (self.nodeToPath.hasOwnProperty(destID)) {
        if(self.nodeToPath[destID].includes(nodeID)){
          delete self.nodeToPath[destID];
          delete self.reachableNodeList[destID];
        }
      }
    }

    // Remove node from nodeList
    if(this.nodeList.includes(nodeID)){
      var index = this.nodeList.indexOf(nodeID);
      this.nodeList.splice(index, 1);
    }

    //Remove node from priorityNodeList
    if(this.priorityNodeList.includes(nodeID)){
      var index = this.priorityNodeList.indexOf(nodeID);
      this.nodeList.splice(index, 1);
    }

    // Delete from nodeToPeer
    if(this.nodeToPeer[nodeID]){
      this.nodeToPeer[nodeID].destroy()
      delete this.nodeToPeer[nodeID];
    }

    // Just in case: Delete from nodeToCallbacks
    if(this.nodeToCallbacks[nodeID]){
      delete this.nodeToCallbacks[nodeID];
    }
  }

  /**
   * Check whether there exists a path to this nodeID
   * @param nodeID
   * @returns {boolean}
   */
  hasPath(nodeID) {
    var self = this;
    return self.nodeToPath.hasOwnProperty(nodeID);
  }

  /**
   * Check whether node is in the reachable list. Probably deprecated...
   * @param nodeID
   * @returns {*}
   */
  isReachable(nodeID) {
    var self = this;
    return self.reachableNodeList.include(nodeID);
  }

  /**
   * Send a message packet to a destination nodeID
   * @param destID
   * @param buffer
   * @param encoding
   * @param callback
   */
  sendMessage(destID, buffer, encoding, callback){
    // console.log("connectionManager sendMessage");
    var self = this;
    // Writing to yourself?
    if(self.nodeID==destID){
      self.writableStream.push(buffer);
      callback();
    }
    else{
      //Does there exist a path to this node already?
      if(self.hasPath(destID) && self.hasConnection(self.nodeToPath[destID][1])) {
        var packet = utils.wrapMessage(buffer,self.nodeToPath[destID],self.nodeList);
        self.send(destID, packet, encoding, callback);
      }
      else{
        self.connectWithCouplers(destID);
        //Once connected, send message
        if(self.nodeToCallbacks[destID]){
          self.nodeToCallbacks[destID].push(((path,nodeList) => {
            var packet = utils.wrapMessage(buffer,path,nodeList);
            self.send(destID, packet, encoding, callback);
          }).bind(self));
        }
        else {
          self.nodeToCallbacks[destID] = [((path,nodeList) => {
            var packet = utils.wrapMessage(buffer,path,nodeList);
            self.send(destID, packet, encoding, callback);
          }).bind(self)];
        }
      }
    }
  }

  // wrapMessage(buffer,destID){
  //   var self = this;
  //   return utils.wrapMessage(buffer,self.nodeToPath[destID],self.nodeList);
  // }

  /**
   * Send a packet to a destination nodeID
   * @param destID
   * @param packet
   * @param encoding
   * @param callback
   */
  send(destID,packet,encoding,callback){
    // console.log("connectionManager send");
    var self = this;
    var firstPeerID = self.nodeToPath[destID][1];
    var firstPeer = self.nodeToPeer[firstPeerID];
    // console.log(`Sending: ${JSON.stringify(packet)}`);
    firstPeer.write(JSON.stringify(packet),encoding,callback);
    // console.log(`Sent: ${packet}`);
  }

  /**
   * Connect to a destination nodeID by attempting multiple couplers in series
   * @param targetID
   */
  connectWithCouplers(targetID){
    var self = this;
    var opts = {priority: self.nodeList.length==0}
    var index = 0

    var callback = function() {
      if(self.nodeList.includes(targetID)){
        return;
      } else if(index < self.couplers.length){
        self.couplers[index].connect(targetID,null,opts);
        index += 1;
        setTimeout(callback, self.options.connectTimeout);
      }
    }
    setTimeout(callback, self.options.connectTimeout);
  }

  /**
   * The data handler for when a packet arrives through a peer
   * @param packet
   */
  defaultPacketHandler(packet) {
    var self = this;

    var packetDestination = utils.getPacketDestination(packet);
    var packetDirection = utils.getPacketDirection(packet);
    var packetType = utils.getPacketType(packet);
    var packetPath = utils.getPacketPath(packet);
    var prevID = packetPath[packetPath.indexOf(self.nodeID) - 1];


    if(packetDirection === 'forward'){
      if(self.nodeID === packetDestination){
        if (packetType === 'message') {
          var buffer = Buffer.from(utils.getPacketData(packet));
          self.nodeToPath = utils.makeNewPaths(self.nodeToPath, self.nodeID, prevID, self.nodeList, utils.getPacketNeighbors(packet));
          // console.log(`After update: ${JSON.stringify(self.nodeToPath)}`);
          self.writableStream.push(buffer);
        }
      }
      else{
        var nextID = packetPath[packetPath.indexOf(this.nodeID) + 1];
        self.nodeToPath = utils.makeNewPaths(self.nodeToPath, self.nodeID, prevID, self.nodeList, utils.getPacketNeighbors(packet));
        // console.log(`After update: ${JSON.stringify(self.nodeToPath)}`);
        packet = utils.updatePacketNeighbors(packet, self.nodeList);
        //ToDo: Figure out if intermediate nodes should also use initial encoding and callback. If so, these will be passed with packet
        // Check that this node can forward the path. If not, fail.
        if(self.hasPath(nextID) && self.hasConnection(self.nodeToPath[nextID][1])) {
          self.send(nextID, packet, null, null);
        }
      }

      // this.updateNodeConnectionList(connectingID);
    }
  };

  /**
   * Connection handler for when peer is connected. Initializes all the handler functions: data, error, close.
   * @param peer
   */
  peerConnectHandler(peer) {
    var self = this;

    self.addConnection(peer,peer.nodeID,peer.metadata.priority);
    console.log(`Peer OnConnect! - ${peer.nodeID}`);

    // Execute all pending callbacks for this nodeID
    if(self.nodeToCallbacks[peer.nodeID]) {
      self.nodeToCallbacks[peer.nodeID].forEach((callback) => {
        console.log(callback);
        callback(self.nodeToPath[peer.nodeID],self.nodeList);
      });
    }

    delete self.nodeToCallbacks[peer.nodeID];

    var peerErrorHandler = function(err) {
      self.removeConnection(peer.nodeID);
      self.emit('error',err);
      console.log('error', err);
    };

    var peerDataHandler = function (bufferedPacket) {
      // console.log(self.nodeToPath);
      var packet = JSON.parse(bufferedPacket.toString());
      self.defaultPacketHandler(packet);
      self.couplers.forEach(function(coupler){
        if(coupler.packetHandler){
          coupler.packetHandler(packet);
        }
      });
    };

    var peerCloseHandler = function() {
      console.log("peerCloseHandler!");
      self.removeConnection(peer.nodeID);
    }

    peer.on('error', peerErrorHandler.bind(self));

    peer.on('data', peerDataHandler.bind(self));

    peer.on('close', peerCloseHandler.bind(self));
  }

}

module.exports = ConnectionManager;