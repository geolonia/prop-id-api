import { DB } from './dynamodb';
import { ulid } from 'ulid';
import { sleep } from './util';
import { NormalizeResult } from '../lib/nja';

export const TableName = process.env.AWS_DYNAMODB_LOG_TABLE_NAME;

export interface AddressDatabaseRecord {
  /** Partition key.
   * in the format: `AddrDB#${pref}${city}${town}`
   */
  PK: `AddrDB#${string}`

  /** Sort key.
   * in the format: `${banchi}-${go}`
  */
  SK: string

  latLng?: [ string, string ]

  createdBy: string
  updatedBy: string
  createdAt: string
  updatedAt: string
}

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
  // 15 tries * 50ms = we'll keep trying to acquire the lock for about 750ms
  while (tries <= 15) {
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
          ttl: Math.trunc((new Date().getTime() / 1000) + 30),
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

export const normalizeBanchiGo: (prenormalized: NormalizeResult) => Promise<NormalizeResult>
  =
async (nja: NormalizeResult) => {
  const dbItems = await DB.query({
    TableName,
    KeyConditionExpression: '#pk = :pk',
    ExpressionAttributeNames: {
      '#pk': 'PK',
    },
    ExpressionAttributeValues: {
      ':pk': `AddrDB#${nja.pref}${nja.city}${nja.town}`,
    },
  }).promise();

  const items = (dbItems.Items || []) as AddressDatabaseRecord[];
  items.sort((a, b) => b.SK.length - a.SK.length);
  for (const item of items) {
    if (nja.addr.startsWith(item.SK)) {
      // we have a match
      const narrowedNormal = {
        ...nja,
        addr: item.SK,
        building: nja.addr.slice(item.SK.length).trim(),
      };
      if (item.SK.indexOf('-') > 0) {
        // 番地号まで認識できた
        narrowedNormal.level = 8;
      } else {
        // 号情報がそもそも存在しない
        narrowedNormal.level = 7;
      }
      if (typeof item.latLng !== 'undefined') {
        narrowedNormal.lat = parseFloat(item.latLng[0]);
        narrowedNormal.lng = parseFloat(item.latLng[1]);
      }
      return narrowedNormal;
    }
  }

  return nja;
};
