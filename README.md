node-split
========

Split buffer in Node.js based on gnu split(1).

## Installation

```shell
$ npm install node-split
```

## API

### split(buffer, options, callback)

Asynchronous split. Passes either an array of splitted buffers or error to callback.

### splitSync(buffer, options)

Synchronous split. Returns an array of splitted buffers.

## Options

* `lines` - Number of lines to put per output files.

* `bytes` - Number of bytes to put per output files.

* `line_bytes` - Number of bytes to put at most per output files.

    `bytes` and `line_bytes` format is integer and optional unit.

    Units are K, M (powers of 1024) or KB, MB (powers of 1000).

* `prefix` - Prefix of output file names.

* `suffix_length` - Length of file name suffixes.

* `additional_suffix` - Additional suffix of file names.

* `numeric_suffixes` - Start number of numeric suffixes.

    If you define `numeric_suffixes`, use numeric suffixes instead of alphabetic.

## Example

```javascript
var split = require('node-split').split;
var fs = require('fs');

fs.readFile('./in.txt', { encoding: null }, function(err, data) {
    if (err) { throw err; }
    split(data, {
        lines: 1
    }, function(err, splitted) {
        if (err) { throw err; }
        // Array of each line
        console.log(splitted.map(function(buf) { return buf.toString(); }));
    });
});
```

If you define `options.prefix`, `split` write buffer to files.

```javascript
var split = require('node-split').split;
var fs = require('fs');

fs.readFile('./in.bin', { encoding: null }, function(err, data) {
    if (err) { throw err; }
    split(data, {
        bytes: '20M', // 20 * 1024 * 1024 bytes per file
        prefix: './out.',
        suffix_length: 3,
        additional_suffix: '.bin'
    }, function(err) {
        if (err) { throw err; }
        // Created files out.aaa.bin, out.aab.bin, out.aac.bin, ...
    });
});
```

`splitSync` split buffer synchronously.

```javascript
var split = require('node-split').splitSync;
var fs = require('fs');

var data = fs.readFileSync('./in.bin', { encoding: null });
var splitted = splitSync(data, {
    bytes: '20K' // 20 * 1024 bytes per files
});
```

