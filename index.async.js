'use strict';

const LRU = require('lru-cache');
const hash = require('object-hash');

module.exports.Locking = class Locking {
  /*
  temporary locker for holding resolve/rejects of
  concurrent cache misses for the same key

  The locker key includes an array of promise resolve/reject
  functions to be invoked once the original caller
  fetches the result of the operation. Example:

  {
    "1119717257625be99": [[resolve, reject], [resolve, reject], [resolve, reject]]
  }
  */
  #locks;

  constructor(func, params) {
    if (!func) throw new Error('Locking: locking class requires two arguments: function, params');
    this.func = func;
    this.cache = new LRU({ ...{ max: 1000 }, ...params });
    this.#locks = {};
    this.stats = {
      locks: 0,
      miss: 0,
      hit: 0
    };
  }

  #createKey(args) {
    return hash(args);
  }

  #resolveLocks(key, result) {
    const locks = this.#locks[key];
    delete this.#locks[key];
    locks.forEach((lock) => {
      this.stats.locks++;
      lock[0](result);
    });
  }

  #rejectLocks(key, err) {
    const locks = this.#locks[key];
    delete this.#locks[key];
    locks.forEach((lock) => {
      this.stats.locks++;
      lock[1](err);
    });
  }

  async call() {
    const args = [... arguments];
    return new Promise(async (resolve, reject) => {
      const key = this.#createKey(args);
      const cached = this.cache.get(key);
      // if item is in the cache, return to caller
      if (cached) return resolve(cached);

      // use the lock if it exists
      // preserve the resolve promise to be called
      // in the future
      if (this.#locks[key]) {
        this.#locks[key].push([resolve, reject]);
        return;
      }

      // set lock for 1 or more concurrent operations
      // for the same key
      this.#locks[key] = [[resolve, reject]];

      console.log(this.#locks);

      // get fresh item and resolve/reject 1 or more locks
      try {
        const result = await this.func(...args);
        this.cache.set(key, result);
        this.#resolveLocks(key, result);
      } catch (err) {
        this.#rejectLocks(key, err);
      }
    });
  }
}