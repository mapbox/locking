'use strict';

import { LRUCache } from 'lru-cache';
import hash from 'object-hash';

type HashKey = string;

export class LockingAsync {
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
  #locks: Record<string, [Function, Function][]>;
  #stale;
  #stats;
  cache: LRUCache<any, any, any>;
  func: Function;

  constructor(func: Function, params?: LRUCache.Options<any, any, any>) {
    if (!func)
      throw new Error(
        'Locking: locking class requires two arguments: function, params',
      );
    this.func = func;
    this.cache = new LRUCache({ max: 1000, ...params });
    this.#locks = {};
    this.#stale = !!params?.allowStale;
    this.#stats = {
      locks: 0,
      miss: 0,
      hit: 0,
      refreshHit: 0,
      calls: 0,
    };
  }

  #createKey(args: Record<any, any>) {
    return hash(args);
  }

  #resolveLocks(key: HashKey, result: any) {
    const locks = this.#locks[key];
    if (!locks) return;
    delete this.#locks[key];
    locks.forEach((lock) => {
      lock[0](result);
    });
  }

  #rejectLocks(key: HashKey, err: any) {
    const locks = this.#locks[key];
    if (!locks) return;
    delete this.#locks[key];
    locks.forEach((lock) => {
      lock[1](err);
    });
  }

  get stats() {
    const activeLocks =
      Object.keys(this.#locks).reduce((total, key) => {
        return (total += this.#locks[key].length);
      }, 0) || 0;

    return {
      activeLocks,
      size: this.cache.size,
      ...this.#stats,
    };
  }

  async get(...args: any[]) {
    this.#stats.calls++;
    return new Promise(async (resolve, reject) => {
      let staleRefresh = false;
      const key = this.#createKey(args);
      const cached = this.cache.get(key);
      // if item is in the cache, return to caller
      if (cached) {
        this.#stats.hit++;
        if (!this.#stale) return resolve(cached);

        // item is not stale
        if (this.cache.has(key)) return resolve(cached);

        // item is in cache but stale
        // resolve with stale item but keep refreshing
        // in the background
        this.#stats.refreshHit++;
        resolve(cached);
        staleRefresh = true;
        this.cache.set(key, cached);
      }

      this.#stats.miss++;

      // Use the lock if it exists to preserve the resolve/reject
      // functions of the promise to be called in the future.
      if (this.#locks[key] && !staleRefresh) {
        this.#stats.locks++;
        this.#locks[key].push([resolve, reject]);
        return;
      }

      // Set lock for 1 or more concurrent operations
      // for the same key. Do not set a lock for a stale
      // hit so we can just refresh the cache value
      // in the background
      if (!staleRefresh) {
        this.#locks[key] = [[resolve, reject]];
      }

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
