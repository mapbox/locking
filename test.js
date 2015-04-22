var Locking = require('./index.js');
var tape = require('tape');

var doc = {};

var io = {};
io['"a"'] = 0;
io['"b"'] = 0;

// Simulates a read function of the form `read(id, callback)`
var testRead = function(id, callback) {
    setTimeout(function() {
        io[JSON.stringify(id)]++;
        var data = JSON.parse(JSON.stringify(doc));
        data.id = id;
        callback(null, data);
    }, 100);
};

var reader = Locking(testRead, { maxAge: 2e3 });

tape('locking singletons', function(t) {
    t.equal(reader, Locking(testRead, { maxAge:2e3 }), 'singletons locking instances');
    t.end();
});


tape('accepts object as id', function(t) {
    reader({pathname:'/test'}, function(err, read) {
        t.deepEqual(read, { id: { pathname: '/test' } }, 'returns read object');
        t.end();
    });
});

tape('locks io for multiple calls', function(t) {
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

tape('gets stale doc before change + cache expiration', function(t) {
    reader('b', function(err, read) {
        t.deepEqual(read, {id:'b'});
        t.end();
    });
});

tape('gets fresh doc after change + cache expiration', function(t) {
    doc.extra = true;
    setTimeout(function() {
        reader('b', function(err, read) {
            t.deepEqual(read, {id:'b', extra:true});
            t.end();
        });
    }, 3000);
});

