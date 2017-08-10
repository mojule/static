document.addEventListener( 'DOMContentLoaded', e => {
  if( window.location.hash.length > 0 ){
    const target = document.querySelector( window.location.hash )

    if( target )
      window.scrollTo( 0, target.offsetTop )
  }
})
