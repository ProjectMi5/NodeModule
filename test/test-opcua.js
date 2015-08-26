/**
 * Created by Thomas on 26.08.2015.
 */
var config = require('./../config.js');

var assert = require('chai').assert;

describe('Test OPC UA library', function(){

  before(function(done){
    var opcuaserver = require('./opcua-server');
    opcuaserver.opcuaserver.then(done);
  });

  describe('test opcua instance', function(){
    var opc = new require('./../models/opc.js');
    var opcua = new opc.opcua();

    describe('#connectQ() connect to mock opc ua server', function() {
      it('opc.connected should be true', function (done) {
        opcua.connectQ(config.endpointurl)
          .then(function () {
            assert.isTrue(opcua.connected);
            done();
          });
      });
    });

    describe('#readArrayQ() read an array of nodes', function(){
      it('read one boolean element', function(done){
        var nodeId = 'MI5.Module2501.Input.SkillInput.SkillInput0.Execute';
        opcua.readArrayQ([nodeId])
          .then(function(results){
            assert.isArray(results);
            assert.equal(results[0].nodeId, nodeId);
            assert.isFalse(results[0].value);
            done();
          });
      });
    });

    describe('#readQ()', function(){
      it('read one element', function(done){
        var nodeId = 'MI5.Module2501.Input.SkillInput.SkillInput0.Execute';
        opcua.readQ(nodeId)
          .then(function(result){
            assert.equal(result.nodeId, nodeId);
            assert.isFalse(result.value);
            done();
          });
      });
    });

    describe('#disconnectQ() from mock opc ua server', function(){
      it('opc.connected should be false', function(done){
        opcua.disconnectQ()
          .then(function() {
            assert.isFalse(opcua.connected, 'no connection');
            done();
          });
      });
    });
  });


});