import '.';
import { BaseEstateId, getEstateIdForAddress, store, StoreEstateIdReq } from './lib/dynamodb';
import { coord2XY, getPrefCode, incrementPGeocode, normalizeBuilding } from './lib/index';
import { errorResponse, json } from './lib/proxy-response';
import Sentry from './lib/sentry';
import { normalize } from './lib/nja';
import { Handler, APIGatewayProxyResult } from 'aws-lambda';
import { authenticateEvent, extractApiKey } from './lib/authentication';
import { createLog } from './lib/dynamodb_logs';
import { ipcNormalizationErrorReport } from './outerApiErrorReport';

const NORMALIZATION_ERROR_CODE_DETAILS = [
  'prefecture_not_recognized',
  'city_not_recognized',
];

export const _handler: Handler<PublicHandlerEvent, APIGatewayProxyResult> = async (event) => {
  const address = event.queryStringParameters?.q;
  const building = event.queryStringParameters?.building;
  const ZOOM = parseInt(process.env.ZOOM, 10);
  const quotaType = 'id-req';

  const { apiKey } = extractApiKey(event);
  const authenticationResult = await authenticateEvent(event, quotaType);
  if ('statusCode' in authenticationResult) {
    return authenticationResult;
  }

  const quotaParams = {
    quotaLimit: authenticationResult.quotaLimit,
    quotaRemaining: authenticationResult.quotaRemaining,
    quotaResetDate: authenticationResult.quotaResetDate,
  };

  if (!address) {
    return errorResponse(400, 'Missing querystring parameter `q`.', quotaParams);
  }

  const background: Promise<any>[] = [];
  Sentry.setContext('query', {
    address,
    debug: event.isDebugMode,
  });
  Sentry.setUser({
    id: event.isDemoMode ? 'demo' : apiKey,
  });

  // Internal normalization
  const prenormalizedAddress = await normalize(address);
  const normalizedAddressNJA = `${prenormalizedAddress.pref}${prenormalizedAddress.city}${prenormalizedAddress.town}${prenormalizedAddress.addr}`;
  const normalizedBuilding = normalizeBuilding(building);

  background.push(createLog('normLogsNJA', {
    input: address,
    level: prenormalizedAddress.level,
    nja: normalizedAddressNJA,
    normalized: JSON.stringify(prenormalizedAddress),
  }));
  if (building) {
    background.push(createLog('buildingLogs', {
      level: prenormalizedAddress.level,
      nja: normalizedAddressNJA,
      normalized: JSON.stringify(prenormalizedAddress),
      building,
    }));
  }

  if (prenormalizedAddress.level < 2) {
    const error_code_detail = NORMALIZATION_ERROR_CODE_DETAILS[prenormalizedAddress.level];
    await Promise.all(background);
    return json(
      {
        error: true,
        error_code: 'normalization_failed',
        error_code_detail,
        address,
      },
      quotaParams,
      400
    );
  }

  if (!prenormalizedAddress.town || prenormalizedAddress.town === '') {
    background.push(createLog('normFailNoTown', {
      input: address,
    }));
  }

  const ipcResult = await incrementPGeocode(normalizedAddressNJA);

  if (!ipcResult) {
    Sentry.captureException(new Error('IPC result null'));
    background.push(ipcNormalizationErrorReport('normFailNoIPCGeomNull', {
      input: normalizedAddressNJA,
    }));
    await Promise.all(background);
    return errorResponse(500, 'Internal server error', quotaParams);
  }

  const {
    feature,
    cacheHit,
  } = ipcResult;

  // Features not found
  if (!feature || feature.geometry === null) {
    Sentry.captureException(new Error(`The address '${address}' is not verified.`));

    background.push(createLog('normFailNoIPCGeom', {
      input: address,
      prenormalized: normalizedAddressNJA,
      ipcResult: JSON.stringify(ipcResult),
    }));
    background.push(ipcNormalizationErrorReport('normFailNoIPCGeom', {
      prenormalized: normalizedAddressNJA,
    }));

    await Promise.all(background);
    return json(
      {
        error: true,
        error_code: 'address_not_verified',
        address,
      },
      quotaParams,
      404,
    );
  }

  const [lng, lat] = feature.geometry.coordinates as [number, number];
  const { geocoding_level } = feature.properties;
  const prefCode = getPrefCode(feature.properties.pref);
  const { x, y } = coord2XY([lat, lng], ZOOM);

  if (geocoding_level <= 4 ) {
    background.push(ipcNormalizationErrorReport('normLogsIPCGeom', {
      prenormalized: normalizedAddressNJA,
      geocoding_level: geocoding_level,
    }));
  }

  if (!prefCode) {
    console.log(`[FATAL] Invalid \`properties.pref\` response from API: '${feature.properties.pref}'.`);
    Sentry.captureException(new Error(`Invalid \`properties.pref\` response from API: '${feature.properties.pref}'`));
    await Promise.all(background);
    return errorResponse(500, 'Internal server error', quotaParams);
  }

  const addressObject = {
    ja: {
      prefecture: prenormalizedAddress.pref,
      city: prenormalizedAddress.city,
      address1: prenormalizedAddress.town,
      address2: prenormalizedAddress.addr,
      other: normalizedBuilding ? normalizedBuilding : '',
    },
  };
  const location = {
    lat: lat.toString(),
    lng: lng.toString(),
  };

  let rawEstateIds: BaseEstateId[];
  try {
    const existingEstateIds = await getEstateIdForAddress(normalizedAddressNJA, normalizedBuilding);
    if (existingEstateIds.length > 0) {
      rawEstateIds = existingEstateIds;
    } else {
      const storeParams: StoreEstateIdReq = {
        zoom: ZOOM,
        tileXY: `${x}/${y}`,
        rawAddress: address,
        address: normalizedAddressNJA,
        prefCode,
      };
      if (building) {
        storeParams.rawBuilding = building;
        storeParams.building = normalizedBuilding;
      }
      rawEstateIds = [
        await store(storeParams),
      ];
    }
  } catch (error) {
    console.error({ ZOOM, addressObject, apiKey, error });
    console.error('[FATAL] Something happend with DynamoDB connection.');
    Sentry.captureException(error);
    await Promise.all(background);
    return errorResponse(500, 'Internal server error', quotaParams);
  }

  const richIdResp = !!(authenticationResult.plan === 'paid' || event.isDemoMode);
  const normalizationLevel = prenormalizedAddress.level.toString();
  const geocodingLevel = geocoding_level.toString();

  const apiResponse = rawEstateIds.map((estateId) => {
    const baseResp: { [key: string]: any } = {
      ID: estateId.estateId,
      normalization_level: normalizationLevel,
      address: {
        ja: {
          // all addresses should be the same.
          ...addressObject.ja,
          // ... but all buildings may not be the same.
          other: estateId.building || '',
        },
      },
    };
    if (richIdResp) {
      baseResp.geocoding_level = geocodingLevel;
      baseResp.location = location;
    }
    return baseResp;
  });

  if (event.isDebugMode === true) {
    await Promise.all(background);
    // aggregate debug info
    return json(
      {
        internallyNormalized: prenormalizedAddress,
        externallyNormalized: feature,
        cacheHit,
        tileInfo: {
          xy: `${x}/${y}`,
          serial: rawEstateIds.map(({serial}) => serial),
          ZOOM,
        },
        apiResponse,
      },
      quotaParams,
    );
  } else {
    await Promise.all(background);
    return json(
      apiResponse,
      quotaParams,
    );
  }
};

export const handler = Sentry.AWSLambda.wrapHandler(_handler);
