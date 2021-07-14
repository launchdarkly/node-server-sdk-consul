import { DataKind, DataCollection, KeyedItems, VersionedData } from './feature_store_types';
import { LDConsulOptions } from './options';

import * as Consul from 'consul';
import { LDFeatureStore, LDLogger, LDOptions } from 'launchdarkly-node-server-sdk';
import * as CachingStoreWrapper from 'launchdarkly-node-server-sdk/caching_store_wrapper';

export const defaultPrefix = 'launchdarkly';
const defaultCacheTTLSeconds = 15;
const notFoundError = 'not found'; // unfortunately the Consul client doesn't have error classes or codes

/**
 * Create a feature flag store backed by Consul.
 * 
 * @returns
 *   A factory function that the SDK will use to create the data store. Put this value into the
 *   `featureStore` property of [[LDOptions]].
 */
export function ConsulFeatureStore(
  /**
   * Options for configuring the feature store.
   */
  options?: LDConsulOptions
): (config: LDOptions) => LDFeatureStore {
  const realOptions = options || {};
  const ttl = realOptions.cacheTTL === null || realOptions.cacheTTL === undefined
    ? defaultCacheTTLSeconds : realOptions.cacheTTL;

  return config =>
    new CachingStoreWrapper(
      new ConsulFeatureStoreImpl(realOptions, realOptions.logger || config.logger),
      ttl,
      'Consul'
    );
}

export class ConsulFeatureStoreImpl { // exported for tests
  public testUpdateHook: (callback: () => void) => void; // exposed for tests

  // The consul package does not have TypeScript definitions - hence the unfortunate use of "any" for
  // the client and its parameters.
  private client: any;
  private prefix: string;

  constructor(options: LDConsulOptions, public logger: LDLogger) {
    this.client = new Consul({ ...options.consulOptions, promisify: true });

    // Note, "promisify: true" causes the client to decorate all of its methods so they return Promises
    // instead of taking callbacks. That's the reason why we can't let the caller pass an already-created
    // client to us - because our code wouldn't work if it wasn't in Promise mode.

    this.prefix = (options.prefix || defaultPrefix) + '/';
  }

  public getInternal(kind: DataKind, key: string, callback: (item?: VersionedData) => void): void {
    (async () => {
      try {
        const result: any = await this.suppressNotFoundErrors(this.client.kv.get({ key: this.itemKey(kind, key) }));
        callback(result ? JSON.parse(result.Value) : null);
      } catch (err) {
        this.logError(err, `query of ${kind.namespace} ${key}`);
        callback(null);
      }
    })();
  }

  public getAllInternal(kind: DataKind, callback: (items: KeyedItems) => void): void {
    (async () => {
      try {
        const result: any = await this.suppressNotFoundErrors(this.client.kv.get({ key: this.kindKey(kind), recurse: true }));
        const itemsOut: KeyedItems = {};
        if (result) {
          for (const value of result) {
            const item = JSON.parse(value.Value);
            itemsOut[item.key] = item;
          }
        }
        callback(itemsOut);
      } catch (err) {
        this.logError(err, `query of all ${kind.namespace}`);
        callback(null);
      }
    })();
  }

  public initOrderedInternal(allData: Array<DataCollection>, callback: () => void): void {
    (async () => {
      try {
        const keys: string[] = await this.suppressNotFoundErrors(this.client.kv.keys({ key: this.prefix }));
        const oldKeys = new Set(keys || []);
        oldKeys.delete(this.initedKey());

        // Write all initial data (without version checks). Note that on other platforms, we batch
        // these operations using the KV.txn endpoint, but the Node Consul client doesn't support that.
        const promises = [];
        for (const collection of allData) {
          const kind = collection.kind;
          for (const item of collection.items) {
            const key = this.itemKey(kind, item.key);
            oldKeys.delete(key);
            const op = this.client.kv.set({ key: key, value: JSON.stringify(item) });
            promises.push(op);
          }
        }

        // Remove existing data that is not in the new list.
        oldKeys.forEach(key => {
          const op = this.client.kv.del({ key: key });
          promises.push(op);
        });

        // Always write the initialized token when we initialize.
        const op = this.client.kv.set({ key: this.initedKey(), value: '' });
        promises.push(op);
      
        await Promise.all(promises);
        callback();
      } catch (err) {
        this.logError(err, 'init');
        callback();
      }
    })();
  }

  public upsertInternal(
    kind: DataKind,
    newItem: VersionedData,
    callback: (err: Error, finalItem: VersionedData) => void,
  ): void {
    const key = this.itemKey(kind, newItem.key);
    const json = JSON.stringify(newItem);

    (async () => {
      let done = false;
      let result = newItem;
      try {
        while (!done) {
          const oldValue: any = await this.suppressNotFoundErrors(this.client.kv.get({ key: key }));

          // instrumentation for unit tests
          if (this.testUpdateHook) {
            await new Promise<void>(resolve => this.testUpdateHook(resolve));
          }
          
          const oldItem = oldValue && JSON.parse(oldValue.Value);

          // Check whether the item is stale. If so, don't do the update (and return the existing item to
          // FeatureStoreWrapper so it can be cached)
          if (oldItem && oldItem.version >= newItem.version) {
            result = oldItem;
            done = true;
          } else {
            // Otherwise, try to write. We will do a compare-and-set operation, so the write will only succeed if
            // the key's ModifyIndex is still equal to the previous value returned by getEvenIfDeleted. If the
            // previous ModifyIndex was zero, it means the key did not previously exist and the write will only
            // succeed if it still doesn't exist.
            const modifyIndex = oldValue ? oldValue.ModifyIndex : 0;
            done = await this.client.kv.set({ key: key, value: json, cas: modifyIndex });
          }
        }
        callback(null, result);
      } catch (err) {
        this.logError(err, 'update');
        callback(err, null);
      }
    })();
  }

  public initializedInternal(callback: (result: boolean) => void): void {
    (async () => {
      try {
        const result = await this.suppressNotFoundErrors(this.client.kv.get({ key: this.initedKey() }));
        callback(!!result);
      } catch (err) {
        this.logError(err, 'initialized check');
        callback(false);
      }
    })();
  }

  public close(): void {
    // nothing to do here
  }

  private kindKey(kind: DataKind): string {
    return this.prefix + kind.namespace + '/';
  }

  private itemKey(kind: DataKind, key: string): string {
    return this.kindKey(kind) + key;
  }

  private initedKey(): string {
    return this.prefix + '$inited';
  }

  private async suppressNotFoundErrors<T>(promise: Promise<T>): Promise<T> {
    // The issue here is that this Consul client is very literal-minded about what is an error, so if Consul
    // returns a 404, it treats that as a failed operation rather than just "the query didn't return anything."
    try {
      return await promise;
    } catch (err) {
      if (err.message == notFoundError) {
        return null;
      }
      throw err;
    }
  }

  private logError(err: Error, actionDesc: string) {
    this.logger.error(`Consul error on ${actionDesc}: ${err}`);
  }
}
