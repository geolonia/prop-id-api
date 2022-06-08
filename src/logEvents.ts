import '.';
import { DynamoDBStreamHandler } from 'aws-lambda';
import zlib from 'zlib';
import AWS from 'aws-sdk';
import { DB } from './lib/dynamodb';
import Sentry from './lib/sentry';
import { normalize } from '@geolonia/normalize-japanese-addresses';
import crypto from 'crypto';

const md5hash = (str: string) => {
  const md5 = crypto.createHash('md5');
  return md5.update(str, 'binary').digest('hex');
};

const ApiKeyTableName = process.env.AWS_DYNAMODB_API_KEY_TABLE_NAME;
export const s3 = new AWS.S3();

const keyOwnerCache: { [apiKey: string]: string } = {};

export const _handler: DynamoDBStreamHandler = async (event) => {
  const recordMap = await event.Records.reduce<Promise<{ [s3Key: string]: any[] }>>(async (promisedPrev, record) => {
    const prev = await promisedPrev;
    if (
      record.eventName === 'INSERT' &&
      record.dynamodb &&
      record.dynamodb.NewImage
    ) {
      const item = AWS.DynamoDB.Converter.unmarshall(record.dynamodb.NewImage);

      const { PK, SK, ...remainingItem } = item;
      const [type, logType, date] = (PK as string).split('#');

      if (type === 'LOG') {
        const [year, month, day] = (date || '').split('-');
        if (logType && [year, month, day].every((val) => !Number.isNaN(parseInt(val)))) {
          const {
            apiKey,
            createAt,
            ...others
          } = remainingItem;
          let userId = item.userId || ((typeof apiKey === 'string') ? keyOwnerCache[apiKey] : undefined);

          if (!userId && apiKey && typeof apiKey === 'string') {
            const { Item } = await DB.get({
              TableName: ApiKeyTableName,
              Key: { apiKey },
            }).promise();
            if (Item && typeof Item.GSI1PK === 'string') {
              userId = Item.GSI1PK;
              keyOwnerCache[apiKey] = userId;
            }
          }

          const key = `json/year=${year}/month=${month}/day=${day}`;
          if (!prev[key]) {
            prev[key] = [];
          }
          // SK is unique because it is numbered by ULID.
          const logItem = { id: SK as string, logType, userId, apiKey, createAt, json: JSON.stringify(others) };
          prev[key].push(logItem);
        }
      } else if (type === 'AddrDB') {
        const address = logType;
        const banchi_go = SK;
        const { pref, city, town } = await normalize(address);
        // NOTE: no partitions
        const key = `addrdb_json/${pref}/${city}/${town}`;
        if (!prev[key]) {
          prev[key] = [];
        }
        const id = md5hash(`${PK}${SK}`);
        const logItem = { id, address, banchi_go, pref, city, town, json: JSON.stringify(remainingItem) };
        prev[key].push(logItem);
      }
    }
    return prev;
  }, Promise.resolve({}));

  const now = Date.now();

  const promises = Object.keys(recordMap).map((key) => {
    const items = recordMap[key];
    const ndjson = items.map((item) => JSON.stringify(item)).join('\n');
    const body = zlib.gzipSync(ndjson);

    return s3.putObject({
      Bucket: process.env.AWS_S3_LOG_STREAM_OUTPUT_BUCKET_NAME,
      Key: `${key}/${now}.json.gz`,
      Body: body,
      ContentEncoding: 'gzip',
    }).promise();
  });
  await Promise.all(promises);
};

export const handler = Sentry.AWSLambda.wrapHandler(_handler);
