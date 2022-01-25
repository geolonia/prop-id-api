import '.';
import { DynamoDBStreamHandler, DynamoDBRecord } from 'aws-lambda';
import AWS from 'aws-sdk';
import Sentry from './lib/sentry';
import { EstateId, DB } from './lib/dynamodb';
import { sendSlackNotification } from './lib/slack';
import type { PlainTextElement, MrkdwnElement, SectionBlock } from '@slack/types';

const _findDuplicateAddress = async (estateId: EstateId) => {
  const resp = await DB.query({
    TableName: process.env.AWS_DYNAMODB_ESTATE_ID_TABLE_NAME,
    IndexName: 'address-index',
    KeyConditionExpression: '#a = :a',
    ExpressionAttributeNames: {
      '#a': 'address',
      '#id': 'estateId',
    },
    ExpressionAttributeValues: {
      ':a': estateId.address,
      ':id': estateId.estateId,
    },
    FilterExpression: '#id <> :id',
    Select: 'COUNT',
  }).promise();
  const count = resp.Count;

  return (typeof count !== 'undefined' && count > 0);
};

const _findDuplicateTile = async (estateId: EstateId) => {
  const resp = await DB.query({
    TableName: process.env.AWS_DYNAMODB_ESTATE_ID_TABLE_NAME,
    IndexName: 'tileXY-index',
    KeyConditionExpression: '#t = :t',
    ExpressionAttributeNames: {
      '#t': 'tileXY',
      '#id': 'estateId',
    },
    ExpressionAttributeValues: {
      ':t': estateId.tileXY,
      ':id': estateId.estateId,
    },
    FilterExpression: '#id <> :id',
    Select: 'COUNT',
  }).promise();
  const count = resp.Count;

  return (typeof count !== 'undefined' && count > 0);
};

const _findDuplicates = async (id: EstateId) => {
  const [
    dupAddr,
    dupTile,
  ] = await Promise.all([
    _findDuplicateAddress(id),
    _findDuplicateTile(id),
  ]);
  const isPending = id.status === 'addressPending';
  const isDuplicated = dupAddr || dupTile;

  if (!isPending && !isDuplicated) {
    // Not pending and No duplicates found -- exit here.
    return;
  }

  const sectionBlocks = [];

  const pendingStr = isPending ? '• 不確かな番地・号に対する ID の発行\n' : '';
  const dupStr = isDuplicated ? '• 重複の可能性\n' : '';

  const checklistSection = {
    type: 'section',
    fields: [
      {
        type: 'mrkdwn',
        text: `*確認項目*:\n${pendingStr}${dupStr}`,
      },
    ],
  };
  if (isDuplicated) {
    const dupAddrStr = dupAddr ? '• 正規化済み住所\n' : '';
    const dupTileStr = dupTile ? '• タイル番号\n' : '';
    checklistSection.fields.push({
      type: 'mrkdwn',
      text: `*重複項目*:\n${dupAddrStr}${dupTileStr}`,
    });
  }

  const parameterSection = {
    type: 'section',
    fields: [
      {
        type: 'mrkdwn',
        text: `*ID*:\n\`${id.estateId}\``,
      },
    ],
  };
  if (dupTile) {
    parameterSection.fields.push({
      type: 'mrkdwn',
      text: `*タイル番号*:\n\`${id.tileXY}\``,
    });
  }

  const addressSection = {
    type: 'section',
    fields: [
      {
        type: 'mrkdwn',
        text: `*入力住所*:\n${id.rawAddress}`,
      },
      {
        type: 'mrkdwn',
        text: `*正規化住所*:\n${id.address}`,
      },
    ],
  };
  if (id.building) {
    addressSection.fields.push({
      type: 'mrkdwn',
      text: `*建物名*:\n${id.building}`,
    });
  }

  sectionBlocks.push(
    checklistSection,
    parameterSection,
    addressSection,
  );

  const channels = {
    local: 'dev-propid-id-notifications-dev',
    dev: 'dev-propid-id-notifications-dev',
    v1: 'dev-propid-id-notifications',
  };

  try {
    await sendSlackNotification({
      channel: channels[process.env.STAGE],
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: ':mag: 確認が必要な不動産共通 ID が発行されました',
          },
        },
        ...sectionBlocks,
      ],
    });
  } catch (e: any) {
    console.log('Slack notification failed with error: ', e);
  }
};

const _recordHandler = async (record: DynamoDBRecord) => {
  // We only will consider inserts. This means that modified records will not be processed twice.
  if (record.eventName !== 'INSERT') { return; }
  const newImageRaw = record.dynamodb?.NewImage;
  if (!newImageRaw) {
    console.error(record);
    throw new Error('New image was not available in record');
  }
  const newImage = AWS.DynamoDB.Converter.unmarshall(newImageRaw) as EstateId;
  // This notification doesn't work on redirected IDs yet.
  if ('canonicalId' in newImage) { return; }

  await _findDuplicates(newImage);
};

export const _handler: DynamoDBStreamHandler = async (event) => {
  const promises = event.Records.map(_recordHandler);
  await Promise.all(promises);
};

export const handler = Sentry.AWSLambda.wrapHandler(_handler);
