import { DynamoDBStreamEvent } from 'aws-lambda';
import * as logEvent from './logEvents'
import zlib from 'zlib'

test('should store log as s3 object', async () => {
  const putObjectArgs: { key: string, body: Buffer }[] = []
  // @ts-ignore
  logEvent.s3 = {
    putObject: ({ Key, Body }: { Key: string, Body: Buffer }) => ({
      promise: () => new Promise<void>(resolve => {
        putObjectArgs.push({key: Key, body: Body })
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
            PK: { S: 'LOG#MY-LOG-TYPE1#2021-01-01' },
            SK: { S: 'my-sort-key1-1' },
            apiKey: { S: 'my-api-key1-1' },
            createAt: { S: now },
            prop1: { S: 'abc' },
            prop2: { N: '123' },
          }
        }
      },
      {
        eventName: 'INSERT',
        dynamodb: {
          NewImage: {
            PK: { S: 'LOG#MY-LOG-TYPE2#2021-01-01' },
            SK: { S: 'my-sort-key1-2' },
            apiKey: { S: 'my-api-key1-2' },
            createAt: { S: now },
            prop1: { S: 'abc' },
            prop2: { N: '123' },
          }
        }
      },
      {
        eventName: 'INSERT',
        dynamodb: {
          NewImage: {
            PK: { S: 'LOG#MY-LOG-TYPE2#2021-01-02' },
            SK: { S: 'my-sort-key2' },
            apiKey: { S: 'my-api-key2' },
            createAt: { S: now },
            prop1: { S: 'abc' },
            prop2: { N: '123' },
            prop3: { S: 'あああ' },
          }
        }
      }
    ]
  }

  await logEvent._handler(event, {} as any, () => {})

  expect(putObjectArgs[0].key).toMatch(/^json\/year=2021\/month=01\/day=01\/[0-9]*\.json\.gz$/)
  expect(putObjectArgs[1].key).toMatch(/^json\/year=2021\/month=01\/day=02\/[0-9]*\.json\.gz$/)
  const body0 = zlib.gunzipSync(putObjectArgs[0].body).toString('utf-8')
  const body1 = zlib.gunzipSync(putObjectArgs[1].body).toString('utf-8')
  expect(body0).toEqual(
    [
      {
        id: 'my-sort-key1-1',
        logType: 'MY-LOG-TYPE1',
        apiKey: 'my-api-key1-1',
        createAt: now,
        json: JSON.stringify({ prop1: 'abc', prop2: 123 }),
      },
      {
        id: 'my-sort-key1-2',
        logType: 'MY-LOG-TYPE2',
        apiKey: 'my-api-key1-2',
        createAt: now,
        json: JSON.stringify({ prop1: 'abc', prop2: 123 }),
      },
    ]
      .map(obj => JSON.stringify(obj))
      .join('\n')
  )
  expect(body1).toEqual(
    [
      {
        id: 'my-sort-key2',
        logType: 'MY-LOG-TYPE2',
        apiKey: 'my-api-key2',
        createAt: now,
        json: JSON.stringify({ prop1: 'abc', prop2: 123, prop3: 'あああ' }),
      },
    ]
      .map(obj => JSON.stringify(obj))
      .join('\n')
  )
})

test('should store address as s3 object', async () => {
  const putObjectArgs: { key: string, body: Buffer }[] = []
  // @ts-ignore
  logEvent.s3 = {
    putObject: ({ Key, Body }: { Key: string, Body: Buffer }) => ({
      promise: () => new Promise<void>(resolve => {
        putObjectArgs.push({key: Key, body: Body })
        resolve()
      })
    })
  }

  const event: DynamoDBStreamEvent = {
    Records: [
      {
        eventName: 'INSERT',
        dynamodb: {
          NewImage: {
            PK: { S: 'AddrDB#滋賀県大津市御陵町' },
            SK: { S: '1234-5678' },
            foo: { S: 'bar' },
          }
        }
      }
    ]
  }

  await logEvent._handler(event, {} as any, () => {})

  expect(putObjectArgs[0].key).toMatch(/^addrdb_json\/滋賀県\/大津市\/御陵町\/[0-9]*\.json\.gz$/)
  const body0 = zlib.gunzipSync(putObjectArgs[0].body).toString('utf-8')
  expect(body0).toEqual(
    [
      {
        id: '090f3d3379eba390e79ce53f2a3795e4',
        address: '滋賀県大津市御陵町',
        banchi_go: '1234-5678',
        pref: '滋賀県',
        city: '大津市',
        town: '御陵町',
        json: JSON.stringify({ foo: 'bar' }),
      }
    ]
      .map(obj => JSON.stringify(obj))
      .join('\n')
  )
})
