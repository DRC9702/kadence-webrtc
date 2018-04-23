var nodeStatic = require('node-static');
var http = require('http');
var socketIO = require('socket.io');
var externalip = require('externalip');
var SignalServer = require('../lib/signal-server');

var port = 8080;

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

  console.log("Listening on: http://" + ip + ":" + port);
});


