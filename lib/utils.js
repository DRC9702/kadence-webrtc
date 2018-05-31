const merge = require('merge');

methods = {};

/**
 * Tells you 'message' or 'signal'
 * @param packet
 * @returns {string|string}
 */
methods.getPacketType = function (packet) {
  return packet.packetType;
};

/**
 * Returns the signalType: 'find' or 'forward'
 * @param packet
 * @returns {string|string}
 */
methods.getPacketDirection = function (packet){
  return packet.direction;
};

/**
 * Gets the data from packet
 * @param packet
 */
methods.getPacketData = function (packet) {
  return packet.data;
}

/**
 * Returns the source of a signal packet
 * @param packet
 */
methods.getPacketSource = function(packet){
  return packet.source;
};

/**
 * Returns the destination of a signal packet
 * @param packet
 * @returns {AudioDestinationNode | RequestDestination}
 */
methods.getPacketDestination = function(packet){
  return packet.destination;
}

/**
 * Returns the current path of a signal packet
 * @param packet
 */
methods.getPacketPath = function(packet){
  return packet.path;
};

methods.wrapMessage = function(buffer, path, neighbors) {
  return {
    packetType: 'message',
    direction: 'forward',
    data: buffer,
    path: path,
    source: path[0],
    destination: path[path.length-1],
    neighbors: neighbors,
  }
}

methods.getPacketNeighbors = function(packet){
  return packet.neighbors;
}

methods.updatePacketNeighbors = function(packet, neighbors){
  packet.neighbors = neighbors;
  return packet;
}

methods.makeNewPaths = function(originalPaths, sourceID, firstHopID, closeNeighbors, farNeighbors){
  console.log("methods makeNewPaths");
  console.log(`OGPaths: ${JSON.stringify(originalPaths)}`);
  var newPaths = {}
  farNeighbors.forEach(function(nodeID){
    if(sourceID !== nodeID && !closeNeighbors.includes(nodeID)) {
      console.log(`${sourceID} - ${firstHopID} - ${nodeID}`);
      newPaths[nodeID] = [sourceID, firstHopID, nodeID];
    }
  })
  newPaths = merge(originalPaths, newPaths);
  return newPaths;
}

module.exports = methods;