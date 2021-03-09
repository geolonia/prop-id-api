// @ts-ignore
import fetch from 'node-fetch'
import * as crypto from 'crypto'
import prefs from './prefs.json'
import { distance } from 'fastest-levenshtein'
import { kanji2number, findKanjiNumbers } from '@geolonia/japanese-numeral'

export const hashXY = (x: number, y: number, serial: number): string => {
    const tileIdentifier = `${x}/${y}/${serial}`
    const sha256 = crypto.createHash('sha256').update(tileIdentifier).digest('hex')
    return (sha256.slice(0, 16).match(/.{4}/g) as string[]).join('-')
}

export const coord2XY = (coord: [lat: number, lng: number], zoom: number): { x: number, y: number } => {
    const [lat, lng] = coord
    if(Number.isNaN(lat) || Number.isNaN(lng) || Number.isNaN(zoom)) {
        throw new Error(`Invalid lat, lng or zoom: ${JSON.stringify({ lat, lng, zoom })}`)
    }
    const x = Math.floor((lng / 180 + 1) * 2**zoom / 2)
    const y = Math.floor((- Math.log(Math.tan((45 + lat / 2) * Math.PI / 180)) + Math.PI) * 2**zoom / (2 * Math.PI))
    return { x, y }
}

export const verifyAddress = (addressListString: string) => {
    // Use first address
    const addresses = addressListString.split(';')
    const address = addresses[0] || ''
    const endpoint = process.env.INCREMENTP_VERIFICATION_API_ENDPOINT
    const apiKey = process.env.INCREMENTP_VERIFICATION_API_KEY
    const url = `${endpoint}/${encodeURIComponent(address)}.json?geocode=true`
    const headers = { 'x-api-key': apiKey }

    return fetch(url, { headers })
    .catch(err => {
        // Network Error and etc.
        throw Error(err);
     })
    .then(res => {
        return res.json().then(body => ({ body, status: res.status, ok: res.ok, headers: res.headers }))
    })
}

export const getPrefCode = (prefName: string): string | null => {
    return prefs[prefName as keyof typeof prefs] || null
}

export const decapitalize = (headers: { [key : string]: string | undefined }) => {
    return Object.keys(headers || {}).reduce<{ [key: string]: string | undefined }>((prev, key) => {
        prev[key.toLowerCase()] = headers[key]
        return prev
    }, {})
}

export const hashToken = (accessToken: string) => {
    return crypto.scryptSync(accessToken, process.env.ACCESS_TOKEN_SALT, 10).toString()
}


export const kan2num = (string: string) => {
  const kanjiNumbers = findKanjiNumbers(string)
  for (let i = 0; i < kanjiNumbers.length; i++) {
    // @ts-ignore
    string = string.replace(kanjiNumbers[i], kanji2number(kanjiNumbers[i]))
  }

  return string
}

export const normalizeBuilding = (query: string) => {

  // 物件名は架空 + ネットで検索
  const getBuildingsFromDynamoDB = [
    'グリーンハイム壱番館',
    'コーポ平井I',
    'ライオンズガーデン綾瀬谷中公園A棟',
    'センチュリーハイツ池尻B号棟',
    'スカイレジデンスEAST',
    'プレミアム福井D',
    'セントラル川添第1',
    '第3トキワ荘',
    'OLIO高井戸4階',
    'マイキャッスル弦巻パークサイド608号室',
  ]

  let normalizedName;

  for (let index = 0; index < getBuildingsFromDynamoDB.length; index++) {
    let building = getBuildingsFromDynamoDB[index];

    // 漢数字を半角数字に変換
    building = kan2num(building)

    console.log("kan2num")
    console.log({building})

    // TODO: ローマ数字を半角数字に変換

    //階と号室 + その前の数字は削除
    building = building.replace(/\d*?(階|号室)/g,'')

    console.log({building})




    //棟、号館、番号館、の直前の文字が違っていれば、違う物件として判定。
    // queryのマッチ結果
    // buildingのマッチ結果
    // if(queryMatch !== buildingMatch){
    //   normalizedName = query
    //   break
    // }

    // const similarScore = distance(query,building)
    // if(similarScore < 5){
    //   normalizedName = building
    //   break
    // } else {
    //   normalizedName = query
    //   break
    // }
  }

  return normalizedName

}
