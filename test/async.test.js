'use strict';

const got = require('got');
const { LockingAsync }  = require('../index.js');
// const LockingAsync = Locking.LockingAsync;

const sleep = (time) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      return resolve();
    }, time);
  });
};

describe('Locking', () => {
  it('fails without provided async method', () => {
    expect(() => {
      new LockingAsync();
    }).toThrow(/Locking: locking class requires two arguments: function, params/);
  });

  it('no parameters', async () => {
    const stub = jest.fn((input) => {
      return Promise.resolve(`output of ${input}`);
    });

    const locker = new LockingAsync(stub);
    expect(await locker.get('hello')).toBe('output of hello');
    expect(await locker.get('hello')).toBe('output of hello');
    expect(stub.mock.calls.length).toBe(1);
    expect(await locker.get('world')).toBe('output of world');
    expect(await locker.get('world')).toBe('output of world');
    expect(stub.mock.calls.length).toBe(2);
  });

  it('throws original function error', async () => {
    const stub = jest.fn(() => {
      return Promise.reject(new Error('This is an error!'));
    });

    const locker = new LockingAsync(stub);
    try {
      await locker.get();
      throw new Error('test should not reach here!');
    } catch (err) {
      expect(err.message).toBe('This is an error!');
      expect(err).toBeInstanceOf(Error);
    }
  });

  it('concurrent cache misses use internal locking mechanism', async () => {
    const counter = 1;
    const ioPromise = jest.fn((a) => {
      return new Promise((resolve) => {
        setTimeout(() => {
          return resolve(`${a}_${counter}`);
        }, 100);
      });
    });

    const locker = new LockingAsync(ioPromise);

    // calling the i/o function three times concurrently should
    // result in only a single i/o operation, and therefore the
    // concurrentCounter should only increment once, not three times.
    const results = await Promise.all([
      locker.get('red'),
      locker.get('red'),
      locker.get('red')
    ]);

    expect(results).toEqual(['red_1', 'red_1', 'red_1']);
    expect(ioPromise.mock.calls.length).toBe(1);
  });

  it('works with promise function of strings', async () => {
    const promiseWithStrings = jest.fn((a, b, c) => {
      return Promise.resolve(`output of ${a}, ${b}, ${c}`);
    });

    const locker = new LockingAsync(promiseWithStrings);
    expect(await locker.get('one', 'two', 'three')).toBe('output of one, two, three');
  });

  it('works with promise function of objects', async () => {
    const promiseWithObjects = jest.fn((a, b) => {
      return Promise.resolve(`output of ${JSON.stringify(a)}, ${JSON.stringify(b)}`);
    });

    const locker = new LockingAsync(promiseWithObjects);
    expect(await locker.get({ one: 'one' }, { option: true })).toBe('output of {"one":"one"}, {"option":true}');
  });

  it('works with promise function of numbers', async () => {
    const promiseWithNumbers = jest.fn((a, b) => {
      return Promise.resolve(a + b);
    });

    const locker = new LockingAsync(promiseWithNumbers);
    expect(await locker.get(4, 5)).toBe(9);
  });

  it('works with promise function of mixed types', async () => {
    const promiseWithMixed = jest.fn((a, b, c) => {
      return Promise.resolve(`output of ${typeof a}, ${typeof b}, ${typeof c}`);
    });

    const locker = new LockingAsync(promiseWithMixed);
    expect(await locker.get({ option: true }, 1, 'hello')).toBe('output of object, number, string');
  });

  it('works with complex promise function', async () => {
    const timeoutPromise = jest.fn(() => {
      return new Promise((resolve) => {
        setTimeout(() => {
          return resolve({ structured: 'data' });
        }, 500);
      });
    });

    const locker = new LockingAsync(timeoutPromise);
    expect(await locker.get({ option: true }, 1, 'hello')).toEqual({ structured: 'data' });
  });

  it('evicts old keys', async () => {
    const stub = jest.fn((input) => {
      return Promise.resolve(`output of ${input}`);
    });

    const locker = new LockingAsync(stub, { max: 1 });
    expect(await locker.get('hello')).toBe('output of hello');
    expect(await locker.get('world')).toBe('output of world');
    expect(await locker.get('hola')).toBe('output of hola');
    expect(await locker.get('mundo')).toBe('output of mundo');
    expect(stub.mock.calls.length).toBe(4);
    expect(locker.cache.size).toBe(1);
    expect(locker.cache.dump()).toEqual([['1119717257625be99c2c5ed29dd1fe31720f9b76', { value: 'output of mundo' }]]);
  });

  it('real life http', async () => {
    const httpFetch = jest.fn((url) => {
      return got(url).json();
    });

    const cache = new LockingAsync(httpFetch);
    const responses = await Promise.all([
      cache.get('https://api.mapbox.com'),
      cache.get('https://api.mapbox.com'),
      cache.get('https://api.mapbox.com'),
      cache.get('https://api.mapbox.com'),
      cache.get('https://api.mapbox.com')
    ]);
    expect(responses).toEqual([
      { api: 'mapbox' },
      { api: 'mapbox' },
      { api: 'mapbox' },
      { api: 'mapbox' },
      { api: 'mapbox' }
    ]);
    expect(httpFetch.mock.calls.length).toBe(1);
  });

  it('allowStale: true', async () => {
    const obj = { some: 'data' };
    const func = jest.fn(() => {
      return Promise.resolve(obj);
    });

    const locker = new LockingAsync(func, { ttl: 500, max: 10, allowStale: true });
    expect(await locker.get('hello')).toMatchObject({ some: 'data' });
    expect(await locker.get('hello')).toMatchObject({ some: 'data' });
    expect(func.mock.calls.length).toBe(1);
    expect(locker.stats).toHaveProperty('refreshHit', 0);
    obj.more = 'info';
    await sleep(501);
    expect(await locker.get('hello')).toMatchObject({ some: 'data', more: 'info' });
    expect(locker.stats).toHaveProperty('refreshHit', 1);
  });

  it('stats', async () => {
    const func = jest.fn((id) => {
      return Promise.resolve(id);
    });

    const cache = new LockingAsync(func);
    expect(await cache.get('id')).toEqual('id');
    expect(await cache.get('id')).toEqual('id');
    expect(await cache.get('id')).toEqual('id');
    expect(await cache.get('id')).toEqual('id');
    expect(cache.stats).toMatchObject({
      calls: 4,
      miss: 1,
      hit: 3,
      size: 1,
      activeLocks: 0,
      locks: 0
    });
  });

  it('stats, i/o', async () => {
    const ioPromise = jest.fn((a) => {
      return new Promise((resolve) => {
        setTimeout(() => {
          return resolve(`${a}`);
        }, 100);
      });
    });

    const locker = new LockingAsync(ioPromise);

    await Promise.all([
      locker.get('red'),
      locker.get('red'),
      locker.get('red')
    ]);

    expect(locker.stats).toMatchObject({
      calls: 3,
      miss: 3,
      hit: 0,
      size: 1,
      activeLocks: 0,
      locks: 2
    });
  });

  it('stats, activeLocks', async () => {
    const func = jest.fn((a) => {
      return new Promise((resolve) => {
        return resolve(`${a}`);
      });
    });

    const locker = new LockingAsync(func);
    const promises = Promise.all([
      locker.get('hello'),
      locker.get('hello')
    ]);

    expect(locker.stats).toHaveProperty('activeLocks', 2);
    await promises;
    expect(locker.stats).toHaveProperty('activeLocks', 0);
  });
});
