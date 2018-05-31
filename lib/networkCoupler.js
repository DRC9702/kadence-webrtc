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
  }

  /**
   * joinWithPeers creates a Peer and sends signalling info for a connection
   * to be established with the intended destination
   * @param targetID
   */
  joinWithPeers(targetID){
  }

  /**
   * sendSignal wraps a peerSignal in a signal packet and sends it with the signalType:
   * - "forward": There already exists a path established to the destination
   * - "find": A path needs to be established as the signal reaches the destination
   * @param targetID
   * @param signal
   */
  sendSignal(targetID, signal) {
  }

  /**
   * handleSignal reads a signal packet and calls the proper handler depending
   * on whether the signal is an "offer" or "answer".
   * @param packet
   */
  handleSignal(packet) {
  }

  /**
   * handleOffer is called when a different node wants to establish a connection with this node - "offer" signal.
   * A peer is created with the signalling info passed in and returned back.
   * @param sourceID
   * @param signal
   */
  handleOffer(sourceID, signal) {
  }

  /**
   * handleAnswer is called as a reply to this node's attempt to connect to a different node - "answer" signal.
   * The peer signals the answer directly and then emits a 'connect' event indicating the 2 peers are fully connected.
   * @param sourceID
   * @param signal
   */
  handleAnswer(sourceID, signal) {
  }

  /**
   * keepOrPass reads a signalPacket and determines whether to keep it (and handle it)
   * or pass it along in the proper fashion.
   * @param packet
   * @param nodeList
   */
  keepOrPass(packet, nodeList) {
  }

}

module.exports = NetworkCoupler;