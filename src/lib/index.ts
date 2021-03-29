// @ts-ignore
import fetch from 'node-fetch'
import * as crypto from 'crypto'
import { promisify } from 'util'
import prefs from './prefs.json'

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
  status: any;
  ok: any;
  headers: any;
}
export const verifyAddress: (addressListString: string) => Promise<VerifyAddressResult> = async (addressListString) => {
  // Use first address
  const addresses = addressListString.split(';')
  const address = addresses[0] || ''
  const endpoint = process.env.INCREMENTP_VERIFICATION_API_ENDPOINT
  const apiKey = process.env.INCREMENTP_VERIFICATION_API_KEY
  const url = `${endpoint}/${encodeURIComponent(address)}.json?geocode=true`
  const headers = { 'x-api-key': apiKey }

  const res = await fetch(url, { headers })
  const body = await res.json()
  return ({ body, status: res.status, ok: res.ok, headers: res.headers })
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
