'use strict'

const path = require( 'path' )
const Vfs = require( '@mojule/vfs' )
const is = require( '@mojule/is' )
const Tree = require( '@mojule/tree' )
const Mmon = require( '@mojule/mmon' )
const pify = require( 'pify' )
const rimraf = require( 'rimraf' )
const ComponentsToDom = require( './components/components-to-dom' )
const getComponents = pify( require( './components/get-components' ) )
const normalizeSchema = require( './normalize-schema' )

const virtualize = pify( Vfs.virtualize )

const createHtmlFiles = ( vfs, components ) => {
  const mmonFiles = vfs.findAll( current =>
    current.nodeType() === 'file' && current.getValue( 'ext' ) === '.mmon'
  )

  let links = []

  mmonFiles.forEach( mmonFile => {
    const { nodeType, ext, filename, data } = mmonFile.value()

    const value = data.toString( 'utf8' )
    const mmon = Mmon.parse( value )
    const model = Tree( mmon )

    const document = model.find(
      current => current.getValue( 'name' ) === 'document'
    )

    let title

    if( document ){
      const model = document.getValue( 'model' )

      if( model.title )
        title = model.title
    }

    if( !title ){
      const { name } = path.parse( filename )
      title = name
    }

    const uri = '/' + path.relative( vfs.getPath(), mmonFile.getParent().getPath() )

    const isHome = uri === '/'
    const meta = { model, title, uri, isHome }

    links.push( { title, uri, isHome } )

    mmonFile.meta( meta )
  })

  links.sort( ( a, b ) => a.isHome ? -1 : 1 )

  const componentsToDom = ComponentsToDom( components )

  const root = vfs.getRoot()

  root.setValue( 'filename', 'static' )

  mmonFiles.forEach( mmonFile => {
    const parent = mmonFile.getParent()
    const meta = mmonFile.meta()
    const { model } = meta

    const header = model.find( current => current.getValue( 'name' ) === 'header' )

    if( header ){
      const model = header.getValue( 'model' )

      Object.assign( model, { links } )

      header.setValue( 'model', model )
    }

    const dom = componentsToDom( model )
    const { name } = path.parse( mmonFile.getValue( 'filename' ) )
    const htmlName = name + '.html'
    const newFile = Vfs.createFile( htmlName, dom.stringify( { pretty: true } ) )

    parent.append( newFile )
    mmonFile.remove()
  })

  return vfs
}

const actualize = ( vfs, outpath, callback ) => {
  vfs.actualize( outpath, err => {
    if( err && err.code === 'EEXIST' ){
      rimraf( err.path, err => {
        if( err ) callback( err )

        actualize( vfs, outpath, callback )
      })

      return
    }

    callback( err )
  })
}



// read the routes first
// generate a component for the routes
const Static = ( inpath, outpath, options = {}, callback = () => {} ) => {
  if( is.function( options ) ){
    callback = options
    options = {}
  }

  const componentsPath = path.join( inpath, './components' )
  const routesPath = path.join( inpath, './routes' )

  getComponents( componentsPath )
  .then( components => {
    const getSchema = name => {
      if( components[ name ] )
        return components[ name ].schema
    }

    const schemas = Object.keys( components ).reduce( ( obj, key ) => {
      const schema = getSchema( key )

      if( schema ) obj[ key ] = schema

      return obj
    }, {} )

    const norm = normalizeSchema( schemas, 'header' )

    console.log( JSON.stringify( norm, null, 2 ) )

    return virtualize( routesPath )
    .then( vfs =>
      createHtmlFiles( vfs, components )
    )
    .then( vfs => {
      actualize( vfs, outpath, callback )
    })
  })
}

module.exports = Static
