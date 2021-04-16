import { APIGatewayProxyResult } from "aws-lambda"
import { decapitalize } from "."
import { incrementServiceUsage, updateTimestamp, authenticate, checkServiceUsageQuota } from "./dynamodb"
import { errorResponse } from "./proxy-response"

export const extractApiKey = (event: PublicHandlerEvent) => {
  const apiKey = event.queryStringParameters ? event.queryStringParameters['api-key'] : undefined
  const accessToken = decapitalize(event.headers)['x-access-token']

  const resp = {
    apiKey,
    accessToken
  }

  if (typeof event.preauthenticatedUserId !== 'undefined') {
    resp.accessToken = "XXX"
  }

  return resp
}

export type AuthenticationPlanIdentifier = "paid" | "free"

export type AuthenticationResult = {
  valid: true
  plan: AuthenticationPlanIdentifier
}

export const authenticateEvent = async (event: PublicHandlerEvent, quotaType: string): Promise<APIGatewayProxyResult | AuthenticationResult> => {
  const { apiKey, accessToken } = extractApiKey(event)

  // authentication is skipped when in demo mode
  if (event.isDemoMode) {
    return { valid: true, plan: "paid" }
  }

  if (!apiKey || !accessToken) {
    return errorResponse(403, 'Incorrect querystring parameter `api-key` or `x-access-token` header value.')
  }

  // if preauthenticated is true, then skip access token check
  // preauthenticated is set to true when going through the admin console
  const authenticateResult = await authenticate(apiKey, accessToken, event.preauthenticatedUserId)
  if (authenticateResult.authenticated === false) {
    return errorResponse(403, 'Incorrect querystring parameter `api-key` or `x-access-token` header value.')
  }

  // Todo?: [Alfa feature] Authenticate even if q['api-key'] not specified

  const {
    authenticated,
    // lastRequestAt,
    customQuotas,
    plan,
  } = authenticateResult

  if (!authenticated || !customQuotas) {
    return errorResponse(403, 'Incorrect querystring parameter `api-key` or `x-access-token` header value.')
  }

  const checkServiceUsageQuotaResult = await checkServiceUsageQuota({
    apiKey,
    quotaType,
    customQuotas,
  })
  if (!checkServiceUsageQuotaResult) {
    return errorResponse(429, `Exceed requests limit.`)
  }

  // 3000ms "too frequent request" 制限は解除中
  // https://github.com/geolonia/estate-id-api/issues/93
  // if (lastRequestAt) {
  //   const diff = Date.now() - lastRequestAt
  //   if (diff < 3000) {
  //     return errorResponse(429, 'Please request after a few second.')
  //   }
  // }

  await Promise.all([
    incrementServiceUsage({ apiKey, quotaType }),
    updateTimestamp(apiKey, Date.now()),
  ])

  return { valid: true, plan }
}
