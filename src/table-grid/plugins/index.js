'use strict'

const mutateColumn = require( './mutate-column' )
const dom = require( './dom' )

const plugins = [ mutateColumn, dom ]

module.exports = plugins
