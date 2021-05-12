import * as proxyResponse from './proxy-response'
import * as dynamodb from './dynamodb'
import { DateTime } from "luxon";

describe('createHeaders', () => {

  test('it works', async () => {

    const { apiKey } = await dynamodb.createApiKey('should get estate ID with details if authenticated')
    const quotaType = "id-req";
    const customQuotas = {}

    const resetDate = DateTime.now().setZone('Asia/Tokyo').startOf('month').plus({months: 1}).toISO()
    await dynamodb.incrementServiceUsage({ apiKey, quotaType })

    const { quotaLimit, quotaRemaining, quotaResetDate} = await dynamodb.checkServiceUsageQuota({ apiKey, quotaType, customQuotas })
    const headers = proxyResponse.createHeaders( { quotaLimit, quotaRemaining, quotaResetDate })

    const expected = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Headers': 'x-access-token, authorization',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store, max-age=0',
      'X-RateLimit-Limit': '10000',
      'X-RateLimit-Remaining': '9999',
      'X-RateLimit-Reset': `${resetDate}`
    }

    // @ts-ignore
    expect(headers).toStrictEqual(expected)
  })

  test('it works customQuotas', async () => {

    const { apiKey } = await dynamodb.createApiKey('should get estate ID with details if authenticated')
    const quotaType = "id-req";
    const customQuotas = {
      'id-req' : 500_000
    }

    await dynamodb.incrementServiceUsage({ apiKey, quotaType })

    const { quotaLimit, quotaRemaining, quotaResetDate} = await dynamodb.checkServiceUsageQuota({ apiKey, quotaType, customQuotas })
    const headers = proxyResponse.createHeaders( { quotaLimit, quotaRemaining, quotaResetDate })

    // @ts-ignore
    expect(headers['X-RateLimit-Limit']).toStrictEqual('500000')
    expect(headers['X-RateLimit-Remaining']).toStrictEqual('499999')
  })
})
