import { errorResponse, json } from '../lib/proxy-response';
import { DB, createApiKey } from '../lib/dynamodb';
import { hashTokenV2, randomToken } from '../lib';
import { auth0ManagementClient } from '../lib/auth0_client';

interface RawApiKey {
  apiKey: string
  description: string
  plan: string
  accessToken?: string
  lastRequestAt: number
  hashedToken?: string
  /** User ID */
  GSI1PK: string
  /** Created at timestamp (ISO-8601) */
  GSI1SK: string
}

const transformApiKey = (key: RawApiKey) => ({
  apiKey: key.apiKey,
  description: key.description,
  plan: key.plan,
  userId: key.GSI1PK,
  createdAt: key.GSI1SK,
});

export const list: AdminHandler = async (event) => {
  const keysResp = await DB.query({
    TableName: process.env.AWS_DYNAMODB_API_KEY_TABLE_NAME,
    IndexName: 'GSI1PK-GSI1SK-index',
    KeyConditionExpression: '#userId = :userId',
    ExpressionAttributeNames: {
      '#userId': 'GSI1PK',
    },
    ExpressionAttributeValues: {
      ':userId': event.userId,
    },
  }).promise();
  const keys = keysResp.Items as RawApiKey[];

  return json({
    error: false,
    keys: keys.map(transformApiKey),
  });
};

export const create: AdminHandler = async (event) => {
  const auth0 = await auth0ManagementClient();
  const user = await auth0.getUser({id: event.userId});

  const plan = user.app_metadata?.plan || 'paid';

  const apiKey = await createApiKey(
    'デフォルトAPIキー',
    {
      plan,
      GSI1PK: event.userId,
      GSI1SK: (new Date().toISOString()),
    }
  );

  return json({
    error: false,
    key: {
      apiKey: apiKey.apiKey,
      accessToken: apiKey.accessToken,
      plan,
    },
  });
};

export const reissue: AdminHandler = async (event) => {
  const apiKey = event.pathParameters?.keyId;
  if (!apiKey) {
    return errorResponse(404, 'key not found');
  }

  const keyResp = await DB.get({
    TableName: process.env.AWS_DYNAMODB_API_KEY_TABLE_NAME,
    Key: { apiKey },
  }).promise();
  if (!keyResp.Item) {
    return errorResponse(404, 'key not found');
  }

  if (keyResp.Item.GSI1PK !== event.userId) {
    // Oops, wrong user's key
    return errorResponse(404, 'key not found');
  }

  const newAccessToken = randomToken(32);
  const hashedToken = await hashTokenV2(apiKey, newAccessToken);
  await DB.update({
    TableName: process.env.AWS_DYNAMODB_API_KEY_TABLE_NAME,
    Key: { apiKey },
    UpdateExpression: 'set #ht = :ht',
    ExpressionAttributeNames: {
      '#ht': 'hashedToken',
    },
    ExpressionAttributeValues: {
      ':ht': hashedToken,
    },
  }).promise();

  return json({
    error: false,
    key: {
      apiKey: apiKey,
      accessToken: newAccessToken,
      plan: keyResp.Item.plan,
    },
  });
};
