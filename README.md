# Kadence-WebRTC

## How to run demo:

1. `npm install`
2. replace node_module/@kadenceproject/kadence/package.json with kadence-browser-package.json and rename it to package.json (this is to disable two plugins that are not supported by browserify)
```
cp kadence-browser-package.json node_modules/@kadenceproject/kadence/package.json
```

3. `npm run demo`

And then redirect browser to `localhost:8080/example/index.html`.

## Probable Issues With Your Installing:
You might face similar issues to me about complaints from `node-gyp`. If this happens, set your node python version to 2.7 (and change it back when you're done).

## Changes to package.json
For the time being, while this package is being developed, it's necessary to add this entry to the kadence package.json:
```
"browser": {
    "scrypt": false,
    "./lib/plugin-traverse.js": false
  },
```
This is the only difference applied in `kadence-browser-package.json` (at the time of writing) but imports may get updated.

## Current Issues:
Demo works with nodes joining the network through other nodes.
- **Signal Server** now only in charge of
  1. dispatching a node to be used as a signal server, and
  2. help join to a specified node if needed
- **Signal Coupler** previously was **signal client**. Now responsible for establishing connection between nodes using socket.io
- **Network Coupler** previously was **message client**. Now only responsible for establishing connection between nodes using existing WebRTC connections
- **connectionManager** took the part from **message client** that decides which coupler to use

---

**Documentation**
=================

## Classes

### `SignalServer`
**source:**
> [/lib/signal-server.js](https://github.com/DRC9702/kadence-webrtc/blob/master/lib/signal-server.js)

**extends:**
> [EventEmitter](https://nodejs.org/api/events.html#events_class_eventemitter)

Represents a signal server that helps exchanging offer/ice candidate/answer info to establish WebRTC connections between peers.

Maintains a table of registered nodes, and a socket connection with each node.

#### Use Cases:
1. Establishing WebRTC connections directly between the first two peers in the network

2. On further requests to join the network, randomly "dispatch" one of the registered nodes to the querying node and establish a WebRTC connection between them. The querying node from now on will use the node dispatched by the SignalServer as its "signal server".

3. Further connections to other nodes will go through the "signal server" instead of the real SignalServer, through existing WebRTC connections between the "signal server" and other peers

4. In case that further WebRTC connection establishments failed via the "signal server", instead use the SignalServer to establishing WebRTC connections



#### Constructor
```javascript
new SignalServer(io)
```

Constructs a SignalServer instance by passing in a Socket.io instance

#### Methods
```javascript
onConnect(socket)
```
Called as a callback from `io.on('connection', ...)` for connection by a Socket.io instance from client side.

Have the `socket` listen on **disconnect**, **discover**, **getRandomNodeId**, **offer**, **answer** events emitted by the connected socket on client side.

```javascript
onGetRamdomNodeId(socket, nodeId)
```
Called as a callback from  `socket.on('getRandomNodeId', ...)`. Randomly choose a registered node(other than the querying node)'s id and send it back by emitting a "dispatch" event through socket.

```javascript
onDiscover(socket, nodeId)
```
The registration procedure. Called as a callback from `socket.on('discover', ...)`. Stores the a map of the querying nodeId to it's socket id into a dictionary.

```javascript
onOffer(socket, data)
```
Called as a callback from `socket.on('offer', ...)`.
Forwards the offer/ice candidate signal to the target node, both contained in argument `data`.

```javascript
onAnswer(socket, data)
```
Called as a callback from `socket.on('answer', ...)`.
Forwards the answer signal to the target node.

### `WebRTCTransport`
**source:**
> [lib/transport.js](https://github.com/DRC9702/kadence-webrtc/blob/master/lib/transport.js)

**extends:**
> [DuplexStream](https://nodejs.org/api/stream.html#stream_class_stream_duplex)

A transport layer plugin for `Kademlia-Node`, implementing WebRTC in addition to builtin protocols like Http and UDP.

It maintains client side socket and a `SignalManager` instance, which handles requests when the current node is used as a "signal server" used by other nodes.

#### Constructor
```javascript
new WebRTCTransport({nodeID: nodeId})
```
Constructs a WebRTCTransport instance to be passed as a part of arguments when initializing a `KademliaNode` instance.

#### Methods
```javascript
_write([id, buffer, target], encoding, callback)
```
Implements the writable interface of a duplex stream. In WebRTCTransport it calls `SignalManager.sendMessage`.

### `ConnectionManager`
**source:**
> [lib/connectionManager.js](https://github.com/DRC9702/kadence-webrtc/blob/master/lib/connectionManager.js)

**extends:**
> [EventEmitter](https://nodejs.org/api/events.html#events_class_eventemitter)

A connectionManager sits in a WebRTCTransport instance and keeps the peer tables. It also decides which way the a message/signal is transferred, either via `NetworkCoupler` or `SignalCoupler`.

#### Constructor
```javascript
new ConnectionManager(writableStream, options)
```
Constructs a ConnectionManager instance.
- initializes a `NetworkCoupler` instance as well as a `SignalCoupler` instance and sets up listeners for both.
- options should includes a nodeID
- maintains two maps: `nodeToPeer`, `nodeToCallbacks` and a list: `nodeList`

#### Methods
```javascript
removeNodeConnection(targetID)
```
Gets rid of targetID from nodeList and deletes the entry in the nodeToPeer mapping.

```javascript
hasNodeConnection(targetID)
```
Checks if targetID has an entry in nodeToPeer, as well as verifying that the peer has not been destroyed.

```javascript
updateNodeConnectionList(targetID)
```
Moves targetID to the top of the nodeList queue.

```javascript
addNodeConnection(targetID, peer)
```
Adds the targetID-peer pair to nodeList and nodeToPeer, while also ensuring the connectionLimit is not exceeded.

```javascript
sendMessage(targetID, buffer, encoding, callback)
```
Wraps the buffer in a message packet and sends to the destination. Format of a message packet: {packetType: 'message', data: buffer}.

```javascript
broadcast(packet, excludeList, encoding, callback)
```
Takes in a formatted packet and sends it to all the nodes in nodeList excluding the ones passed in the excludeList.

```javascript
send(targetID, packet, encoding, callback)
```
The base method for sending packets to targetIDs

```javascript
peerConnectHandler(peer)
```
To be called on a peer whenever the 'connect' event is emitted. When triggered, the peer is fully connected to another peer and should now be set to handle packets appropriately.


### `SignalCoupler`
**source:**
> [lib/signalCoupler.js](https://github.com/DRC9702/kadence-webrtc/blob/master/lib/signalCoupler.js)

**extends:**
> [EventEmitter](https://nodejs.org/api/events.html#events_class_eventemitter)

Listens to signal packets from the signal-server and generates peers accordingly.

#### Constructor
```javascript
new signalCoupler(socket, nodeID)
```
Constructs a SignalCoupler instance and set socket listener on **connect**, **discover**, **offer**, **answer** and **dispatch**

#### Methods
```javascript
onConnect(data)
```
Called when the WebSocket between signalCoupler and the signal-server is connected

```javascript
onDiscover(data)
```
Called when the signal-server returns "onDiscover" information

```javascript
onOffer(data)
```
Called when an offer through the signal-server arrives from a different node.
A peer is created and signaling information is exchanged.

```javascript
onAnswer(data)
```
Called when an answer is through the signal-server is received.
The corresponding peer is now fully connected and emitted.

```javascript
onDispatch(data)
```
Called when a different nodeID of the network is returned as a response to getRandomNodeId

```javascript
connect(id, opts, metadata)
```
Called when the signalCoupler wants to create a peer connection to a different node.
A new peer is created and an offer is sent.

```javascript
rediscover(metadata)
```
Called to re-obtain discovery info

```javascript
getRandomNodeId(nodeId)
```
Requests a random nodeID of a different node in the network from signal-server

### `NetworkCoupler`
**source:**
> [lib/networkCoupler.js](https://github.com/DRC9702/kadence-webrtc/blob/master/lib/networkCoupler.js)

**extends:**
> [EventEmitter](https://nodejs.org/api/events.html#events_class_eventemitter)

Listens to signal packets from the Peer-Network and generates peers accordingly.

#### Constructor
```javascript
new networkCoupler(this, options)
```

Constructs a NetworkCoupler instance and maintains two maps: `nodeToHalfPeer` and `nodeToPath`.

#### Methods
```javascript
joinWithPeers(targetID)
```
Creates a Peer and sends signaling info for a connection to be established with the intended destination.

```javascript
sendSignal(targetID, signal)
```
Wraps a peerSignal in a signal packet and sends it with the signalType:
- "forward": There already exists a path established to the destination
- "find": A path needs to be established as the signal reaches the destination

```javascript
handleSignal(packet)
```
Reads a signal packet and calls the proper handler depending on whether the signal is an "offer" or "answer".

```javascript
handleOffer(sourceID, signal)
```
Called when a different node wants to establish a connection with this node - "offer" signal.
- A peer is created with the signaling info passed in and returned back.

```javascript
handleAnswer(sourceID, signal)
```
Called as a reply to this node's attempt to connect to a different node - "answer" signal.
- The peer signals the answer directly and then emits a 'connect' event indicating the 2 peers are fully connected.

```javascript
keepOrPass(packet, nodeList)
```
Reads a signalPacket and determines whether to keep it (and handle it) or pass it along in the proper fashion.







## Example

### `root-server`
> [/example/root-server.js](https://github.com/DRC9702/kadence-webrtc/blob/master/example/root-server.js)

Represents a file server that serves html files to webpages

- Ideally when running a Kadence-WebRTC application from browser, there should be a remote server that hosts the website for users to join the network

- `/example/root-server.js` is a simple script that starts a file server locally that serves a user-defined html page

- Has to maintain an instance of `lib/signal-server.js` class, which handles requests to join the network

### `browser-demo`
**source:**
> [/example/browser-demo.js](https://github.com/DRC9702/kadence-webrtc/blob/master/example/browser-demo.js)

The javascript file that interacts directly with DOM and initializes/make calls accordingly to an instance of `Kademlia-Node` from [`@kadenceproject/kadence`](https://github.com/kadence/kadence), the core package **Kadence-WebRTC** relies on, which is a complete implementation of
the Kademlia distributed hash table that aims to effectively mitigate all vulnerabilities described in the S/Kademlia paper.
