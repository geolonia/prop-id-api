import AWS from 'aws-sdk'
import { hashToken, hashTokenV2, hashXY, randomToken } from './index'

const REDIRECT_MAX = 4
const DB = process.env.TEST === "1" ? new AWS.DynamoDB.DocumentClient({ endpoint: "http://127.0.0.1:8000", region: "us-west-2" }) : new AWS.DynamoDB.DocumentClient()

interface BaseEstateId {
  estateId: string
  address: string
  serial: number
  tileXY: string
  zoom: number
}

interface ConsolidatedEstateId extends BaseEstateId {
  canonicalId: string
  consolidatedAt: number
}

export type EstateId = BaseEstateId | ConsolidatedEstateId

export interface ApiKeyCreateResponse {
  apiKey: string
  accessToken: string
}

export const createApiKey = async (description: string): Promise<ApiKeyCreateResponse> => {
  const apiKey = randomToken(20)
  const accessToken = randomToken(32)

  await DB.put({
    TableName: process.env.AWS_DYNAMODB_API_KEY_TABLE_NAME,
    Item: {
      apiKey,
      hashedToken: await hashTokenV2(apiKey, accessToken),
      description
    },
    ConditionExpression: `attribute_not_exists(#id)`,
    ExpressionAttributeNames: {
      '#id': 'apiKey'
    }
  }).promise()

  return {
    apiKey,
    accessToken,
  }
}

export const authenticate = async (apiKey: string, accessToken: string) => {
  const getItemInput: AWS.DynamoDB.DocumentClient.GetItemInput = {
    TableName: process.env.AWS_DYNAMODB_API_KEY_TABLE_NAME,
    Key: { apiKey }
  }
  const { Item: item } = await DB.get(getItemInput).promise()

  if (!item) {
    await hashTokenV2(apiKey, accessToken)
    return { authenticated: false }
  }

  if ('hashedToken' in item && item.hashedToken === await hashTokenV2(apiKey, accessToken)) {
    return { authenticated: true, lastRequestAt: item.lastRequestAt }
  }

  if ('accessToken' in item && item.accessToken === hashToken(accessToken)) {
    return { authenticated: true, lastRequestAt: item.lastRequestAt }
  }

  return { authenticated: false }
}

export const updateTimestamp = async (apiKey:string, timestamp: number) => {
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
  return await DB.update(updateItemInput).promise()
}

export const getEstateIdForAddress = async (address: string): Promise<BaseEstateId | null> => {
  const queryInputForExactMatch: AWS.DynamoDB.DocumentClient.QueryInput = {
    TableName: process.env.AWS_DYNAMODB_ESTATE_ID_TABLE_NAME,
    IndexName: 'address-index',
    Limit: 1,
    ExpressionAttributeNames: { '#a': 'address' },
    ExpressionAttributeValues: { ':a': address },
    KeyConditionExpression: '#a = :a',
  }
  const { Items: exactMatchItems = [] } = await DB.query(queryInputForExactMatch).promise()

  if (exactMatchItems.length === 0) {
    return null
  }

  const item = exactMatchItems[0] as EstateId
  if ('canonicalId' in item) {
    return getEstateId(item.canonicalId, 1)
  }

  return item
}

export const getEstateId = async (id: string, redirectCount: number = 0): Promise<BaseEstateId | null> => {
  if (redirectCount > REDIRECT_MAX) {
    throw new Error(`Redirect count exceeded. Possible infinite loop?`)
  }

  const resp = await DB.get({
    TableName: process.env.AWS_DYNAMODB_ESTATE_ID_TABLE_NAME,
    Key: {
      estateId: id
    }
  }).promise()

  if (!resp.Item) {
    return null
  }

  const item = resp.Item as EstateId

  if ('canonicalId' in item) {
    // Follow the redirect.
    return await getEstateId(item.canonicalId, redirectCount + 1)
  }

  return item
}

export const issueSerial = async (x: number, y:number, address: string): Promise<number> => {
  const tileXY = `${x}/${y}`

  const queryInputForExactMatch: AWS.DynamoDB.DocumentClient.QueryInput = {
    TableName: process.env.AWS_DYNAMODB_ESTATE_ID_TABLE_NAME,
    IndexName: 'address-index',
    Limit: 1,
    ExpressionAttributeNames: { '#a': 'address' },
    ExpressionAttributeValues: { ':a': address },
    KeyConditionExpression: '#a = :a',
  }
  const { Items: exactMatchItems = [] } = await DB.query(queryInputForExactMatch).promise()

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

  const { Items: serializedItems = [] } = await DB.query(queryInputForSerial).promise()
  if (serializedItems.length === 0) {
    return 0
  } else {
    return serializedItems[0].serial + 1 // next serial number
  }
}

const _generateSerial = () => Math.floor(Math.random() * 999_999_999)

export interface StoreEstateIdReq {
  address: string
  tileXY: string
  zoom: number
  prefCode: string
}

export const store = async (idObj: StoreEstateIdReq) => {
  let successfulItem: EstateId | false = false, tries = 0

  while (successfulItem === false && tries < 10) {
    try {
      tries += 1
      const serial = _generateSerial()
      const [x, y] = idObj.tileXY.split('/')
      const Item: EstateId = {
        ...idObj,
        estateId: idObj.prefCode + "-" + hashXY(x, y, serial),
        serial
      }
      const putItemInput: AWS.DynamoDB.DocumentClient.PutItemInput = {
        TableName: process.env.AWS_DYNAMODB_ESTATE_ID_TABLE_NAME,
        Item,
        ConditionExpression: `attribute_not_exists(#id)`,
        ExpressionAttributeNames: {
          '#id': 'estateId'
        }
      }
      await DB.put(putItemInput).promise()
      successfulItem = Item
    } catch (e) {
    }
  }

  if (successfulItem === false) {
    throw new Error(`Couldn't insert new item after ${tries} tries.`)
  }

  return successfulItem
}
