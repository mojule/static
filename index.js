'use strict'

//module.exports = require( './dist' )

const Static = require( './src' )

Static( './data', './out', err => {
  if( err ) return console.error( err )

  console.log( 'Done' )
})
