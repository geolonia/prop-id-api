import '..';
import { errorResponse } from '../lib/proxy-response';
import Sentry from '../lib/sentry';
import { authenticator, decorate, Decorator } from '../lib/decorators';
import { String } from 'aws-sdk/clients/apigateway';
import { _splitHandler } from './splitHandler';
import { _queryHandler } from './queryHandler';

export type IdQueryOut = {
  ID: string
  spatialId?: {
    id: string
    alt: number
  } | null
  normalization_level: string
  status: 'addressPending' | null

  // paid response
  geocoding_level?: String
  location?: { lat: string, lng: string }
  address?: {
    ja: {
      prefecture: string
      city: string
      address1: string
      address2: string
      other: string
    },
  }
};

const rootHandler: PropIdHandler = async (event, context, callback) => {
  if (event.resource === '/{estateId}' && event.httpMethod === 'GET') {
    return await _queryHandler(event, context, callback);
  } else if (event.resource === '/{estateId}/split' && event.httpMethod === 'POST') {
    return await _splitHandler(event, context, callback);
  } else {
    return errorResponse(404, 'Not found');
  }
};

export const handler = decorate(
  rootHandler,
  [
    authenticator('id-req'),
    Sentry.AWSLambda.wrapHandler as Decorator,
  ]
);
