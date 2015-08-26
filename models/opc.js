/**
 * Created by Thomas on 26.08.2015.
 */

//var config = require('./../config.js');
var nodeopcua = require('node-opcua');

//var EventEmitter = require("events").EventEmitter;
//var util = require("util");
//var assert = require("assert");
var _ = require("underscore");

var async = require("async");
var Q = require("q");
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
//========================= Helper Function ========================================
//==================================================================================

/**
 * Helper Class
 * @type {{checkAndCorrectNodeId: Function, modifiyNodeArray: Function, addAtributeId: Function, concatNodesAndResults: Function}}
 */
var helper = {
  /**
   * Check NodeId and adds / removes stuff if necessary
   *
   * @accepts 'MI5.Queue.Queue0.', 'ns=4;s=MI5.Queue.Queue0'
   * @param baseNode
   * @returns {String}
   */
  checkAndCorrectNodeId : function(baseNode) {
    // add . at the end if missing
    if (baseNode.slice(-1) == '.') {
      baseNode = baseNode.slice(0, -1);
    }

    // check for namespace and node-identifier
    if (baseNode.slice(0, 7) != 'ns=4;s=') {
      baseNode = 'ns=4;s=' + baseNode;
    }

    return baseNode;
  },

  /**
   * Adds node-opcua specific nodes values: 'node' --> {nodeId: node}
   *
   * @param string
   * @returns object
   */
  modifiyNodeArray : function(node) {
    return {
      nodeId : node
    };
  },

  /**
   * Add attributeId to node-object array:
   * {nodeId: node} ==> {nodeId: node, attributeId: 13}
   *
   * @param node
   * @returns {number}
   */
  addAtributeId : function(node){
    node.attributeId = 13;
    return node;
  },

  /**
   * Combines nodes and results to one data array with the structure:
   * [{"nodeId":"MI5.Module1101.Output.SkillOutput.SkillOutput0.Busy",
       * "value":0}, {...}, {...}]
   *
   * @param nodes :
   *          nodeId
   * @param results :
   *          value
   * @returns {Array}
   */
  concatNodesAndResults : function(nodes, results) {
    var output = new Array;
    for (var i = 0; i <= nodes.length; i++) {
      if (nodes[i] != undefined && results[i] != undefined) {
        // Check for BadNodeId (value: null, then statusCode)
        // console.log(nodes[i]);
        // console.log(results[i]);
        if (_.isEmpty(results[i].value)) {
          output[i] = {
            nodeId : nodes[i].nodeId.value,
            value : '',
            error : results[i].statusCode.description
          };
        } else {
          output[i] = {
            nodeId : nodes[i].nodeId.value,
            value : results[i].value.value
          };
        }
      }
    }
    return output;
  },



};

