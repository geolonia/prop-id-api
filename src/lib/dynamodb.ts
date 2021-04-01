import AWS from 'aws-sdk'
import { hashToken, hashTokenV2, hashXY, randomToken } from './index'

const REDIRECT_MAX = 4
export const DB = process.env.TEST === "1" ? new AWS.DynamoDB.DocumentClient({ endpoint: "http://127.0.0.1:8000", region: "us-west-2" }) : new AWS.DynamoDB.DocumentClient()

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

export const getEstateIdForAddress = async (address: string, building?: string | null ): Promise<BaseEstateId | null> => {

  let ExpressionAttributeNames =  { '#a': 'address', '#b': 'building' }
  let ExpressionAttributeValues : {':a':string, ':b'?:string} =  { ':a': address }
  let KeyConditionExpression = '#a = :a'
  let FilterExpression;
  if (building) {
    ExpressionAttributeValues[':b'] = building
    FilterExpression = '#b = :b'
  } else {
    FilterExpression = 'attribute_not_exists(#b)'
  }

  const queryInputForExactMatch: AWS.DynamoDB.DocumentClient.QueryInput = {
    TableName: process.env.AWS_DYNAMODB_ESTATE_ID_TABLE_NAME,
    IndexName: 'address-index',
    Limit: 1,
    ExpressionAttributeNames,
    ExpressionAttributeValues,
    KeyConditionExpression,
    FilterExpression
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

const _generateSerial = () => Math.floor(Math.random() * 999_999_999)

export interface StoreEstateIdReq {
  rawAddress: string
  address: string
  rawBuilding?: string | null
  building?: string | null
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
      if (e.code === "ConditionalCheckFailedException") {
        // Try again
      } else {
        throw e
      }
    }
  }

  if (successfulItem === false) {
    throw new Error(`Couldn't insert new item after ${tries} tries.`)
  }

  return successfulItem
}

export interface MergeEstateIdReq {
  from: string[]
  to: string
}

type MergeEstateIdResponse = {
  error: true,
  errorType: "destination_doesnt_exist" | "destination_is_not_canonical" | "destination_is_source"
} | {
  error: false,
  mergedIds: {id: string}[]
}

export const mergeEstateId = async (params: MergeEstateIdReq): Promise<MergeEstateIdResponse> => {
  const toId = params.to

  for (let i = 0; i < params.from.length; i++) {
    const fromId = params.from[i];
    if (fromId === toId) {
      return { error: true, errorType: "destination_is_source" }
    }
  }

  const resp = await DB.get({
    TableName: process.env.AWS_DYNAMODB_ESTATE_ID_TABLE_NAME,
    Key: {
      estateId: toId
    }
  }).promise()
  if (!resp.Item) {
    return { error: true, errorType: "destination_doesnt_exist" }
  }
  if ('canonicalId' in resp.Item) {
    return { error: true, errorType: "destination_is_not_canonical" }
  }

  const consolidatedAt = new Date().getTime()
  const promises: Promise<{id: string}>[] = []
  for (let i = 0; i < params.from.length; i++) {
    const fromId = params.from[i]

    promises.push((async () => {
      await DB.update({
        TableName: process.env.AWS_DYNAMODB_ESTATE_ID_TABLE_NAME,
        ExpressionAttributeNames: {
          '#c': 'canonicalId',
          '#cAt': 'consolidatedAt',
        },
        ExpressionAttributeValues: {
          ':c': toId,
          ':cAt': consolidatedAt,
        },
        Key: {
          estateId: fromId
        },
        UpdateExpression: "SET #c = :c, #cAt = :cAt"
      }).promise()

      return { id: fromId }
    })())

    promises.push()
  }

  return {
    error: false,
    mergedIds: await Promise.all(promises)
  }
}

export interface UsageQuotaParams {
  apiKey: string
  quotaType: string
}

export const _generateUsageQuotaKey = (params: UsageQuotaParams) => {

  const apiKey = params.apiKey
  const quotaType = params.quotaType

  const now = new Date()
  const month = `${now.getMonth() + 1}`.padStart(2, "0")
  const year = now.getFullYear()

  return `USAGE#${apiKey}#${quotaType}#${year}${month}`

}

export const checkServiceUsageQuota = async (params: UsageQuotaParams): Promise<boolean> => {

  const apiKey = params.apiKey
  const quotaType = params.quotaType
  const quotaLimits: { [key: string]: number } = {
    "id-req": 10000
  }
  const usageKey = _generateUsageQuotaKey({apiKey,quotaType})

  const getItemInput: AWS.DynamoDB.DocumentClient.GetItemInput = {
    TableName: process.env.AWS_DYNAMODB_API_KEY_TABLE_NAME,
    Key: { apiKey : usageKey },
  }
  const { Item: item } = await DB.get(getItemInput).promise()
  if (undefined === item){ // Initial request
    return true

  } else if (item && (quotaType in quotaLimits) && (item.c < quotaLimits[quotaType])){
    return true

  } else {
    return false
  }
}

export interface IncrementServiceUsageReq {
  apiKey: string
  quotaType: string
}

export const incrementServiceUsage = async (params: IncrementServiceUsageReq) => {

  const apiKey = params.apiKey
  const quotaType = params.quotaType
  const usageKey = _generateUsageQuotaKey({apiKey,quotaType})

  const updateItemInput: AWS.DynamoDB.DocumentClient.UpdateItemInput = {
    TableName: process.env.AWS_DYNAMODB_API_KEY_TABLE_NAME,
    Key: { apiKey : usageKey },
    UpdateExpression: 'SET #c = if_not_exists(#c, :default) + :increment',
    ExpressionAttributeNames: {
      '#c': 'c',
    },
    ExpressionAttributeValues:{
      ":default": 0,
      ":increment": 1
    }
  }
  await DB.update(updateItemInput).promise()
}
