'use strict';

const { Locking } = require('../index.js');
const { queue } = require('d3-queue');

describe('Callback', () => {
  it('locking singletons', () => {
    const testFunc = jest.fn((id, cb) => {
      return cb(null, id);
    });

    const locker = Locking(testFunc, { max: 100, ttl: 1e3 });
    expect(locker).toEqual(Locking(testFunc, { max: 100, ttl: 1e3 }));
  });

  it('accepts object as id', () => {
    const testFunc = jest.fn((id, cb) => {
      return cb(null, id);
    });

    const locker = Locking(testFunc);
    locker({ pathname: '/test' }, (err, res) => {
      expect(res).toEqual({ pathname: '/test' });
    });
  });

  it('passes errors', () => {
    const testFunc = jest.fn((id, cb) => {
      return cb(new Error('test function fail'));
    });

    const locker = Locking(testFunc);
    locker('id', (err, res) => {
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toEqual('test function fail');
      expect(res).toBeUndefined();
    });
  });

  it('does not cache errors', () => {
    const testFunc = jest.fn()
      .mockReturnValueOnce((id, cb) => {
        return cb(new Error('test function fail'));
      }).mockReturnValueOnce((id, cb) => {
        return cb(null, `success with ${id}`);
      });

    const locker = Locking(testFunc);
    locker('hello', (err) => {
      expect(err).toBeInstanceOf(Error);

      locker('hello', (err, res) => {
        expect(err).toBeUndefined();
        expect(res).toEqual('success with hello');
      });
    });
  });

  it('locks i/o for multiple concurrent calls to the same id', () => {
    let callCount = 0;
    function asyncFunction(id, cb) {
      setTimeout(() => {
        callCount++;
        cb(null, id);
      }, 100);
    }

    const locker = Locking(asyncFunction);

    queue()
      .defer(locker, 'hello')
      .defer(locker, 'hello')
      .defer(locker, 'hello')
      .awaitAll((err) => {
        expect(err).toBeNull();
        expect(callCount).toBe(1);
      });
  });

  it('uses LRU for subsequent calls', () => {
    let counter = 0;
    const testFunc = jest.fn((id, cb) => {
      counter++;
      return cb(null, `success for ${id}, counter: ${counter}`);
    });

    const locker = Locking(testFunc);
    locker('hello', () => {
      locker('hello', (err, result) => {
        expect(err).toBeFalsy();
        expect(result).toBe('success for hello, counter: 1');
        expect(testFunc.mock.calls.length).toBe(1);
      });
    });
  });

  it('uses LRU for subsequent calls', () => {
    let counter = 0;
    const testFunc = jest.fn((id, cb) => {
      counter++;
      return cb(null, `success for ${id}, counter: ${counter}`);
    });

    const locker = Locking(testFunc);
    locker('hello', () => {
      locker('hello', (err, result) => {
        expect(err).toBeFalsy();
        expect(result).toBe('success for hello, counter: 1');
        expect(testFunc.mock.calls.length).toBe(1);
      });
    });
  });

  it('call after ttl expires is a fresh call', () => {
    jest.useFakeTimers();
    const obj = { some: 'data' };
    const testFunc = jest.fn((id, cb) => {
      return cb(null, obj);
    });

    const locker = Locking(testFunc, { ttl: 1e3, max: 10 }); // 1 second ttl
    locker('id', (err, result) => {
      expect(result).toEqual({ some: 'data' });
      expect(testFunc.mock.calls.length).toBe(1);

      // update object
      obj.more = 'info';

      // wait for ttl to expire
      jest.runAllTimers();
      setTimeout(() => {
        locker('id', (err, result) => {
          expect(err).toBeFalsy();
          expect(result).toEqual({ some: 'data', more: 'info' });
          expect(testFunc.mock.calls.length).toBe(2);
          jest.useRealTimers();
        });
      }, 1e3);
    });
  });

  it('allowStale: true', () => {
    jest.useFakeTimers();
    const obj = { some: 'data' };
    const staleFunc = jest.fn((id, cb) => {
      cb(null, obj);
    });

    const locker = Locking(staleFunc, { ttl: 500, max: 10, allowStale: true });

    locker('id', (err, result1) => {
      expect(result1).toMatchObject({ some: 'data' });
      expect(staleFunc.mock.calls.length).toBe(1);
      obj.more = 'info';

      locker('id', (err, result2) => {
        expect(result2).toMatchObject({ some: 'data' });
        expect(staleFunc.mock.calls.length).toBe(1);

        jest.runAllTimers();
        setTimeout(() => {
          locker('id', (err, result3) => {
            expect(result3).toMatchObject({ some: 'data', more: 'info' });
            expect(staleFunc.mock.calls.length).toBe(2);
            jest.useRealTimers();
          });
        }, 2000);
      });
    });
  });
});
