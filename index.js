var loaders = [];
var cachers = [];

module.exports = locking;

/**
 * Wraps any loader function of the form `loader(id, callback)` to use
 * an LRU cache and lock I/O operations across concurrent calls.
 *
 * @param {Function} loader any asynchronous function that takes
 * a callback as its last argument.
 * @param {Object} options passed to the lru-cache instance
 * @returns {Function} a version of that function that locks on successive
 * simultaneous calls.
 */
function locking(loader, options) {
    var existing = loaders.indexOf(loader);
    if (existing !== -1) return cachers[existing];

    options = options || { max: 100, maxAge: 30e3 };

    var cache = require('lru-cache')(options);
    var locks = {};
    var cacheStats = { hit:0, miss:0, mchit:0, mcmiss:0 };
    var cacher = function(id, callback) {
        // Stringify objects.
        var key = JSON.stringify(id);

        // Instance is in LRU cache.
        var cached = cache.peek(key);
        if (cached) {
            cacheStats.hit++;
            return callback(null, cached);
        }

        // Previous instance creation is in progress (locking).
        if (locks[key]) return locks[key].push(callback);

        // Create a new lock.
        locks[key] = [callback];

        loader(id, function(err, instance) {
            if (instance) {
                cacheStats.miss++;
                cache.set(key, instance);
            }

            var q = locks[key];
            delete locks[key];
            for (var i = 0; i < q.length; i++) {
                q[i](err, instance);
            }
        });
    };
    cacher.cacheStats = cacheStats;
    cacher.cache = cache;
    loaders.push(loader);
    cachers.push(cacher);
    return cacher;
}
