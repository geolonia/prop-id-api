import AWS from 'aws-sdk'

/**
 * decapitablize header object
 * @param headers event.headers
 */
const decapitalize = (headers: { [key: string]: string | undefined }) => {
    const keys = Object.keys(headers).map(key => key.toLocaleLowerCase())
    return keys.reduce<{ [key: string]: string | undefined }>((prev, key) => {
        prev[key] = headers[key]
        return prev
    }, {})
}

/**
 * Request DynamoDB authenticate a user
 * @param apiKey 
 * @param accessToken 
 */
const authenticated = async (apiKey: string | undefined, accessToken: string | undefined) => {
    if(!apiKey || !accessToken) {
        return false
    }

    const docclient = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10' })
    const getItemInput: AWS.DynamoDB.DocumentClient.GetItemInput = {
        TableName: process.env.AWS_DYNAMODB_API_KEY_TABLE_NAME,
        Key: { apiKey }
    }

    const { Item: item } = await docclient.get(getItemInput).promise()
    if(!item || item.accessToken !== accessToken) {
        return false
    }

    return true
}

export const handler: EstateAPI.LambdaHandler = async (event, context, callback) => {

    const apiKey = event.queryStringParameters ? event.queryStringParameters['api-key'] : void 0
    const accessToken = decapitalize(event.headers)['x-access-token']

    if(! await authenticated(apiKey, accessToken)) {
        return callback(null, {
            statusCode: 403,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: 'Missing querystring parameter `api-key`.'
            })
        })
    }

    return callback(null, {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({}),
    });
}
