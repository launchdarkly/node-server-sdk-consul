const ConsulFeatureStore = require('../consul_feature_store');
const {
  runPersistentFeatureStoreTests,
} = require('launchdarkly-node-server-sdk/sharedtest/store_tests');
const consul = require('consul');

// Runs the standard test suites provided by the SDK's store_tests module.

function actualPrefix(prefix) {
  return prefix || 'launchdarkly';
}

function clearAllData(client) {
  return async (prefix) => {
    await client.kv.del({ key: actualPrefix(prefix), recurse: true });
  };
}

describe('ConsulFeatureStore', function() {

  const client = consul({ promisify: true });

  function createStore(prefix, cacheTTL, logger) {
    return ConsulFeatureStore({ prefix, cacheTTL })({ logger });
  }

  function createStoreWithConcurrentUpdateHook(prefix, logger, hook) {
    const store = createStore(prefix, 0, logger);
    store.underlyingStore.testUpdateHook = hook;
    return store;
  }

  runPersistentFeatureStoreTests(
    createStore,
    clearAllData(client),
    createStoreWithConcurrentUpdateHook,
  );
});
