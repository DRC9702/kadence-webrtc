var nodeStatic = require('node-static');
var http = require('http');
var socketIO = require('socket.io');
var externalip = require('externalip');
var randomInt = require('random-int');

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

  var ioServer = socketIO(httpServer);
  var signalServer = require('simple-signal-server')(ioServer)

  signalServer.on('discover', function (request) {
    console.log("Discovered: " + request.initiator.id);
    console.log(request);
    nodeArray.push(request.metadata);
    nodeToSocket[request.metadata] = request.initiator.id;
    console.log("request.metadata:" + request.metadata);
    console.log("request.initiator.id:" + request.initiator.id);
    console.log(JSON.stringify(nodeToSocket));
  })

  signalServer.on('request', function (request) {
    console.log("Request: " + request.initiator.id);
    console.log(request);
    // request.forward(nodeToSocket[request.receiver.id]);

    // Dispatching
    var size = Object.keys(nodeToSocket).length;
    console.log(size);
    if (size !== 0) {
      console.log(nodeArray);
      do {
        nodeIdRandom = randomInt(size - 1);
        console.log(`random index: ${nodeIdRandom}`);
        console.log(nodeToSocket[nodeArray[nodeIdRandom]]);
        console.log(nodeToSocket[request.initiator.id]);
      }
      while (nodeToSocket[nodeArray[nodeIdRandom]] === nodeToSocket[request.metadata]);
      request.forward(nodeToSocket[nodeArray[nodeIdRandom]]);
      console.log(`Signal Server: Dispatching ${nodeIdRandom}th node in table`);
    } else {
      console.log("Empty Network");
      // should return an error to the request initiator
    }
    
  })

  console.log("Listening on: http://" + ip + ":" + port);

});


