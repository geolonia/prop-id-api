import { verifyAddress, coord2XY, hashXY, getPrefCode } from './lib/index'

export const handler: EstateAPI.LambdaHandler = async (event, context, callback) => {

    const address = event.queryStringParameters?.q
    const debug =  !!event.queryStringParameters && 'debug' in event.queryStringParameters
    const ZOOM = parseInt(process.env.ZOOM, 10)

    if(!address) {
        return callback(null, {
            statusCode: 400,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: 'Missing querystring parameter `q`.'
            })
        })
    }

    let result
    try {
        result = await verifyAddress(address)
    } catch (error) {
        process.stderr.write("API or Netowork Down Detected.\n")
        process.stderr.write(JSON.stringify(error))
        return callback(null, {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: 'Internal Server Error.'
            })
        })
    }

    if(!result.ok) {
        if(result.status === 403) {
            process.stderr.write("API Authentication failed.\n")
        } else {
            process.stderr.write("not documented status code detected.\n")
        }
        process.stderr.write(JSON.stringify({ result }))
        return callback(null, {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: 'Internal Server Error.'
            })
        })
    }

    const feature = result.body.features[0]

    if(feature.geometry === null) {
        // Features not found
        return callback(null, {
            statusCode: 404,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: `The address '${address}' is not verified.`
            })
        })
    }

    const [lng, lat] = feature.geometry.coordinates as [number, number]
    const prefCode = getPrefCode(feature.properties.pref)
    const { x, y } = coord2XY([lat, lng], ZOOM)
    const hash = hashXY(x, y)

    if(!prefCode) {
        process.stderr.write("Invalid `properties.pref` response from API: '${feature.properties.pref}'.\n")
        return callback(null, {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: 'Internal Server Error.'
            })
        })
    }

    const ID = `${prefCode}-${hash}`

    let body: object[] = [
        {
            ID: ID
        }
    ]

    if(debug) {
        body[0] = {
            ...body[0],
            debug: {
                prefCode,
                hash,
                tileIndex: { x, y },
                zoom: ZOOM,
                feature
            }
        }
    }

    return callback(null, {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body),
    });
}
