// @ts-ignore
import fnv from 'fnv-plus'
import fetch from 'node-fetch'
import prefs from './prefs.json'

export const hashXY = (x: number, y: number): string => {
    const tileIdentifier = `${x}/${y}`
    const ahash64 = fnv.hash(tileIdentifier, 64).hex();
    return (ahash64.match(/.{4}/g) as string[]).join('-')
}

export const coord2XY = (coord: [lat: number, lng: number], zoom: number): { x: number, y: number } => {
    const [lat, lng] = coord
    const x = Math.floor((lng / 180 + 1) * 2**zoom / 2)
	const y = Math.floor((- Math.log(Math.tan((45 + lat / 2) * Math.PI / 180)) + Math.PI) * 2**zoom / (2 * Math.PI))
    return { x, y }
}

export const verifyAddress = (address: string) => {
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
        return res.json().then(body => ({ body, status: res.status, ok: res.ok }))
    })
}

export const getPrefCode = (prefName: string): string | null => {
    return prefs[prefName as keyof typeof prefs] || null
}
