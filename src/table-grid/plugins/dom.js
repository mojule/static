'use strict'

const Vdom = require( '@mojule/vdom' )
const markdown = require( 'commonmark' )
const is = require( '@mojule/is' )
const formatNumbers = require( './format-numbers' )
const formatString = require( './format-string' )

const dom = grid => {
  return {
    dom: () => rowsToTable( grid )
  }
}

const mdReader = new markdown.Parser()
const mdWriter = new markdown.HtmlRenderer()

const { table, tr, th, td, text } = Vdom.h

const strToDom = str => Vdom.parse( str, { removeWhitespace: true } )

const renderCell = value => {
  if( is.string( value ) ){
    const fragment = Vdom.createDocumentFragment()

    const el = strToDom( mdWriter.render( mdReader.parse( value ) ) )

    fragment.append( el )
    el.unwrap()

    return fragment
  }

  return text( value )
}

const rowsToTable = grid => {
  const schema = grid.schema()
  const columnNames = grid.columnNames()

  Object.keys( schema.properties ).forEach( propertyName => {
    const property = schema.properties[ propertyName ]
    const mapper = property.type === 'number' ? formatNumbers : formatString

    grid.mutateColumn( propertyName, mapper )
  })

  const rows = grid.rows()

  const $headerRow = tr( ...columnNames.map( name => {
    const { type } = schema.properties[ name ]
    const $th = th( renderCell( name ) )

    if( type === 'number' )
      $th.addClass( 'table__cell--number' )

    return $th
  }))

  const $trs = rows.map( row => {
    const $tds = columnNames.map( ( name, i ) => {
      const { type } = schema.properties[ name ]
      const value = row[ i ]
      const $td = td( renderCell( value ) )

      $td.setAttr( 'title', name )

      if( type === 'number' || type === 'integer' )
        $td.addClass( 'table__cell--number' )

      return $td
    })

    return tr( ...$tds )
  })

  const $table = table(
    { class: 'table' },
    $headerRow,
    ...$trs
  )

  return $table
}

module.exports = dom
