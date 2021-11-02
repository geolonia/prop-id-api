import { DB } from './dynamodb';
import { ulid } from 'ulid';
import { sleep } from './util';

export const TableName = process.env.AWS_DYNAMODB_LOG_TABLE_NAME;

export const createLog = async (identifier: string, metadata: { [key: string]: any }, now: Date = new Date()): Promise<void> => {
  const nowStr = now.toISOString();
  const datePart = nowStr.slice(0, 10);
  const PK = `LOG#${identifier}#${datePart}`;
  const SK = ulid(now.getTime());

  await DB.put({
    TableName,
    Item: {
      PK,
      SK,
      ...metadata,
    },
  }).promise();
};

export const withLock = async <T = any>(lockId: string, inner: () => Promise<T>): Promise<T> => {
  // Get lock
  let tries = 0, lockAcquired = false;
  while (tries < 6) {
    tries++;
    try {
      await DB.put({
        TableName,
        Item: {
          PK: `Lock#${lockId}`,
          SK: 'LOCK',

          // This lock isn't designed to be held for a long time, so they
          // expire 30 seconds after they're taken.
          // We are going to delete it ourselves, but there's a very slight chance
          // that our script gets interrupted before the lock is deleted.
          // Using the ttl makes sure we don't have any dangling locks.
          ttl: (new Date().getTime() / 1000) + 30,
        },
        ConditionExpression: 'attribute_not_exists(#pk)',
        ExpressionAttributeNames: {
          '#pk': 'PK',
        },
      }).promise();
      lockAcquired = true;
      // We successfully got the lock.
      break;
    } catch (e: any) {
      if (e.code === 'ConditionalCheckFailedException') {
        // Try again
      } else {
        throw e;
      }
    }
    await sleep(50);
  }

  if (!lockAcquired) {
    throw new Error(`lock ${lockId} could not be acquired after ${tries} tries`);
  }

  try {
    return await inner();
  } finally {
    // Release lock
    await DB.delete({
      TableName,
      Key: {
        PK: `Lock#${lockId}`,
        SK: 'LOCK',
      },
    }).promise();
  }
};
