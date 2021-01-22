import { verifyAddress, coord2XY, hashXY, getPrefCode } from './lib/index'

export const handler: EstateAPI.LambdaHandler = async (event, context, callback) => {

    const address = event.queryStringParameters?.q
    const ZOOM = parseInt(process.env.ZOOM, 10)

    if(!address) {
        return callback(JSON.stringify({
            statusCode: 400,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: 'Missing querystring parameter `q`.'
            })
        }))
    }

    let result
    try {
        result = await verifyAddress(address)
    } catch (error) {
        // API or Netowork Down Detected
        return callback(JSON.stringify({
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: 'Internal Server Error.'
            })
        }))
    }

    const feature = result.body.features[0]
    const [lng, lat] = feature.geometry.coordinates as [number, number]
    const prefCode = getPrefCode(feature.properties.pref)
    const { x, y } = coord2XY([lat, lng], ZOOM)
    const hash = hashXY(x, y)

    if(!prefCode) {
        // Invalid `properties.pref` response from API
        return callback(JSON.stringify({
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: 'Internal Server Error.'
            })
        }))
    }

    const ID = `${prefCode}_${hash}`

    return callback(null, {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify([
            {
                ID: ID
            }
        ]),
    });
}