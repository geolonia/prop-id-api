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
    dynamodb.issueSerial = async () => 100
    dynamodb.store = async () => void 0
    dynamodb.updateTimestamp = async (apiKey: string, timestamp: number) => void 0
    dynamodb.removeTimestamp = async (apiKey: string) => void 0

    const event = {
        queryStringParameters: {
            q: '岩手県盛岡市盛岡駅西通２丁目９番地１号 マリオス10F'
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
    dynamodb.issueSerial = async () => 100
    dynamodb.authenticate = async () => ({ authenticated: true })
    dynamodb.updateTimestamp = async (apiKey: string, timestamp: number) => void 0
    dynamodb.removeTimestamp = async (apiKey: string) => void 0
    dynamodb.store = async () => void 0

    const event = {
        queryStringParameters: {
            q: '岩手県盛岡市盛岡駅西通２丁目９番地１号 マリオス10F',
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
            ID: "03-81b1-52e4-8c9e-d8d1",
            "address": {
                "ja": {
                    "address1": "盛岡駅西通2丁目",
                    "address2": "9-1",
                    "city": "盛岡市",
                    "other": "マリオス10F",
                    "prefecture": "岩手県",
                },
            },
            "location": {
                "lat": "39.701281",
                "lng": "141.13366",
            },
        }
    ])
})

test('should get estate ID with details if authenticated, and geocodeing-level is 7 (番地でマッチ：号情報が存在しない地域）', async () => {
  // mock
  const dynamodb = require('./lib/dynamodb')
  dynamodb.issueSerial = async () => 100
  dynamodb.authenticate = async () => ({ authenticated: true })
  dynamodb.updateTimestamp = async (apiKey: string, timestamp: number) => void 0
  dynamodb.removeTimestamp = async (apiKey: string) => void 0
  dynamodb.store = async () => void 0

  const event = {
      queryStringParameters: {
          q: '兵庫県姫路市玉手2丁目465',
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
          ID: "28-917e-43e1-941e-83f7",
          "address": {
              "ja": {
                  "address1": "玉手2丁目",
                  "address2": "465",
                  "city": "姫路市",
                  "other": "",
                  "prefecture": "兵庫県",
              },
          },
          "location": {
              "lat": "34.813927",
              "lng": "134.659955",
          },
      }
  ])
})

test('should get return 400 with insufficient address.', async () => {
  // mock
  const dynamodb = require('./lib/dynamodb')
  dynamodb.authenticate = async () => ({ authenticated: true })
  dynamodb.updateTimestamp = async (apiKey: string, timestamp: number) => void 0
  dynamodb.removeTimestamp = async (apiKey: string) => void 0
  dynamodb.store = async () => void 0

  const addresses = [
    '兵庫県神戸市東灘区田中町1丁目'
  ]

  for (const address of addresses) {
    const event = {
      queryStringParameters: {
          q: address,
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
    // @ts-ignore
    expect(lambdaResult.statusCode).toEqual(400)
  }
})

test('should return 429 with too frequest request.', async () => {
    // mock
    const dynamodb = require('./lib/dynamodb')
    const now = Date.now()
    dynamodb.issueSerial = async () => 100
    dynamodb.authenticate = async () => ({ authenticated: true, lastRequestAt: now })
    dynamodb.updateTimestamp = async (apiKey: string, timestamp: number) => void 0
    dynamodb.removeTimestamp = async (apiKey: string) => void 0
    dynamodb.store = async () => void 0

    const event = {
        queryStringParameters: {
            q: '岩手県盛岡市盛岡駅西通２丁目９番地１号 マリオス10F',
            'api-key': 'geolonia'
        },
        headers: {
            'X-Access-Token': 'test'
        }
    }
    // @ts-ignore
     const lambdaResult = await promisify(handler)(event, {})
    // @ts-ignore
    expect(lambdaResult.statusCode).toBe(429)
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

test('should return 403 if not authenticated.', async () => {
    // mock
    const dynamodb = require('./lib/dynamodb')
    dynamodb.authenticate = async () => ({ authenticated: false })
    dynamodb.updateTimestamp = async (apiKey: string, timestamp: number) => void 0
    dynamodb.removeTimestamp = async (apiKey: string) => void 0
    dynamodb.issueSerial = async () => 100

    const event = {
        queryStringParameters: {
            q: '岩手県盛岡市盛岡駅西通２丁目９番地１号 マリオス10F',
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
