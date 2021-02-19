import { authenticate, issueSerial, store, updateTimestamp } from './lib/dynamodb'
import { decapitalize, verifyAddress, coord2XY, hashXY, getPrefCode } from './lib/index'
import { error, json } from './lib/proxy-response'

export const handler: EstateAPI.LambdaHandler = async (event, context, callback, isDemoMode = false, isDebugMode = false) => {

    const address = event.queryStringParameters?.q
    const apiKey = event.queryStringParameters ? event.queryStringParameters['api-key'] : void 0
    const accessToken = decapitalize(event.headers)['x-access-token']
    const ZOOM = parseInt(process.env.ZOOM, 10)

    if(!address) {
        return callback(null, error(400, 'Missing querystring parameter `q`.'))
    }


    if(isDemoMode) {
        // pass through with debug mode
    } else if(
        // [Alfa feature] Authenticate even if q['api-key'] not specified
        !apiKey ||
        !accessToken ||
        !await authenticate(apiKey, accessToken)
    ) {
        return callback(null, error(403, 'Incorrect querystring parameter `api-key` or `x-access-token` header value.'))
    } else {
        const { authenticated, lastRequestAt } = await authenticate(apiKey, accessToken);
        if(!authenticated) {
            return callback(null, error(403, 'Incorrect querystring parameter `api-key` or `x-access-token` header value.'))
        } else if(lastRequestAt) {
            const diff = Date.now() - lastRequestAt
            if(diff < 3000) {
                return callback(null, error(429, 'Please request after a few second.'))
            }
        }
        await updateTimestamp(apiKey, Date.now())
    }

    // Request Increment P Address Verification API
    let result
    try {
        result = await verifyAddress(address)
    } catch (error) {
        console.error({ error })
        console.error('[FATAL] API or Netowork Down Detected.')
        return callback(null, error(500, 'Internal Server Error.'))
    }

    // API key for Increment P should valid.
    if(!result.ok) {
        if(result.status === 403) {
            console.error('[FATAL] API Authentication failed.')
        } else {
            console.error('[FATAL] Unknown status code detected.')
        }
        console.error(error)
        return callback(null, error(500, 'Internal Server Error.'))
    }

    const feature = result.body.features[0]

    // Features not found
    if(feature.geometry === null) {
        return callback(null, error(404, "The address '%s' is not verified.", address))
    }

    const normalizedAddress = feature.properties.place_name

    const [lng, lat] = feature.geometry.coordinates as [number, number]
    const prefCode = getPrefCode(feature.properties.pref)
    const { x, y } = coord2XY([lat, lng], ZOOM)
    const nextSerial = await issueSerial(x, y, normalizedAddress)
    const hash = hashXY(x, y, nextSerial)

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
    }
    const location = {
        lat: lat.toString(),
        lng: lng.toString()
    }

    let body
    if(apiKey || isDemoMode) {
        // apiKey has been authenticated and return rich results
        body = { ID, address: addressObject, location }
    } else {
        body = { ID }
    }

    try {
        await store(ID,`${x}/${y}`, nextSerial, ZOOM, normalizedAddress)
    } catch (error) {
        console.error({ ID, ZOOM, addressObject, apiKey, error })
        console.error('[FATAL] Something happend with DynamoDB connection.')
    }

    if(isDebugMode && isDemoMode) {
      return callback(null, json({
        internallyNormalized: address, // TODO: should be replace with own normalized result
        externallyNormalized: feature,
        tileInfo: { xy: `${x}/${y}`, serial:nextSerial, ZOOM },
        apiResponse: [body]
      }));
    } else {
      return callback(null, json([body]));
    }
}
