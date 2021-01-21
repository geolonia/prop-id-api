import { hashXY, coord2XY } from './index'

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