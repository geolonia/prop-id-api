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

test('Test for IPC API with 神奈川県横浜市緑区中山５丁目１－２４', async () => {

  const address = '神奈川県横浜市緑区中山５丁目１－２４'

  const res = await fetch(`https://api-anorm.mapfan.com/v1/${encodeURIComponent(address)}.json?geocode=true`, {
        method: 'get',
        headers: { 'x-api-key' : process.env.INCREMENTP_VERIFICATION_API_KEY },
    })
  const json = await res.json()

  expect(json.features[0].properties.geocoding_level).toStrictEqual(8)
  expect(json.features[0].properties.pref).toStrictEqual("神奈川県")
  expect(json.features[0].geometry.coordinates.length).toStrictEqual(2)
  expect(json.features[0].geometry.type).toStrictEqual("Point")
})

test('Test for IPC API with 千葉県流山市東初石６丁目１８５－６', async () => {

  const address = '千葉県流山市東初石６丁目１８５－６'

  const res = await fetch(`https://api-anorm.mapfan.com/v1/${encodeURIComponent(address)}.json?geocode=true`, {
        method: 'get',
        headers: { 'x-api-key' : process.env.INCREMENTP_VERIFICATION_API_KEY },
    })
  const json = await res.json()

  expect(json.features[0].properties.geocoding_level).toStrictEqual(3)
  expect(json.features[0].properties.pref).toStrictEqual("千葉県")
  expect(json.features[0].geometry.coordinates.length).toStrictEqual(2)
  expect(json.features[0].geometry.type).toStrictEqual("Point")
})

test('Test for IPC API with 千葉県流山市十太夫２１２', async () => {

  const address = '千葉県流山市十太夫２１２'

  const res = await fetch(`https://api-anorm.mapfan.com/v1/${encodeURIComponent(address)}.json?geocode=true`, {
        method: 'get',
        headers: { 'x-api-key' : process.env.INCREMENTP_VERIFICATION_API_KEY },
    })
  const json = await res.json()

  expect(json.features[0].properties.geocoding_level).toStrictEqual(2) // TODO: IPCに報告する必要がある？
  expect(json.features[0].properties.pref).toStrictEqual("千葉県")
  expect(json.features[0].geometry.coordinates.length).toStrictEqual(2)
  expect(json.features[0].geometry.type).toStrictEqual("Point")
})

test('Test for IPC API with 大阪府四條畷市中野３２－５', async () => {

  const address = '大阪府四條畷市中野３２－５'

  const res = await fetch(`https://api-anorm.mapfan.com/v1/${encodeURIComponent(address)}.json?geocode=true`, {
        method: 'get',
        headers: { 'x-api-key' : process.env.INCREMENTP_VERIFICATION_API_KEY },
    })
  const json = await res.json()

  expect(json.features[0].properties.geocoding_level).toStrictEqual(3)
  expect(json.features[0].properties.pref).toStrictEqual("大阪府")
  expect(json.features[0].geometry.coordinates.length).toStrictEqual(2)
  expect(json.features[0].geometry.type).toStrictEqual("Point")
})
