# @mapbox/locking :lock: 

[![js](https://github.com/mapbox/locking/actions/workflows/test.yml/badge.svg)](https://github.com/mapbox/locking/actions/workflows/test.yml)

Wrap any callback or async function to use an LRU cache and prevent (lock) asynchronous operations across concurrent calls.

```sh
npm install --save @mapbox/locking
```

# Usage

```js
import { Locking, LockingAsync } from '@mapbox/locking';
```

The `options` objects are passed directly to [lru-cache](https://github.com/isaacs/node-lru-cache/tree/v10.4.3?tab=readme-ov-file#usage) allowing you to set the max age, max items, and other behaviors of the LRU cache. When `options.allowStale` is set to `true` the locking cache implements additional behavior to continue serving a stale item until the item has been refreshed in the background.

### `Locking(function, options)`

For locking callback functions in the form `function(id, callback)`. Returns a callable function

```js
import { Locking } from '@mapbox/locking';
import fs from 'fs';
const readFile = Locking(fs.readFile, options);

// Reads file once, calls callback 10x.
for (let i = 0; i < 10; i++) {
  readFile('./sample.txt', function(err, data) {
    console.log(data);
  });
}
```

### `LockingAsync(function, options)`

Constructor for locking promise or async functions in the form of `function(...arguments)`. This can manage functions of arbitrary arguments and types. Returns a class with two functions, which includes a callable method `get()` for calling the original function.

```js
import { LockingAsync } from '@mapbox/locking';
import got from 'got';

const jsonApi = new Locking((url) => {
  return got(url).json();
}, options);

// call function
await jsonApi.get('https://api.mapbox.com');
await jsonApi.get('https://api.mapbox.com');
await jsonApi.get('https://api.mapbox.com');

// get stats
console.log(jsonApi.stats); 
// { total: 3, hit: 2, miss: 1, locks: 2, refreshHit: 0, currentLocks: 0, size: 1 }
```

# Developing

```sh
npm ci          # setup
npm test        # run tests
npm run build   # build typescript
npm run format  # format with prettier
```