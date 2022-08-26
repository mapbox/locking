var locking = require('../index.js');
var tape = require('tape');

var doc = {};

var io = {};
io['"a"'] = 0;
io['"b"'] = 0;
io['"err"'] = 0;

// Simulates a read function of the form `read(id, callback)`
var testRead = function(id, callback) {
    setTimeout(function() {
        io[JSON.stringify(id)]++;
        var data = JSON.parse(JSON.stringify(doc));
        data.id = id;
        // This purposefully simulates an I/O source that passes an error
        // object *and* futher args to the callback. While most I/O functions
        // don't pass anything beyond an error on failures when they do we
        // need to bypass caching.
        if (id === 'err') {
            callback(new Error('read fail'), data);
        } else {
            callback(null, data);
        }
    }, 100);
};

var reader = locking(testRead, { maxAge: 1e3, stale: true });

tape('locking singletons', function(t) {
    t.equal(reader, locking(testRead, { maxAge:1e3 }), 'singletons locking instances');
    t.end();
});


tape('accepts object as id', function(t) {
    reader({pathname:'/test'}, function(err, read) {
        t.deepEqual(read, { id: { pathname: '/test' } }, 'returns read object');
        t.end();
    });
});

tape('passes errors', function(t) {
    reader('err', function(err, read) {
        t.equal(err.toString(), 'Error: read fail');
        t.deepEqual(read, { id: 'err' });
        t.deepEqual(io['"err"'], 1, 'iops: 1');
        t.end();
    });
});

tape('does not cache object on errors', function(t) {
    reader('err', function(err, read) {
        t.equal(err.toString(), 'Error: read fail');
        t.deepEqual(read, { id: 'err' });
        t.deepEqual(io['"err"'], 2, 'iops: 2');
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

tape('stale step 1', function(t) {
    reader('b', function(err, read) {
        t.deepEqual(read, {id:'b'}, 'reads cached doc');
        t.ok(true, 'update doc');
        doc.extra = true;
        setTimeout(t.end, 1500);
    });
});

tape('stale step 2 (while background refresh is occurring)', function(t) {
    reader('b', function(err, read) {
        t.deepEqual(read, {id:'b'}, 'reads stale doc');
    });
    reader('b', function(err, read) {
        t.deepEqual(read, {id:'b'}, 'reads stale doc');
    });
    reader('b', function(err, read) {
        t.deepEqual(read, {id:'b'}, 'reads stale doc');
        setTimeout(t.end, 200);
    });
});

tape('stale step 3 (after background refresh is complete)', function(t) {
    reader('b', function(err, read) {
        t.deepEqual(read, {id:'b', extra:true}, 'reads updated doc');
        t.end();
    });
});

