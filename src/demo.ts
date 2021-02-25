import { handler as publicHandler } from './public'
import { decapitalize } from './lib/index'
import { errorResponse } from './lib/proxy-response'

const refererHeads = [
  'http://127.0.0.1:',
  'http://localhost:',
  'https://geolonia.github.io',
]

export const handler: EstateAPI.LambdaHandler = async (event, context, callback) => {

  const headers = decapitalize(event.headers);
  const referer = headers.referer;
  const allowed = referer && refererHeads.some(refererHead => referer.indexOf(refererHead) === 0)

  if(allowed) {
    return await publicHandler(
      event,
      context,
      (_0, arguedProxyResult) => {
        const proxyResult = {
            ...arguedProxyResult,
            headers: {
                ...arguedProxyResult?.headers,
                'Access-Control-Allow-Origin': '*'
            }
        }
        // @ts-ignore
        return callback(_0, proxyResult)
      },
      true, // demo mode
      event.queryStringParameters?.debug === 'true' // debug mode
    )
  } else {
    return callback(null, errorResponse(403, 'Access denied.'))
  }
}
