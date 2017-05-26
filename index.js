'use strict'

const Static = require( './dist' )

if( !module.parent )
  Static( './data', './out', err => {
    if( err ) return console.error( err )

    console.log( 'Done' )
  })
