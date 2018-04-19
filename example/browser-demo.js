const bunyan = require('bunyan');
const level = require('level-browserify');
const kadence = require('@kadenceproject/kadence');
var WebRTCTransport = require('../lib/transport');

var node;

document.querySelector('#makeNode').addEventListener('submit', (e) => {
  // Prevent page refresh
  e.preventDefault();

  var nodeName = document.getElementById("nodeName").value;
  var id = kadence.utils.hash160(nodeName).toString('hex');

  node = new kadence.KademliaNode({
    identity: id,
    transport: new WebRTCTransport({nodeID: id}),
    storage: level('storage.db'),
  });
  node.listen();

  console.log(`node id = ${id}`);
  node.transport.signalClient.simpleSignalClient.getRandomNodeId(id);
  node.transport.signalClient.simpleSignalClient.on('dispatch', function(metadata){
    console.log("Browser-Demo: caught dispatch event");
    console.log("selfId: " + metadata.selfId + " targetId: " + metadata.targetId);
    if (metadata.selfId !== metadata.targetId) {
      console.log("Browser-Demo: about to join random Node given by root server");
      node.join([metadata.targetId,
        {}],
      () => {
        node.logger.info(`Connected to ${node.router.size} peers!`);
        // console.log(`Connected to ${node.router.size} peers!`);
    });
    } else {
      console.log("Browser-Demo: network does not have any nodes yet");
    }
  })

  alert("Node launched!");

  // document.getElementById("nodeid").innerHTML = node.identity.toString('hex');
});

document.querySelector('#joinNode').addEventListener('submit', (e) => {
  // Prevent page refresh
  e.preventDefault();

  var targetName = document.getElementById("targetName").value;
  var targetId = kadence.utils.hash160(targetName).toString('hex');

  // console.log(targetId);

  node.join([targetId,
      {}],
    () => {
      node.logger.info(`Connected to ${node.router.size} peers!`);
      // console.log(`Connected to ${node.router.size} peers!`);
  });
});

document.querySelector('#putKV').addEventListener('submit', (e) => {
  e.preventDefault();

  const key = document.getElementById("keyName").value;
  const val = document.getElementById("valName").value;
  console.log(`Putting key: ${key} and val: ${val}`);

  hashedKey = kadence.utils.hash160(key);
  // console.log("hashedKey: " + hashedKey.toString('hex'));

  node.iterativeStore(hashedKey, val, (err, stored) => {
    if(err) {
      console.log(err);
      return;
    }
    console.log(`Stored: { ${key} : ${val} }`);
  });
});

document.querySelector('#getKV').addEventListener('submit', (e) => {
  e.preventDefault();

  const key = document.getElementById("key").value;
  console.log(`Getting key: ${key}`);

  hashedKey = kadence.utils.hash160(key);
  // console.log(`hashedKey:  ${hashedKey.toString('hex')}`);
  node.iterativeFindValue(hashedKey, (err, result, contacts) => {
    if(err) {
      console.log(err);
      return;
    }
    alert(`Value: ${result.value} - ${result.publisher}`);
  });
});