import { _handler as publicHandler } from './public'
import { _handler as handler } from './idQuery'
import * as dynamodb from './lib/dynamodb'

test('returns 400 when estateId is not available', async () => {
  const event = {
    isDemoMode: true,
    pathParameters: {}
  }
  // @ts-ignore
  const lambdaResult = await handler(event) as APIGatewayProxyResult
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
  const lambdaResult = await handler(event) as APIGatewayProxyResult
  expect(lambdaResult.statusCode).toBe(404)
})

test('it works', async () => {
  const event1 = {
    isDemoMode: true,
    queryStringParameters: {
      q: '東京都文京区小石川1-2-1',
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
  const lambdaResult2 = await handler(event2) as APIGatewayProxyResult
  expect(lambdaResult2.statusCode).toBe(200)

  const body2 = JSON.parse(lambdaResult2.body)

  expect(body2[0].ID).toBe(body1[0].ID)
  expect(body2[0].location.geocoding_level).toBe(body1[0].location.geocoding_level)
})

test('should get estate ID without details if authenticated with a free API key', async () => {
  const { apiKey, accessToken } = await dynamodb.createApiKey('should get estate ID without details if authenticated with a free API key', { plan: "free" })

  const event1 = {
    queryStringParameters: {
      q: '東京都文京区小石川1-2-2',
      building: 'おはようビル',
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
  const lambdaResult2 = await handler(event2) as APIGatewayProxyResult
  expect(lambdaResult2.statusCode).toBe(200)

  const body2 = JSON.parse(lambdaResult2.body)

  const first2 = body2[0]
  expect(first2.ID).toBe(first1.ID)
  expect(first2.address).toBeUndefined()
  expect(first2.location).toBeUndefined()
})
