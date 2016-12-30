locking
-------

[![Build Status](https://travis-ci.org/mapbox/node-locking.svg?branch=master)](https://travis-ci.org/mapbox/node-locking)

Wraps any loader function of the form `loader(id, callback)` to use
an LRU cache and lock I/O operations across concurrent calls.

```js
var Locking = require('@mapbox/locking');
var fs = require('fs');
var readFile = Locking(fs.readFile);

// Reads file once, calls callback 10x.
for (var i = 0; i < 10; i++) {
    readFile('./sample.txt', function(err, data) {
        console.log(data);
    });
}
```

### Usage

```js
var options = {};
var lockingReader = Locking(reader, options);
```

`options` is passed directly to `lru-cache` (https://github.com/isaacs/node-lru-cache/blob/f25bdae0b4bb0166a75fa01d664a3e3cece1ce98/README.md#options) allowing you to set the max age, max items, and other behaviors of the LRU cache.

When `options.stale` is set to `true` the locking cache implements additional behavior to continue serving a stale item until the item has been refreshed in the background.

