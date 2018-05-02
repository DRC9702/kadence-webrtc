methods = {};

// Tells you 'message' or 'signal'
methods.getPacketType = function (packet) {
  return packet.packetType;
};

// 4 types of signals: find, forward
methods.getPacketSignalType = function (packet){
  return packet.signalType;
};

// Get's the data from packet
methods.getPacketData = function (packet) {
  return packet.data;
}

methods.getPacketSource = function(packet){
  return packet.source;
};

methods.getPacketDestination = function(packet){
  return packet.destination;
}

methods.getPacketPath = function(packet){
  return packet.path;
};

module.exports = methods;