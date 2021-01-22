import Lambda from 'aws-lambda'
import { promisify } from '../__tests__/utils'
import { handler } from './public'

test('should specify the ZOOM environmental variable.', () => {
    const ZOOM = parseInt(process.env.ZOOM, 10)
    expect(ZOOM).not.toBe(isNaN)
    expect(typeof ZOOM).toBe('number')
})

test('should get estate ID', async () => {
    const event = {
        queryStringParameters: {
            q: '盛岡市盛岡駅西通町２丁目９番地１号 マリオス10F"'
        }
    }
    // @ts-ignore
     const lambdaResult = await promisify(handler)(event, {})
    // @ts-ignore
    const body = JSON.parse(lambdaResult.body)

    expect(body).toEqual([
        {
            ID: "03_6b6d-f315-17a6-ba28"
        }
    ])
})