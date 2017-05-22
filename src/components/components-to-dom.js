'use strict'

const TransformMapper = require( './component-transform-mapper' )
const is = require( '@mojule/is' )
const Templating = require( '@mojule/templating' )
const Vdom = require( '@mojule/vdom' )
const sass = require( 'node-sass' )

const ComponentsToDom = components => {
  const transformMapper = TransformMapper( components )
  const componentNames = Object.keys( components )

  const getContent = name => {
    if( components[ name ] )
      return components[ name ].content
  }

  const getTemplate = name => {
    if( components[ name ] )
      return components[ name ].template
  }

  const getConfig = name => {
    if( components[ name ] )
      return components[ name ].config
  }

  const getStyle = name => {
    if( components[ name ] )
      return components[ name ].style
  }

  const templates = componentNames.reduce( ( t, name ) => {
    const template = getTemplate( name )

    if( template )
      t[ name ] = Vdom( template )

    return t
  }, {} )

  const templating = Templating( templates )

  const componentsToDom = root => {
    let css = ''
    const cssMap = {}

    root.walk( current => {
      const name = current.getValue( 'name' )

      if( !cssMap[ name ] ){
        const style = getStyle( name )

        if( style )
          css += '\n' + style

        cssMap[ name ] = true
      }
    })

    const document = root.find( current => {
      const { name } = current.getValue()

      return name === 'document'
    })

    if( document ){
      const model = document.getValue( 'model' )
      let { styles } = model

      if( !is.array( styles ) )
        styles = []

      css = sass.renderSync({ data: css }).css.toString()

      styles.push({
        text: css
      })

      model.styles = styles

      document.setValue( 'model', model )
    }

    const nodeToDom = node => {
      let { name, model } = node.getValue()

      const content = getContent( name )

      if( content )
        return Vdom( content )

      model = transformMapper( name, model )

      const dom = templating( name, model )
      const config = getConfig( name )

      if( config && config.containerSelector ){
        const { containerSelector } = config

        const target = dom.matches( containerSelector ) ?
          dom :
          dom.querySelector( containerSelector )

        if( target )
          node.getChildren().forEach( child => {
            const domChild = nodeToDom( child )
            target.append( domChild )
          })
      }

      return dom
    }

    return nodeToDom( root )
  }

  return componentsToDom
}

module.exports = ComponentsToDom
