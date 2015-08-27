/**
 * Created by Thomas on 26.08.2015.
 */
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
 * Create the variables using a generalized function
 * @param server
 */
function construct_my_address_space(server) {
  server.engine.addFolder("RootFolder", {browseName: "Mi5"});
  server.engine.addFolder("Mi5", {browseName: "Module2501"});
  server.engine.addFolder("Module2501", {browseName: "Input"});
  server.engine.addFolder("Input", {browseName: "SkillInput"});
  server.engine.addFolder("SkillInput", {browseName: "SkillInput0"});

  createOpcuaVariable('SkillInput0', 'MI5.Module2501.Input.PositionInput', 'Double', 0);
  createOpcuaVariable('SkillInput0', 'MI5.Module2501.Input.SkillInput.SkillInput0.Execute', 'Boolean', false);

  server.engine.addFolder("Mi5", {browseName: "Recipe"});
  server.engine.addFolder("Recipe", {browseName: "Recipe[0]"});
  createOpcuaVariable('Recipe[0]', 'MI5.Recipe[0].Description', 'String', 'Recipe 0 description');
  createOpcuaVariable('Recipe[0]', 'MI5.Recipe[0].Name', 'String', 'XTS one Round');
  createOpcuaVariable('Recipe[0]', 'MI5.Recipe[0].RecipeID', 'Int16', 10001);
}

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
// exports a promise, so that the sole require does not start a server.
exports.instance = function(){
  return Q.promise(function(resolve){
    serverQ().then(post_initialize).then(start_server).then(resolve);
  });
}

/**
 * Create a console interface
 *
 * start the server directly using:
 * // $..PassiveModule\test\mock>node opcua-server.js --startServer
 */
if(process.argv.pop() == '--start'){
  serverQ().then(post_initialize).then(start_server);
}

/**
 * Construct the address space
 *
 * this post_initialize is from the node-opcua github example
 * @returns {Promise}
 */
function post_initialize() {
  console.log("initialized");

  return Q.promise(function(resolve){
    construct_my_address_space(server);
    resolve();
  });
}

/**
 * start the server
 *
 * @returns {Promise}
 */
function start_server(){
  return Q.promise(function(resolve){
    server.start(function(err) {
      console.log('err',err);
      console.log("Server is now listening ... ( press CTRL+C to stop)");
      console.log("port ", server.endpoints[0].port);
      var endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
      console.log(" the primary server endpoint url is ", endpointUrl );

      resolve();
    });
  });
}


//============================================================================================================
//===============================    Helper   ================================================================
//============================================================================================================
/**
 * Generate 15 digit random string
 * used for 'variable variable names'
 *
 * @returns {String}
 */
function createVariableName()
{
  var text = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwx";

  for( var i=0; i < 15; i++ )
    text += possible.charAt(Math.floor(Math.random() * possible.length));

  return text;
}

// important
var localVars = [];

/**
 * uses node v0.48
 *
 * @param parent
 * @param nodeId
 * @param type
 * @param value
 */
function createOpcuaVariable(parent, nodeId, type, value){
  var helper = require('./../../models/opc-helper.js').helper;

  nodeId = helper.checkAndCorrectNodeId(nodeId);
  var browseName = nodeId.split('.').pop();

  // add to localVars array
  var currentElement = localVars.length;
  localVars[currentElement] = value;

  // generate random string for adding to server object
  var randomString  = createVariableName();
  try{
    var options = {
      nodeId: nodeId,
      browseName: browseName,
      dataType: type,
      value: {
        get: function () {
          return new opcua.Variant({dataType: opcua.DataType[type], value: localVars[currentElement] });
        },
        set: function (variant) {
          if( type == 'Double'){
            localVars[currentElement] = parseFloat(variant.value);
          } else if ( type == 'Int16' ||  type == 'UInt16') {
            localVars[currentElement] = parseInt(variant.value, 10);
          } else { // e.g. String, Boolean
            localVars[currentElement] = variant.value;
          }
          return opcua.StatusCodes.Good;
        }
      }
    };
    server[randomString] = server.engine.addVariable(parent, options);
    console.log('created: ', nodeId);
  } catch(err){
    console.log('err',err);
  }
}