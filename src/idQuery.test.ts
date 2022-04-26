import { _handler as _publicHandler } from './public'
import { _handler as _idQueryHandler, _splitHandler as _idQuerySplitHandler } from './idQuery';
import * as dynamodb from './lib/dynamodb'
import { authenticator, logger, decorate } from './lib/decorators';

// TODO: logger、authenticator をテストから分離する
const publicHandler = decorate(_publicHandler, [logger, authenticator('id-req')]);
const idQueryHandler = decorate(_idQueryHandler, [logger, authenticator('id-req')]);
const idQuerySplitHandler = decorate(_idQuerySplitHandler, [logger, authenticator('id-req')]);

test('returns 400 when estateId is not available', async () => {
  const event = {
    isDemoMode: true,
    pathParameters: {}
  }
  // @ts-ignore
  const lambdaResult = await idQueryHandler(event) as APIGatewayProxyResult
  expect(lambdaResult.statusCode).toBe(400)
})

test('returns 404 when estateId is not found', async () => {
  const event = {
    isDemoMode: true,
    pathParameters: {
      estateId: "13-ffff-ffff-ffff-ffff"
    }
  }
  // @ts-ignore
  const lambdaResult = await idQueryHandler(event) as APIGatewayProxyResult
  expect(lambdaResult.statusCode).toBe(404)
})

test('it works', async () => {
  const event1 = {
    isDemoMode: true,
    queryStringParameters: {
      q: '東京都文京区春日1-16-21',
    },
  }
  // @ts-ignore
  const lambdaResult1 = await publicHandler(event1) as APIGatewayProxyResult
  const body1 = JSON.parse(lambdaResult1.body)

  const event2 = {
    isDemoMode: true,
    pathParameters: {
      estateId: body1[0].ID
    }
  }
  // @ts-ignore
  const lambdaResult2 = await idQueryHandler(event2) as APIGatewayProxyResult
  expect(lambdaResult2.statusCode).toBe(200)

  const body2 = JSON.parse(lambdaResult2.body)

  expect(body2[0].ID).toBe(body1[0].ID)
  expect(body2[0].normalization_level).toBe(body1[0].normalization_level)
  expect(body2[0].geocoding_level).toBe(body1[0].geocoding_level)
  expect(body2[0].address.ja.prefecture).toStrictEqual('東京都')
  expect(body2[0].address.ja.city).toStrictEqual('文京区')
  expect(body2[0].address.ja.address1).toStrictEqual('春日一丁目')
  expect(body2[0].address.ja.address2).toStrictEqual('16-21')
  expect(body2[0].address.ja.other).toStrictEqual('')
})

test('should get estate ID without details if authenticated with a free API key', async () => {
  const { apiKey, accessToken } = await dynamodb.createApiKey('should get estate ID without details if authenticated with a free API key', { plan: "free" })

  const event1 = {
    queryStringParameters: {
      q: '東京都文京区春日1-16-21',
      'api-key': apiKey,
    },
    headers: {
      'X-Access-Token': accessToken,
    }
  }
  // @ts-ignore
  const lambdaResult1 = await publicHandler(event1) as APIGatewayProxyResult
  const body1 = JSON.parse(lambdaResult1.body)

  const first1 = body1[0]
  expect(first1).toHaveProperty("ID")
  expect(first1.normalization_level).toStrictEqual('3')
  expect(first1.geocoding_level).toBeUndefined()
  expect(first1.address).toMatchObject({
    "ja": {
      "prefecture": "東京都",
      "city": "文京区",
      "address1": "春日一丁目",
      "address2": "16-21",
      "other": "",
    }
  })
  expect(first1.location).toBeUndefined()

  const event2 = {
    queryStringParameters: {
      'api-key': apiKey,
    },
    pathParameters: {
      estateId: first1.ID,
    },
    headers: {
      'X-Access-Token': accessToken,
    }
  }
  // @ts-ignore
  const lambdaResult2 = await idQueryHandler(event2) as APIGatewayProxyResult
  expect(lambdaResult2.statusCode).toBe(200)

  const body2 = JSON.parse(lambdaResult2.body)

  const first2 = body2[0]
  expect(first2.ID).toBe(first1.ID)
  expect(first2.normalization_level).toStrictEqual('3')
  expect(first2.geocoding_level).toBeUndefined()
  expect(first2.address).toBeUndefined()
  expect(first2.building).toBeUndefined()
  expect(first2.location).toBeUndefined()
})

test('should get estate ID with details if authenticated with a paid API key', async () => {
  const { apiKey, accessToken } = await dynamodb.createApiKey('should get estate ID with details if authenticated with a paid API key', { plan: "paid" })

  const event1 = {
    queryStringParameters: {
      q: '東京都文京区春日1-16-21',
      'api-key': apiKey,
    },
    headers: {
      'X-Access-Token': accessToken,
    }
  }
  // @ts-ignore
  const lambdaResult1 = await publicHandler(event1) as APIGatewayProxyResult
  const body1 = JSON.parse(lambdaResult1.body)

  const first1 = body1[0]
  expect(first1).toHaveProperty('ID')
  expect(first1).toHaveProperty('address')

  const event2 = {
    queryStringParameters: {
      'api-key': apiKey,
    },
    pathParameters: {
      estateId: first1.ID,
    },
    headers: {
      'X-Access-Token': accessToken,
    }
  }
  // @ts-ignore
  const lambdaResult2 = await idQueryHandler(event2) as APIGatewayProxyResult
  expect(lambdaResult2.statusCode).toBe(200)

  const body2 = JSON.parse(lambdaResult2.body)

  const first2 = body2[0]
  expect(first2.ID).toBe(first1.ID)
  expect(first2.normalization_level).toStrictEqual('3')
  expect(first2.geocoding_level).toStrictEqual('8')
  expect(first2.address.ja.prefecture).toStrictEqual('東京都')
  expect(first2.address.ja.city).toStrictEqual('文京区')
  expect(first2.address.ja.address1).toStrictEqual('春日一丁目')
  expect(first2.address.ja.address2).toStrictEqual('16-21')
  expect(first2.address.ja.other).toStrictEqual('')
  expect(first2.location).toHaveProperty('lat')
  expect(first2.location).toHaveProperty('lng')
})

test('should not return building name with empty building name parameter', async () => {
  const { apiKey, accessToken } = await dynamodb.createApiKey('should not return building name with empty building name parameter', { plan: "paid" })

  const event1 = {
    queryStringParameters: {
      q: '東京都文京区春日1-16-21',
      'api-key': apiKey,
    },
    headers: {
      'X-Access-Token': accessToken,
    }
  }
  // @ts-ignore
  const lambdaResult1 = await publicHandler(event1) as APIGatewayProxyResult
  const body1 = JSON.parse(lambdaResult1.body)
  const first1 = body1[0]

  const event2 = {
    queryStringParameters: {
      'api-key': apiKey,
    },
    pathParameters: {
      estateId: first1.ID,
    },
    headers: {
      'X-Access-Token': accessToken,
    }
  }
  // @ts-ignore
  const lambdaResult2 = await idQueryHandler(event2) as APIGatewayProxyResult
  expect(lambdaResult2.statusCode).toBe(200)
  const body2 = JSON.parse(lambdaResult2.body)

  const first2 = body2[0]
  expect(first2.building).toStrictEqual(undefined)
})

test('should not include building name in address2', async () => {
  const { apiKey, accessToken } = await dynamodb.createApiKey('should not include building name in address2', { plan: "paid" })

  const event1 = {
    queryStringParameters: {
      q: '滋賀県大津市御陵町3-1おはようビル123F',
      'api-key': apiKey,
    },
    headers: {
      'X-Access-Token': accessToken,
    }
  }
  // @ts-ignore
  const lambdaResult1 = await publicHandler(event1) as APIGatewayProxyResult
  const body1 = JSON.parse(lambdaResult1.body)

  const event2 = {
    queryStringParameters: {
      'api-key': apiKey,
    },
    pathParameters: {
      estateId: body1[0].ID,
    },
    headers: {
      'X-Access-Token': accessToken,
    }
  }
  // @ts-ignore
  const lambdaResult2 = await idQueryHandler(event2) as APIGatewayProxyResult
  expect(lambdaResult2.statusCode).toBe(200)
  const body2 = JSON.parse(lambdaResult2.body)

  expect(body2[0].address.ja.address2).toEqual('3-1')
  expect(body2[0].address.ja.other).toEqual('おはようビル123F')
})

test('should return status parameters', async () => {
  const { apiKey, accessToken } = await dynamodb.createApiKey('should return status parameters', { plan: "paid" })

  const event1 = {
    queryStringParameters: {
      q: '京都府京都市右京区西院西貝川町100マンションGLV3NLV3',
      'api-key': apiKey,
    },
    headers: {
      'X-Access-Token': accessToken,
    }
  }
  // @ts-ignore
  const lambdaResult1 = await publicHandler(event1) as APIGatewayProxyResult
  const body1 = JSON.parse(lambdaResult1.body)
  expect(body1[0].status).toBe('addressPending')

  const event2 = {
    queryStringParameters: {
      'api-key': apiKey,
    },
    pathParameters: {
      estateId: body1[0].ID,
    },
    headers: {
      'X-Access-Token': accessToken,
    }
  }
  // @ts-ignore
  const lambdaResult2 = await idQueryHandler(event2) as APIGatewayProxyResult
  expect(lambdaResult2.statusCode).toBe(200)
  const body2 = JSON.parse(lambdaResult2.body)

  expect(body2[0].status).toEqual('addressPending')
})

test('should generate new ID from that of existing.', async () => {
  // id issue with public handler
  const event1 = {
    isDemoMode: true,
    queryStringParameters: {
      q: '滋賀県大津市京町４丁目１−１こんにちはビルA棟',
    },
  }
  // @ts-ignore
  const lambdaResult1 = await publicHandler(event1) as APIGatewayProxyResult
  expect(lambdaResult1.statusCode).toBe(200)
  const [idObj1] = JSON.parse(lambdaResult1.body)

  // id split
  const event2 = {
    isDemoMode: true,
    pathParameters: {
      estateId: idObj1.ID,
    },
    queryStringParameters: {
      lat: '35.1234',
      lng: '135.1234',
      building: 'こんにちはビルB棟',
    }
  }
  // @ts-ignore
  const lambdaResult2 = await idQuerySplitHandler(event2) as APIGatewayProxyResult
  expect(lambdaResult2.statusCode).toBe(200)
  const [idObj2] = JSON.parse(lambdaResult2.body)
  expect(typeof idObj2.ID === 'string').toBeTruthy()
  expect(idObj2.ID).not.toBe(idObj1.ID)

  // id query with public handler
  const event3 = {
    isDemoMode: true,
    queryStringParameters: {
      q: '滋賀県大津市京町４丁目１−１',
    },
  }
  // @ts-ignore
  const lambdaResult3 = await publicHandler(event3) as APIGatewayProxyResult
  expect(lambdaResult3.statusCode).toBe(200)
  const idObjects3 = JSON.parse(lambdaResult3.body)
  expect(idObjects3).toHaveLength(2)
  expect(idObjects3.find(idObj => idObj.ID === idObj1.ID)).toMatchObject(idObj1)
  expect(idObjects3.find(idObj => idObj.ID === idObj2.ID)).toMatchObject(idObj2)

  // id query with query handler
  const [event4, event5] = idObjects3.map((idObj: any) => ({
    isDemoMode: true,
    pathParameters: {
      estateId: idObj.ID,
    },
  }))

  // @ts-ignore
  const [lambdaResult4, lambdaResult5] = await Promise.all([
    // @ts-ignore
    idQueryHandler(event4),
    // @ts-ignore
    idQueryHandler(event5),
  ])
  // @ts-ignore
  expect(lambdaResult4.statusCode).toBe(200)
  // @ts-ignore
  expect(lambdaResult5.statusCode).toBe(200)
  // @ts-ignore
  const idObj4 = JSON.parse(lambdaResult4.body)
  // @ts-ignore
  const idObj5 = JSON.parse(lambdaResult5.body)

  expect(idObj4).toMatchObject(idObj1)
  expect(idObj5).toMatchObject(idObjects3[0])
  expect(idObj5).toMatchObject(idObjects3[1])
})
