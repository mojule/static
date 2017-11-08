'use strict'

let path = require( 'path' )
const Components = require( '@mojule/components' )
const ComponentTransformers = require( '@mojule/components/src/transformers' )
const domUtils = require( '@mojule/dom-utils' )
const is = require( '@mojule/is' )
const MMON = require( '@mojule/mmon' )
const Tree = require( '@mojule/tree' )
const utils = require( '@mojule/utils' )
const VFS = require( '@mojule/vfs' )
const jsdom = require( 'jsdom' )
const pify = require( 'pify' )
const rimraf = require( 'rimraf' )
const fs = require( 'fs' )
const TransformDocument = require( './transform-document' )
const generateResources = require( './generate-resources' )
const Sass = require( './transformers/sass' )

// browserify exports path.posix as just path
path = path.posix || path

const virtualize = pify( VFS.virtualize )

const { stringify, removeAll } = domUtils
const { ReadComponents } = Components

const Transformers = options => {
  const transformers = ComponentTransformers( options )

  transformers[ '.scss' ] = Sass( options )

  return transformers
}

const { JSDOM } = jsdom
const dom = new JSDOM( '<!doctype>' )
const { document } = dom.window

const options = { document, Transformers }

const readComponents = ReadComponents( options )
const transformDocument = TransformDocument( document )

VFS.registerText( '.mmon' )

const Link = uri => {
  const link = document.createElement( 'link' )

  link.setAttribute( 'rel', 'stylesheet' )
  link.setAttribute( 'href', uri )

  return link
}

const Script = uri => {
  const script = document.createElement( 'script' )

  script.setAttribute( 'src', uri )

  return script
}

const createHtmlFiles = ( vfs, componentApi ) => {
  const { getStyle, getClient } = componentApi

  const mmonFiles = vfs.subNodes.filter( current =>
    current.nodeName === '#file' &&
    ( current.ext === '.mmon' || current.filename === 'index.json' )
  )

  const root = vfs.rootNode

  root.value.filename = 'static'

  const componentsForRoute = {}
  const nodesForRoute = {}

  mmonFiles.forEach( mmonFile => {
    const { nodeType, ext, filename, data, parentNode } = mmonFile
    const uri = '/' + path.posix.relative( vfs.getPath(), mmonFile.parentNode.getPath() )
    const { name } = path.parse( filename )
    const value = data.toString( 'utf8' )

    const mmon = filename === 'index.json' ? JSON.parse( value ) : MMON.parse( value )
    const componentTree = Tree.deserialize( mmon )

    const rendered = componentApi.render( componentTree )

    const { names, node } = rendered

    componentsForRoute[ uri ] = names

    const doc = transformDocument( node )

    nodesForRoute[ uri ] = {
      name,
      doc,
      parentNode,
      mmonFile
    }
  })

  const routeToResources = generateResources({ componentsForRoute, vfs, getStyle, getClient })

  Object.keys( nodesForRoute ).forEach( uri => {
    const { name, doc, parentNode, mmonFile } = nodesForRoute[ uri ]

    const head = doc.querySelector( 'head' )
    const body = doc.querySelector( 'body' )

    const resources = routeToResources.global.concat( routeToResources[ uri ] )

    resources.forEach( resource => {
      if( !resource ) return

      if( resource.endsWith( 'css') ){
        const link = Link( resource )
        head.appendChild( link )
      } else if( resource.endsWith( 'js' ) ){
        const script = Script( resource )
        body.appendChild( script )
      }
    })

    const html = stringify( doc )
    const htmlName = name + '.html'
    const newFile = VFS.createFile( htmlName, html )

    parentNode.appendChild( newFile )
    parentNode.removeChild( mmonFile )
  })

  return vfs
}

const createServerIndex = names => `'use strict'

const result = {}

${
  names.map( name =>
    `result['${ name }'] = require( './${ name }' )`
  ).join( '\n' )
}

module.exports = result
`

const createServerFiles = ( components, outpath ) => {
  const serverVfs = VFS.createDirectory( 'server' )

  const names = Object.keys( components )
  const serverNames = []

  names.forEach( name => {
    const component = components[ name ]

    if( component.server ){
      const file = VFS.createFile( name + '.js', component.server )
      serverVfs.appendChild( file )
      serverNames.push( name )
    }
  })

  const indexJs = createServerIndex( serverNames )
  const index = VFS.createFile( 'index.js', indexJs )

  serverVfs.appendChild( index )

  return serverVfs
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

    callback( err, vfs )
  })
}

const write = pify( actualize )

// read the routes first
// generate a component for the routes
const Static = ( inpath, outpath, options = {}, callback = err => { if( err ) throw err } ) => {
  if( is.function( options ) ){
    callback = options
    options = {}
  }

  const componentsPath = path.join( inpath, './components' )
  const routesPath = path.join( inpath, './routes' )

  readComponents( componentsPath, ( err, components ) => {
    if( err ) return callback( err )

    const componentApi = Components( components, { document } )

    return virtualize( routesPath )
    .then( vfs =>
      createHtmlFiles( vfs, componentApi )
    )
    .then( vfs =>
      write( vfs, outpath )
    )
    .then( vfs =>
      createServerFiles( components, outpath )
    )
    .then( serverVfs =>
      write( serverVfs, outpath )
    )
    .then( () => callback( null ) )
    .catch( callback )
  })
}

module.exports = Static
