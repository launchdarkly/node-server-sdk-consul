var ConsulFeatureStore = require('../consul_feature_store');
var testBase = require('launchdarkly-node-server-sdk/test/feature_store_test_base');
var consul = require('consul');

function stubLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };
}

describe('ConsulFeatureStore', function() {

  var client = consul();

  function clearTable(done) {
    client.kv.del({ key: 'launchdarkly', recurse: true }, function() {
      done();
    });
  }

  const sdkConfig = { logger: stubLogger() };

  function makeStore() {
    return ConsulFeatureStore()(sdkConfig);
  }

  function makeStoreWithoutCache() {
    return ConsulFeatureStore({ cacheTTL: 0 })(sdkConfig);
  }

  function makeStoreWithPrefix(prefix) {
    return ConsulFeatureStore({ prefix: prefix, cacheTTL: 0 })(sdkConfig);
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
