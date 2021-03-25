import { rawHandler as publicHandler, PublicHandlerEvent } from './public'
import { decapitalize } from './lib/index'
import { errorResponse } from './lib/proxy-response'
import Sentry from './lib/sentry'
import { APIGatewayProxyResult, Handler } from 'aws-lambda'

const refererHeads = [
  'http://127.0.0.1:',
  'http://localhost:',
  'https://geolonia.github.io',
]

const rawHandler: Handler<PublicHandlerEvent, APIGatewayProxyResult> = async (event, context, callback) => {
  const headers = decapitalize(event.headers);
  const { referer, origin } = headers;
  const allowedReferer = referer && refererHeads.some(refererHead => referer.indexOf(refererHead) === 0)
  const allowedOrigin = origin && refererHeads.some(refererHead => origin.indexOf(refererHead) === 0)

  if (!(allowedReferer || allowedOrigin)) {
    return errorResponse(403, 'Access denied.')
  }

  event.isDebugMode = event.queryStringParameters?.debug === 'true'
  event.isDemoMode = true
  const arguedProxyResult = await publicHandler(
    event,
    context,
    callback,
    // true, // demo mode
    // event.queryStringParameters?.debug === 'true' // debug mode
  ) as APIGatewayProxyResult

  const proxyResult = {
    ...arguedProxyResult,
    headers: {
      ...arguedProxyResult.headers,
      'Access-Control-Allow-Origin': '*'
    }
  }
  return proxyResult
}

export const handler = Sentry.AWSLambda.wrapHandler(rawHandler)
