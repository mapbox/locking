# Changelog

## v5.0.0

- Convert to typescript
- Test with node.js 20.x 
- Replace TravisCI with GitHub Actions

## v4.0.0

**BREAKING**

- library now exports two items, `Locking` and `LockingAsync`
- `Locking` function, which contains the same interface as previous versions
- `LockingAsync` class, for managing async/promise functions of arbitrary parameters
- update lru-cache 7.x, this includes updated options:
  - `stale` is now `allowStale`
  - `maxAge` is now `ttl`
- use jest as a test runner
- test on node 16 & 18, drop node 10 & 12

## v3.3.0

- Make sure not to fetch data with a key that doesn't exist

## v3.2.0

- Upgraded to lru-cache 5.x
