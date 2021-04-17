import { DB } from "./dynamodb"
import { ulid } from "ulid"

export const createLog = async (identifier: string, metadata: { [key: string]: any }, now: Date = new Date()): Promise<void> => {
  const nowStr = now.toISOString()
  const datePart = nowStr.slice(0, 10)
  const PK = `LOG#${identifier}#${datePart}`
  const SK = ulid(now.getTime())

  await DB.put({
    TableName: process.env.AWS_DYNAMODB_LOG_TABLE_NAME,
    Item: {
      PK,
      SK,
      ...metadata,
    }
  }).promise()
}
