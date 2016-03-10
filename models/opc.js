/**
 * Created by Thomas on 26.08.2015.
 */

var async = require("async");
var Q = require("q");
var Promise = require('bluebird');
//var md5 = require("md5");

var opcua = function(){
  this.client = false;
  this.session = false;
  this.connected = false;
  this.subscription = undefined;
};
exports.opcua = opcua;

//==================================================================================
//========================= Connection Handling ====================================
//==================================================================================

opcua.prototype.connect = function(endpointurl, callback){
  var self = this;

  var nodeopcua = require('node-opcua');

  async.series([ function(cb) {
    // only create Client, if there is none
    if (!self.client) {
      self.client = new nodeopcua.OPCUAClient();
      self.client.connect(endpointurl, function(err) {
        if(err){
          throw err;
        } else {
          console.log('client created');
          cb(err);
        }
      });
    } else {
      throw 'there is already a client';
    }
  }, function(cb) {
    // Only create session, if there is none
    if (!self.session) {
      try {
        self.client.createSession(function (err, session) {
          self.session = session;
          console.log('session created');
          cb(err);
        });
      } catch(err) {
        throw 'could not create an opcua session'
      }
    } else {
      throw 'there is already a session';
    }
  } ], function(err) {
    if(err){
      console.log('err');
    } else {
      self.connected = true;
      callback();
    }
  });
};

opcua.prototype.connectQ = function(endpointurl){
  var self = this;

  // Create a promise based API for the connect function
  return Q.promise(function(resolve){
    self.connect(endpointurl, resolve);
  });
};

opcua.prototype.disconnect = function(callback){
  var self = this;

  if (typeof self.client !== 'undefined') {
    self.connected = false;
    if (callback) {
      self.client.disconnect(callback);
    } else {
      // The try catch blog doesnt really catch errors, other constructs are also possible
      try {
        self.client.disconnect();
      } catch(err){
        throw err;
      }
    }
  }
};

opcua.prototype.disconnectQ = function(){
  var self = this;

  return Q.promise(function(resolve, reject){
    self.disconnect(function(err){
      if(!err){
        resolve();
      } else {
        reject(err);
      }
    });
  });
};

//==================================================================================
//========================= Read Element ===========================================
//==================================================================================

/**
 * Read an Array of nodeids
 *
 * Basic function. It is used by several derivated functions like readArrayQ and read.
 *
 * @param nodes
 * @param callback
 */
opcua.prototype.readArray = function(nodes, callback) {
  var self = this;

  var max_age = 0; // what does it mean?

  nodes = nodes.map(helper.checkAndCorrectNodeId);
  nodes = nodes.map(helper.modifiyNodeArray);
  nodes = nodes.map(helper.addAtributeId);

  self.session.read(nodes, max_age, function(err, nodes, results) {
    var tempData = helper.concatNodesAndResults(nodes, results);
    //tempData = opcua._addEventsAndIdsToResultsArray(tempData);
    // console.log(tempData);
    callback(err, tempData);
  });
};

/**
 * Read only one element
 *
 * @experimental - not tested
 * @uses readArray()
 * @param node
 * @param callback
 */
opcua.prototype.read = function(node, callback){
  var self = this;

  var result = self.readArray([node], function(err, result){
    callback(err, result.pop());
  });
};

/**
 * Promise API for readArray()
 * @uses readArray()
 * @param nodes
 * @returns {Promise}
 */
opcua.prototype.readArrayQ = function(nodes){
  var self = this;

  return Q.promise(function(resolve, reject){
    self.readArray(nodes, function(err, results){
      if(err){
        reject(err);
      }
      resolve(results);
    })
  });
};

/**
 * Read one element
 *
 * @uses readArrayQ()
 * @param node
 */
opcua.prototype.readQ = function(node){
  var self = this;

  return self.readArrayQ([node])
    .then(function(results){
      return Q.promise(function(resolve){
        resolve(results.pop());
      });
    });
};

//==================================================================================
//========================= Write Element ==========================================
//==================================================================================

opcua.prototype.write = function(nodeId, value, type, callback){
  var self = this;

  var nodeopcua = require('node-opcua');

  var nodeData = {
    nodeId : helper.checkAndCorrectNodeId(nodeId),
    attributeId : 13,
    value : new nodeopcua.DataValue({
      value : new nodeopcua.Variant({
        dataType : helper.convertDataType(type),
        value : value
      })
    })
  };

  self.session.write([nodeData], function(err, results){
    if(err){
      callback(err, null);
    }
    callback(err,results.pop());
  });
}

opcua.prototype.writeQ = function(nodeId, value, type){
  var self = this;

  return Q.promise(function(resolve, reject){
    self.write(nodeId, value, type, function(err, result){
      if(!err){
        resolve(result);
      } else {
        reject(err);
      }
    });
  })
};

//==================================================================================
//========================= Subscribe / Monitor ====================================
//==================================================================================

opcua.prototype.subscribe = function(nodeId) {
  var nodeopcua = require('node-opcua');

  var self = this;
  return new Promise(function(resolve, reject) {

    var subscriptionSettings = {
      requestedPublishingInterval : 1000,
      requestedLifetimeCount : 100, // 10 // if not present, subscribtion
                                    // gets terminated soon.
      requestedMaxKeepAliveCount : 10, // 2
      maxNotificationsPerPublish : 10,
      publishingEnabled : true,
      priority : 10
    };

    self.subscription = new nodeopcua.ClientSubscription(self.session,subscriptionSettings);

    self.subscription.on("started", function() {
      console.log("mi5Subscribe: subscription started - subscriptionId=",
        opcua.subscription.subscriptionId);
    });

    self.subscription.on("keepalive", function() {
      console.log('SUBS: keepalive');
    }).on("terminated", function() {
      console.log('SUBS: terminated');
    });

    resolve({status: 'ok', description: 'subscription created'});
  });
};

opcua.prototype.monitor = function(nodes) {
  var nodeopcua = require('node-opcua');

  var self = this;

  nodes = [nodes];
  nodes = nodes.map(helper.checkAndCorrectNodeId);
  nodes = nodes.map(helper.modifiyNodeArray);
  nodes = nodes.map(helper.addAtributeId);

  // Monitor settings
  var requestedParameters = {
    samplingInterval : 100,
    discardOldest : true,
    queueSize : 1 // for mqtt publisher, take only 1
  };
  var timestampToReturn = nodeopcua.read_service.TimestampsToReturn.Both;

  return new Promise(function(resolve) {
    var monitoredNode = self.subscription.monitor(nodes[0],
      requestedParameters, timestampToReturn);

    setTimeout(function(){
      resolve(monitoredNode);
    },0);
  });
};

//==================================================================================
//========================= Helper Function ========================================
//==================================================================================

var helper = require('./opc-helper.js').helper;
