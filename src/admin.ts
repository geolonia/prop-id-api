import '.'
import Sentry from './lib/sentry'
import { APIGatewayProxyHandler } from 'aws-lambda'
import { errorResponse } from './lib/proxy-response'
import jwt from "jsonwebtoken"
import jwks from "jwks-rsa"

import * as keys from "./admin/keys"
import { decapitalize } from './lib'

const jwksClient = jwks({
  cache: true,
  cacheMaxAge: 600000,
  rateLimit: true,
  jwksRequestsPerMinute: 5,
  jwksUri: "https://prop-id.jp.auth0.com/.well-known/jwks.json"
})

const _handler: APIGatewayProxyHandler = async (event) => {
  const headers = decapitalize(event.headers)
  const tokenHeader = headers['authorization']
  if (!tokenHeader || !tokenHeader.match(/^bearer /i)) {
    return errorResponse(401, 'Not authenticated')
  }
  const token = tokenHeader.substr(7)
  const decodedToken = jwt.decode(token, { complete: true })
  const kid = decodedToken?.header.kid
  if (!kid) {
    return errorResponse(401, 'Not authenticated')
  }
  let userId: string | undefined = undefined
  try {
    const signingKey = await jwksClient.getSigningKey(kid)
    const verifiedToken = jwt.verify(token, signingKey.getPublicKey(), {
      audience: 'https://api.propid.jp',
      algorithms: ['RS256'],
      issuer: 'https://prop-id.jp.auth0.com/'
    }) as { [key: string]: any }
    userId = verifiedToken.sub
  } catch (e) {
    if (
      e.name !== "JsonWebTokenError" &&
      e.name !== "NotBeforeError" &&
      e.name !== "TokenExpiredError"
    ) {
      throw e
    }
  }
  if (!userId) {
    return errorResponse(401, 'Not authenticated')
  }

  const adminEvent: AdminHandlerEvent = {
    ...event,
    userId
  }

  if (event.resource === "/admin/keys" && event.httpMethod === "GET") {
    return keys.list(adminEvent)
  } else if (event.resource === "/admin/keys" && event.httpMethod === "POST") {
    return keys.create(adminEvent)
  } else if (event.resource === "/admin/keys/{keyId}/reissue" && event.httpMethod === "PATCH") {
    return keys.reissue(adminEvent)
  }
  return errorResponse(404, 'Not found')
}

export const handler = Sentry.AWSLambda.wrapHandler(_handler)
