// @ts-ignore
import fnv from 'fnv-plus'

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

export const cleanse = async (address: string) => {}
 