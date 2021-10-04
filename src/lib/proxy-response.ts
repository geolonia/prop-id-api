import util from 'util';

type HeadersParams = {
  quotaLimit: number,
  quotaRemaining: number,
  quotaResetDate: string | false
} | undefined;

export const createHeaders = (params: HeadersParams): { [key: string]: string } => {
  let customHeaders = {};
  if (params) {
    const { quotaLimit, quotaRemaining, quotaResetDate } = params;
    customHeaders = {
      'X-RateLimit-Limit': `${quotaLimit}`,
      'X-RateLimit-Remaining': `${quotaRemaining}`,
      'X-RateLimit-Reset': `${quotaResetDate}`,
    };
  }
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Headers': 'x-access-token, authorization',
    'Access-Control-Allow-Origin': '*', // CORS origin authentication is done using API Gateway
    'Cache-Control': 'no-store, max-age=0',
    ...customHeaders,
  };
};

export const errorResponse = (statusCode: number, message: string, meta?: HeadersParams, ...variables: string[]) => {
  return {
    statusCode,
    headers: createHeaders(meta),
    body: JSON.stringify({
      message: util.format(message, ...variables),
    }),
  };
};

export const json = (body: object, meta?: HeadersParams, statusCode = 200 ) => {

  return {
    statusCode,
    headers: createHeaders(meta),
    body: JSON.stringify(body),
  };
};
