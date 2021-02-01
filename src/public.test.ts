import { promisify } from './__tests__/utils'
import { handler } from './public'

test('should specify the ZOOM environmental variable.', () => {
    // mock
    const dynamodb = require('./lib/dynamodb')
    dynamodb.store = async () => void 0

    const ZOOM = parseInt(process.env.ZOOM, 10)
    expect(ZOOM).not.toBe(NaN)
    expect(typeof ZOOM).toBe('number')
})

// [Alpha feature] Authentication required
test.skip('should get estate ID', async () => {
    // mock
    const dynamodb = require('./lib/dynamodb')
    dynamodb.store = async () => void 0
    
    const event = {
        queryStringParameters: {
            q: '盛岡市盛岡駅西通町２丁目９番地１号 マリオス10F'
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

test('should get estate ID with details if authenticated', async () => {
    // mock
    const dynamodb = require('./lib/dynamodb')
    dynamodb.authenticate = async () => { authenticated: true }
    dynamodb.store = async () => void 0
    
    const event = {
        queryStringParameters: {
            q: '盛岡市盛岡駅西通町２丁目９番地１号 マリオス10F',
            'api-key': 'geolonia'
        },
        headers: {
            'X-Access-Token': 'test'
        }
    }
    // @ts-ignore
     const lambdaResult = await promisify(handler)(event, {})
    // @ts-ignore
    const body = JSON.parse(lambdaResult.body)
    expect(body).toEqual([
        {
            ID: "03-5759-4a9a-6195-71a0",
            "address": {
                "ja": {
                    "address1": "盛岡駅西通2丁目",
                    "address2": "9-1",
                    "city": "盛岡市",
                    "other": "マリオス10F",
                    "prefecture": "岩手県",
                },
                "location": {
                    "lat": "39.701281",
                    "lng": "141.13366",
                },
            },
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

test('should return 403 if authenticated.', async () => {
    // mock
    const dynamodb = require('./lib/dynamodb')
    dynamodb.authenticate = async () => { authenticated: false }

    const event = {
        queryStringParameters: {
            q: '盛岡市盛岡駅西通町２丁目９番地１号 マリオス10F',
            'api-key': 'geolonia'
        },
        headers: {
            'X-Access-Token': 'test'
        }
    }
    // @ts-ignore
    const { statusCode, body } = await promisify(handler)(event, {})
    const { message } = JSON.parse(body)
    expect(statusCode).toEqual(403)
    expect(message).toEqual('Incorrect querystring parameter `api-key` or `x-access-token` header value.')
})

// [Alpha feature] Authentication required
test.skip('should return 404 if address is not verified', async () => {
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
