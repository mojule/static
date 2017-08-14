document.addEventListener( 'DOMContentLoaded', e => {
  const suppliers = Array.from( document.querySelectorAll( '.supplier' ) )

  window.initMap = () => {
    const map = new google.maps.Map( document.querySelector('.map'), {
      zoom: 4,
      center: { lat: -41.5, lng: 172.833 }
    })

    const markers = suppliers.map( supplier => {
      let { name, lat, lng } = supplier.dataset

      lat = parseFloat( lat )
      lng = parseFloat( lng )

      const marker = new google.maps.Marker({
        position: { lat, lng },
        map: map,
        title: name
      })

      marker.addListener( 'click', () => {
        suppliers.forEach( supplier => {
          supplier.classList.add( 'supplier--hidden' )
        })

        supplier.classList.remove( 'supplier--hidden' )

        map.setZoom( Math.max( 16, map.getZoom() ) )
        map.setCenter( marker.getPosition() )
      })

      return marker
    })
  }

  const script = document.createElement( 'script' )
  document.body.appendChild( script )

  script.setAttribute( 'defer', '' )
  script.setAttribute( 'async', '' )
  script.setAttribute( 'src', 'https://maps.googleapis.com/maps/api/js?key=AIzaSyApuRZ01IHeB-Dwb-3mCMQO9inLRlPkuQM&callback=initMap' )
})
