locking
-------

[![Build Status](https://travis-ci.org/mapbox/node-locking.svg?branch=master)](https://travis-ci.org/mapbox/node-locking)

Wraps any loader function of the form `loader(id, callback)` to use
an LRU cache and lock I/O operations across concurrent calls.

    var Locking = require('@mapbox/locking');
    var fs = require('fs');
    var readFile = Locking(fs.readFile);

    // Reads file once, calls callback 10x.
    for (var i = 0; i < 10; i++) {
        readFile('./sample.txt', function(err, data) {
            console.log(data);
        });
    }

