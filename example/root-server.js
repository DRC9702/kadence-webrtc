var nodeStatic = require('node-static');
var http = require('http');
var socketIO = require('socket.io');
var externalip = require('externalip');
var randomInt = require('random-int');
var SignalServer = require('../lib/signal-server');

var port = 8080;
var nodeArray = [];
var nodeToSocket = {};

// getting external ip
externalip(function (err, ip) {

  if(err){
    console.log("Error:" + err);
  }

  var fileServer = new nodeStatic.Server();
  const httpServer = http.createServer(function(request, response) {
    console.log(request.url);
    fileServer.serve(request, response);
  }).listen(8080);
  //}).listen(8080, ip);

  var ioServer = socketIO(httpServer);
  var signalServer = new SignalServer(ioServer);

  signalServer.on('discover', function (request) {
    console.log("Discovered: " + request.initiator.id);
    nodeArray.push(request.metadata);
    nodeToSocket[request.metadata] = request.initiator.id;
    console.log(JSON.stringify(nodeToSocket));
  })

  signalServer.on('dispatch', function (request) {
    // Dispatching
    var size = nodeArray.length;
    console.log("root-server: on dispatch");
    if (size > 1) {
      console.log(nodeArray);
      do {
        nodeIdRandom = randomInt(size - 1);
        console.log(`random index: ${nodeIdRandom}`);
      }
      while (nodeArray[nodeIdRandom] === request.metadata);

      request.dispatch({ selfId: request.metadata, targetId: nodeArray[nodeIdRandom] });
      console.log(`root-server: Dispatching ${nodeIdRandom}th node with id ${nodeArray[nodeIdRandom]} in table`);
    } else {
      console.log("root-server: Empty Network");
      request.dispatch({selfId: request.metadata, targetId: request.metadata});
      // should return an error to the request initiator
    }

  })

  signalServer.on('request', function (request) {
    console.log("Request: " + request.initiator.id);
    console.log(request);
    request.forward(nodeToSocket[request.receiver.id]);
    
  })

  console.log("Listening on: http://" + ip + ":" + port);

});


