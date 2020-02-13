var consul = require('consul');
var winston = require('winston');

var CachingStoreWrapper = require('launchdarkly-node-server-sdk/caching_store_wrapper');

var defaultCacheTTLSeconds = 15;
var defaultPrefix = 'launchdarkly';
var notFoundError = 'not found'; // unfortunately the Consul client doesn't have error classes or codes

function ConsulFeatureStore(options) {
  var ttl = options && options.cacheTTL;
  if (ttl === null || ttl === undefined) {
    ttl = defaultCacheTTLSeconds;
  }
  return new CachingStoreWrapper(consulFeatureStoreInternal(options), ttl, 'Consul');
}

function consulFeatureStoreInternal(options) {
  options = options || {};
  var logger = (options.logger ||
    new winston.Logger({
      level: 'info',
      transports: [
        new (winston.transports.Console)(),
      ]
    })
  );
  var client = consul(Object.assign({}, options.consulOptions, { promisify: true }));
  // Note, "promisify: true" causes the client to decorate all of its methods so they return Promises
  // instead of taking callbacks. That's the reason why we can't let the caller pass an already-created
  // client to us - because our code wouldn't work if it wasn't in Promise mode.
  var prefix = (options.prefix || defaultPrefix) + '/';

  var store = {};

  function kindKey(kind) {
    return prefix + kind.namespace + '/';
  }

  function itemKey(kind, key) {
    return kindKey(kind) + key;
  }

  function initedKey() {
    return prefix + '$inited';
  }

  // The issue here is that this Consul client is very literal-minded about what is an error, so if Consul
  // returns a 404, it treats that as a failed operation rather than just "the query didn't return anything."
  function suppressNotFoundErrors(promise) {
    return promise.catch(function(err) {
      if (err.message == notFoundError) {
        return Promise.resolve();
      }
    });
  }

  function logError(err, actionDesc) {
    logger.error('Consul error on ' + actionDesc + ': ' + err);
  }

  function errorHandler(cb, failValue, message) {
    return function(err) {
      logError(err, message);
      cb(failValue);
    };
  }

  store.getInternal = function(kind, key, cb) {
    suppressNotFoundErrors(client.kv.get({ key: itemKey(kind, key) }))
      .then(function(result) {
        cb(result ? JSON.parse(result.Value) : null);
      })
      .catch(errorHandler(cb, null, 'query of ' + kind.namespace + ' ' + key));
  };

  store.getAllInternal = function(kind, cb) {
    suppressNotFoundErrors(client.kv.get({ key: kindKey(kind), recurse: true }))
      .then(function(result) { 
        var itemsOut = {};
        if (result) {
          result.forEach(function(value) {
            var item = JSON.parse(value.Value);
            itemsOut[item.key] = item;
          });
        }
        cb(itemsOut);
      })
      .catch(errorHandler(cb, {}, 'query of all ' + kind.namespace));
  };

  store.initOrderedInternal = function(allData, cb) {
    suppressNotFoundErrors(client.kv.keys({ key: prefix }))
      .then(function(keys) {
        var oldKeys = new Set(keys || []);
        oldKeys.delete(initedKey());

        // Write all initial data (without version checks). Note that on other platforms, we batch
        // these operations using the KV.txn endpoint, but the Node Consul client doesn't support that.
        var promises = [];
        allData.forEach(function(collection) {
          var kind = collection.kind;
          collection.items.forEach(function(item) {
            var key = itemKey(kind, item.key);
            oldKeys.delete(key);
            var op  = client.kv.set({ key: key, value: JSON.stringify(item) });
            promises.push(op);
          });
        });

        // Remove existing data that is not in the new list.
        oldKeys.forEach(function(key) {
          var op = client.kv.del({ key: key });
          promises.push(op);
        });

        // Always write the initialized token when we initialize.
        var op = client.kv.set({ key: initedKey(), value: '' });
        promises.push(op);
      
        return Promise.all(promises);
      })
      .then(function() { cb(); })
      .catch(errorHandler(cb, null, 'init'));
  };

  store.upsertInternal = function(kind, newItem, cb) {
    var key = itemKey(kind, newItem.key);
    var json = JSON.stringify(newItem);

    var tryUpdate = function() {
      return suppressNotFoundErrors(client.kv.get({ key: key }))
        .then(function(oldValue) {
          // instrumentation for unit tests
          if (store.testUpdateHook) {
            return new Promise(store.testUpdateHook).then(function() { return oldValue; });
          } else {
            return oldValue;
          }
        })
        .then(function(oldValue) {
          var oldItem = oldValue && JSON.parse(oldValue.Value);

          // Check whether the item is stale. If so, don't do the update (and return the existing item to
          // FeatureStoreWrapper so it can be cached)
          if (oldItem && oldItem.version >= newItem.version) {
            return oldItem;
          }

          // Otherwise, try to write. We will do a compare-and-set operation, so the write will only succeed if
          // the key's ModifyIndex is still equal to the previous value returned by getEvenIfDeleted. If the
          // previous ModifyIndex was zero, it means the key did not previously exist and the write will only
          // succeed if it still doesn't exist.
          var modifyIndex = oldValue ? oldValue.ModifyIndex : 0;
          var p = client.kv.set({ key: key, value: json, cas: modifyIndex });
          return p.then(function(result) {
            return result ? newItem : tryUpdate(); // start over if the compare-and-set failed
          });
        });
    };

    tryUpdate().then(
      function(result) { cb(null, result); },
      function(err) {
        logger.error('failed to update: ' + err);
        cb(err, null);
      });
  };

  store.initializedInternal = function(cb) {
    suppressNotFoundErrors(client.kv.get({ key: initedKey() }))
      .then(function(result) { cb(!!result); })
      .catch(errorHandler(cb, false, 'initialized check'));
  };

  store.close = function() {
    // nothing to do here
  };

  return store;
}

module.exports = ConsulFeatureStore;
