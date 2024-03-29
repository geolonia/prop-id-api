import { _handler as publicHandler } from '../public'
import { _queryHandler as idQueryHandler } from './queryHandler';
import * as dynamodb from '../lib/dynamodb'

jest.setTimeout(15 * 1000)

const context = {
  propIdAuthenticator: { authentication: { plan: 'paid' } },
  propIdLogger: { background: [] },
}
const freeContext = {
  propIdAuthenticator: { authentication: { plan: 'free' } },
  propIdLogger: { background: [] },
}

test('returns 400 when estateId is not available', async () => {
  const event = {
    isDemoMode: true,
    pathParameters: {}
  }
  // @ts-ignore
  const lambdaResult = await idQueryHandler(event, context) as APIGatewayProxyResult
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
  const lambdaResult = await idQueryHandler(event, context) as APIGatewayProxyResult
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
  const lambdaResult1 = await publicHandler(event1, context) as APIGatewayProxyResult
  const body1 = JSON.parse(lambdaResult1.body)

  const event2 = {
    isDemoMode: true,
    pathParameters: {
      estateId: body1[0].ID
    }
  }
  // @ts-ignore
  const lambdaResult2 = await idQueryHandler(event2, context) as APIGatewayProxyResult
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
  const lambdaResult1 = await publicHandler(event1, freeContext) as APIGatewayProxyResult
  const body1 = JSON.parse(lambdaResult1.body)

  const first1 = body1[0]
  expect(first1).toHaveProperty("ID")
  expect(first1.normalization_level).toStrictEqual('8')
  expect(first1.geocoding_level).toBeUndefined()
  expect(first1.address).toBeUndefined()
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
  const lambdaResult2 = await idQueryHandler(event2, freeContext) as APIGatewayProxyResult
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
  const lambdaResult1 = await publicHandler(event1, context) as APIGatewayProxyResult
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
  const lambdaResult2 = await idQueryHandler(event2, context) as APIGatewayProxyResult
  expect(lambdaResult2.statusCode).toBe(200)

  const body2 = JSON.parse(lambdaResult2.body)

  const first2 = body2[0]
  expect(first2.ID).toBe(first1.ID)
  expect(first2.normalization_level).toStrictEqual('8')
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
  const lambdaResult1 = await publicHandler(event1, context) as APIGatewayProxyResult
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
  const lambdaResult2 = await idQueryHandler(event2, context) as APIGatewayProxyResult
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
  const lambdaResult1 = await publicHandler(event1, context) as APIGatewayProxyResult
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
  const lambdaResult2 = await idQueryHandler(event2, context) as APIGatewayProxyResult
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
  const lambdaResult1 = await publicHandler(event1, context) as APIGatewayProxyResult
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
  const lambdaResult2 = await idQueryHandler(event2, context) as APIGatewayProxyResult
  expect(lambdaResult2.statusCode).toBe(200)
  const body2 = JSON.parse(lambdaResult2.body)

  expect(body2[0].status).toEqual('addressPending')
})


