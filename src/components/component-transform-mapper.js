'use strict'

const SchemaTree = require( '@mojule/schema-tree' )
const JsonTree = require( '@mojule/json-tree' )
const Tree = require( '@mojule/tree' )
const transformMapper = require( '@mojule/transform' )
const utils = require( '@mojule/utils' )

const { clone } = utils

//const log = console.log
const log = () => {}

const ComponentTransformMapper = components => {
  const componentNames = Object.keys( components )

  const getSchema = name => {
    if( components[ name ] )
      return components[ name ].schema
  }

  const getTransform = name => {
    if( components[ name ] )
      return components[ name ].transform
  }

  const findRefComponents = node =>
    node.findAll( current =>
      node !== current && componentNames.includes( current.getValue( '$ref' ) )
    )

  const mapComponents = ( name, model, depth = 0 ) => {
    const indent = '  '.repeat( depth )

    log( indent, 'mapping components:', name )

    model = clone( model )

    let modelTree = JsonTree( model )

    const transform = getTransform( name )
    const schema = getSchema( name )

    if( transform && !schema ){
      log( indent, '  no schema, calling transform' )

      return transformMapper( model, transform )
    }

    if( !transform && !schema ){
      log( indent, '  no schema or transform' )

      return model
    }

    const schemaTree = SchemaTree( schema )
    const refComponents = findRefComponents( schemaTree )

    log( indent, '  $ref components:', refComponents.length )

    refComponents.forEach( current => {
      const value = current.getValue()
      const componentName = value.$ref

      log( '\n' + indent, '    current ref:', componentName )

      /*
        Important to remember that schema paths do not necessarily match up to
        model - this will work for now, but need to investigate and consider a
        more robust solution
      */
      const refPathNode = value.arrayItem ?
        current.getParent() :
        current

      const refNodePath = refPathNode.getPath()
      const modelNode = modelTree.atPath( refNodePath )

      if( !modelNode ){
        log( indent, '    no model node' )
        return
      }

      const modelNodeValue = modelNode.value()

      if( value.arrayItem ){
        log( indent, '    array item' )

        const modelArray = modelNode.toJson()

        const transformed = modelArray.map( item =>{
          log( indent, '    mapping:', name )
          return mapComponents( name, item, depth + 4 )
        })

        log( indent, '    transformed:', JSON.stringify( transformed ) )

        const transformedNode = JsonTree( transformed )
        const modelNodeParent = modelNode.getParent()
        const { propertyName } = modelNodeValue

        if( propertyName )
          transformedNode.assign( { propertyName } )

        modelNodeParent.replaceChild( transformedNode, modelNode )
      } else if( value.propertyName ){
        log( indent, '    property' )

        const model = modelNode.toJson()
        const transformed = mapComponents( componentName, model, depth + 4 )

        log( indent, '    transformed:', JSON.stringify( transformed ) )

        const transformedNode = JsonTree( transformed )
        const modelNodeParent = modelNode.getParent()
        const { propertyName } = modelNodeValue

        if( propertyName )
          transformedNode.assign( { propertyName } )

        modelNodeParent.replaceChild( transformedNode, modelNode )
      } else {
        log( indent, '    not array item or property' )

        const model = modelNode.toJson()
        const transformed = mapComponents( componentName, model, depth + 4 )

        log( indent, '    transformed:', JSON.stringify( transformed ) )

        const transformedNode = JsonTree( transformed )
        const modelNodeParent = modelNode.getParent()

        if( modelNodeParent ){
          modelNodeParent.replaceChild( transformedNode, modelNode  )
        }
        else {
          modelTree = transformedNode
        }
      }
    })

    model = modelTree.toJson()

    if( transform )
      model = transformMapper( model, transform )

    return model
  }

  return mapComponents
}

module.exports = ComponentTransformMapper
