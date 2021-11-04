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
      q: '岩手県盛岡市盛岡駅西通２丁目９番地１号 マリオス',
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

test('should get the same ID for multiple queries to same address with different buildings', async () => {
  const buildings = [
    '',
    ' 文京区役所',
    ' 10F',
    ' 10階',
    ' 文京区役所10F',
    ' 文京区役所10階',
    ' 文京区役所12階',
    ' 文京区役所12階 区民課',
    '文京区役所',
    '-10F',
    '-10階',
    '文京区役所10F',
    '文京区役所10階',
    '文京区役所12階',
    '文京区役所12階 区民課',
  ];
  const event = {
    isDemoMode: true,
    queryStringParameters: {
      q: '東京都文京区春日1-16-21',
    },
  };

  // @ts-ignore
  const lambdaResult1 = await handler(event) as APIGatewayProxyResult
  const body1 = JSON.parse(lambdaResult1.body)

  for (const building of buildings) {
    const event2 = {
      ...event,
      queryStringParameters: {
        ...event.queryStringParameters,
      },
    };
    event2.queryStringParameters.q = event2.queryStringParameters.q + building;
    // @ts-ignore
    const lambdaResult2 = await handler(event2) as APIGatewayProxyResult;
    const body2 = JSON.parse(lambdaResult2.body);

    expect(body1[0].ID).toEqual(body2[0].ID);
  }
}, 30_000); // 30s timeout; there are a lot of queries to process here

test('should get estate ID with details if authenticated', async () => {
  const { apiKey, accessToken } = await dynamodb.createApiKey('should get estate ID with details if authenticated')
  const event = {
    queryStringParameters: {
      q: '岩手県盛岡市盛岡駅西通２丁目９番地１号マリオス',
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
      "normalization_level": "3",
      "geocoding_level": "8",
      "address": {
        "ja": {
            "address1": "盛岡駅西通二丁目",
            "address2": "9-1",
            "city": "盛岡市",
            "other": "マリオス",
            "prefecture": "岩手県",
        },
      },
      "location": {
        "lat": "39.701281",
        "lng": "141.13366",
      },
    })
  ])
});

test('should return the same ID for queries with a different building name', async () => {
  const event1 = {
    isDemoMode: true,
    queryStringParameters: {
      q: '鹿児島県熊毛郡屋久島町安房187番地1',
    },
  }
  const event2 = {
    isDemoMode: true,
    queryStringParameters: {
      q: '鹿児島県熊毛郡屋久島町安房187番地1 おはようビル2.9.10棟',
    },
  }
  // @ts-ignore
  const lambdaResult1 = await handler(event1) as APIGatewayProxyResult;
  const body1 = JSON.parse(lambdaResult1.body);
  expect(body1.error).not.toStrictEqual(true);
  expect(body1.length).toStrictEqual(1);

  // @ts-ignore
  const lambdaResult2 = await handler(event2) as APIGatewayProxyResult;
  const body2 = JSON.parse(lambdaResult2.body);
  expect(body2.error).not.toStrictEqual(true);
  expect(body2.length).toStrictEqual(1);

  expect(body1[0].ID).toEqual(body2[0].ID);
});

describe("preauthenticatedUserId", () => {
  test('should get estate ID if preauthenticated', async () => {
    const userId = 'keymock|should get estate ID if preauthenticated'
    const { apiKey } = await dynamodb.createApiKey('should get estate ID if preauthenticated', {
      GSI1PK: userId,
      plan: "free",
    })
    const event = {
      queryStringParameters: {
        q: '岩手県盛岡市盛岡駅西通２丁目９番地１号 マリオス',
        'api-key': apiKey,
      },
      preauthenticatedUserId: userId,
    }
    // @ts-ignore
    const lambdaResult = await handler(event) as APIGatewayProxyResult
    const body = JSON.parse(lambdaResult.body)

    expect(lambdaResult.statusCode).toBe(200)
    expect(body[0].ID).toBeDefined()
    expect(body[0].normalization_level).toStrictEqual('3')
    expect(body[0].geocoding_level).toBeUndefined()
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
        q: '岩手県盛岡市盛岡駅西通２丁目９番地１号 マリオス',
        'api-key': apiKey,
      },
      preauthenticatedUserId: userId,
    }
    // @ts-ignore
    const lambdaResult = await handler(event) as APIGatewayProxyResult
    const body = JSON.parse(lambdaResult.body)

    expect(lambdaResult.statusCode).toBe(200)
    expect(body[0].ID).toBeDefined()
    expect(body[0].normalization_level).toStrictEqual("3")
    expect(body[0].geocoding_level).toStrictEqual("8")
    expect(body[0].location).toMatchObject({
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
        q: '岩手県盛岡市盛岡駅西通２丁目９番地１号 マリオス',
        'api-key': apiKey,
      },
      preauthenticatedUserId: userId2,
    }
    // @ts-ignore
    const lambdaResult = await handler(event) as APIGatewayProxyResult
    const body = JSON.parse(lambdaResult.body)

    expect(lambdaResult.statusCode).toBe(403)
    expect(body[0]?.ID).toBeUndefined()
    expect(body[0]?.geocoding_level).toBeUndefined()
  })
})

test('should get estate ID with details if authenticated and Building name', async () => {
  const { apiKey, accessToken } = await dynamodb.createApiKey('should get estate ID with details if authenticated')
  const event = {
    queryStringParameters: {
      q: '岩手県盛岡市盛岡駅西通２丁目９番地１号 マリオス',
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
      "normalization_level": "3",
      "geocoding_level": "8",
      "address": {
        "ja": {
            "address1": "盛岡駅西通二丁目",
            "address2": "9-1",
            "city": "盛岡市",
            "other": "マリオス",
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


test('should get estate ID without details if authenticated with a free API key', async () => {
  const { apiKey, accessToken } = await dynamodb.createApiKey('should get estate ID without details if authenticated with a free API key', { plan: "free" })

  const queryStringParameters = {
    q: '岩手県盛岡市盛岡駅西通２丁目９番地１号 マリオス',
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
  expect(first.normalization_level).toStrictEqual("3")
  expect(first.geocoding_level).toBeUndefined()
  expect(first.address).toMatchObject({
    "ja": {
      "prefecture": "岩手県",
      "city": "盛岡市",
      "address1": "盛岡駅西通二丁目",
      "address2": "9-1",
      "other": "マリオス",
    }
  })
  expect(first.location).toBeUndefined()
})

test('should get estate ID with details if authenticated with 和歌山県東牟婁郡串本町田並1300', async () => {
  const { apiKey, accessToken } = await dynamodb.createApiKey('should get estate ID with details if authenticated')

  const event = {
    isDemoMode: true,
    queryStringParameters: {
      q: '和歌山県東牟婁郡串本町田並1300',
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
      "normalization_level": "3",
      "geocoding_level": "7",
      "address": {
        "ja": {
          "address1": "田並",
          "address2": "1300",
          "city": "東牟婁郡串本町",
          "other": "",
          "prefecture": "和歌山県",
        },
      },
      "location": {
        "lat": "33.49016",
        "lng": "135.716715",
      },
    })
  ])
})

test('should return identical estate ID if two addresses were requested in parallel', async () => {
  const { apiKey, accessToken } = await dynamodb.createApiKey('should get estate ID with details if authenticated')

  const event = {
    isDemoMode: true,
    queryStringParameters: {
      q: '東京都文京区春日１丁目１６ー２１',
      'api-key': apiKey
    },
    headers: {
      'X-Access-Token': accessToken,
    }
  };

  const responses = await Promise.all([...Array(4).keys()].map(async () => {
    // @ts-ignore
    return await handler(event) as APIGatewayProxyResult;
  }));

  const respSummaries = responses.map(lambdaResult => {
    const body = JSON.parse(lambdaResult.body);
    return {
      id: body[0].ID,
      length: body.length,
    };
  });

  const ids = new Set(respSummaries.map(({id}) => id));
  expect(ids.size).toStrictEqual(1);
  for (const {length} of respSummaries) {
    expect(length).toStrictEqual(1);
  }
});

describe("normalization error cases",  () => {
  test('should return 400 with insufficient address.', async () => {
    const addresses = [
      ['和歌山県東牟婁郡', 'city_not_recognized'],
      ['和歌山県aoeu', 'city_not_recognized'],
      ['和歌県', 'prefecture_not_recognized'],
      ['おはよう', 'prefecture_not_recognized'],
      ['東京都千代田区飯田橋１丁目', 'geo_koaza'],
      ['東京都千代田区飯田橋１丁目３', 'geo_banchi'],
    ]

    for (const addressData of addresses) {
      const [ address, expectedErrorCodeDetail ] = addressData
      const event = {
        isDemoMode: true,
        queryStringParameters: {
          q: address
        }
      }

      // @ts-ignore
      const resp = await handler(event) as APIGatewayProxyResult
      const body = JSON.parse(resp.body)
      expect(resp.statusCode).toEqual(400)
      expect(body.error_code).toBe("normalization_failed")
      expect(body.error_code_detail).toBe(expectedErrorCodeDetail)
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
})

test('should return 403 if not authenticated.', async () => {
  const event = {
    queryStringParameters: {
      q: '岩手県盛岡市盛岡駅西通２丁目９番地１号 マリオス',
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
        q: '岩手県盛岡市盛岡駅西通２丁目９番地１号 マリオス',
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
    q: '岩手県盛岡市盛岡駅西通２丁目９番地１号 マリオス',
  }
  const queryPattern2 = {
    q: '岩手県盛岡市盛岡駅西通2-９-１マリオス',
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
