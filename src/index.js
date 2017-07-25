'use strict'

const path = require( 'path' )
const Components = require( '@mojule/components' )
const is = require( '@mojule/is' )
const Mmon = require( '@mojule/mmon' )
const Tree = require( '@mojule/tree' )
const utils = require( '@mojule/utils' )
const Vfs = require( '@mojule/vfs' )
const pify = require( 'pify' )
const rimraf = require( 'rimraf' )
const fs = require( 'fs' )

const virtualize = pify( Vfs.virtualize )

Vfs.registerText( '.mmon' )

const expandRoutes = ( vfs, componentsApi ) => {
  const components = componentsApi.get()
  const { getModel } = componentsApi

  const routingMmonFiles = vfs.findAll( current =>
    current.nodeType() === 'file' && current.filename() === '_route.mmon'
  )

  routingMmonFiles.forEach( file => {
    const parent = file.getParent()
    const mmon = Mmon.parse( file.value().data.toString( 'utf8' ) )

    const config = file.siblings().find( current =>
      current.nodeType() === 'file' && current.filename() === '_routes.json'
    )

    if( !config )
      throw new Error( '_route.mmon requires a matching _routes.json' )

    const { data, component, routeFrom } = JSON.parse( config.value().data.toString( 'utf8' ) )

    file.remove()
    config.remove()

    const model = getModel( data )

    if( !is.array( model ) )
      throw new Error( 'Route data should be an array' )

    model.forEach( item => {
      const currentTree = Tree( utils.clone( mmon ) )
      const componentNode = currentTree.find(
        current => current.getValue( 'name' ) === component
      )

      const document = currentTree.find(
        current => current.getValue( 'name' ) === 'document'
      )

      if( document ){
        const model = document.getValue( 'model' )

        model.title = item[ routeFrom ]

        document.setValue( 'model', model )
      }

      componentNode.setValue( 'model', item )

      const routeName = utils.identifier( item[ routeFrom ] )
      const routeFolder = Vfs.createDirectory( routeName )

      parent.add( routeFolder )

      const itemTree = JSON.stringify( currentTree.get(), null, 2 )
      const index = Vfs.createFile( 'index.json', itemTree )

      routeFolder.add( index )
    })
  })

  return vfs
}

const createHtmlFiles = ( vfs, componentsApi ) => {
  const components = componentsApi.get()

  const mmonFiles = vfs.findAll( current =>
    current.nodeType() === 'file' &&
    ( current.getValue( 'ext' ) === '.mmon' || current.filename() === 'index.json' )
  )

  const linkMap = new Map()

  mmonFiles.forEach( mmonFile => {
    const { nodeType, ext, filename, data } = mmonFile.value()

    const value = data.toString( 'utf8' )

    const mmon = filename === 'index.json' ? JSON.parse( value ) : Mmon.parse( value )
    const model = Tree( mmon )

    const document = model.find(
      current => current.getValue( 'name' ) === 'document'
    )

    let title

    const { name } = path.parse( mmonFile.getParent().filename() )
    const slug = name

    if( document ){
      const model = document.getValue( 'model' )

      if( model.title )
        title = model.title
    }

    if( !title ){
      title = slug
    }

    const uri = '/' + path.posix.relative( vfs.getPath(), mmonFile.getParent().getPath() )

    const isHome = uri === '/'

    const depth = mmonFile.ancestors().length

    let parent = ''

    if( depth > 2 ){
      const parentFilename = mmonFile.getParent().getParent().filename()
      const { name } = path.parse( parentFilename )
      parent = name
    }

    linkMap.set( uri, { slug, title, uri, isHome, depth, parent } )

    const meta = { model, slug, title, uri, isHome, depth, parent }

    mmonFile.meta( meta )
  })

  const links = Array.from( linkMap.values() ).filter( l => l.depth <= 2 )
  const secondary = Array.from( linkMap.values() ).filter( l => l.depth > 2 )

  const compare = ( a, b ) => {
    if( a.title > b.title )
      return -1

    if( a.title < b.title )
      return 1

    return 0
  }

  links.sort( compare ).sort( ( a, b ) => a.isHome ? -1 : 1 )
  secondary.sort( compare )

  const root = vfs.getRoot()

  root.setValue( 'filename', 'static' )

  mmonFiles.forEach( mmonFile => {
    const parent = mmonFile.getParent()
    const meta = mmonFile.meta()
    const { model, title, slug, depth } = meta

    const header = model.find( current => current.getValue( 'name' ) === 'header' )

    if( header ){
      const model = header.getValue( 'model' )
      const linksModel = { links }

      const secondaryLinks = secondary.filter( l => l.parent === slug || l.depth === depth )

      if( secondaryLinks.length > 0 )
        linksModel[ 'secondary-links' ] = secondaryLinks

      Object.assign( model, linksModel )

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
      expandRoutes( vfs, api )
    )
    .then( vfs =>
      createHtmlFiles( vfs, api )
    )
    .then( vfs => {
      actualize( vfs, outpath, callback )
    })
    .catch( callback )
  })
}

module.exports = Static
