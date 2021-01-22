import { promisify } from './__tests__/utils'
import { handler } from './authenticated'

test.only('wip', async () => {
    const result = await promisify(handler)({ queryStringParameters: { apiKey: 'geolonia' } }, {})
})
