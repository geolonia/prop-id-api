import Lambda from 'aws-lambda'
import { promisify } from './__tests__/utils'
import { handler } from './public'

test('should specify the ZOOM environmental variable.', () => {
    const ZOOM = parseInt(process.env.ZOOM, 10)
    expect(ZOOM).not.toBe(NaN)
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
            ID: "03-5759-4a9a-6195-71a0"
        }
    ])
})

test('should return 400 with empty address', async () => {
    const event = {
        queryStringParameters: null
    }
    // @ts-ignore
    const { statusCode, body } = await promisify(handler)(event, {})
    const { message } = JSON.parse(body)
    expect(statusCode).toEqual(400)
    expect(message).toEqual('Missing querystring parameter `q`.')
})

test('should return 404 if address is not verified', async () => {
    const event = {
        queryStringParameters: {
            q: '===Not exisiting address. This string should not be verified via API.==='
        }
    }
    // @ts-ignore
    const { statusCode, body } = await promisify(handler)(event, {})
    const { message } = JSON.parse(body)
    expect(statusCode).toEqual(404)
    expect(message).toEqual(`The address '${event.queryStringParameters.q}' is not verified.`)
})
