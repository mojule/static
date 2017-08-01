'use strict'

const path = require( 'path' )
const Components = require( '@mojule/components' )
const is = require( '@mojule/is' )
const Mmon = require( '@mojule/mmon' )
const Tree = require( '@mojule/tree' )
const utils = require( '@mojule/utils' )
const VFS = require( '@mojule/vfs' )
const pify = require( 'pify' )
const rimraf = require( 'rimraf' )
const fs = require( 'fs' )

const virtualize = pify( VFS.virtualize )

VFS.registerText( '.mmon' )

const expandRoutes = ( vfs, componentsApi ) => {
  const components = componentsApi.get()
  const { getModel } = componentsApi

  const routingMmonFiles = vfs.subNodes.filter( current =>
    current.nodeName === '#file' && current.filename === '_route.mmon'
  )

  routingMmonFiles.forEach( file => {
    const parent = file.parentNode
    const mmon = Mmon.parse( file.data.toString( 'utf8' ) )

    const config = file.siblingNodes.find( current =>
      current.nodeName === '#file' && current.filename === '_routes.json'
    )

    if( !config )
      throw new Error( '_route.mmon requires a matching _routes.json' )

    const { data, component, routeFrom } = JSON.parse( config.data.toString( 'utf8' ) )

    file.remove()
    config.remove()

    const model = getModel( data )

    if( !is.array( model ) )
      throw new Error( 'Route data should be an array' )

    model.forEach( item => {
      const currentTree = Tree.deserialize( utils.clone( mmon ) )
      const componentNode = currentTree.subNodes.find(
        current => current.value.name === component
      )

      const document = currentTree.subNodes.find(
        current => current.value.name === 'document'
      )

      if( document ){
        document.value.model.title = item[ routeFrom ]
      }

      componentNode.value.model = item

      const routeName = utils.identifier( item[ routeFrom ] )
      const routeFolder = VFS.createDirectory( routeName )

      parent.appendChild( routeFolder )

      const itemTree = JSON.stringify( currentTree.serialize(), null, 2 )
      const index = VFS.createFile( 'index.json', itemTree )

      routeFolder.appendChild( index )
    })
  })

  return vfs
}

const createHtmlFiles = ( vfs, componentsApi ) => {
  const components = componentsApi.get()

  const mmonFiles = vfs.subNodes.filter( current =>
    current.nodeName === '#file' &&
    ( current.ext === '.mmon' || current.filename === 'index.json' )
  )

  const linkMap = new Map()

  mmonFiles.forEach( mmonFile => {
    const { nodeType, ext, filename, data } = mmonFile

    const value = data.toString( 'utf8' )

    const mmon = filename === 'index.json' ? JSON.parse( value ) : Mmon.parse( value )
    const model = Tree.deserialize( mmon )

    const document = model.subNodes.find(
      current => current.value.name === 'document'
    )

    let title

    const { name } = path.parse( mmonFile.parentNode.filename )
    const slug = name

    if( document ){
      const { model } = document.value

      if( model.title )
        title = model.title
    }

    if( !title ){
      title = slug
    }

    const uri = '/' + path.posix.relative( vfs.getPath(), mmonFile.parentNode.getPath() )

    const isHome = uri === '/'

    const depth = mmonFile.ancestorNodes.length

    let parent = ''

    if( depth > 2 ){
      const parentFilename = mmonFile.parentNode.parentNode.filename
      const { name } = path.parse( parentFilename )
      parent = name
    }

    linkMap.set( uri, { slug, title, uri, isHome, depth, parent } )

    mmonFile.meta = { model, slug, title, uri, isHome, depth, parent }
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

  const root = vfs.rootNode

  root.value.filename = 'static'

  mmonFiles.forEach( mmonFile => {
    const parent = mmonFile.parentNode
    const { model, title, slug, depth } = mmonFile.meta

    const header = model.subNodes.find( current => current.value.name === 'header' )

    if( header ){
      const { model } = header.value
      const linksModel = { links }

      const secondaryLinks = secondary.filter( l => l.parent === slug || l.depth === depth )

      if( secondaryLinks.length > 0 )
        linksModel[ 'secondary-links' ] = secondaryLinks

      Object.assign( model, linksModel )

      header.value.model = model
    }

    const dom = componentsApi.dom( model )
    const { name } = path.parse( mmonFile.filename )
    const htmlName = name + '.html'
    const newFile = VFS.createFile( htmlName, dom.toString( { pretty: true } ) )

    parent.appendChild( newFile )
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
