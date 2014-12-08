var Locking = require('./index.js');
var tape = require('tape');

var io = {};
io['"a"'] = 0;
io['"b"'] = 0;

// Simulates a read function of the form `read(id, callback)`
var testRead = function(id, callback) {
    setTimeout(function() {
        io[JSON.stringify(id)]++;
        callback(null, {id:id});
    }, 100);
};

tape('locking singletons', function(t) {
    t.equal(Locking(testRead), Locking(testRead), 'singletons locking instances');
    t.end();
});


tape('accepts object as id', function(t) {
    var reader = Locking(testRead);
    reader({pathname:'/test'}, function(err, read) {
        t.deepEqual(read, { id: { pathname: '/test' } }, 'returns read object');
        t.end();
    });
});

tape('locks io for multiple calls', function(t) {
    var reader = Locking(testRead);
    var hits = reader.cacheStats.hit;
    var remaining = 10;
    var data;
    for (var i = 0; i < 10; i++) {
        reader('a', function(err, read) {
            if (!data) {
                data = read;
            } else {
                t.deepEqual(data, read, 'data is shared amongst locked reader callbacks');
            }
            if (!--remaining) {
                t.equal(reader.cacheStats.hit - hits, 0, '0 LRU cache hits');
                t.equal(io['"a"'], 1, 'single I/O operation for a');
                t.end();
            }
        });
    }
});

tape('uses LRU for subsequent calls', function(t) {
    var reader = Locking(testRead);
    var hits = reader.cacheStats.hit;
    reader('b', function(err, data) {
        var remaining = 10;
        for (var i = 0; i < 10; i++) {
            reader('b', function(err, read) {
                t.deepEqual(data, read, 'data is shared amongst locked reader callbacks');
                if (!--remaining) {
                    t.equal(reader.cacheStats.hit - hits, 10, '10 LRU cache hits');
                    t.equal(io['"b"'], 1, 'single I/O operation for b');
                    t.end();
                }
            });
        }
    });
});

