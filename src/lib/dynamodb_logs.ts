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

  latLng?: [string, string]

  createdBy: string
  updatedBy: string
  createdAt: string
  updatedAt: string
}

export const createLog = async (
  logIdentifier: string,
  metadata: { [key: string]: any },
  userIdentifier: { apiKey?: string, userId?: string } = {},
  now: Date = new Date(),
): Promise<{ PK: string, SK: string }> => {
  const nowStr = now.toISOString();
  const datePart = nowStr.slice(0, 10);
  const PK = `LOG#${logIdentifier}#${datePart}`;
  const SK = ulid(now.getTime());

  const { apiKey, userId } = userIdentifier;

  const item = {
    PK,
    SK,
    userId,
    apiKey,
    createAt: nowStr,
    ...metadata,
  };

  await DB.put({
    TableName,
    Item: item,
  }).promise();

  return item;
};

export const getLog = (PK: string, SK: string) => DB.get({
  TableName,
  Key: { PK, SK },
}).promise().catch(() => false);


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

export const normalizeBanchiGo: (prenormalized: NormalizeResult, ignoreBuilding: boolean) => Promise<NormalizeResult & { int_geocoding_level?: number }>
  =
  async (nja: NormalizeResult, ignoreBuilding = false) => {

    if (ignoreBuilding) {
      const { Item: item } = await DB.get({
        TableName,
        Key: { PK: `AddrDB#${nja.pref}${nja.city}${nja.town}`, SK: nja.addr },
      }).promise();
      const narrowedNormal = {
        ...nja,
        building: '',
        int_geocoding_level: 0,
      };
      if (item) {
        // 番地号まで認識できた
        narrowedNormal.level = 8;
        if (typeof item.latLng !== 'undefined') {
          narrowedNormal.lat = parseFloat(item.latLng[0]);
          narrowedNormal.lng = parseFloat(item.latLng[1]);
          if (!Number.isNaN(narrowedNormal.lat) && !Number.isNaN(narrowedNormal.lng)) {
            narrowedNormal.int_geocoding_level = 8;
          }
        }
      } else {
        // 号情報がそもそも存在しない
        narrowedNormal.level = 7;
      }
      return narrowedNormal;
    }

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
          int_geocoding_level: 0,
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
          if (!Number.isNaN(narrowedNormal.lat) && !Number.isNaN(narrowedNormal.lng)) {
            narrowedNormal.int_geocoding_level = 8;
          }
        }
        return narrowedNormal;
      }
    }

    return nja;
  };
