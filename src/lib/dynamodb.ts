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
        return false
    }

    if(item && item.accessToken === hashToken(accessToken)) {
        return true
    }
    return false
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

export const restore = async (estateId: string) => {
    const docclient = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10' })
    const getItemInput: AWS.DynamoDB.DocumentClient.GetItemInput = {
        TableName: process.env.AWS_DYNAMODB_ESTATE_ID_TABLE_NAME,
        Key: {
            estateId
        }
    }

    const { Item: item } = await docclient.get(getItemInput).promise()
    if(item) {
        return JSON.parse(item.address) as object
    } else {
        return void 0
    }
}
