import { hashXY } from './index'

test('Should hash tile index as xxxx-xxxx-xxxx-xxxx', () => {
    const indexX = 1234567
    const indexY = 54321
    const digest = hashXY(indexX, indexY)
    expect(digest).toHaveLength(16 + 3) // 16 digits + 3 hyphens
    expect(digest.split('-').every(section => section.length === 4)).toBe(true)
    expect(digest).toMatchSnapshot()
})
