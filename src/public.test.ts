import { APIGatewayProxyResult } from 'aws-lambda'
import * as dynamodb from './lib/dynamodb'
import { _updateServiceUsageQuota, _getServiceUsageQuotaItem } from './lib/dynamodb.test'
import { rawHandler as handler } from './public'

test('should specify the ZOOM environmental variable.', () => {
    const ZOOM = parseInt(process.env.ZOOM, 10)
    expect(ZOOM).not.toBe(NaN)
    expect(typeof ZOOM).toBe('number')
})

test('should get same estate ID for multiple queries to same address', async () => {
  const event = {
    isDemoMode: true,
    queryStringParameters: {
      q: '岩手県盛岡市盛岡駅西通２丁目９番地１号 マリオス10F',
    },
  }
  // @ts-ignore
  const lambdaResult1 = await handler(event)
  // @ts-ignore
  const body1 = JSON.parse(lambdaResult1.body)

  // @ts-ignore
  const lambdaResult2 = await handler(event)
  // @ts-ignore
  const body2 = JSON.parse(lambdaResult2.body)

  expect(body1[0].ID).toEqual(body2[0].ID)
})

test('should get estate ID with details if authenticated', async () => {
  const { apiKey, accessToken } = await dynamodb.createApiKey('should get estate ID with details if authenticated')

  const event = {
    queryStringParameters: {
      q: '岩手県盛岡市盛岡駅西通２丁目９番地１号 マリオス10F',
      'api-key': apiKey,
    },
    headers: {
      'X-Access-Token': accessToken,
    }
  }
  // @ts-ignore
  const lambdaResult = await handler(event)
  // @ts-ignore
  const body = JSON.parse(lambdaResult.body)
  expect(body).toEqual([
    expect.objectContaining({
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
    })
  ])
})

test('should get estate ID with details if authenticated with 和歌山県東牟婁郡串本町田並1500', async () => {
  const event = {
    isDemoMode: true,
    queryStringParameters: {
      q: '和歌山県東牟婁郡串本町田並1500',
    }
  }
  // @ts-ignore
  const lambdaResult = await handler(event)
  // @ts-ignore
  const body = JSON.parse(lambdaResult.body)
  expect(body).toEqual([
    expect.objectContaining({
      "address": {
        "ja": {
            "address1": "田並",
            "address2": "",
            "city": "東牟婁郡串本町",
            "other": "",
            "prefecture": "和歌山県",
        },
      },
      "location": {
        "lat": "33.488638",
        "lng": "135.714765",
      },
    })
  ])
})

test('should return 400 with insufficient address.', async () => {
  const addresses = [
    '和歌山県東牟婁郡'
  ]

  for (const address of addresses) {
    const event = {
      isDemoMode: true,
      queryStringParameters: {
          q: address,
      }
    }

    try {
      // @ts-ignore
      const lambdaResult = await handler(event)
      // @ts-ignore
      throw lambdaResult.statusCode
    } catch(e) {
      expect(e).toEqual(400)
    }
  }
})

test('should return 429 with too frequest request.', async () => {
  const { apiKey, accessToken } = await dynamodb.createApiKey('should return 429 with too frequest request')

  const event = {
    queryStringParameters: {
      q: '岩手県盛岡市盛岡駅西通２丁目９番地１号 マリオス10F',
      'api-key': apiKey,
    },
    headers: {
      'X-Access-Token': accessToken,
    }
  }
  // @ts-ignore
  const lambdaResult1 = await handler(event) as APIGatewayProxyResult
  expect(lambdaResult1!.statusCode).toBe(200)

  // @ts-ignore
  const lambdaResult2 = await handler(event) as APIGatewayProxyResult
  expect(lambdaResult2.statusCode).toBe(429)
})

test('should return 400 with empty address', async () => {
  const event = {
    isDemoMode: true,
    queryStringParameters: null
  }
  // @ts-ignore
  const { statusCode, body } = await handler(event)
  const { message } = JSON.parse(body)
  expect(statusCode).toEqual(400)
  expect(message).toEqual('Missing querystring parameter `q`.')
})

test('should return 403 if not authenticated.', async () => {
  const event = {
    queryStringParameters: {
      q: '岩手県盛岡市盛岡駅西通２丁目９番地１号 マリオス10F'
    },
  }
  // @ts-ignore
  const { statusCode, body } = await handler(event)
  const { message } = JSON.parse(body)
  expect(statusCode).toEqual(403)
  expect(message).toEqual('Incorrect querystring parameter `api-key` or `x-access-token` header value.')
})

test('should return 403 if request exceeds request limit, or  200 if request dose not exceeds request limit, ', async () => {

  const testCases = [
    { requested: 10000, status: 403},
    { requested: 9999, status: 200}
  ]

  await Promise.all(testCases.map(async testCase => {

    const { apiKey, accessToken } = await dynamodb.createApiKey('should get estate ID with details if authenticated')
    const quotaType = "id-req"
    const usageKey = dynamodb._generateUsageQuotaKey({ apiKey, quotaType })

    //Update X number for requested count
    await _updateServiceUsageQuota(usageKey, testCase.requested)

    const item = await _getServiceUsageQuotaItem(usageKey)
    // @ts-ignore
    expect(item.c).toStrictEqual(testCase.requested)

    const event = {
      queryStringParameters: {
        q: '岩手県盛岡市盛岡駅西通２丁目９番地１号 マリオス10F',
        'api-key': apiKey,
      },
      headers: {
        'X-Access-Token': accessToken,
      }
    }

    try {
      // @ts-ignore
      const lambdaResult = await handler(event)
      // @ts-ignore
      throw lambdaResult.statusCode
    } catch(e) {
      expect(e).toEqual(testCase.status)
    }
  }))
})

// [Alpha feature] Authentication required
// test.skip('should return 404 if address is not verified', async () => {
//     const event = {
//         queryStringParameters: {
//             q: '===Not exisiting address. This string should not be verified via API.==='
//         }
//     }
//     // @ts-ignore
//     const { statusCode, body } = await handler(event)
//     const { message } = JSON.parse(body)
//     expect(statusCode).toEqual(404)
//     expect(message).toEqual(`The address '${event.queryStringParameters.q}' is not verified.`)
// })
