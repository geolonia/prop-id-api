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
        return { authenticated: true, lastRequestAt: item.lastRequestAt }
    }
    return { authenticated: false }
}

export const updateTimestamp = async (apiKey:string, timestamp: number) => {
    const docclient = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10' })
    const updateItemInput: AWS.DynamoDB.DocumentClient.UpdateItemInput = {
        TableName: process.env.AWS_DYNAMODB_API_KEY_TABLE_NAME,
        Key: { apiKey },
        UpdateExpression: 'set #lastRequestAt = :timestamp',
        ExpressionAttributeNames: {
            '#lastRequestAt': 'lastRequestAt',
        },
        ExpressionAttributeValues: {
            ':timestamp': timestamp
        }
    }
    return await docclient.update(updateItemInput).promise()
}

export const issueSerial = async (x: number, y:number, address: string): Promise<number> => {
  const docclient = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10' })
  const tileXY = `${x}/${y}`

  const queryInputForExactMatch: AWS.DynamoDB.DocumentClient.QueryInput = {
    TableName: process.env.AWS_DYNAMODB_ESTATE_ID_TABLE_NAME,
    IndexName: 'address-index',
    Limit: 1,
    ExpressionAttributeNames: { '#a': 'address' },
    ExpressionAttributeValues: { ':a': address },
    KeyConditionExpression: '#a = :a',
  }
  const { Items: exactMatchItems = [] } = await docclient.query(queryInputForExactMatch).promise()

  if (exactMatchItems.length === 1) {
    return exactMatchItems[0].serial;
  }

  // find serial
  const queryInputForSerial: AWS.DynamoDB.DocumentClient.QueryInput = {
    TableName: process.env.AWS_DYNAMODB_ESTATE_ID_TABLE_NAME,
    IndexName: 'tileXY-index',
    Limit: 1,
    ExpressionAttributeNames: { '#t': 'tileXY' },
    ExpressionAttributeValues: { ':t': tileXY },
    ScanIndexForward: false, // descending
    KeyConditionExpression: '#t = :t'
  }

  const { Items: serializedItems = [] } = await docclient.query(queryInputForSerial).promise()
  if(serializedItems.length === 0) {
    throw new Error('Unexpected error')
  } else {
    return serializedItems[0].serial + 1 // next serial number
  }
}

export const store = async (estateId: string, tileXY: string, serial: number, zoom: number, address: string) => {
    const docclient = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10' })
    const putItemInput: AWS.DynamoDB.DocumentClient.PutItemInput = {
        TableName: process.env.AWS_DYNAMODB_ESTATE_ID_TABLE_NAME,
        Item: {
            estateId,
            tileXY,
            serial,
            zoom,
            address
        }
    }
    return await docclient.put(putItemInput).promise()
}
