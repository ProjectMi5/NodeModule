/**
 * Created by Thomas on 26.08.2015.
 */
var config = require('./../config.js');

var assert = require('chai').assert;


describe('Test OPC UA library', function(){

  before(function(done){
    this.timeout(5*1000);
    var opcuaserver = require('./mock/opcua-server');
    opcuaserver.instance().done(done); //wait until server is started
  });

  describe('test opcua instance', function(){
    var opc = new require('./../models/opc.js');
    var opcua = new opc.opcua();

    var nodeId = 'MI5.Module2501.Input.SkillInput.SkillInput0.Execute';

    describe('#connect() connect to mock opc ua server', function() {
      it('opc.connected should be true', function () {
        return opcua.connect(config.endpointurl)
          .then(function () {
            assert.isTrue(opcua.connected);
          });
      });
    });

    describe('#readArray() read an array of nodes', function(){
      it('read one boolean element', function(){
        return opcua.readArray([nodeId])
          .then(function(results){
            console.log(results);

            assert.isArray(results);
            assert.equal(results[0].nodeId, nodeId);
            assert.isFalse(results[0].value, 'must be false');
          });
      });
    });

    describe('#read()', function(){
      it('read one element', function(){
        return opcua.read(nodeId)
          .then(function(result){
            console.log(result);

            assert.equal(result.nodeId, nodeId);
            assert.isFalse(result.value);
          });
      });
    });

    describe('#writeCB()', function(){
      it('should overwrite execute with true', function(done){ //callback needed, since writeCB is cb function
        opcua.writeCB(nodeId, true, 'Boolean', function(err, result){
          console.log(err, result);

          assert.isNull(err);
          assert.equal(result.name,'Good');

          // Test
          opcua.read(nodeId)
            .then(function(result){
              assert.isTrue(result.value);
            }).done(done); // catch exceptions caught in the promise chain by envoking final done callback
        });
      });
    });

    describe('#write()', function(){
      it('should overwrite execute with false', function(){
        return opcua.write(nodeId, true, 'Boolean')
          .then(function(result){
            assert.equal(result.name,'Good');

            // Test
            return opcua.read(nodeId)
              .then(function(result){
                assert.isTrue(result.value);
              });
          })
          .catch(function(err){
            assert.isNull(err);
          });
      });
    });

    describe('#subscribe()', function(){
      it('should create a subscription', function(){
        return opcua.subscribe()
          .then(function(result){
            assert.equal(result.status,'ok');
            //console.log(opcua.subscription);
          });
      });
    });

    describe('#monitor()', function(){
      it('should monitor an item (subscription required)', function(done){
        opcua.monitor(nodeId)
          .then(function(monitoredItem){
            assert(typeof monitoredItem != 'undefined', 'monitoredItem not undefined');
            monitoredItem.on('changed', function(data){
              console.log('changed value', data.value.value);
              assert(data.value.value == true, 'monitored a change');
              done();
            });

            opcua.write(nodeId, false, 'Boolean');
            opcua.write(nodeId, true, 'Boolean');

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