import { incrementPGeocode } from '../lib';
import { getEstateId, store } from '../lib/dynamodb';
import { errorResponse, json } from '../lib/proxy-response';
import { joinNormalizeResult, normalize } from '../lib/nja';
import { extractBuildingName, normalizeBuildingName } from '../lib/building_normalization';
import { createLog, withLock } from '../lib/dynamodb_logs';

import type {  StoreEstateIdReq } from '../lib/dynamodb';
import type { AuthenticatorContext, LoggerContext } from '../lib/decorators';
import type { IdQueryOut } from './';
import { auth0ManagementClient } from '../lib/auth0_client';

export const _splitHandler: PropIdHandler = async (event, context) => {

  const {
    propIdAuthenticator: { authentication, quotaParams },
    propIdLogger: { background },
  } = context as AuthenticatorContext & LoggerContext;

  const estateId = event.pathParameters?.estateId;
  if (!estateId) {
    return errorResponse(400, 'Missing estate ID.', quotaParams);
  }

  const { lat: latStr = '', lng: lngStr = '', building } = event.queryStringParameters || {};
  const { currentAddress, idSplit: { confirm } } = JSON.parse(event.body || '').feedback;
  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);

  if (Number.isNaN(lat) || Number.isNaN(lng) || !building) {
    return errorResponse(400, 'Invalid query lat, lng or building.', quotaParams);
  }

  const estateIdObj = await getEstateId(estateId);
  const normalizedBuilding = normalizeBuildingName(building);

  if (!estateIdObj) {
    return errorResponse(404, 'The given Prop ID is not found.', quotaParams);
  } else if (estateIdObj.building === normalizedBuilding) {
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
    building: normalizedBuilding,
    prefCode: prefCode,
    status: 'addressPending',
  };

  const prenormalizedResult = await normalize(estateIdObj.rawAddress);

  const finalAddress = joinNormalizeResult(prenormalizedResult);
  const lockId = `${finalAddress}/${normalizedBuilding}`;
  const splitIdObj = await withLock(lockId, () => store(storeParams, { location: { lat, lng } }));

  const idOut: IdQueryOut = {
    ID: splitIdObj.estateId,
    normalization_level: prenormalizedResult.level.toString(),
    status: splitIdObj.status === 'addressPending' ? 'addressPending' : null,

    address: {
      ja: {
        prefecture: prenormalizedResult.pref,
        city: prenormalizedResult.city,
        address1: prenormalizedResult.town,
        address2: prenormalizedResult.addr,
        other: normalizedBuilding,
      },
    },
  };

  if (authentication.plan === 'paid') {
    const ipcResult = await incrementPGeocode(estateIdObj.address);
    if (!ipcResult) {
      return errorResponse(500, 'Internal server error', quotaParams);
    }

    const { feature } = ipcResult;
    // NOTE: Use the location submitted by the user
    const location = { lat: lat.toString(), lng: lng.toString() };

    const { geocoding_level } = feature.properties;

    const extracted = extractBuildingName(estateIdObj.address, prenormalizedResult, ipcResult);

    const addressObject = {
      ja: {
        prefecture: extracted.pref,
        city: extracted.city,
        address1: extracted.town,
        address2: extracted.addr,
        other: extracted.building || building,
      },
    };

    idOut.geocoding_level = geocoding_level.toString(),
    idOut.location = location;
    idOut.address = addressObject;
  }

  if (event.preauthenticatedUserId) {
    const auth0 = await auth0ManagementClient();
    const user = await auth0.getUser({ id: event.preauthenticatedUserId });

    background.push(createLog('feedbackRequest', {
      userEmail: user.email,
      feedback: {
        feedbackType: 'idSplit',
        currentAddress,
        id: estateId,
        idSplit: {
          dest: splitIdObj.estateId,
          latLng: [latStr, lngStr].join(','),
          building,
          confirm,
        },
      },
    }, {
      userId: event.preauthenticatedUserId,
    })
      .then(({ PK, SK }) =>
        createLog(
          'feedbackRequestReview',
          { feedbackLogId: { PK, SK }, review: 'resolved', slack_user: null }
        )
      ));
  }

  return json([idOut]);
};
