'use strict'

const is = require( '@mojule/is' )

const formatString = column => column.map( value => value.toString() )

module.exports = formatString
