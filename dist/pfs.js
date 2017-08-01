'use strict';

var fs = require('fs');
var pify = require('pify');

module.exports = pify(fs);