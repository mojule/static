'use strict'

const is = require( '@mojule/is' )
const VFS = require( '@mojule/vfs' )

const getOrCreateDirectory = ( vfs, name ) => {
  let dir = vfs.childNodes.find( current =>
    current.nodeName === '#directory' && current.filename === name
  )

  if( !dir ){
    dir = VFS.createDirectory( name )
    vfs.appendChild( dir )
  }

  return dir
}

const generateResources = ({ componentsForRoute, vfs, getStyle, getClient }) => {
  const css = getOrCreateDirectory( vfs, 'css' )
  const js = getOrCreateDirectory( vfs, 'js' )

  const routes = Object.keys( componentsForRoute )
  const componentToPages = {}

  routes.forEach( route => {
    const names = componentsForRoute[ route ]

    names.reverse()

    names.forEach( componentName => {
      if( !is.array( componentToPages[ componentName ] ) )
        componentToPages[ componentName ] = []

      componentToPages[ componentName ].push( route )
    })
  })

  const components = {
    global: []
  }

  Object.keys( componentToPages ).forEach( componentName => {
    const pages = componentToPages[ componentName ]

    if( pages.length > 1 ){
      components.global.push( componentName )
    } else if( pages.length === 1 ){
      const page = pages[ 0 ]

      if( !is.array( components[ page ] ) )
        components[ page ] = []

      components[ page ].push( componentName )
    }
  })

  const routeToResources = {}

  Object.keys( components ).forEach( route => {
    routeToResources[ route ] = []

    const filename = route === 'global' ?
      'site' :
      [ 'home' ].concat( route.split( '/' ).filter( s => s !== '' ) ).join( '--' )

    const styles = components[ route ].map( getStyle ).filter( s => s )
    const scripts = components[ route ].map( getClient ).filter( s => s )

    if( styles.length ){
      const file = VFS.createFile( filename + '.css', styles.join( '\n' ) )
      css.appendChild( file )
      routeToResources[ route ].push( '/css/' + filename + '.css' )
    }

    if( scripts.length ){
      const file = VFS.createFile( filename + '.js', scripts.join( '\n' ) )
      js.appendChild( file )
      routeToResources[ route ].push( '/js/' + filename + '.js' )
    }
  })

  return routeToResources
}

module.exports = generateResources
