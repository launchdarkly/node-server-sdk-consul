var ConsulFeatureStore = require('../consul_feature_store');
var testBase = require('launchdarkly-node-server-sdk/test/feature_store_test_base');
var consul = require('consul');

describe('ConsulFeatureStore', function() {

  var client = consul();

  function clearTable(done) {
    client.kv.del({ key: 'launchdarkly', recurse: true }, function() {
      done();
    });
  }

  function makeStore() {
    return new ConsulFeatureStore();
  }

  function makeStoreWithoutCache() {
    return new ConsulFeatureStore({ cacheTTL: 0 });
  }

  function makeStoreWithPrefix(prefix) {
    return new ConsulFeatureStore({ prefix: prefix, cacheTTL: 0 });
  }

  function makeStoreWithHook(hook) {
    var store = makeStore();
    store.underlyingStore.testUpdateHook = hook;
    return store;
  }

  describe('cached', function() {
    testBase.baseFeatureStoreTests(makeStore, clearTable, true);
  });

  describe('uncached', function() {
    testBase.baseFeatureStoreTests(makeStoreWithoutCache, clearTable, false, makeStoreWithPrefix);
  });

  testBase.concurrentModificationTests(makeStore, makeStoreWithHook);
});
