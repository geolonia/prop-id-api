import { APIGatewayProxyResult } from "aws-lambda"
import { decapitalize } from "."
import { incrementServiceUsage, updateTimestamp, authenticate, checkServiceUsageQuota } from "./dynamodb"
import { errorResponse } from "./proxy-response"

export const extractApiKey = (event: PublicHandlerEvent) => {
  const apiKey = event.queryStringParameters ? event.queryStringParameters['api-key'] : undefined
  const accessToken = decapitalize(event.headers)['x-access-token']

  return {
    apiKey,
    accessToken
  }
}

export const authenticateEvent = async (event: PublicHandlerEvent, quotaType: string): Promise<APIGatewayProxyResult | true> => {
  const { apiKey, accessToken } = extractApiKey(event)

  if (event.isDemoMode) {
    return true
  }

  // authentication is skipped when in demo mode
  if (!apiKey || !accessToken) {
    return errorResponse(403, 'Incorrect querystring parameter `api-key` or `x-access-token` header value.')
  }
  const authenticateResult = await authenticate(apiKey, accessToken)
  if (!authenticateResult) {
    return errorResponse(403, 'Incorrect querystring parameter `api-key` or `x-access-token` header value.')
  }

  // Todo?: [Alfa feature] Authenticate even if q['api-key'] not specified

  const { authenticated, lastRequestAt } = authenticateResult

  if (!authenticated) {
    return errorResponse(403, 'Incorrect querystring parameter `api-key` or `x-access-token` header value.')
  }

  const checkServiceUsageQuotaResult = await checkServiceUsageQuota({ apiKey, quotaType })
  if (!checkServiceUsageQuotaResult) {
    return errorResponse(403, `Exceed requests limit.`)
  }

  if (lastRequestAt) {
    const diff = Date.now() - lastRequestAt
    if (diff < 3000) {
      return errorResponse(429, 'Please request after a few second.')
    }
  }

  await Promise.all([
    incrementServiceUsage({ apiKey, quotaType }),
    updateTimestamp(apiKey, Date.now()),
  ])

  return true
}
