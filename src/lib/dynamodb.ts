import AWS from 'aws-sdk'
import { hashToken } from './index'

export const authenticate = async (apiKey: string, accessToken: string) => {
    const docclient = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10' })
    const getItemInput: AWS.DynamoDB.DocumentClient.GetItemInput = {
        TableName: process.env.AWS_DYNAMODB_API_KEY_TABLE_NAME,
        Key: { apiKey }
    }
    const { Item: item } = await docclient.get(getItemInput).promise()

    if(!item) {
        return { authenticated: false }
    }

    if(item && item.accessToken === hashToken(accessToken)) {
        return { authenticated: true, lastRequest: item.lastRequest }
    }
    return { authenticated: false }
}

export const update = async (apiKey:string, timestamp: number | false) => {
    const docclient = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10' })
    let updateItemInput: AWS.DynamoDB.DocumentClient.UpdateItemInput
    if(timestamp == false) {
        updateItemInput = {
            TableName: process.env.AWS_DYNAMODB_API_KEY_TABLE_NAME,
            Key: { apiKey },
            UpdateExpression: 'remove #lastRequest',
            ExpressionAttributeNames: {
                '#lastRequest': 'lastRequest',
            },
        }
    } else {
        updateItemInput = {
            TableName: process.env.AWS_DYNAMODB_API_KEY_TABLE_NAME,
            Key: { apiKey },
            UpdateExpression: 'set #lastRequest = :timstamp',
            ExpressionAttributeNames: {
                '#lastRequest': 'lastRequest',
            },
            ExpressionAttributeValues: {
                ':timestamp': timestamp || null
            }
        } 
    }
}

export const store = async (estateId: string, zoom: number, address: object) => {
    const docclient = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10' })
    const putItemInput: AWS.DynamoDB.DocumentClient.PutItemInput = {
        TableName: process.env.AWS_DYNAMODB_ESTATE_ID_TABLE_NAME,
        Item: {
            estateId,
            zoom: process.env.ZOOM,
            address: JSON.stringify(address)
        }
    }
    return await docclient.put(putItemInput).promise()
}
