import { authenticate, restore } from './lib/dynamodb'
import { decapitalize } from './lib/index'
import { error, json } from './lib/proxy-response'

export const handler: EstateAPI.LambdaHandler = async (event, context, callback) => {

    const apiKey = event.queryStringParameters ? event.queryStringParameters['api-key'] : void 0
    const accessToken = decapitalize(event.headers)['x-access-token']
    const estateId = (event.pathParameters || {}).estateId

    if(!estateId) {
        return callback(null, error(400, 'Incorect path parameter `estateId`.'))
    }

    if(!apiKey || !accessToken || !await authenticate(apiKey, accessToken)) {
        return callback(null, error(403, 'Incorrect querystring parameter `api-key` or `x-access-token` header value.'))
    }
    
    let addressObject
    try {
        addressObject = await restore(estateId)
    } catch (error) {
        // estateId should be found.
        return callback(null, error(404, 'Estate ID %s is not found.', estateId))
    }

    // apiKey has been authenticated and return rich results
    const body = { ID: estateId, address: addressObject }

    return callback(null, json(body));
}
