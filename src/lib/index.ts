import axios, { AxiosResponse } from 'axios'
import * as crypto from 'crypto'
import { promisify } from 'util'
import prefs from './prefs.json'
import Sentry from './sentry'

const scrypt = promisify(crypto.scrypt)

export const hashXY = (x: string | number, y: string | number, serial: number): string => {
  const tileIdentifier = `${x}/${y}/${serial}`
  const sha256 = crypto.createHash('sha256').update(tileIdentifier).digest('hex')
  return (sha256.slice(0, 16).match(/.{4}/g) as string[]).join('-')
}

export const coord2XY = (coord: [lat: number, lng: number], zoom: number): { x: number, y: number } => {
  const [lat, lng] = coord
  if (Number.isNaN(lat) || Number.isNaN(lng) || Number.isNaN(zoom)) {
    throw new Error(`Invalid lat, lng or zoom: ${JSON.stringify({ lat, lng, zoom })}`)
  }
  const x = Math.floor((lng / 180 + 1) * 2**zoom / 2)
  const y = Math.floor((- Math.log(Math.tan((45 + lat / 2) * Math.PI / 180)) + Math.PI) * 2**zoom / (2 * Math.PI))
  return { x, y }
}

export type VerifyAddressResult = {
  body: any;
  status: number;
  ok: boolean;
  headers: { [key: string]: string };
}
export const verifyAddress: (addressListString: string) => Promise<VerifyAddressResult> = async (addressListString) => {
  // Use first address
  const addresses = addressListString.split(';')
  const address = addresses[0] || ''
  const endpoint = process.env.INCREMENTP_VERIFICATION_API_ENDPOINT
  const apiKey = process.env.INCREMENTP_VERIFICATION_API_KEY
  const url = `${endpoint}/${encodeURIComponent(address)}.json?geocode=true`
  const headers = {
    'x-api-key': apiKey,
    'user-agent': 'geolonia-prop-id/1.0',
  }

  const res = await axios.get(url, {
    headers,
    validateStatus: status => ( status < 500 ),
  })

  return ({
    body: res.data,
    status: res.status,
    ok: res.status === 200,
    headers: res.headers
  })
}

export type IncrementPGeocodeResult = {
  feature: any
  cacheHit: boolean
}

export const incrementPGeocode: (address: string) => Promise<IncrementPGeocodeResult | false> = async (address) => {
  // Request Increment P Address Verification API
  let verifiedResult: VerifyAddressResult
  try {
    verifiedResult = await verifyAddress(address)
  } catch (error) {
    Sentry.captureException(error)
    console.error({ error })
    console.error('[FATAL] API or Network Down Detected.')
    return false
  }

  // API key for Increment P should valid.
  if(!verifiedResult.ok) {
    if(verifiedResult.status === 403) {
      console.error('[FATAL] API Authentication failed.')
    } else {
      console.error('[FATAL] Unknown status code detected.')
    }
    Sentry.captureException(new Error(`error from Increment P: ${JSON.stringify(verifiedResult)}`))
    return false
  }

  const feature = verifiedResult.body.features[0]

  return {
    feature,
    cacheHit: verifiedResult.headers['x-cache'] === 'Hit from cloudfront'
  }
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

export const randomToken = (length: number) => {
  return crypto.randomBytes(length).reduce((p, i) => p + (i % 36).toString(36), '')
}

export const hashToken = (accessToken: string) => {
  return crypto.scryptSync(accessToken, process.env.ACCESS_TOKEN_SALT, 10).toString()
}

export const hashTokenV2 = async (apiKey: string, accessToken: string) => {
  // use api key as salt
  const buf = await scrypt(accessToken, apiKey, 10) as Buffer
  return buf.toString('base64')
}

export const zen2hanAscii = (str: string) => {
  return str.replace(/[Ａ-Ｚａ-ｚ０-９！＂＃＄％＆＇（）＊＋，－．／：；＜＝＞？＠［＼］＾＿｀｛｜｝]/g, (s) => {
      return String.fromCharCode(s.charCodeAt(0) - 0xfee0)
  })
  .replace(/　/g, " ") // 全角スペースを半角スペースに変換
}

export const yokobo2zenchoonSymbol = (str: string) => {
  return str.replace(/[-－﹣−‐⁃‑‒–—﹘―⎯⏤ーｰ─━]/gi,'ー') // 長音記号に変換
}

export const normalizeBuilding = (building?: string ): string | undefined => {
  if (typeof building === 'undefined' || building.trim() === "") {
    return undefined
  }
  return yokobo2zenchoonSymbol(zen2hanAscii(building.trim()))
}
