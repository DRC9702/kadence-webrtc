// Import dependencies
const bunyan = require('bunyan');
// const levelup = require('levelup');
// const leveldown = require('leveldown'); //THIS REQUIRES IS NOT WORKING
// const encoding = require('encoding-down');
// var level = require('level-browserify')
var level = require('level-browserify');
const kadence = require('@kadenceproject/kadence');
var WebRTCTransport = require('../');

var node;
var host='localhost';
var port=1337;

document.querySelector('#makeNode').addEventListener('submit', function (e) {
  // Prevent page refresh
  e.preventDefault();

  var nodeName = document.getElementById("nodeName").value;
  var id = kadence.utils.hash160(nodeName).toString('hex');

  node = new kadence.KademliaNode({
    identity: id,
    transport: new WebRTCTransport({nodeID: id}),
    // storage: levelup(encoding(leveldown('storage.db'))), //CAN NOT USE LEVELDOWN YET
    storage: level('storage.db'),
    // contact: { hostname: host, port: port }
  });

  alert("Node launched!");

  document.getElementById("nodeid").innerHTML = node.identity.toString('hex');
});

document.querySelector('#joinNode').addEventListener('submit', function (e) {
  // Prevent page refresh
  e.preventDefault();

  var targetName = document.getElementById("targetName").value;
  var targetId = kadence.utils.hash160(targetName).toString('hex');

  console.log(targetId);

  node.join([targetId,
      {}],
    () => {
      node.logger.info(`Connected to ${node.router.size} peers!`);
      // console.log(`Connected to ${node.router.size} peers!`);
    });
});

document.querySelector('#putKV').addEventListener('submit', function (e) {
  e.preventDefault();

  var key = document.getElementById("keyName").value;
  var val = document.getElementById("valName").value;
  console.log('Putting key:' + key + "and val:" + val);

  hashedKey = kadence.utils.hash160(key);
  console.log("hashedKey: " + hashedKey.toString('hex'));

  node.iterativeStore(hashedKey, val, function(err, stored) {
    if(err) {
      console.log(err);
      return;
    }
    console.log("Stored: {" + key + ": " + val + "} - " + stored);
  });
});

document.querySelector('#getKV').addEventListener('submit', function (e) {
  e.preventDefault();

  var key = document.getElementById("key").value;
  console.log('Putting key:' + key);

  hashedKey = kadence.utils.hash160(key);
  console.log("hashedKey: " + hashedKey.toString('hex'));
  node.iterativeFindValue(hashedKey, function(err, result, contacts) {
    if(err) {
      console.log(err);
      return;
    }
    console.log("Value: " + result.value + " - " + result.publisher);
  });
});