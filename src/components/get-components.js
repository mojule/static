'use strict'

const path = require( 'path' )
const is = require( '@mojule/is' )
const Vfs = require( '@mojule/vfs' )
const Vdom = require( '@mojule/vdom' )
const markdown = require( 'commonmark' )
const parseCsv = require( 'csv-parse/lib/sync' )
const pify = require( 'pify' )
const TableGrid = require( '../table-grid' )

const virtualize = pify( Vfs.virtualize )
const mdReader = new markdown.Parser()
const mdWriter = new markdown.HtmlRenderer()

const strToDom = str => Vdom.parse( str, { removeWhitespace: true } ).get()

const transforms = {
  '.json': str => JSON.parse( str ),
  '.html': strToDom,
  '.md': str => strToDom( mdWriter.render( mdReader.parse( str ) ) ),
  '.markdown': str => transforms[ '.md' ]( str ),
  '.csv': str => {
    const csv = parseCsv( str, { auto_parse: true } )
    const grid = TableGrid( csv )

    return grid.dom().get()
  }
}

const getComponents = ( filepath, callback ) => {
  const result = {}

  virtualize( filepath )
  .then( root => {
    const files = root.findAll( current => current.nodeType() === 'file' )
    const rootPath = root.getPath()

    const getCategories = directory => {
      const directoryPath = directory.getPath()
      const relative = path.posix.relative( rootPath, directoryPath )
      const segs = relative.split( '/' )

      // discard last segment, it's the component name
      segs.pop()

      return segs
    }

    let error

    files.forEach( file => {
      if( error ) return

      const directory = file.getParent()
      const name = directory.filename()
      const parsed = path.parse( file.filename() )
      const type = parsed.name
      const ext = parsed.ext
      const categories = getCategories( directory )

      let data = file.data()

      if( !result[ name ] ){
        result[ name ] = { name, categories }
      }

      if( transforms[ ext ] )
        data = transforms[ ext ]( data )

      if( !is.undefined( result[ name ][ type ] ) ){
        error = new Error( 'Duplicate found for ' + name + ', ' + type )
        return
      }

      result[ name ][ type ] = data
    })

    if( error ){
      return callback( error )
    }

    callback( null, result )
  })
  .catch( err => callback( err ))
}

module.exports = getComponents
