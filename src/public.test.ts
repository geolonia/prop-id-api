import { APIGatewayProxyResult } from 'aws-lambda'
import { authenticator, log } from './lib/decorators'
import * as dynamodb from './lib/dynamodb'
import { _getServiceUsageQuotaItem, _updateServiceUsageQuota } from './lib/dynamodb_test_helpers.test'
import { _handler } from './public'
const handler = authenticator('id-req')(log(_handler));

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

  const addresses = [
    ['和歌山県東牟婁郡', 'city_not_recognized'],
    ['和歌山県aoeu', 'city_not_recognized'],
    ['和歌県', 'prefecture_not_recognized'],
    ['おはよう', 'prefecture_not_recognized'],
    ['東京都千代田区飯田橋１丁目', 'geo_koaza'],
  ]

  for (const addressData of addresses) {
    test(`should return 400 with insufficient address for ${addressData[0]}.`, async () => {
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
    })
  }

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

describe('banchi-go database', () => {
  beforeAll(async () => {
    const testData = [
      { addr: '東京都文京区水道二丁目', bg: '80-6' },
      { addr: '東京都文京区水道二丁目', bg: '81' },
      { addr: '東京都町田市木曽東四丁目', bg: '81-イ22' },
      { addr: '大阪府大阪市中央区久太郎町三丁目', bg: '渡辺3'},

      // Corresponds to the 5th test case below.
      // We should not register this address in the database prior to testing.
      // It's not normalized by IPC, nor internally.
      // { addr: '東京都文京区水道二丁目', bg: '1-9999' },

      // Corresponds to the 6th test case below.
      // It's normalized internally but not by IPC.
      { addr: '東京都文京区水道二丁目', bg: '1-9998' },
    ];

    await Promise.all(
      testData.map(({addr, bg}) => dynamodb.DB.put({
        TableName: process.env.AWS_DYNAMODB_LOG_TABLE_NAME,
        Item: {
          PK: `AddrDB#${addr}`,
          SK: bg,
        },
      }).promise())
    );
  });

  const cases: [address: string, building: string, expectedNormResult?: any, expectedIdObject?: any][] = [
    ['東京都文京区水道2丁目80-6 おはようビル', 'おはようビル',, { status: undefined }],
    ['東京都文京区水道2丁目81 おはようビル', 'おはようビル',, { status: undefined }],
    ['東京都町田市木曽東四丁目81-イ22', '',, { status: undefined }],
    ['大阪府大阪市中央区久太郎町三丁目渡辺3小原流ホール', '小原流ホール',, { status: undefined }],
    ['東京都文京区水道2丁目1-9999マンションGLV5NLV3', '', { geocoding_level: '5', normalization_level: '3' }, { status: 'addressPending' }],
    ['東京都文京区水道2丁目1-9998マンションGLV5NLV8', 'マンションGLV5NLV8', { geocoding_level: '5', normalization_level: '8' }, { status: undefined }],
    ['大阪府高槻市富田町1-999-888マンションGLV4NLV3', '', { geocoding_level: '4', normalization_level: '3' }, { status: 'addressPending' }],
    ['京都府京都市右京区西院西貝川町100マンションGLV3NLV3', '', { geocoding_level: '3', normalization_level: '3' }, { status: 'addressPending' }],
  ];

  for (const [inputAddr, building, expectedNormResult, expectedIdObject] of cases) {
    test(`creates estate ID for ${inputAddr}`, async () => {
      const { apiKey, accessToken } = await dynamodb.createApiKey(`creates estate ID for ${inputAddr}`);
      const event = {
        queryStringParameters: {
          q: inputAddr,
          'api-key': apiKey,
        },
        headers: {
          'X-Access-Token': accessToken,
        },
      };
      // @ts-ignore
      const lambdaResult = await handler(event);
      // @ts-ignore
      const body = JSON.parse(lambdaResult.body);

      expect(body[0].ID).toBeDefined();
      expect(body[0]).toEqual(
        expect.objectContaining({
          "address": expect.objectContaining({
            "ja": expect.objectContaining({
              "other": building,
            }),
          }),
        })
      );

      if (expectedNormResult) {
        for (const key in expectedNormResult) {
          expect(`${key}=${body[0][key]}`).toEqual(`${key}=${expectedNormResult[key]}`)
        }
      }

      if (expectedIdObject) {
        const ddbGetResp = await dynamodb.DB.get({
          TableName: process.env.AWS_DYNAMODB_ESTATE_ID_TABLE_NAME,
          Key: { estateId: body[0].ID }
        }).promise()
        const item = ddbGetResp.Item as any
        for (const key in expectedIdObject) {
          expect(`${key}=${item[key]}`).toEqual(`${key}=${expectedIdObject[key]}`)
        }
      }
    });
  }
});

describe('Logging', () => {
    test('normLogsNJA should include version info', async () => {
      const inputAddr = '滋賀県大津市御陵町100−200'
      const { apiKey, accessToken } = await dynamodb.createApiKey(`tries to create estate ID for ${inputAddr}`);
      const event = {
        queryStringParameters: {
          q: inputAddr,
          'api-key': apiKey,
        },
        headers: {
          'X-Access-Token': accessToken,
        },
      };
      const now = new Date()

      // @ts-ignore
      const lambdaResult = await handler(event);
      // @ts-ignore
      const body = JSON.parse(lambdaResult.body);

      const TableName = process.env.AWS_DYNAMODB_LOG_TABLE_NAME;
      const PK = `LOG#normLogsNJA#${now.toISOString().slice(0, 10)}`
      const resp = await dynamodb.DB.query({
        TableName,
        KeyConditionExpression: "#k = :k",
        ExpressionAttributeNames: {
          "#k": "PK"
        },
        ExpressionAttributeValues: {
          ":k": PK
        },
      }).promise()

      const logItem = (resp.Items || []).find(item => item.input === inputAddr) as any
      expect(logItem.deps.nja).toMatch(/([0-9]+)\.([0-9]+)\.([0-9]+)$/)
      expect(logItem.deps.ja).toMatch(/([0-9]+)\.([0-9]+)\.([0-9]+)$/)
    })

    test('NJA.level <= 2 should create a LOG#normFailNoTown', async () => {
      const inputAddr = '滋賀県大津市あああああああ町'
      const { apiKey, accessToken } = await dynamodb.createApiKey(`tries to create estate ID for ${inputAddr}`);

      const event = {
        queryStringParameters: {
          q: inputAddr,
          'api-key': apiKey,
        },
        headers: {
          'X-Access-Token': accessToken,
        },
      };
      const now = new Date()

      // @ts-ignore
      const lambdaResult = await handler(event);
      // @ts-ignore
      const body = JSON.parse(lambdaResult.body);

      expect(body.error_code_detail).toEqual('neighborhood_not_recognized')

      const TableName = process.env.AWS_DYNAMODB_LOG_TABLE_NAME;
      const PK = `LOG#normFailNoTown#${now.toISOString().slice(0, 10)}`
      const resp = await dynamodb.DB.query({
        TableName,
        KeyConditionExpression: "#k = :k",
        ExpressionAttributeNames: {
          "#k": "PK"
        },
        ExpressionAttributeValues: {
          ":k": PK
        },
      }).promise()

      const logItem = (resp.Items || []).find(item => item.input === inputAddr) as any
      expect(logItem.output.pref).toEqual('滋賀県')
      expect(logItem.output.city).toEqual('大津市')
      expect(logItem.output.town).toEqual('')
      expect(logItem.output.level).toEqual(2)
    })
})
