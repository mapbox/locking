import { describe, it, expect, vi, afterEach } from 'vitest';
// @ts-ignore
import { queue } from 'd3-queue';
import { Locking } from '../src';

afterEach(() => {
  vi.clearAllTimers();
});

describe('Callback', () => {
  it('locking singletons', () => {
    const testFunc = vi.fn((id: any, cb: Function) => {
      return cb(null, id);
    });

    const locker = Locking(testFunc, { max: 100, ttl: 1e3 });
    expect(locker).toEqual(Locking(testFunc, { max: 100, ttl: 1e3 }));
  });

  it('accepts object as id', () => {
    const testFunc = vi.fn((id: any, cb: Function) => {
      return cb(null, id);
    });

    const locker = Locking(testFunc);
    locker({ pathname: '/test' }, (err: any, res: any) => {
      expect(res).toEqual({ pathname: '/test' });
    });
  });

  it('passes errors', () => {
    const testFunc = vi.fn((id: any, cb: Function) => {
      return cb(new Error('test function fail'));
    });

    const locker = Locking(testFunc);
    locker('id', (err: any, res: any) => {
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toEqual('test function fail');
      expect(res).toBeUndefined();
    });
  });

  it('does not cache errors', () => {
    const testFunc = vi
      .fn()
      .mockReturnValueOnce((id: any, cb: Function) => {
        return cb(new Error('test function fail'));
      })
      .mockReturnValueOnce((id: any, cb: Function) => {
        return cb(null, `success with ${id}`);
      });

    const locker = Locking(testFunc);
    locker('hello', (err: any) => {
      expect(err).toBeInstanceOf(Error);

      locker('hello', (err: any, res: any) => {
        expect(err).toBeUndefined();
        expect(res).toEqual('success with hello');
      });
    });
  });

  it('locks i/o for multiple concurrent calls to the same id', () => {
    let callCount = 0;
    function asyncFunction(id: any, cb: Function) {
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
      .awaitAll((err: any) => {
        expect(err).toBeNull();
        expect(callCount).toBe(1);
      });
  });

  it('uses LRU for subsequent calls', () => {
    let counter = 0;
    const testFunc = vi.fn((id: any, cb: Function) => {
      counter++;
      return cb(null, `success for ${id}, counter: ${counter}`);
    });

    const locker = Locking(testFunc);
    locker('hello', () => {
      locker('hello', (err: any, result: any) => {
        expect(err).toBeFalsy();
        expect(result).toBe('success for hello, counter: 1');
        expect(testFunc.mock.calls.length).toBe(1);
      });
    });
  });

  it('uses LRU for subsequent calls', () => {
    let counter = 0;
    const testFunc = vi.fn((id: any, cb: Function) => {
      counter++;
      return cb(null, `success for ${id}, counter: ${counter}`);
    });

    const locker = Locking(testFunc);
    locker('hello', () => {
      locker('hello', (err: any, result: any) => {
        expect(err).toBeFalsy();
        expect(result).toBe('success for hello, counter: 1');
        expect(testFunc.mock.calls.length).toBe(1);
      });
    });
  });

  it('call after ttl expires is a fresh call', () => {
    vi.useFakeTimers();
    const obj: Record<any, any> = { some: 'data' };
    const testFunc = vi.fn((id: any, cb: Function) => {
      return cb(null, obj);
    });

    const locker = Locking(testFunc, { ttl: 1e3, max: 10 }); // 1 second ttl
    locker('id', (err: any, result: any) => {
      expect(result).toEqual({ some: 'data' });
      expect(testFunc.mock.calls.length).toBe(1);

      // update object
      obj.more = 'info';

      // wait for ttl to expire
      vi.runAllTimers();
      setTimeout(() => {
        locker('id', (err: any, result: any) => {
          expect(err).toBeFalsy();
          expect(result).toEqual({ some: 'data', more: 'info' });
          expect(testFunc.mock.calls.length).toBe(2);
          vi.useRealTimers();
        });
      }, 1e3);
    });
  });

  it('allowStale: true', () => {
    vi.useFakeTimers();
    const obj: Record<any, any> = { some: 'data' };
    const staleFunc = vi.fn((id: any, cb: Function) => {
      cb(null, obj);
    });

    const locker = Locking(staleFunc, { ttl: 500, max: 10, allowStale: true });

    locker('id', (err: any, result1) => {
      expect(result1).toMatchObject({ some: 'data' });
      expect(staleFunc.mock.calls.length).toBe(1);
      obj.more = 'info';

      locker('id', (err: any, result2) => {
        expect(result2).toMatchObject({ some: 'data' });
        expect(staleFunc.mock.calls.length).toBe(1);

        vi.runAllTimers();
        setTimeout(() => {
          locker('id', (err: any, result3) => {
            expect(result3).toMatchObject({ some: 'data', more: 'info' });
            expect(staleFunc.mock.calls.length).toBe(2);
            vi.useRealTimers();
          });
        }, 2000);
      });
    });
  });
});
