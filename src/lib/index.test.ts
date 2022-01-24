import { hashXY, coord2XY, verifyAddress, zen2hanAscii, yokobo2zenchoonSymbol  } from './index'

test('Should hash tile index as xxxx-xxxx-xxxx-xxxx', () => {
    const indexX = 1234567
    const indexY = 54321
    const serial = 100
    const digest = hashXY(indexX, indexY, serial)
    expect(digest).toHaveLength(16 + 3) // 16 digits + 3 hyphens
    expect(digest.split('-').every(section => section.length === 4)).toBe(true)
    expect(digest).toMatchSnapshot()
})

test('Should calculate tile indexes from coordinates(1)', () => {
    // see https://maps.gsi.go.jp/development/tileCoordCheck.html#18/35.68122/139.76755
    const lat = 35.68122
    const lng = 139.76755
    const {x, y} = coord2XY([lat, lng], 18)
    expect(x).toEqual(232847)
    expect(y).toEqual(103226)
})

test('Should calculate tile indexes from coordinates(2)', () => {
    const lat = 35.68122
    const lng = 139.76755
    const { x, y } = coord2XY([lat, lng], 22)
    // Those values are approximately x 2^(22 - 18) from the test above.
    expect(x).toEqual(3725561)
    expect(y).toEqual(1651624)
})

test('Should not calculate tile indexes with NaN', () => {
  const lat = 35.68122
  const lng = 139.76755
  expect(() => coord2XY([lat, lng], NaN)).toThrow()
})

describe('IncrementP Verification API', () => {
  test('Should verify an address via API', async () => {
    const address ="盛岡市盛岡駅西通町２丁目９番地１号 マリオス10F"
    const result = await verifyAddress(address)
    expect(result.status).toEqual(200)
    expect(result.ok).toEqual(true)
    expect(result.body).toEqual({
        "type": "FeatureCollection",
        "query": [
          "盛岡市盛岡駅西通町２丁目９番地１号 マリオス10F"
        ],
        "features": [
          {
            "type": "Feature",
            "geometry": {
              "type": "Point",
              "coordinates": [
                141.13366,
                39.701281
              ]
            },
            "properties": {
              "query": "盛岡市盛岡駅西通町２丁目９番地１号 マリオス10F",
              "place_name": "岩手県盛岡市盛岡駅西通2丁目 9-1 マリオス10F",
              "not_normalized": "",
              "pref": "岩手県",
              "pref_kana": "イワテケン",
              "city": "盛岡市",
              "city_kana": "モリオカシ",
              "area": "盛岡駅西通",
              "area_kana": "モリオカエキニシドオリ",
              "koaza_chome": "2丁目",
              "koaza_chome_kana": "2チョウメ",
              "banchi_go": "9-1",
              "building": "マリオス",
              "building_number": "10F",
              "zipcode": "0200045",
              "geocoding_level": 8,
              "geocoding_level_desc": "号レベルでマッチしました(8)",
              "log": "FL001:都道府県名を補完しました(岩手県) | RM001:文字を除去しました(町)"
            }
          }
        ],
        "attribution": "(c) GeoTechnologies Inc."
      })
  })

  test('should return `feature.geometry === null` if invalid address specified.', async () => {
    const result = await verifyAddress('===Not exisiting address. This string should not be verified via API.===')
    expect(result.status).toBe(200)
    expect(result.body).toEqual({
      type: 'FeatureCollection',
      query: [
        '===Not exisiting address. This string should not be verified via API.==='
      ],
      features: [
        {
          type: 'Feature',
          geometry: null,
          properties: {
            query: '===Not exisiting address. This string should not be verified via API.===',
            place_name: '',
            pref: '',
            pref_kana: '',
            city: '',
            city_kana: '',
            area: '',
            area_kana: '',
            koaza_chome: '',
            koaza_chome_kana: '',
            banchi_go: '',
            building: '',
            building_number: '',
            zipcode: '',
            geocoding_level: -1,
            geocoding_level_desc: 'マッチレベルが不明です(-1)',
            log: 'NF001:都道府県情報を取得できませんでした | NF002:市区町村情報を取得できませんでした | ZJ005:郵便番号が存在しない住所情報です',
            "not_normalized": "===Not exisiting address. This string should not be verified via API.===",
          }
        }
      ],
      attribution: '(c) GeoTechnologies Inc.'
    })
  })

  test('should verify the first address.', async () => {
    const address ="盛岡市盛岡駅西通町２丁目９番地１号 マリオス10F;aaaa"
    const results = await verifyAddress(address)
    expect(results.body.features).toHaveLength(1)
  })

  test('should return 400 if no address specified.', async () => {
    const result = await verifyAddress('')
    expect(result.status).toBe(400)
    expect(result.ok).toEqual(false)
    expect(result.body.message).toEqual("addr is not specified")
  })

  test('should return 403 if no api key specified.', async () => {
    // @ts-ignore
    const TEMP_API_KEY = process.env.INCREMENTP_VERIFICATION_API_KEY
    // @ts-ignore
    process.env.INCREMENTP_VERIFICATION_API_KEY = ''

    const address ="盛岡市盛岡駅西通町２丁目９番地１号 マリオス10F"
    const result = await verifyAddress(address)
    expect(result.status).toBe(403)
    expect(result.ok).toEqual(false)
    expect(result.body.message).toEqual("Authentication failed")

    // @ts-ignore
    process.env.INCREMENTP_VERIFICATION_API_KEY = TEMP_API_KEY
  })
})

test('should throw if API request fails with network problem', async () => {
  jest.mock('axios')
  const axios = require('axios')
  axios.get.mockImplementation(async () => { throw new Error('mocked network error') })

  const error = await axios.get().catch((err: Error) => err)
  expect(error.message).toEqual('mocked network error')
})

test('should verify the address with 和歌山県東牟婁郡串本町田並1234', async () => {
  const address ="和歌山県東牟婁郡串本町田並1234"
  const results = await verifyAddress(address)
  expect(results.body.features).toHaveLength(1)
})

test('should verify the address with 和歌山県東牟婁郡串本町鬮野川1234', async () => {
  const address ="和歌山県東牟婁郡串本町鬮野川1234"
  const results = await verifyAddress(address)
  expect(results.body.features).toHaveLength(1)
})

test('should IPC responce of banchi_go is empty. test with 和歌山県東牟婁郡串本町田並1500', async () => {
  const address ="和歌山県東牟婁郡串本町田並1500"
  const results = await verifyAddress(address)
  expect(results.body.features[0].properties.banchi_go).toStrictEqual("")
})

test('should IPC responce of city is not empty. test with 和歌山県東牟婁郡串本町', async () => {
  const address ="和歌山県東牟婁郡串本町"
  const results = await verifyAddress(address)
  expect(results.body.features[0].properties.city).toStrictEqual('東牟婁郡串本町')
})

test('should IPC responce of area is not empty. test with 和歌山県東牟婁郡串本町鬮野川', async () => {
  const address ="和歌山県東牟婁郡串本町鬮野川"
  const results = await verifyAddress(address)
  expect(results.body.features[0].properties.area).toStrictEqual('鬮野川')
})

test('should IPC responce of area is not empty. test with 和歌山県東牟婁郡北山村大沼999', async () => {
  const address ="和歌山県東牟婁郡北山村大沼999"
  const results = await verifyAddress(address)
  expect(results.body.features[0].properties.area).toStrictEqual('大沼')
})

test('Should replace 全角Ascii to 半角Ascii', () => {
  const ascii = '！＂＃＄％＆＇（）＊＋，－．／：；＜＝＞？＠［＼］＾＿｀｛｜｝'
  const normalized = zen2hanAscii(ascii)
  expect(normalized).toStrictEqual('\!\"\#\$\%\&\'\(\)\*\+\,\-\.\/\:\;\<\=\>\?\@\[\\\]\^\_\`\{\|\}')
})

test('Should replace 横棒 to 長音記号', () => {
  const yokobo = '-－﹣−‐⁃‑‒–—﹘―⎯⏤ーｰ─━'
  const normalized = yokobo2zenchoonSymbol(yokobo)
  expect(normalized).toStrictEqual('ーーーーーーーーーーーーーーーーーー')
})
