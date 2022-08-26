'use strict';

const got = require('got');
const { LockingAsync } = require('../index.js');

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
});
