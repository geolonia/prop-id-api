import { DynamoDBStreamEvent } from 'aws-lambda';
import * as logEvent from './logEvents'
import zlib from 'zlib'

test('should store log as s3 object', async () => {
  let key, body
  // @ts-ignore
  logEvent.s3 = {
    putObject: ({ Key, Body }: { Key: string, Body: Buffer }) => ({
      promise: () => new Promise<void>(resolve => {
        key = Key
        body = zlib.gunzipSync(Body as unknown as Buffer).toString('utf-8'),
        resolve()
      })
    })
  }

  const now = new Date().toISOString()
  const event: DynamoDBStreamEvent = {
    Records: [
      {
        eventName: 'INSERT',
        dynamodb: {
          NewImage: {
            PK: { S: 'LOG#MY-LOG-TYPE#2021-01-01' },
            SK: { S: 'my-sort-key' },
            apiKey: { S: 'my-api-key' },
            createAt: { S: now },
            prop1: { S: 'abc' },
            prop2: { N: '123' }
          }
        }
      }
    ]
  }
  await logEvent._handler(event, {} as any, () => {})
  expect(key).toMatch(/^year=2021\/month=01\/day=01\/[0-9]*\.json\.gz$/)
  expect(body).toEqual(JSON.stringify([{
    id: 'my-sort-key',
    logType: 'MY-LOG-TYPE',
    apiKey: 'my-api-key',
    createAt: now,
    others: {
      prop1: 'abc',
      prop2: 123,
    }
  }]))
})
