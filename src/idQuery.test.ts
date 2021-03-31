import { _handler as publicHandler } from './public'
import { _handler as handler } from './idQuery'

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
})
