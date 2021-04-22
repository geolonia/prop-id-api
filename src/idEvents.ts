import '.'
import { DynamoDBStreamHandler, DynamoDBRecord } from 'aws-lambda'
import AWS from 'aws-sdk'
import Sentry from './lib/sentry'
import { EstateId, DB } from './lib/dynamodb'
import { sendSlackNotification } from './lib/slack'
import { PlainTextElement, MrkdwnElement } from "@slack/types"

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
  }).promise()
  const count = resp.Count

  return (typeof count !== 'undefined' && count > 0)
}

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
  }).promise()
  const count = resp.Count

  return (typeof count !== 'undefined' && count > 0)
}

const _findDuplicates = async (id: EstateId) => {
  const [
    dupAddr,
    dupTile,
  ] = await Promise.all([
    _findDuplicateAddress(id),
    _findDuplicateTile(id),
  ])

  const fields: (PlainTextElement | MrkdwnElement)[] = []

  if (dupAddr || dupTile) {
    const dupAddrStr = dupAddr ? "正規化済み住所\n" : ""
    const dupTileStr = dupTile ? "タイル番号\n" : ""
    fields.push({
      type: "mrkdwn",
      text: `*重複項目*\n${dupAddrStr}${dupTileStr}`
    })
  }

  fields.push({
    type: "mrkdwn",
    text: `*ID*\n\`${id.estateId}\``,
  })
  fields.push({
    type: "mrkdwn",
    text: `*正規化済み住所*\n${id.address}`,
  })
  fields.push({
    type: "mrkdwn",
    text: `*入力住所*\n${id.rawAddress}`,
  })

  if (id.building) {
    fields.push({
      type: "mrkdwn",
      text: `*建物名*\n${id.building}`,
    })
  }

  const channels = {
    local: "dev-propid-id-notifications-dev",
    dev: "dev-propid-id-notifications-dev",
    v1: "dev-propid-id-notifications",
  }

  await sendSlackNotification({
    channel: channels[process.env.STAGE],
    blocks: [
      {
        type: "section",
        text: {
          type: "plain_text",
          text: "重複する可能性がある不動産共通ID新規作成されました。"
        }
      },
      {
        type: "section",
        fields,
      }
    ]
  })
}

const _recordHandler = async (record: DynamoDBRecord) => {
  // We only will consider inserts. This means that modified records will not be processed twice.
  if (record.eventName !== "INSERT") { return }
  const newImage = AWS.DynamoDB.Converter.unmarshall(record.dynamodb?.NewImage!) as EstateId
  // This notification doesn't work on redirected IDs yet.
  if ('canonicalId' in newImage) { return }

  await _findDuplicates(newImage)
}

export const _handler: DynamoDBStreamHandler = async (event) => {
  const promises = event.Records.map(_recordHandler)
  await Promise.all(promises)
}

export const handler = Sentry.AWSLambda.wrapHandler(_handler)
