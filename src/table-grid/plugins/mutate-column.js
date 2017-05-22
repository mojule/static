'use strict'

const mutateColumn = grid => {
  return {
    mutateColumn: ( x = 0, mapper = col => col ) => {
      x = grid.normalizeColumnIndex( x )

      return grid.setColumn(
        mapper(
          grid.getColumn( x ), grid
        ),
        x
      )
    }
  }
}

module.exports = mutateColumn
