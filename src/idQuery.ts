import '.';
import { Handler, APIGatewayProxyResult } from 'aws-lambda';
import { incrementPGeocode } from './lib';
import { authenticateEvent } from './lib/authentication';
import { getEstateId } from './lib/dynamodb';
import { errorResponse, json } from './lib/proxy-response';
import Sentry from './lib/sentry';
import { normalize } from './lib/nja';

export const _handler: Handler<PublicHandlerEvent, APIGatewayProxyResult> = async (event) => {
  const quotaType = 'id-req';
  const authenticationResult = await authenticateEvent(event, quotaType);
  if ('statusCode' in authenticationResult) {
    return authenticationResult;
  }

  const quotaParams = {
    quotaLimit: authenticationResult.quotaLimit,
    quotaRemaining: authenticationResult.quotaRemaining,
    quotaResetDate: authenticationResult.quotaResetDate,
  };

  const estateId = event.pathParameters?.estateId;
  if (!estateId) {
    return errorResponse(400, 'Missing estate ID.', quotaParams);
  }

  const estateIdObj = await getEstateId(estateId);

  if (!estateIdObj) {
    return json(
      {
        error: true,
        error_description: 'not_found',
      },
      quotaParams,
      404
    );
  }

  const prenormalizedAddress = await normalize(estateIdObj.rawAddress);

  const idOut: any = {
    ID: estateIdObj.estateId,
    normalization_level: prenormalizedAddress.level.toString(),
  };

  if (authenticationResult.plan === 'paid') {
    const ipcResult = await incrementPGeocode(estateIdObj.address);
    if (!ipcResult) {
      return errorResponse(500, 'Internal server error', quotaParams);
    }

    const {
      feature,
    } = ipcResult;

    const [lng, lat] = feature.geometry.coordinates as [number, number];
    const { geocoding_level } = feature.properties;

    const location = {
      lat: lat.toString(),
      lng: lng.toString(),
    };

    const addressObject = {
      ja: {
        prefecture: prenormalizedAddress.pref,
        city: prenormalizedAddress.city,
        address1: prenormalizedAddress.town,
        address2: prenormalizedAddress.addr,
        other: estateIdObj.building ? estateIdObj.building : '',
      },
    };

    idOut.geocoding_level = geocoding_level.toString(),
    idOut.location = location;
    idOut.address = addressObject;
  }

  return json([ idOut ], quotaParams);
};

export const handler = Sentry.AWSLambda.wrapHandler(_handler);
