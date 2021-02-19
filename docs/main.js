
const main = ({ debug }, callback) => {
  const map = new geolonia.Map('#map')
  const marker = new geolonia.Marker()

  let endpoint = "https://d2cs0t9ef9cmd3.cloudfront.net/dev/demo/"

  const addressInput = document.getElementById('address')
  const button = document.getElementById('button')
  const notFound = document.getElementById('not-found')

  const showNotFound = (display) => notFound.style.display = display ? 'block' : 'none'

  // No submit with Enter
  addressInput.addEventListener('keypress', (e) => {
    if(e.keyCode === 13) {
      e.preventDefault()
      button.click()
    }
  })

  addressInput.addEventListener('change', (e) => {
    showNotFound(false)
  })

  if (location.hash.length) {
    addressInput.value = decodeURI(location.hash.slice(1));
  }

  // inject another endpoint
  const external = new URLSearchParams(location.search).get('url')
  if(external) {
      endpoint = external
  }

  button.addEventListener('click', () => {
    const address = addressInput.value
    const url = `${endpoint}?q=${address}&debug=${debug}`

    location.hash = encodeURI(address)

    fetch(url)
    .then(res => res.json())
    .catch(() => false)
    .then(result => {
      if(result) {
        showNotFound(false)

        if(Array.isArray(result)) {
          const center = [result[0].location.lng, result[0].location.lat]
          map.flyTo({
            center: center,
            zoom: 17,
            essential: true,
          })
          marker.setLngLat(center).addTo(map)

          for (const item of result) {
            delete item.location
          }
        }
        callback(result)
      } else {
        showNotFound(true)
        callback(false)
      }
    })
  })

}
