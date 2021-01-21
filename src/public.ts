import Lambda from 'aws-lambda'
import { verifyAddress, coord2XY, hashXY } from './lib/index'

type Handler = (event: Lambda.APIGatewayProxyEvent, context: any, callback: Lambda.Callback) => void

export const handler: Handler = async (event, context, callback) => {

    const address = event.queryStringParameters?.q
    const ZOOM = parseInt(process.env.ZOOM, 10)

    if(Number.isNaN(ZOOM)) {
        return callback(JSON.stringify({
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: 'Invalid Server Error.'
            })
        }))
    }

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
        // TODO: error handling for Increment P API
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

    const [lng, lat] = result.features[0] as [number, number]
    const { x, y } = coord2XY([lat, lng], ZOOM)
    const hash = hashXY(x, y)

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