'use strict'

const sass = require( 'node-sass' )
const { StringDecoder } = require( 'string_decoder' )

const decoder = new StringDecoder( 'utf8' )

const Sass = options => {
  const importer = url => {
    const { getStyle } = options
    const contents = getStyle( url ) || ''

    return { contents }
  }

  return data => {
    const result = sass.renderSync({ data, importer })
    const buffer = Buffer.from( result.css )

    return decoder.write( buffer )
  }
}

module.exports = Sass
