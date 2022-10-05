import { incrementPGeocode } from '../lib';
import { getEstateId } from '../lib/dynamodb';
import { errorResponse, json } from '../lib/proxy-response';
import { normalize } from '../lib/nja';
import { extractBuildingName } from '../lib/building_normalization';

import type { AuthenticatorContext } from '../lib/decorators';
import type { IdQueryOut } from './';


export const _queryHandler: PropIdHandler = async (event, context) => {

  const {
    propIdAuthenticator: {
      authentication, quotaParams,
    },
  } = context as AuthenticatorContext;

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

  const idOut: IdQueryOut = {
    ID: estateIdObj.estateId,
    normalization_level: prenormalizedAddress.level.toString(),
    status: estateIdObj.status === 'addressPending' ? 'addressPending' : null,
  };

  if (authentication.plan === 'paid') {
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

    const extracted = extractBuildingName(estateIdObj.address, prenormalizedAddress, ipcResult);

    const addressObject = {
      ja: {
        prefecture: extracted.pref,
        city: extracted.city,
        address1: extracted.town,
        address2: extracted.addr,
        other: extracted.building || estateIdObj.building || '',
      },
    };

    idOut.geocoding_level = geocoding_level.toString(),
    idOut.location = estateIdObj.userLocation ? {
      lat: estateIdObj.userLocation.lat.toString(),
      lng: estateIdObj.userLocation.lng.toString(),
    } : location;
    idOut.address = addressObject;
  }

  return json([idOut], quotaParams);
};
