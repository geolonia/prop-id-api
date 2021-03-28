import fetch from 'node-fetch'

test('Test for IPC API', async () => {

  const address = '和歌山県東牟婁郡串本町田並1512'

  const res = await fetch(`https://api-anorm.mapfan.com/v1/${encodeURIComponent(address)}.json?geocode=true`, {
        method: 'get',
        headers: { 'x-api-key' : process.env.INCREMENTP_VERIFICATION_API_KEY },
    })
  const json = await res.json()

  expect(json.features[0].properties.geocoding_level).toStrictEqual(3)
  expect(json.features[0].properties.pref).toStrictEqual("和歌山県")
  expect(json.features[0].geometry.coordinates.length).toStrictEqual(2)
  expect(json.features[0].geometry.type).toStrictEqual("Point")
})
