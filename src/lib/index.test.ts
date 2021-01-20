import { hash } from './index'

test('Should hash tileIndex', () => {
    const indexX = 12345
    const indexY = 54321
    expect(hash(indexX, indexY)).toMatchSnapshot()
})