import { handler as publicHandler } from './public'

export const handler: EstateAPI.LambdaHandler = async (event, context, callback) => {
    return await publicHandler(
      event,
      context,
      (_0, arguedProxyResult) => {
        const proxyResult = {
            ...arguedProxyResult,
            headers: {
                ...arguedProxyResult?.headers,
                'Access-Control-Allow-Origin': 'https://geolonia.github.io'
            }
        }
        // @ts-ignore
        return callback(_0, proxyResult)
      },
      true, // demo mode
      event.queryStringParameters?.debug === 'true'
    )
}
