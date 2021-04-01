import * as dynamodb_logs from './dynamodb_logs'
import { DB } from './dynamodb'

describe('createLog', () => {
  test('it works', async () => {
    const now = new Date()
    await dynamodb_logs.createLog("it works", { some: "metadata" }, now)
    const PK = `LOG#it works#${now.toISOString().slice(0, 10)}`
    const resp = await DB.query({
      TableName: process.env.AWS_DYNAMODB_LOG_TABLE_NAME,
      KeyConditionExpression: "#k = :k",
      ExpressionAttributeNames: {
        "#k": "PK"
      },
      ExpressionAttributeValues: {
        ":k": PK
      },
    }).promise()

    expect(resp.Count!).toBeGreaterThan(0)
    expect(resp.Items![0]).toMatchObject({
      PK,
      some: "metadata"
    })
  })
})
