import * as dynamodb from './dynamodb'

export const _updateServiceUsageQuota = async ( usageKey:string, updateRequestCount:number ) => {

  const updateItemInput: AWS.DynamoDB.DocumentClient.UpdateItemInput = {
    TableName: process.env.AWS_DYNAMODB_API_KEY_TABLE_NAME,
    Key: { apiKey : usageKey },
    UpdateExpression: 'SET #c = :c',
    ExpressionAttributeNames: {
      '#c': 'c',
    },
    ExpressionAttributeValues: {
      ':c': updateRequestCount
    }
  }
  await dynamodb.DB.update(updateItemInput).promise()
}

export const _getServiceUsageQuotaItem = async ( usageKey:string ) =>{
  const getItemInput: AWS.DynamoDB.DocumentClient.GetItemInput = {
    TableName: process.env.AWS_DYNAMODB_API_KEY_TABLE_NAME,
    Key: { apiKey : usageKey },
  }
  const { Item: item } = await dynamodb.DB.get(getItemInput).promise()
  return item
}

it("works", async () => {
  expect(1).toBe(1)
})
