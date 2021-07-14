import { ConsulFeatureStore, ConsulFeatureStoreImpl, defaultPrefix } from '../src/feature_store';

import * as Consul from 'consul';
import * as ld from 'launchdarkly-node-server-sdk';
import { runPersistentFeatureStoreTests } from 'launchdarkly-node-server-sdk/sharedtest/store_tests';

const client = new Consul({ promisify: true });

async function clearData(prefix) {
  await client.kv.del({ key: prefix || defaultPrefix, recurse: true });
}

describe('ConsulFeatureStore', function() {
  function createStore(prefix: string, cacheTTL: number, logger: ld.LDLogger) {
    return ConsulFeatureStore({ prefix, cacheTTL })({ logger });
  }

  function createStoreWithConcurrentUpdateHook(
    prefix: string,
    logger: ld.LDLogger,
    hook: (callback: () => void) => void,
  ) {
    const store = createStore(prefix, 0, logger);

    // Undocumented 'underlyingStore' property is currently the only way to access the RedisFeatureStoreImpl;
    // however, eslint does not like the 'object' typecast
    /* eslint-disable @typescript-eslint/ban-types */
    ((store as object)['underlyingStore'] as ConsulFeatureStoreImpl).testUpdateHook = hook;
    /* eslint-enable @typescript-eslint/ban-types */

    return store;
  }

  runPersistentFeatureStoreTests(
    createStore,
    clearData,
    createStoreWithConcurrentUpdateHook,
  );
});
