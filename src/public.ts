import { authenticate, store, updateTimestamp, removeTimestamp } from './lib/dynamodb'
import { decapitalize, verifyAddress, coord2XY, hashXY, getPrefCode, sleep } from './lib/index'
import { error, json } from './lib/proxy-response'

export const handler: EstateAPI.LambdaHandler = async (event, context, callback) => {

    const address = event.queryStringParameters?.q
    const apiKey = event.queryStringParameters ? event.queryStringParameters['api-key'] : void 0
    const accessToken = decapitalize(event.headers)['x-access-token']
    const ZOOM = parseInt(process.env.ZOOM, 10)

    if(!address) {
        return callback(null, error(400, 'Missing querystring parameter `q`.'))
    }

    const now = Date.now()

    // [Alfa feature] Authenticate even if q['api-key'] not specified
    if(!apiKey || !accessToken) {
        return callback(null, error(403, 'Incorrect querystring parameter `api-key` or `x-access-token` header value.'))
    } else {
        const { authenticated, lastRequestAt } = await authenticate(apiKey, accessToken);
        if(!authenticated) {
            return callback(null, error(403, 'Incorrect querystring parameter `api-key` or `x-access-token` header value.'))
        }
        if(lastRequestAt) {
            const diff = now - lastRequestAt
            if(diff < 1000) {
                // Delay and limit access.
                await sleep(1000)
            } else if(diff > 2000) {
                // Uncontroled timestamp. An error may have occurred.
                await updateTimestamp(apiKey, now)
            }
        } else {
            await updateTimestamp(apiKey, now)
        }
    }
    
    // Request Increment P Address Verification API
    let result
    try {
        result = await verifyAddress(address)
    } catch (error) {
        process.stderr.write("API or Netowork Down Detected.\n")
        process.stderr.write(JSON.stringify(error))
        return callback(null, error(500, 'Internal Server Error.'))
    }

    // API key for Increment P should valid.
    if(!result.ok) {
        if(result.status === 403) {
            process.stderr.write("API Authentication failed.\n")
        } else {
            process.stderr.write("not documented status code detected.\n")
        }
        process.stderr.write(JSON.stringify({ result }))
        return callback(null, error(500, 'Internal Server Error.'))
    }

    const feature = result.body.features[0]

    // Features not found
    if(feature.geometry === null) {
        await removeTimestamp(apiKey)
        return callback(null, error(404, "The address '%s' is not verified.", address))
    }

    const [lng, lat] = feature.geometry.coordinates as [number, number]
    const prefCode = getPrefCode(feature.properties.pref)
    const { x, y } = coord2XY([lat, lng], ZOOM)
    const hash = hashXY(x, y)

    if(!prefCode) {
        process.stderr.write("Invalid `properties.pref` response from API: '${feature.properties.pref}'.\n")
        return callback(null, error(500, 'Internal Server Error.'))

    }

    const ID = `${prefCode}-${hash}`
    const addressObject = {
        ja: {
            prefecture: feature.properties.pref,
            city: feature.properties.city,
            address1: feature.properties.area + feature.properties.koaza_chome,
            address2: feature.properties.banchi_go,
            other: feature.properties.building + feature.properties.building_number
        },
        location: {
            lat: lat.toString(),
            lng: lng.toString()
        }
    }

    let body 
    if(apiKey) {
        // apiKey has been authenticated and return rich results
        body = { ID: ID, address: addressObject }
    } else {
        body = { ID: ID }
    }

    try {
        await Promise.all([
            store(ID, ZOOM, addressObject),
            removeTimestamp(apiKey),
        ])
    } catch (error) {
        console.error({ ID, ZOOM, addressObject, apiKey, error })
        console.error('[FATAL] Something happend with DynamoDB connection.')
    }

    return callback(null, json([body]));
}
