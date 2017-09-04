'use strict'

const domUtils = require( '@mojule/dom-utils' )
const is = require( '@mojule/is' )

const { removeAll } = domUtils

const moveNode = ( source, target ) => {
  while( source.firstChild )
    target.appendChild( source.firstChild )

  const attrs = Array.from( source.attributes )

  attrs.forEach( pair => {
    target.setAttribute( pair.name, pair.value )
  })

  source.parentNode.removeChild( source )
}

const TransformDocument = document => {
  const transformDocument = ( node, title ) => {
    const doctype = document.implementation.createDocumentType( 'html', '', '' )
    const doc = document.implementation.createDocument( 'http://www.w3.org/1999/xhtml', 'html', doctype )

    const { documentElement } = doc

    removeAll( documentElement )

    const head = document.createElement( 'head' )
    const body = document.createElement( 'body' )
    const noscript = document.createElement( 'noscript' )

    documentElement.appendChild( head )
    documentElement.appendChild( body )
    body.appendChild( noscript )

    const componentHead = node.querySelector( 'component-head' )
    const componentBody = node.querySelector( 'component-body' )
    const componentNoscript = node.querySelector( 'component-noscript' )

    if( is.string( title ) )
      doc.title = title

    if( componentHead )
      moveNode( componentHead, head )

    if( componentBody ){
      moveNode( componentBody, body )
    } else {
      while( node.firstChild )
        body.appendChild( node.firstChild )
    }

    if( componentNoscript )
      moveNode( componentNoscript, noscript )

    return doc
  }

  return transformDocument
}

module.exports = TransformDocument
