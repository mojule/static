document.addEventListener( 'DOMContentLoaded', e => {
  $( '.page-hero__slider' ).slick({
    autplay: true,
    autoplaySpeed: 2000,
    infinite: true,
    slidesToShow: 1,
    slidesToScroll: 1,
    dots: true,
    fade: true,
    cssEase: 'linear',
    arrows: false,
    pauseOnHover: false,
    pauseOnFocus: false
  })

  $( '.page-hero__slider' ).slick( 'slickPlay' )
})
