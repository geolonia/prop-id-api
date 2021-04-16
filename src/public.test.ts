import { APIGatewayProxyResult } from 'aws-lambda'
import * as dynamodb from './lib/dynamodb'
import { _getServiceUsageQuotaItem, _updateServiceUsageQuota } from './lib/dynamodb_test_helpers.test'
import { _handler as handler } from './public'

test('should specify the ZOOM environmental variable.', () => {
    const ZOOM = parseInt(process.env.ZOOM, 10)
    expect(ZOOM).not.toBe(NaN)
    expect(typeof ZOOM).toBe('number')
})

test('should get same estate ID for multiple queries to same address', async () => {

  const event = {
    isDemoMode: true,
    queryStringParameters: {
      q: '岩手県盛岡市盛岡駅西通２丁目９番地１号',
      building: 'マリオス10F',
    },
  }
  // @ts-ignore
  const lambdaResult1 = await handler(event) as APIGatewayProxyResult
  const body1 = JSON.parse(lambdaResult1.body)

  // @ts-ignore
  const lambdaResult2 = await handler(event) as APIGatewayProxyResult
  const body2 = JSON.parse(lambdaResult2.body)

  expect(body1[0].ID).toEqual(body2[0].ID)

})

test('should get estate ID with details if authenticated', async () => {
  const { apiKey, accessToken } = await dynamodb.createApiKey('should get estate ID with details if authenticated')
  const event = {
    queryStringParameters: {
      q: '岩手県盛岡市盛岡駅西通２丁目９番地１号',
      building: 'マリオス10F',
      'api-key': apiKey,
  },
    headers: {
      'X-Access-Token': accessToken,
    }
  }
  // @ts-ignore
  const lambdaResult = await handler(event) as APIGatewayProxyResult
  const body = JSON.parse(lambdaResult.body)

  expect(body).toEqual([
    expect.objectContaining({
      "address": {
        "ja": {
            "address1": "盛岡駅西通二丁目",
            "address2": "9-1",
            "city": "盛岡市",
            "other": "マリオス10F",
            "prefecture": "岩手県",
        },
      },
      "location": {
        "geocoding_level": "8",
        "lat": "39.701281",
        "lng": "141.13366",
      },
    })
  ])
})

describe("preauthenticatedUserId", () => {
  test('should get estate ID if preauthenticated', async () => {
    const userId = 'keymock|should get estate ID if preauthenticated'
    const { apiKey } = await dynamodb.createApiKey('should get estate ID if preauthenticated', {
      GSI1PK: userId,
      plan: "free",
    })
    const event = {
      queryStringParameters: {
        q: '岩手県盛岡市盛岡駅西通２丁目９番地１号',
        building: 'マリオス10F',
        'api-key': apiKey,
      },
      preauthenticatedUserId: userId,
    }
    // @ts-ignore
    const lambdaResult = await handler(event) as APIGatewayProxyResult
    const body = JSON.parse(lambdaResult.body)

    expect(lambdaResult.statusCode).toBe(200)
    expect(body[0].ID).toBeDefined()
    expect(body[0].location).toBeUndefined()
  })

  test('should get estate ID if preauthenticated as paid user', async () => {
    const userId = 'keymock|should get estate ID if preauthenticated as paid user'
    const { apiKey } = await dynamodb.createApiKey('should get estate ID if preauthenticated as paid user', {
      GSI1PK: userId,
      plan: "paid",
    })
    const event = {
      queryStringParameters: {
        q: '岩手県盛岡市盛岡駅西通２丁目９番地１号',
        building: 'マリオス10F',
        'api-key': apiKey,
      },
      preauthenticatedUserId: userId,
    }
    // @ts-ignore
    const lambdaResult = await handler(event) as APIGatewayProxyResult
    const body = JSON.parse(lambdaResult.body)

    expect(lambdaResult.statusCode).toBe(200)
    expect(body[0].ID).toBeDefined()
    expect(body[0].location).toMatchObject({
      "geocoding_level": "8",
      "lat": "39.701281",
      "lng": "141.13366",
    })
  })

  test('should get error if API key and preauthenticated user does not match', async () => {
    const userId = 'keymock|should get error if API key and preauthenticated user does not match'
    const userId2 = 'keymock|should get error if API key and preauthenticated user does not match 2'
    const { apiKey } = await dynamodb.createApiKey('should get error if API key and preauthenticated user does not match', {
      GSI1PK: userId,
      plan: "free",
    })
    await dynamodb.createApiKey('should get error if API key and preauthenticated user does not match2', {
      GSI1PK: userId2,
      plan: "free",
    })
    const event = {
      queryStringParameters: {
        q: '岩手県盛岡市盛岡駅西通２丁目９番地１号',
        building: 'マリオス10F',
        'api-key': apiKey,
      },
      preauthenticatedUserId: userId2,
    }
    // @ts-ignore
    const lambdaResult = await handler(event) as APIGatewayProxyResult
    const body = JSON.parse(lambdaResult.body)

    expect(lambdaResult.statusCode).toBe(403)
    expect(body[0]?.ID).toBeUndefined()
  })
})

test('[Not Recommended request type] should get estate ID with details if authenticated and Building name in q query. ', async () => {
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
            "address1": "盛岡駅西通二丁目",
            "address2": "9-1 マリオス10F",
            "city": "盛岡市",
            "other": "",
            "prefecture": "岩手県",
        },
      },
      "location": {
        "geocoding_level": "8",
        "lat": "39.701281",
        "lng": "141.13366",
      },
    })
  ])
})


test('should get estate ID without details if authenticated with a free API key', async () => {
  const { apiKey, accessToken } = await dynamodb.createApiKey('should get estate ID without details if authenticated with a free API key', { plan: "free" })

  const queryStringParameters = {
    q: '岩手県盛岡市盛岡駅西通２丁目９番地１号',
    building: 'マリオス10F',
    'api-key': apiKey,
  }

  const event = {
    queryStringParameters,
    headers: {
      'X-Access-Token': accessToken,
    }
  }
  // @ts-ignore
  const lambdaResult = await handler(event) as APIGatewayProxyResult
  const body = JSON.parse(lambdaResult.body)

  const first = body[0]
  expect(first).toHaveProperty("ID")
  expect(first.address).toBeUndefined()
  expect(first.location).toBeUndefined()
})

test('should get estate ID with details if authenticated with 和歌山県東牟婁郡串本町田並1500', async () => {
  const { apiKey, accessToken } = await dynamodb.createApiKey('should get estate ID with details if authenticated')

  const event = {
    isDemoMode: true,
    queryStringParameters: {
      q: '和歌山県東牟婁郡串本町田並1500',
      'api-key': apiKey
    },
    headers: {
      'X-Access-Token': accessToken,
    }
  }
  // @ts-ignore
  const lambdaResult = await handler(event) as APIGatewayProxyResult
  const body = JSON.parse(lambdaResult.body)

  expect(body).toEqual([
    expect.objectContaining({
      "address": {
        "ja": {
          "address1": "田並",
          "address2": "1500",
          "city": "東牟婁郡串本町",
          "other": "",
          "prefecture": "和歌山県",
        },
      },
      "location": {
        "geocoding_level": "3",
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
        q: address
      }
    }

    // @ts-ignore
    const lambdaResult = await handler(event) as APIGatewayProxyResult
    expect(lambdaResult.statusCode).toEqual(400)
  }
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
      q: '岩手県盛岡市盛岡駅西通２丁目９番地１号',
      building: 'マリオス10F',
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
    { requested: 10_000, status: 429 },
    { requested: 9_999,  status: 200 },
    { requested: 10_001, status: 200, customQuota: 20_000 },
    { requested: 20_001, status: 429, customQuota: 20_000 }
  ]

  await Promise.all(testCases.map(async testCase => {
    const quotaType = "id-req"
    const otherParams: {[key: string]: any} = {}
    if (testCase.customQuota) {
      otherParams[`quota_${quotaType}`] = testCase.customQuota
    }
    const { apiKey, accessToken } = await dynamodb.createApiKey('should get estate ID with details if authenticated', otherParams)
    const usageKey = dynamodb._generateUsageQuotaKey(apiKey, quotaType)

    // Update X number for requested count
    await _updateServiceUsageQuota(usageKey, testCase.requested)

    const item = await _getServiceUsageQuotaItem(usageKey)
    expect(item).toBeDefined()
    expect(item!.c).toStrictEqual(testCase.requested)

    const event = {
      queryStringParameters: {
        q: '岩手県盛岡市盛岡駅西通２丁目９番地１号',
        building: 'マリオス10F',
        'api-key': apiKey,
      },
      headers: {
        'X-Access-Token': accessToken,
      }
    }

    // @ts-ignore
    const lambdaResult = await handler(event) as APIGatewayProxyResult
    expect(lambdaResult.statusCode).toEqual(testCase.status)
  }))
})

test('should get same estate ID by normalization', async () => {

  const queryPattern1 = {
    q: '岩手県盛岡市盛岡駅西通２丁目９番地１号',
    building: 'マリオス１０Ｆ',
  }
  const queryPattern2 = {
    q: '岩手県盛岡市盛岡駅西通2-９-１',
    building: 'マリオス10F',
  }

  const event1 = {
    isDemoMode: true,
    queryStringParameters: queryPattern1,
  }
  // @ts-ignore
  const lambdaResult1 = await handler(event1)
  // @ts-ignore
  const body1 = JSON.parse(lambdaResult1.body)

  const event2 = {
    isDemoMode: true,
    queryStringParameters: queryPattern2,
  }
  // @ts-ignore
  const lambdaResult2 = await handler(event2)
  // @ts-ignore
  const body2 = JSON.parse(lambdaResult2.body)

  expect(body1[0].ID).toEqual(body2[0].ID)

})
