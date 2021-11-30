import '.';
import { DynamoDBStreamHandler } from 'aws-lambda';
import zlib from 'zlib';
import AWS from 'aws-sdk';
import { DB } from './lib/dynamodb';
import Sentry from './lib/sentry';

const ApiKeyTableName = process.env.AWS_DYNAMODB_API_KEY_TABLE_NAME;
export const s3 = new AWS.S3();

const keyOwnerCache: { [apiKey: string]: string } = {};

export const _handler: DynamoDBStreamHandler = async (event) => {
  const recordMap = await event.Records.reduce<{ [key: string]: any }>(async (promisedPrev, record) => {
    const prev = await promisedPrev;
    if (
      record.eventName === 'INSERT' &&
      record.dynamodb &&
      record.dynamodb.NewImage
    ) {
      const item = AWS.DynamoDB.Converter.unmarshall(record.dynamodb.NewImage);

      const {
        PK,
        SK,
        apiKey,
        createAt,
        ...others
      } = item;
      let userId = item.userId || ((typeof apiKey === 'string') ? keyOwnerCache[apiKey] : undefined);

      if (!userId && apiKey && typeof apiKey === 'string') {
        const { Item } = await DB.get({
          TableName: ApiKeyTableName,
          Key: { apiKey },
        }).promise();
        if (Item && typeof Item.GSIPK === 'string') {
          userId = Item.GSIPK;
          keyOwnerCache[apiKey] = userId;
        }
      }

      const [type, logType, date] = (PK as string).split('#');
      const [year, month, day] = date.split('-');
      if (
        type === 'LOG' &&
        logType &&
        [year, month, day].every((val) => !Number.isNaN(parseInt(val)))
      ) {

        const key = `year=${year}/month=${month}/day=${day}`;
        if (!prev[key]) {
          prev[key] = [];
        }
        // SK is unique because it is numbered by ULID.
        const item = { id: SK as string, logType, userId, apiKey, createAt, others };
        prev[key].push(item);
      }
    }
    return prev;
  }, Promise.resolve({}));

  const now = Date.now();

  const promises = Object.keys(recordMap).map((key) => {
    const items = recordMap[key];
    const body = zlib.gzipSync(JSON.stringify(items));

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
