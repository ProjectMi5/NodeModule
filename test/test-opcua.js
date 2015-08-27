/**
 * Created by Thomas on 26.08.2015.
 */
var config = require('./../config.js');

var assert = require('chai').assert;


describe('Test OPC UA library', function(){

  before(function(done){
    var opcuaserver = require('./mock/opcua-server');
    opcuaserver.instance().done(done); //wait until server is started
  });

  describe('test opcua instance', function(){
    var opc = new require('./../models/opc.js');
    var opcua = new opc.opcua();

    var nodeId = 'MI5.Module2501.Input.SkillInput.SkillInput0.Execute';

    describe('#connectQ() connect to mock opc ua server', function() {
      it('opc.connected should be true', function () {
        return opcua.connectQ(config.endpointurl)
          .then(function () {
            assert.isTrue(opcua.connected);
          });
      });
    });

    describe('#readArrayQ() read an array of nodes', function(){
      it('read one boolean element', function(){
        return opcua.readArrayQ([nodeId])
          .then(function(results){
            console.log(results);

            assert.isArray(results);
            assert.equal(results[0].nodeId, nodeId);
            assert.isFalse(results[0].value, 'must be false');
          });
      });
    });

    describe('#readQ()', function(){
      it('read one element', function(){
        return opcua.readQ(nodeId)
          .then(function(result){
            console.log(result);

            assert.equal(result.nodeId, nodeId);
            assert.isFalse(result.value);
          });
      });
    });

    describe('#write()', function(){
      it('should overwrite execute with true', function(done){ //callback needed, since write is cb function
        opcua.write(nodeId, true, 'Boolean', function(err, result){
          console.log(err, result);

          assert.isNull(err);
          assert.equal(result.name,'Good');

          // Test
          opcua.readQ(nodeId)
            .then(function(result){
              assert.isTrue(result.value);
            }).done(done); // catch exceptions caught in the promise chain by envoking final done callback
        });
      });
    });

    describe('#writeQ()', function(){
      it('should overwrite execute with false', function(){
        return opcua.writeQ(nodeId, true, 'Boolean')
          .then(function(result){
            assert.equal(result.name,'Good');

            // Test
            return opcua.readQ(nodeId)
              .then(function(result){
                assert.isTrue(result.value);
              });
          })
          .fail(function(err){
            assert.isNull(err);
          });
      });
    });

    describe('#disconnectQ() from mock opc ua server', function(){
      it('opc.connected should be false', function(){
        return opcua.disconnectQ()
          .then(function() {
            assert.isFalse(opcua.connected, 'no connection');
          });
      });
    });
  });


});