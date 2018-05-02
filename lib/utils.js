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
methods.getPacketSignalType = function (packet){
  return packet.signalType;
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

module.exports = methods;