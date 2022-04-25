import '.';
import { incrementPGeocode } from './lib';
import { getEstateId, store, StoreEstateIdReq } from './lib/dynamodb';
import { errorResponse, json } from './lib/proxy-response';
import Sentry from './lib/sentry';
import { normalize } from './lib/nja';
import { extractBuildingName, normalizeBuildingName } from './lib/building_normalization';
import { authenticator, AuthenticatorContext, decorate, Decorator } from './lib/decorators';
import { String } from 'aws-sdk/clients/apigateway';

export type IdQueryOut = {
  ID: string
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

export const _handler: PropIdHandler = async (event, context) => {

  const {
    propIdAuthenticator: {
      authentication,
      quotaParams,
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
        other: estateIdObj.building ? estateIdObj.building : '',
      },
    };

    idOut.geocoding_level = geocoding_level.toString(),
    idOut.location = location;
    idOut.address = addressObject;
  }

  return json([ idOut ], quotaParams);
};

export const _splitHandler: PropIdHandler = async (event, context) => {

  const {
    propIdAuthenticator: { quotaParams },
  } = context as AuthenticatorContext;

  const estateId = event.pathParameters?.estateId;
  if (!estateId) {
    return errorResponse(400, 'Missing estate ID.', quotaParams);
  }

  const { lat: latStr = '', lng: lngStr  = '', building } = event.queryStringParameters || {};
  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);

  if (Number.isNaN(lat) || Number.isNaN(lng) || !building) {
    return errorResponse(400, 'Invalid query lat, lng or building.', quotaParams);
  }

  const estateIdObj = await getEstateId(estateId);
  const normalizedBuidingName = normalizeBuildingName(building);

  if (!estateIdObj) {
    return errorResponse(404, 'The given Prop ID is not found.', quotaParams);
  } else if (estateIdObj.building === normalizedBuidingName) {
    return errorResponse(400, 'The given building name is duplicated.', quotaParams);
  }

  const baseEstateId = estateIdObj.estateId;
  const prefCode = baseEstateId.slice(0, 2);

  const storeParams: StoreEstateIdReq = {
    zoom: estateIdObj.zoom,
    tileXY: estateIdObj.tileXY,
    rawAddress: estateIdObj.rawAddress,
    address: estateIdObj.address,
    rawBuilding: building,
    building: normalizedBuidingName,
    prefCode: prefCode,
    status: 'addressPending',
  };

  // TODO: lock
  const splitIdObj = await store(storeParams, { location: { lat, lng } });

  const prenormalizedResult = await normalize(splitIdObj.rawAddress);

  const idOut: Required<IdQueryOut> = {
    ID: splitIdObj.estateId,
    normalization_level: prenormalizedResult.level.toString(),
    status: splitIdObj.status === 'addressPending' ? 'addressPending' : null,

    // ID 分割時は建物名と緯度経度をユーザーから受け付けているため、geocoding_level は 9 になる
    // TODO: IDQuery でいつも 9がちゃんと帰ってくる？確認
    geocoding_level: '9',
    location: { lat: lat.toString(), lng: lng.toString() },
    address: {
      ja: {
        prefecture: prenormalizedResult.pref,
        city: prenormalizedResult.city,
        address1: prenormalizedResult.town,
        address2: prenormalizedResult.addr,
        other: normalizedBuidingName,
      },
    },
  };

  return json([ idOut ]);
};

const rootHandler: PropIdHandler = async (event, context, callback) => {
  if (event.resource === '/{estateId}' && event.httpMethod === 'GET') {
    return await _handler(event, context, callback);
  } else if (event.resource === '/{estateId}/split' && event.httpMethod === 'POST') {
    return await _splitHandler(event, context, callback);
  } else {
    return errorResponse(404, 'Not found');
  }
};

export const handler = decorate(rootHandler,
  [
    authenticator('id-req'),
    Sentry.AWSLambda.wrapHandler as Decorator,
  ]
);
