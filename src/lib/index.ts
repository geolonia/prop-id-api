import crypto from 'crypto'

export const hashXY = (x: number, y: number): string => {
    const tileIdentifier = `${x.toString()}/${y.toString()}`
    const hash = crypto.createHash('SHA256')
    hash.update(tileIdentifier)
    const digest16 = hash.copy().digest('hex').slice(0, 16)
    return (digest16.match(/.{4}/g) as string[]).join('-')
}
