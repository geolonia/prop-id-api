// @ts-ignore
import fnv from 'fnv-plus'

export const hashXY = (x: number, y: number): string => {
    const tileIdentifier = `${x}/${y}`
    const ahash64 = fnv.hash(tileIdentifier, 64).hex();
    return (ahash64.match(/.{4}/g) as string[]).join('-')
}
