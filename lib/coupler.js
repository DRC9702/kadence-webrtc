const EventEmitter = require('nanobus');

class coupler extends EventEmitter{

  constructor(options){
    console.log("coupler constructor");
    super();
    this.nodeID = options.nodeID;
  }

}

module.exports = coupler;
