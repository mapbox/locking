'use strict';

const loaders = [];
const cachers = [];
const LRU = require('lru-cache');

module.exports = locking;

/**
 * Wraps any loader function of the form `loader(id, callback)` to use
 * an LRU cache and lock I/O operations across concurrent calls.
 *
 * @param {Function} loader any asynchronous function that takes
 * a callback as its last argument.
 * @param {Object} options passed to the lru-cache instance
 * @returns {Function} a version of that function that locks on successive
 * simultaneous calls.
 */
function locking(loader, options) {
  const existing = loaders.indexOf(loader);
  if (existing !== -1) return cachers[existing];

  options = options || { max: 100, ttl: 30e3 };

  const cache = new LRU(options);
  const locks = {};
  const cacheStats = { hit:0, miss:0, mchit:0, mcmiss:0 };
  const cacher = options.allowStale ?
    createStaleCacher(cache, locks, cacheStats, loader) :
    createCacher(cache, locks, cacheStats, loader);
  cacher.cacheStats = cacheStats;
  cacher.cache = cache;
  loaders.push(loader);
  cachers.push(cacher);
  return cacher;
}

function createStaleCacher(cache, locks, cacheStats, loader) {
  return function(id, callback) {
    // Stringify objects.
    const key = JSON.stringify(id);

    // Instance is in LRU cache.
    const cached = cache.get(key);
    if (cached) {
      cacheStats.hit++;
      // The retrieved version of the object is not stale.
      if (cache.has(key)) {
        return callback(null, cached);
      // The retrieved version of the object was stale: return it and
      // cache a fresh version of the object in the background.
      //
      // 1. Return it
      // 2. Set it again in the cache so calls to the loader continue
      //    receiving the stale version until the fresh one is loaded
      // 3. Continue onto loading logic
      } else {
        callback(null, cached);
        cache.set(key, cached);
      }
    } else {
      // Previous instance creation is in progress (locking).
      if (locks[key]) return locks[key].push(callback);

      // Create a new lock.
      locks[key] = [callback];
    }

    loader(id, (err, instance) => {
      if (!err && instance) {
        cacheStats.miss++;
        cache.set(key, instance);
      }

      if (locks[key]) {
        const q = locks[key];
        delete locks[key];
        for (let i = 0; i < q.length; i++) {
          q[i](err, instance);
        }
      }
    });
  };
}

function createCacher(cache, locks, cacheStats, loader) {
  return (id, callback) => {
    // Stringify objects.
    const key = JSON.stringify(id);

    // Instance is in LRU cache.
    const cached = cache.get(key);
    if (cached) {
      cacheStats.hit++;
      return callback(null, cached);
    }

    // Previous instance creation is in progress (locking).
    if (locks[key]) return locks[key].push(callback);

    // Create a new lock.
    locks[key] = [callback];

    loader(id, (err, instance) => {
      if (!err && instance) {
        cacheStats.miss++;
        cache.set(key, instance);
      }

      if (locks[key]) {
        const q = locks[key];
        delete locks[key];
        for (let i = 0; i < q.length; i++) {
          q[i](err, instance);
        }
      }
    });
  };
}
