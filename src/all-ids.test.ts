import fs from 'fs'
import os from 'os'
import path from 'path'
import async from 'async'

import { DB } from './lib/dynamodb';

import { _handler } from './public';
import { APIGatewayProxyResult } from 'aws-lambda';
import { decorate, logger, authenticator } from './lib/decorators';

const handler = decorate(_handler, [logger, authenticator('id-req')]);


const allIds = fs.readFileSync(path.join(__dirname, '..', 'out', 'all-ids.csv'), {
  encoding: 'utf-8',
}).split(/\n/).map((line) => line.trim().split(','));

beforeAll(async () => {
  const queue = async.cargoQueue<Record<string, any>>(async (records) => {
    // console.timeLog('loading IDs', `writing ${records.length} records...`);
    const resp = await DB.batchWrite({
      RequestItems: {
        [process.env.AWS_DYNAMODB_ESTATE_ID_TABLE_NAME]: records.map((record) => ({
          PutRequest: {
            Item: record,
          },
        })),
      }
    }).promise();
    const unprocessed = (resp.UnprocessedItems || {})[process.env.AWS_DYNAMODB_ESTATE_ID_TABLE_NAME] || [];
    if (unprocessed.length > 0) {
      console.error('unprocessed items', unprocessed);
      throw new Error('unprocessed items');
    }
  }, 2, 25);
  queue.error();

  for (const row of allIds) {
    const [id,_min_createat,_max_createat,_cnt,address,rawAddress] = row;
    queue.push({
      estateId: id,
      address,
      rawAddress,
      zoom: 22,
      serial: 1,
    });
  }
  let progressTimer: NodeJS.Timeout | null = null;
  (() => {
    let lastLength = queue.length();
    let lastTS = process.hrtime.bigint();
    const logger = () => {
      const length = queue.length();
      if (length === 0) {
        return;
      }
      let progress = lastLength - length;
      const nowTS = process.hrtime.bigint();
      const elapsed = nowTS - lastTS;
      const perSecond = progress / Number(elapsed) * 1e9;
      const timeRemaining = length / perSecond;
      console.log(`queue length: ${length}, progress: ${progress} (${perSecond.toFixed(2)}/s, ${timeRemaining.toFixed(2)}s remaining)`);

      lastLength = length;
      lastTS = nowTS;
      progressTimer = setTimeout(logger, 10_000);
    };
    logger();
  })();
  await queue.drain();
  if (progressTimer) {
    // clear the timeout so jest doesn't complain
    clearTimeout(progressTimer);
  }
}, 60_000 * 10); // give us 10 minutes to load the data

for (const row of allIds) {
  test(`${row[0]} - ${row[5]} (ID発行)`, async () => {
    const event = {
      isDemoMode: true,
      queryStringParameters: {
        q: row[5],
      },
    };
    // @ts-expect-error context and callback are not used
    const lambdaResult = await handler(event) as APIGatewayProxyResult
    const body = JSON.parse(lambdaResult.body)
    expect(body[0].ID).toEqual(row[0]);
  });
}
