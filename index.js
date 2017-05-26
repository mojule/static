'use strict'

const Static = require( './src' )

if( !module.parent )
  Static( './data', './out', err => {
    if( err ) return console.error( err )

    console.log( 'Done' )
  })
