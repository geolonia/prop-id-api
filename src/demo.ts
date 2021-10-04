import '.';
import { _handler as publicHandler } from './public';
import { _handler as idQueryHandler } from './idQuery';
import { decapitalize } from './lib/index';
import { errorResponse } from './lib/proxy-response';
import Sentry from './lib/sentry';
import { APIGatewayProxyResult, Handler } from 'aws-lambda';

const refererHeads = [
  'http://127.0.0.1:',
  'http://localhost:',
  'https://geolonia.github.io',
  'https://app.propid.jp',
];

const _handler: Handler<PublicHandlerEvent, APIGatewayProxyResult> = async (event, context, callback) => {
  const headers = decapitalize(event.headers);
  const { referer, origin } = headers;
  const allowedReferer = referer && refererHeads.some((refererHead) => referer.indexOf(refererHead) === 0);
  const allowedOrigin = origin && refererHeads.some((refererHead) => origin.indexOf(refererHead) === 0);

  if (!(allowedReferer || allowedOrigin)) {
    return errorResponse(403, 'Access denied.');
  }

  event.isDebugMode = event.queryStringParameters?.debug === 'true';
  event.isDemoMode = true;

  let proxyHandler: Handler<PublicHandlerEvent, APIGatewayProxyResult> | undefined = undefined;
  if (event.resource === '/demo') {
    proxyHandler = publicHandler;
  } else if (event.resource === '/demo/{estateId}') {
    proxyHandler = idQueryHandler;
  }

  if (!proxyHandler) {
    return errorResponse(404, 'Not found');
  }

  const arguedProxyResult = await proxyHandler(
    event,
    context,
    callback,
  ) as APIGatewayProxyResult;

  const proxyResult = {
    ...arguedProxyResult,
    headers: {
      ...arguedProxyResult.headers,
      'Access-Control-Allow-Origin': '*',
    },
  };
  return proxyResult;
};

export const handler = Sentry.AWSLambda.wrapHandler(_handler);
