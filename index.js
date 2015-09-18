/** @module node-split */

'use strict';

var fs = require('fs');

/**
 * @private
 * @param {mumber} number
 * @return {boolean}
 */
var isSafe = function(number) {
    return Number.MIN_SAFE_INTEGER <= number
        && number <= Number.MAX_SAFE_INTEGER;
};

/**
 * @private
 * @param {string} property
 * @param {Object} object
 * @return {boolean}
 */
var isDefined = function(property, object) {
    return property in object
        && object[property] !== undefined
        && object[property] !== null;
};

/**
 * @private
 * @param {Object} _options
 * @return {Object}
 * @throws When options are invalid
 */
var checkOptions = function(_options) {
    var options = {};

    if (typeof _options !== 'object' || _options === null) {
        throw  new TypeError('Options must be an object');
    }

    var byLines = isDefined('lines', _options);
    var byBytes = isDefined('bytes', _options);
    var byLineBytes = isDefined('line_bytes', _options);

    if ((byLines && byBytes)
        || (byBytes && byLineBytes)
        || (byLines && byLineBytes)) {
        throw new Error('Cannot split in more than one way');
    }

    if (!byLines && !byBytes && !byLineBytes) {
        throw new Error('Splitting way is not specified');
    }

    if (byLines) {
        if (isNaN(_options.lines)
            || !isSafe(_options.lines) || _options.lines < 1) {
            throw new Error('Invalid number of lines');
        }

        options.lines = Math.floor(_options.lines);
    }

    if (byBytes || byLineBytes) {
        var size = byBytes ? _options.bytes : _options.line_bytes;

        if (isNaN(size)) {
            var result = /^(\d+)(KB|MB|K|M)$/i.exec(size);

            if (result === null) {
                throw new Error('Invalid number of bytes');
            }

            var unit = (function(x) {
                switch (x) {
                    case 'k': case 'K':   return 1024;
                    case 'm': case 'M':   return 1048576;
                    case 'kb': case 'KB': return 1000;
                    case 'mb': case 'MB': return 1000000;
                }
            })(result[2]);

            if (!isSafe(result[1] * unit)) {
                throw new Error('Invalid number of bytes');
            }

            options[byBytes ? 'bytes' : 'line_bytes'] = result[1] * unit;
        } else {
            if (!isSafe(size) || size < 1) {
                throw new Error('Invalid number of bytes');
            }

            options[byBytes ? 'bytes' : 'line_bytes'] = Math.floor(size);
        }
    }

    if (isDefined('prefix', _options)) {
        options.prefix = '' + _options.prefix;

        if (isDefined('suffix_length', _options)) {
            if (!isSafe(_options.suffix_length) || _options.suffix_length < 1) {
                throw new Error('Invalid suffix length');
            }

            options.suffix_length = Math.floor(_options.suffix_length);
        }

        if (isDefined('numeric_suffixes', _options)) {
            if (!isSafe(_options.numeric_suffixes) || _options.numeric_suffixes < 0) {
                throw new Error('');
            }

            options.numeric_suffixes = Math.floor(_options.numeric_suffixes);
        }

        options.additional_suffix = isDefined('additional_suffix', _options)
            ? _options.additional_suffix + ''
            : '';
    }

    return options;
};

/**
 * @private
 * @param {number} length
 * @param {number} symbolLength
 * @return {number}
 */
var getSuffixLength = function(length, symbolLength) {
    var count = 0;
    for (; length = Math.floor(length / symbolLength); ++count) {}
    return count;
};

/**
 * @private
 * @param {number} length
 * @param {*} value
 * @return {Array}
 */
var replicate = function(length, value) {
    var array = new Array(length);
    for (var i = 0; i < length; ++i) {
        array[i] = value;
    }
    return array;
};

/**
 * @private
 * @param {number} length
 * @param {Object} options
 * @return {Array.<string>}
 * @throws When lacking in suffixes.
 */
var createFilenames = function(size, options) {
    if (isDefined('numeric_suffixes', options)) {
        if (!isSafe(options.numeric_suffixes + size - 1)) {
            throw new Error(''); // TODO
        }

        if (isDefined('suffix_length', options)) {
            if (options.suffix_length < getSuffixLength(size, 10)) {
                throw new Error(''); // TODO
            }
        } else {
            options.suffix_length = Math.max(getSuffixLength(size, 10), 2);
        }

        var padding = replicate(options.suffix_length, '0').join('');
        var filenames = new Array(size);

        for (var i = 0; i < size; ++i) {
            filenames[i] = options.prefix
                + (padding + (options.numeric_suffixes + i))
                    .slice(-options.suffix_length)
                + options.additional_suffix;
        }

        return filenames;
    }

    // alphabetic suffix

    var alphabet = 'abcdefghijklmnopqrstuvwxyz';

    if (isDefined('suffix_length', options)) {
        if (options.suffix_length < getSuffixLength(size, alphabet.length)) {
            throw new Error('output file suffixes exhausted');
        }
    } else {
        options.suffix_length
            = Math.max(getSuffixLength(size, alphabet.length), 2);
    }

    var padding = replicate(options.suffix_length, 'a').join('');
    var filenames = [];

    for (var i = 0; i < size; ++i) {
        var suffix = [];

        for (var n = i; n > 0; n = Math.floor(n / alphabet.length)) {
            suffix.push(alphabet[n % alphabet.length]);
        }

        filenames[i] = options.prefix
            + (padding + suffix.reverse().join('')).slice(-options.suffix_length)
            + options.additional_suffix;
    }

    return filenames;
};

/**
 * @private
 * @param {Buffer} buffer
 * @param {number} lines
 * @return {Array.<Buffer>}
 */
var splitByLines = function(buffer, lines) {
    var LF = '\n'.charCodeAt(0);

    var splitted = [];

    for (var begin = 0, index = 0, lineCount = 1; ; ++index) {
        if (begin === buffer.length) {
            break;
        }

        if (buffer.length < index) {
            splitted.push(buffer.slice(begin));
            break;
        }

        if (buffer[index] === LF) {
            if (lineCount === lines) {
                splitted.push(buffer.slice(begin, index + 1));
                begin = index + 1;
                lineCount = 1;
            } else {
                ++lineCount;
            }
        }
    }

    return splitted;
};

/**
 * @private
 * @param {Buffer} buffer
 * @param {number} size
 * @return {Array.<Buffer>}
 */
var splitByBytes = function(buffer, size) {
    var splitted = [];

    for (var begin = 0, end = size; ; begin = end, end += size) {
        if (begin === buffer.length) {
            break;
        }

        if (buffer.length < end) {
            splitted.push(buffer.slice(begin));
            break;
        }

        splitted.push(buffer.slice(begin, end));
    }

    return splitted;
};

/**
 * @private
 * @param {Buffer} buffer
 * @param {Object} options
 * @return {Array.<Buffer>}
 */
var _split = function(buffer, options) {
    if (isDefined('lines', options)) {
        return splitByLines(buffer, options.lines);
    }

    if (isDefined('bytes', options)) {
        return splitByBytes(buffer, options.bytes);
    }

    // isDefined('line_bytes', options)
    return splitByLines(buffer, 1).map(function(line) {
        return splitByBytes(line, options.line_bytes);
    }).reduce(function(acc, line) {
        acc.push.apply(acc, line);
        return acc;
    }, []);
};

/**
 * Split buffer.
 *
 * @param {Buffer} buffer - Buffer to split.
 * @param {Object} options - Splitting options.
 * @param {number=} options.lines - Number of lines to put per output files.
 * @param {(number|string)=} options.bytes - Number of bytes to put per output files.
 * @param {(number|string)=} options.line_bytes - Number of bytes to put at most per output files.
 * @param {string=} options.prefix - Output file names prefix.
 * @param {number=} options.suffix_length - Length of suffixes.
 * @param {string=} options.additional_suffix - Additional suffix of file names.
 * @param {number=} options.numeric_suffixes - Start number of numeric suffixes.
 * @param {function(?Error, ?Array.<Buffer>)=} callback - Callback.
 * @throws If callback is not defined,
 *     throws an error when Options are invalid or when running out of suffixes.
 */
module.exports.split = function(buffer, options, callback) {
    if (typeof callback !== 'function') {
        callback = (function rethrow() {
            return function(err) { if (err) { throw err; } };
        })();
    }

    var splitted = null;

    try {
        options = checkOptions(options);
        splitted = _split(buffer, options);
    } catch (err) {
        process.nextTick(callback, err);
        return;
    }

    if (isDefined('prefix', options)) {
        var filenames = [];

        try {
            filenames = createFilenames(splitted.length, options);
        } catch (err) {
            process.nextTick(callback, err);
            return;
        }

        var done = 0, errored = false;

        splitted.forEach(function(buf, index) {
            fs.writeFile(filenames[index], buf, { encoding: null }, function(err) {
                if (err) {
                    errored = true;
                    callback(err);
                    return;
                }

                ++done;

                if (!errored && done === splitted.length) {
                    callback(null, splitted);
                }
            });
        });
    } else {
        process.nextTick(callback, null, splitted);
    }
};

/**
 * Split buffer synchronously.
 *
 * @param {Buffer} buffer - Buffer to split.
 * @param {Object} options - Splitting options. See {@link module:node-split.split}.
 * @return {Array.<Buffer>} Array of splitted buffer
 * @throws Throws an error when options are invalid or when running out of suffixes.
 */
module.exports.splitSync = function(buffer, options) {
    options = checkOptions(options);

    var splitted = _split(buffer, options);
    var filenames = createFilenames(splitted.length, options);

    if (isDefined('prefix', options)) {
        splitted.forEach(function(buf, index) {
            fs.writeFileSync(filenames[index], buf, { encoding: null });
        });
    }

    return splitted;
};

