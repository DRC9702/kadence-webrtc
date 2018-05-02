Classes
=======
---

## SignalServer
**source:**
> [/lib/signal-server.js](https://github.com/DRC9702/kadence-webrtc/blob/master/lib/signal-server.js)

**extends:**
> [EventEmitter](https://nodejs.org/api/events.html#events_class_eventemitter)

Represents a signal server that helps exchanging offer/ice candidate/answer info to establish WebRTC connections between peers.

Maintains a table of registered nodes, and a socket connection with each node.

##### Use Cases:
1. Establishing WebRTC connections directly between the first two peers in the network

2. On further requests to join the network, randomly "dispatch" one of the registered nodes to the querying node and establish a WebRTC connection between them. The querying node from now on will use the node dispatched by the SignalServer as its "signal server".

3. Further connections to other nodes will go through the "signal server" instead of the real SignalServer, through existing WebRTC connections between the "signal server" and other peers

4. In case that further WebRTC connection establishments failed via the "signal server", instead use the SignalServer to establishing WebRTC connections



##### Constructor
```javascript
new SignalServer(io)
```

Constructs a SignalServer instance by passing in a Socket.io instance

##### Methods
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

## WebRTCTransport
**source:**
> [lib/transport.js](https://github.com/DRC9702/kadence-webrtc/blob/master/lib/transport.js)

**extends:**
> [DuplexStream](https://nodejs.org/api/stream.html#stream_class_stream_duplex)

A transport layer plugin for `Kademlia-Node`, implementing WebRTC in addition to builtin protocols like Http and UDP.

It maintains client side socket and a `SignalManager` instance, which handles requests when the current node is used as a "signal server" used by other nodes.

##### Constructor
```javascript
new WebRTCTransport({nodeID: nodeId})
```
Constructs a WebRTCTransport instance to be passed as a part of arguments when initializing a `KademliaNode` instance.

##### Methods
```javascript
_write([id, buffer, target], encoding, callback)
```
Implements the writable interface of a duplex stream. In WebRTCTransport it calls `SignalManager.sendMessage`.


Example
==============
---

## root-server
> [/example/root-server.js](https://github.com/DRC9702/kadence-webrtc/blob/master/example/root-server.js)

Represents a file server that serves html files to webpages

- Ideally when running a Kadence-WebRTC application from browser, there should be a remote server that hosts the website for users to join the network

- `/example/root-server.js` is a simple script that starts a file server locally that serves a user-defined html page

- Has to maintain an instance of `lib/signal-server.js` class, which handles requests to join the network

## browser-demo
**source:**
> [/example/browser-demo.js](https://github.com/DRC9702/kadence-webrtc/blob/master/example/browser-demo.js)

The javascript file that interacts directly with DOM and initializes/make calls accordingly to an instance of `Kademlia-Node` from [`@kadenceproject/kadence`](https://github.com/kadence/kadence), the core package **Kadence-WebRTC** relies on, which is a complete implementation of
the Kademlia distributed hash table that aims to effectively mitigate all vulnerabilities described in the S/Kademlia paper.
