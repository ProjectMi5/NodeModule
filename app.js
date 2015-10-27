/**
 * Passive Module for Input/Output module in Showcase Mi5
 *
 * @author Tomas Frei
 * @date 2015-08-06
 */
var config = require('./config.js');

var opcuaserver = require('./test/mock/opcua-server');
opcuaserver.instance().done(function(){
	console.log('OPC UA Server started, use CTRL+C to terminate.');
	console.log('Happy coding! - Project Mi5');
});

