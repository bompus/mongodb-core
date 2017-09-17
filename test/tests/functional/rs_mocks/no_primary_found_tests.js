'use strict';
var assign = require('../../../../lib/utils').assign,
  co = require('co'),
  Connection = require('../../../../lib/connection/connection'),
  mock = require('../../../mock'),
  ConnectionSpy = require('../shared').ConnectionSpy;

let test = {};
describe('ReplSet No Primary Found (mocks)', function() {
  beforeEach(() => {
    test.spy = new ConnectionSpy();
    Connection.enableConnectionAccounting(test.spy);
  });

  afterEach(() => {
    return mock.cleanup(test.spy).then(() => {
      test.spy = undefined;
      Connection.disableConnectionAccounting();
    });
  });

  it('Should correctly connect to a replicaset where the arbiter hangs no primary found error', {
    metadata: {
      requires: {
        generators: true,
        topology: 'single'
      }
    },

    test: function(done) {
      var ReplSet = this.configuration.mongo.ReplSet,
        ObjectId = this.configuration.mongo.BSON.ObjectId;

      // Contain mock server
      var primaryServer = null;
      var firstSecondaryServer = null;
      var secondSecondaryServer = null;
      var arbiterServer = null;

      // Default message fields
      var defaultFields = {
        setName: 'rs',
        setVersion: 1,
        electionId: new ObjectId(),
        maxBsonObjectSize: 16777216,
        maxMessageSizeBytes: 48000000,
        maxWriteBatchSize: 1000,
        localTime: new Date(),
        maxWireVersion: 3,
        minWireVersion: 0,
        ok: 1,
        hosts: ['localhost:32000', 'localhost:32001', 'localhost:32002'],
        arbiters: ['localhost:32003']
      };

      // Primary server states
      var primary = [
        assign({}, defaultFields, {
          ismaster: true,
          secondary: false,
          me: 'localhost:32000',
          primary: 'localhost:32000'
        })
      ];

      // Primary server states
      var firstSecondary = [
        assign({}, defaultFields, {
          ismaster: false,
          secondary: true,
          me: 'localhost:32001',
          primary: 'localhost:32000'
        })
      ];

      // Primary server states
      var secondSecondary = [
        assign({}, defaultFields, {
          ismaster: false,
          secondary: true,
          me: 'localhost:32002',
          primary: 'localhost:32000'
        })
      ];

      // Primary server states
      var arbiter = [
        assign({}, defaultFields, {
          ismaster: false,
          secondary: false,
          arbiterOnly: true,
          me: 'localhost:32003',
          primary: 'localhost:32000'
        })
      ];

      // Boot the mock
      co(function*() {
        primaryServer = yield mock.createServer(32000, 'localhost');
        firstSecondaryServer = yield mock.createServer(32001, 'localhost');
        secondSecondaryServer = yield mock.createServer(32002, 'localhost');
        arbiterServer = yield mock.createServer(32003, 'localhost');

        primaryServer.setMessageHandler(request => {
          var doc = request.document;
          if (doc.ismaster) {
            request.reply(primary[0]);
          }
        });

        firstSecondaryServer.setMessageHandler(request => {
          setTimeout(() => {
            var doc = request.document;
            if (doc.ismaster) {
              request.reply(firstSecondary[0]);
            }
          }, 9000000); // never respond?
        });

        secondSecondaryServer.setMessageHandler(request => {
          var doc = request.document;
          if (doc.ismaster) {
            request.reply(secondSecondary[0]);
          }
        });

        arbiterServer.setMessageHandler(request => {
          setTimeout(() => {
            var doc = request.document;
            if (doc.ismaster) {
              request.reply(arbiter[0]);
            }
          }, 9000000); // never respond?
        });
      });

      // Attempt to connect
      var server = new ReplSet([{ host: 'localhost', port: 32000 }], {
        setName: 'rs',
        connectionTimeout: 2000,
        socketTimeout: 4000,
        haInterval: 2000,
        size: 1
      });

      // Add event listeners
      server.on('connect', function() {
        server.destroy();
        done();
      });

      server.on('error', done);
      setTimeout(function() {
        server.connect();
      }, 100);
    }
  });
});
