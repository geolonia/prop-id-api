import AWS from 'aws-sdk'
import crypto from 'crypto'

export const authenticate = async (apiKey: string, accessToken: string) => {
    const docclient = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10' })
    const getItemInput: AWS.DynamoDB.DocumentClient.GetItemInput = {
        TableName: process.env.AWS_DYNAMODB_API_KEY_TABLE_NAME,
        Key: {
            apiKey: 'geolonia'
        }
    }
    const { Item: item } = await docclient.get(getItemInput).promise()

    if(!item) {
        return false
    }

    const hashedToken = crypto.scryptSync(accessToken, process.env.ACCESS_TOKEN_SALT, 10).toString()

    if(item && item.accessToken === hashedToken) {
        return true
    }
    return false
}