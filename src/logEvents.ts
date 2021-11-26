import '.';
import { DynamoDBStreamHandler } from 'aws-lambda';
import { Parser as Json2csvParser } from 'json2csv';
import zlib from 'zlib';
import AWS from 'aws-sdk';
import Sentry from './lib/sentry';

const s3 = new AWS.S3();

export const _handler: DynamoDBStreamHandler = async (event) => {
  const recordMap = event.Records.reduce<{ [key: string]: any }>((prev, record) => {
    if (
      record.eventName === 'INSERT' &&
      record.dynamodb &&
      record.dynamodb.NewImage
    ) {
      const item = AWS.DynamoDB.Converter.unmarshall(record.dynamodb.NewImage);

      const {
        PK,
        SK,
        userId,
        apiKey,
        createAt,
      } = item;

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
        const item = { id: SK as string, logType, userId, apiKey, createAt };
        prev[key].push(item);
      }
    }
    return prev;
  }, {});

  const now = Date.now();

  const promises = Object.keys(recordMap).map((key) => {
    const items = recordMap[key];

    const json2csvParser = new Json2csvParser();
    const csv = json2csvParser.parse(items);
    const body = zlib.gzipSync(csv);

    return s3.putObject({
      Bucket: process.env.AWS_S3_LOG_STREAM_OUTPUT_BUCKET_NAME,
      Key: `${key}/${now}.csv.gz`,
      Body: body,
      ContentEncoding: 'gzip',
    }).promise();
  });
  await Promise.all(promises);
};

export const handler = Sentry.AWSLambda.wrapHandler(_handler);
