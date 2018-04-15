var nodeStatic = require('node-static');
var http = require('http');
var socketIO = require('socket.io');
var externalip = require('externalip');

var port = 8080;
var nodeToSocket = {};

externalip(function (err, ip) {

  if(err){
    console.log("Error:" + err);
  }

  var fileServer = new(nodeStatic.Server)();
  var app = http.createServer(function(request, response) {
    console.log(request.url);
    fileServer.serve(request, response);
  }).listen(8080,ip);

  var io = socketIO.listen(app);
  var signalServer = require('simple-signal-server')(io)

  signalServer.on('discover', function (request) {
    console.log("Discovered: " + request.initiator.id);
    console.log(request);
    nodeToSocket[request.metadata] = request.initiator.id;
    console.log(JSON.stringify(nodeToSocket));
  })

  signalServer.on('request', function (request) {
    console.log("Request: " + request.initiator.id);
    console.log(request);
    request.forward(nodeToSocket[request.receiver.id]);
  })

  console.log("Listening on: http://" + ip + ":" + port);

});


