import { normalizeBanchiGo } from '../lib/dynamodb_logs';
import { normalize } from '../lib/nja';
import { _addBanchiGoHandler as addBanchiGoHandler } from './addBanchiGoHandler';
import { _handler as _publicHandler } from '../public'
import { authenticator, decorate, logger } from '../lib/decorators'
import * as dynamodb from '../lib/dynamodb'

// TODO: logger、authenticator をテストから分離する
const publicHandler = decorate(_publicHandler, [logger, authenticator('id-req')]);

test('error', async () => {
  const event = {
    body: JSON.stringify({}),
  }
  // @ts-ignore
  const { statusCode } = await addBanchiGoHandler(event)
  expect(statusCode).toBe(400)
});

test('add banchi go', async () => {
  const address = '滋賀県米原市大久保848-2' // TODO: 置き換える
  const normalizedResult = await normalize(address)
  const addBanchiGoevent = {
    body: JSON.stringify(normalizedResult),
  }

  const result1 = await normalizeBanchiGo(normalizedResult)
  expect(result1.level).toBeLessThanOrEqual(7)

  // @ts-ignore
  const { statusCode } = await addBanchiGoHandler(addBanchiGoevent)
  expect(statusCode).toBe(200)

  const result2 = await normalizeBanchiGo(normalizedResult)
  expect(result2.level).toBe(8)
  expect(result2.status).toBe('addressPending')

  const { apiKey, accessToken } = await dynamodb.createApiKey(`creates estate ID for ${address}`);
  const publicHandlerEvent = {
    queryStringParameters: { q: address, 'api-key': apiKey },
    headers: { 'X-Access-Token': accessToken },
  };

  // @ts-ignore
  const result3 = await publicHandler(publicHandlerEvent);
  // @ts-ignore
  const body = JSON.parse(result3.body)
  expect(body[0].ID).toBeDefined();
  expect(body[0].status).toEqual('addressPending')
});
