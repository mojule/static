'use strict'

const path = require( 'path' )
const Components = require( '@mojule/components' )
const is = require( '@mojule/is' )
const Mmon = require( '@mojule/mmon' )
const Tree = require( '@mojule/tree' )
const Vfs = require( '@mojule/vfs' )
const pify = require( 'pify' )
const rimraf = require( 'rimraf' )

const virtualize = pify( Vfs.virtualize )

const createHtmlFiles = ( vfs, componentsApi ) => {
  const components = componentsApi.get()

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

    const uri = '/' + path.posix.relative( vfs.getPath(), mmonFile.getParent().getPath() )

    const isHome = uri === '/'
    const meta = { model, title, uri, isHome }

    links.push( { title, uri, isHome } )

    mmonFile.meta( meta )
  })

  links.sort( ( a, b ) => a.isHome ? -1 : 1 )

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

    const dom = componentsApi.dom( model )
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
const Static = ( inpath, outpath, options = {}, callback = err => { if( err ) throw err } ) => {
  if( is.function( options ) ){
    callback = options
    options = {}
  }

  const componentsPath = path.join( inpath, './components' )
  const routesPath = path.join( inpath, './routes' )

  Components.read( componentsPath, ( err, api ) => {
    if( err ) return callback( err )

    return virtualize( routesPath )
    .then( vfs =>
      createHtmlFiles( vfs, api )
    )
    .then( vfs => {
      actualize( vfs, outpath, callback )
    })
  })
}

module.exports = Static
