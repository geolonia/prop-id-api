import * as dynamodb_logs from './dynamodb_logs'
import { sleep } from './util';
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

describe('withLock', () => {
  test('it returns the result value of inner', async () => {
    const lockId = 'XYZ1';
    const output = await dynamodb_logs.withLock(lockId, async () => {
      return 'hello';
    });
    expect(output).toStrictEqual('hello');
  });

  test('it disallows a new lock to be created', async () => {
    const lockId = 'XYZ2';

    const output = dynamodb_logs.withLock(lockId, async () => {
      await sleep(1500);
    });

    await expect(dynamodb_logs.withLock(lockId, async () => {
      console.error('this should never be reached');
    })).rejects.toThrow(/lock XYZ2 could not be acquired after \d+ tries/);

    await output;
  });
});
