# Changelog

## v4.0.0

**BREAKING**

- library now exports two items, `Locking` and `LockingAsync`
- `Locking` function, which contains the same interface as previous versions
- `LockingAsync` class, for managing async/promise functions of arbitrary parameters
- update lur-cache 7.x, this includes updated options:
  - `stale` is now `allowStale`
  - `maxAge` is now `ttl`
- use jest as a test runner
- test on node 16 & 18, drop node 10 & 12

## v3.3.0

- Make sure not to fetch data with a key that doesn't exist

## v3.2.0

- Upgraded to lru-cache 5.x
