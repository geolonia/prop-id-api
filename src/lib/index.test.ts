import { hashXY, coord2XY, verifyAddress } from './index'

test('Should hash tile index as xxxx-xxxx-xxxx-xxxx', () => {
    const indexX = 1234567
    const indexY = 54321
    const digest = hashXY(indexX, indexY)
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
    const { x, y } = coord2XY([lat, lng], 24)
    // Those values are approximately x 2^(24 - 18) from the test above.
    expect(x).toEqual(14902247)
    expect(y).toEqual(6606499)
})

test('Should verify an address via API', async () => {
    const address ="盛岡市盛岡駅西通町２丁目９番地１号 マリオス10F"
    const result = await verifyAddress(address)
    expect(result).toEqual({
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
        "attribution": "(c) INCREMENT P CORPORATION"
      })
})