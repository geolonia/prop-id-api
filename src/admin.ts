import '.';
import Sentry from './lib/sentry';
import { APIGatewayProxyResult, Handler } from 'aws-lambda';
import { errorResponse } from './lib/proxy-response';
import jwt from 'jsonwebtoken';
import jwks from 'jwks-rsa';

import * as keys from './admin/keys';
import * as feedback from './admin/feedback';
import * as feedbackReaction from './admin/feedback_reaction';
import { _handler as publicHandler } from './public';
import { _queryHandler as idQueryHandler } from './idQuery/queryHandler';
import { _splitHandler as idQuerySplitHandler } from './idQuery/splitHandler';

import { decapitalize } from './lib';
import { AUTH0_DOMAIN, AUTH0_MGMT_DOMAIN } from './lib/auth0_client';
import { authenticator, decorate, logger } from './lib/decorators';

const jwksClient = jwks({
  cache: true,
  cacheMaxAge: 600000,
  rateLimit: true,
  jwksRequestsPerMinute: 5,
  jwksUri: `https://${AUTH0_DOMAIN}/.well-known/jwks.json`,
});

const _handler: Handler<PublicHandlerEvent, void | APIGatewayProxyResult> = async (event, context, callback) => {

  // POST from Slack interaction
  if (event.resource === '/admin/feedback_reaction' && event.httpMethod === 'POST') {
    return feedbackReaction.handler(event);
  }

  const headers = decapitalize(event.headers);
  const tokenHeader = headers['authorization'];
  if (!tokenHeader || !tokenHeader.match(/^bearer /i)) {
    console.log('Couldn\'t find authorization header.');
    return errorResponse(401, 'Not authenticated');
  }

  const token = tokenHeader.substr(7);
  const decodedToken = jwt.decode(token, { complete: true });
  const kid = decodedToken?.header.kid;
  if (!kid) {
    console.log('Token couldn\'t be decoded');
    return errorResponse(401, 'Not authenticated');
  }
  let userId: string | undefined = undefined;
  try {
    const signingKey = await jwksClient.getSigningKey(kid);
    const verifiedToken = jwt.verify(token, signingKey.getPublicKey(), {
      audience: 'https://api.propid.jp',
      algorithms: ['RS256'],
      issuer: [
        `https://${AUTH0_DOMAIN}/`,
        `https://${AUTH0_MGMT_DOMAIN}/`,
      ],
    }) as { [key: string]: any };
    userId = verifiedToken.sub;
  } catch (e: any) {
    if (
      e.name !== 'JsonWebTokenError' &&
      e.name !== 'NotBeforeError' &&
      e.name !== 'TokenExpiredError'
    ) {
      throw e;
    }
    console.log('Token verification error: ', e.name, JSON.stringify(e));
  }
  if (!userId) {
    return errorResponse(401, 'Not authenticated');
  }

  const adminEvent: AdminHandlerEvent = {
    ...event,
    userId,
  };

  if (event.resource === '/admin/keys' && event.httpMethod === 'GET') {
    return keys.list(adminEvent);
  } else if (event.resource === '/admin/keys' && event.httpMethod === 'POST') {
    return keys.create(adminEvent);
  } else if (event.resource === '/admin/keys/{keyId}/reissue' && event.httpMethod === 'PATCH') {
    return keys.reissue(adminEvent);
  } else if (event.resource === '/admin/query' && event.httpMethod === 'GET') {
    event.preauthenticatedUserId = userId;
    event.isDebugMode = event.queryStringParameters?.debug === 'true';
    const handler = decorate(publicHandler, [logger, authenticator('id-req')]);
    return await handler(event, context, callback);
  } else if (event.resource === '/admin/query/{estateId}' && event.httpMethod === 'GET') {
    event.preauthenticatedUserId = userId;
    event.isDebugMode = event.queryStringParameters?.debug === 'true';
    const handler = decorate(idQueryHandler, [logger, authenticator('id-req')]);
    return await handler(event, context, callback);
  } else if (event.resource === '/admin/query/{estateId}/split' && event.httpMethod === 'POST') {
    event.preauthenticatedUserId = userId;
    event.isDebugMode = event.queryStringParameters?.debug === 'true';
    const handler = decorate(idQuerySplitHandler, [logger, authenticator('id-req')]);
    return await handler(event, context, callback);
  } else if (event.resource === '/admin/feedback' && event.httpMethod === 'POST') {
    return feedback.create(adminEvent);
  }
  return errorResponse(404, 'Not found');
};

export const handler = Sentry.AWSLambda.wrapHandler(_handler);
