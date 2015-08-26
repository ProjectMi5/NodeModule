/**
 * Created by Thomas on 26.08.2015.
 */
//var config = require('./../config.js');

/*global require,setInterval,console */
var opcua = require("node-opcua");

// Promise API for server createion
var Q = require('q');

// Let's create an instance of OPCUAServer
var server = new opcua.OPCUAServer({
  port: 4334, // the port of the listening socket of the server
  resourcePath: "UA/InputModuleMock", // this path will be added to the endpoint resource name
  buildInfo : {
    productName: "InputModuleMock",
    buildNumber: "7658",
    buildDate: new Date(2015,8,6)
  }
});

/**
 * Promised based API for server
 *
 * usage: serverQ()
 *         .then(post_initialize)
 *         .then(start_server);
 * @returns {Promise}
 */
var serverQ = function(){
  return Q.Promise(function(resolve){
    server.initialize(resolve);
  });
}
exports.opcuaserver = serverQ().then(post_initialize).then(start_server);

function post_initialize() {
  console.log("initialized");
  function construct_my_address_space(server) {

    server.engine.addFolder("RootFolder",{ browseName: "Mi5"});
    server.engine.addFolder("Mi5",{ browseName: "Module2501"});

    // add a variable named MyVariable2 to the newly created folder "MyDevice"
    var execute = false;
    server.varExecute = server.engine.addVariable("Module2501",{

      nodeId: "ns=4;s=MI5.Module2501.Input.SkillInput.SkillInput0.Execute",
      browseName: "Execute",
      dataType: "Boolean",
      value: {
        get: function () {
          return new opcua.Variant({dataType: opcua.DataType.Boolean, value: execute });
        },
        set: function (variant) {
          execute = variant.value;
          return opcua.StatusCodes.Good;
        }
      }
    });
  }

  return Q.promise(function(resolve){
    construct_my_address_space(server);
    resolve();
  });
}

function start_server(){
  return Q.promise(function(resolve){
    server.start(function() {
      console.log("Server is now listening ... ( press CTRL+C to stop)");
      console.log("port ", server.endpoints[0].port);
      var endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
      console.log(" the primary server endpoint url is ", endpointUrl );

      resolve();
    });
  });
}
