import * as dynamodb_logs from './dynamodb_logs'
import { ulid } from 'ulid';
import { sleep } from './util';
import { DB } from './dynamodb';
import { normalize, NormalizeResult } from './nja';

const TableName = process.env.AWS_DYNAMODB_LOG_TABLE_NAME;

describe('createLog', () => {
  test('it works', async () => {
    const now = new Date()
    await dynamodb_logs.createLog(
      "it works",
      { some: "metadata" },
      { userId: 'MY-USER-ID' },
      now,
    )
    const PK = `LOG#it works#${now.toISOString().slice(0, 10)}`
    const resp = await DB.query({
      TableName,
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
      userId: 'MY-USER-ID',
      createAt: now.toISOString(),
      some: "metadata"
    })
  })
})

describe('withLock', () => {
  test('it returns the result value of inner', async () => {
    const lockId = ulid();
    const output = await dynamodb_logs.withLock(lockId, async () => {
      return 'hello';
    });
    expect(output).toStrictEqual('hello');
  });

  test('it disallows a new lock to be created', async () => {
    const lockId = ulid();

    const output = dynamodb_logs.withLock(lockId, async () => {
      await sleep(1500);
    });

    await sleep(2);

    await expect(dynamodb_logs.withLock(lockId, async () => {
      console.error('this should never be reached');
    })).rejects.toThrow(new RegExp(`lock ${lockId} could not be acquired after \\d+ tries`));

    await output;
  });
});

describe('normalizeBanchiGo', () => {
  beforeAll(async () => {
    const testData = [
      { addr: '東京都文京区水道二丁目', bg: '1-5' },
      { addr: '東京都文京区水道二丁目', bg: '2' },
      { addr: '東京都町田市木曽東四丁目', bg: '14-イ22' },
      { addr: '大阪府大阪市中央区久太郎町四丁目', bg: '渡辺3'},
    ];

    await Promise.all(
      testData.map(({addr, bg}) => DB.put({
        TableName,
        Item: {
          PK: `AddrDB#${addr}`,
          SK: bg,
        },
      }).promise())
    );
  });

  const cases: [string, Partial<NormalizeResult>][] = [
    ['東京都文京区水道2丁目1-5 おはようビル', { addr: '1-5', building: 'おはようビル', level: 8 }],
    ['東京都文京区水道2丁目2 おはようビル', { addr: '2', building: 'おはようビル', level: 7 }],
    ['東京都町田市木曽東四丁目14-イ22ビル名205', { addr: '14-イ22', building: 'ビル名205', level: 8 }],
    ['大阪府大阪市中央区久太郎町四丁目渡辺3小原流ホール', { addr: '渡辺3', building: '小原流ホール', level: 7 }],
  ];

  for (const [inputAddr, matching] of cases) {
    test(`recognizes ${inputAddr}`, async () => {
      const prenormalized = await normalize(inputAddr);
      const normalized = await dynamodb_logs.normalizeBanchiGo(prenormalized);
      expect(normalized).toMatchObject(matching);
    });
  }
});
