import '.';
import { BaseEstateId, getEstateIdForAddress, store, StoreEstateIdReq } from './lib/dynamodb';
import { coord2XY, getPrefCode, incrementPGeocode } from './lib/index';
import { errorResponse, json } from './lib/proxy-response';
import Sentry from './lib/sentry';
import { joinNormalizeResult, normalize, NormalizeResult, versions } from './lib/nja';
import { createLog, normalizeBanchiGo, withLock } from './lib/dynamodb_logs';
import { ipcNormalizationErrorReport } from './outerApiErrorReport';
import { extractBuildingName, normalizeBuildingName } from './lib/building_normalization';
import { authenticator, AuthenticatorContext, decorate, Decorator, logger, LoggerContext } from './lib/decorators';

const NORMALIZATION_ERROR_CODE_DETAILS = [
  'prefecture_not_recognized',
  'city_not_recognized',
  'neighborhood_not_recognized',
];

const IPC_NORMALIZATION_ERROR_CODE_DETAILS: { [key: string]: string } = {
  '1': 'geo_prefecture',
  '2': 'geo_city',
  '3': 'geo_oaza',
  '4': 'geo_koaza',
  '5': 'geo_banchi',
  '7': 'geo_ok_no_go',
  '8': 'geo_ok_go',
  '-1': 'geo_undefined',
};

// アドレスクエリとして使用できない文字
const IPC_INVALID_CHARS = ['/'];

export const _handler: PropIdHandler = async (event, context) => {
  const address = event.queryStringParameters?.q;
  const ZOOM = parseInt(process.env.ZOOM, 10);
  const {
    propIdAuthenticator: {
      apiKey,
      authentication,
      quotaParams,
    },
    propIdLogger: {
      background,
    },
  }= (context as AuthenticatorContext & LoggerContext);

  if (!address) {
    return errorResponse(400, 'Missing querystring parameter `q`.', quotaParams);
  }

  const invalidAddressChar = IPC_INVALID_CHARS.find((char) => address.indexOf(char) !== -1);
  if (invalidAddressChar) {
    return errorResponse(400, `The parameter \`q\` contains an invalid character '${invalidAddressChar}'.`);
  }

  Sentry.setContext('query', {
    address,
    debug: event.isDebugMode,
  });
  Sentry.setUser({
    id: event.isDemoMode ? 'demo' : apiKey,
  });

  // Internal normalization
  const prenormalized = await normalize(address);
  const prenormalizedStr = joinNormalizeResult(prenormalized);
  let finalNormalized: NormalizeResult = prenormalized;

  background.push(createLog('normLogsNJA', {
    input: address,
    level: prenormalized.level,
    nja: prenormalizedStr,
    deps: versions,
    normalized: JSON.stringify(prenormalized),
  }, { apiKey }));
  if (
    prenormalized.level <= 2 ||
    // NOTE: 以下の条件判定は NJA のレスポンスとしてはあり得ないため不要だが、念の為入れている
    !prenormalized.town ||
    prenormalized.town === ''
  ) {
    background.push(createLog('normFailNoTown', {
      input: address,
      output: prenormalized,
    }, { apiKey }));
  }

  if (prenormalized.level <= 2) {
    const error_code_detail = NORMALIZATION_ERROR_CODE_DETAILS[prenormalized.level];
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

  const ipcResult = await incrementPGeocode(prenormalizedStr);

  if (!ipcResult) {
    Sentry.captureException(new Error('IPC result null'));
    background.push(ipcNormalizationErrorReport('normFailNoIPCGeomNull', {
      input: prenormalizedStr,
    }));
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
      prenormalized: prenormalizedStr,
      ipcResult: JSON.stringify(ipcResult),
    }, { apiKey }));
    background.push(ipcNormalizationErrorReport('normFailNoIPCGeom', {
      prenormalized: prenormalizedStr,
    }));

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
  const { geocoding_level, not_normalized } = feature.properties;
  const ipc_geocoding_level_int = parseInt(geocoding_level, 10);
  const ipc_not_normalized_address_part = not_normalized;
  const prefCode = getPrefCode(feature.properties.pref);
  const { x, y } = coord2XY([lat, lng], ZOOM);

  if (ipc_geocoding_level_int === 3) {
    /* IPC からの返答が 3の場合（つまり、番地が認識できなかったとき）はエラーを返します */
    return json(
      {
        error: true,
        error_code: 'banchi_not_found',
        address,
      },
      quotaParams,
      400,
    );
  } else if (ipc_geocoding_level_int >= 4 && ipc_geocoding_level_int <= 5) {
    /* IPC からの返答が 4, 5 の場合（つまり、少なくとも番地は認識できたとき）は、自分のデータベースを問い合わせ、
     * 実在するかの確認を取ります。
     */
    const internalBGNormalized = await normalizeBanchiGo(prenormalized);
    if (internalBGNormalized.level >= 7) {
      // 内部で番地号情報がありました。
      finalNormalized = internalBGNormalized;
    }
    // NOTE: これ以降、 normalization_level( = finalNormalized.level、最終正規化レベル) は NJA レベルを継承します。
    // 最終正規化レベルは 3 以外に、以下の2つのレベルを取りえます
    // - 7: 番地・号を認識できなかった
    // - 8: 番地・号を認識できた

    background.push(createLog('normLogsIPCFail', {
      prenormalized: prenormalizedStr,
      ipcLevel: ipc_geocoding_level_int,
      intBGLevel: internalBGNormalized.level,
    }, { apiKey }));
  }

  if (finalNormalized.level <= 6 && ipc_geocoding_level_int <= 6) {
    background.push(ipcNormalizationErrorReport('normLogsIPCGeom', {
      prenormalized: prenormalizedStr,
      geocoding_level: geocoding_level,
    }));
  }

  // GT社 LV 5 以下 かつ正規化できなかったパートが存在しない場合は不十分な住所が入力されているケースだと判断できる
  // この場合はエラーとして処理
  if (
    finalNormalized.level <= 3 &&
    ipc_geocoding_level_int <= 5 &&
    !ipc_not_normalized_address_part
  ) {
    const error_code_detail = (
      IPC_NORMALIZATION_ERROR_CODE_DETAILS[ipc_geocoding_level_int.toString()]
      || IPC_NORMALIZATION_ERROR_CODE_DETAILS['-1']
    );
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

  if (!prefCode) {
    console.log(`[FATAL] Invalid \`properties.pref\` response from API: '${feature.properties.pref}'.`);
    Sentry.captureException(new Error(`Invalid \`properties.pref\` response from API: '${feature.properties.pref}'`));
    return errorResponse(500, 'Internal server error', quotaParams);
  }

  // ビル名が以前認識されていない(NJAレベルや、内部DBプロセスで)かつ、IPCのレベルが6以上だと `extractBuildingName`
  // で抽出可能となります。
  // IPCレベル5の場合、ビル名の抽出は行わないため、 `address2` プロパティにビル名含まれたままになります。
  if (typeof finalNormalized.building === 'undefined' && ipc_geocoding_level_int >= 6) {
    const extractedBuilding = extractBuildingName(
      address,
      prenormalized,
      ipcResult,
    );
    if (typeof extractedBuilding.building !== 'undefined') {
      finalNormalized = extractedBuilding;
    }
  }

  const finalAddress = joinNormalizeResult(finalNormalized);
  const normalizedBuilding = normalizeBuildingName(finalNormalized.building || '');

  const addressObject = {
    ja: {
      prefecture: finalNormalized.pref,
      city: finalNormalized.city,
      address1: finalNormalized.town,
      address2: finalNormalized.addr,
      other: finalNormalized.building || '',
    },
  };
  const location = {
    lat: lat.toString(),
    lng: lng.toString(),
  };

  let existing: boolean;
  let rawEstateIds: BaseEstateId[];

  // NOTE:
  // 番地・号を発見できなかったとき(最終正規化レベル <= 6 かつ IPC <=5)は `addressPending` としてマークされ、別途確認を行うことになります。
  // この住所は未知の番地・号か、あるいは単純に不正な入力値である可能性があります。
  // また、ビル名の抽出ができないため、`address2` フィールドに番地・号とビル名が混在します。
  // 修正のプロセスにより住所文字列は変更される可能性があります。
  const status = finalNormalized.level <= 6 && ipc_geocoding_level_int <= 5 ? 'addressPending' : undefined;

  try {
    const lockId = `${finalAddress}/${normalizedBuilding}`;
    const estateIdIssuance = await withLock(lockId, async () => {
      const existingEstateIds = await getEstateIdForAddress(finalAddress, normalizedBuilding);
      if (existingEstateIds.length > 0) {
        return {
          existing: true,
          rawEstateIds: existingEstateIds,
        };
      } else {
        const storeParams: StoreEstateIdReq = {
          zoom: ZOOM,
          tileXY: `${x}/${y}`,
          rawAddress: address,
          address: finalAddress,
          rawBuilding: finalNormalized.building,
          building: normalizedBuilding,
          prefCode,
          status,
        };
        return {
          existing: false,
          rawEstateIds: [await store(storeParams)],
        };
      }
    });
    existing = estateIdIssuance.existing;
    rawEstateIds = estateIdIssuance.rawEstateIds;
  } catch (error) {
    console.error({ ZOOM, addressObject, apiKey, error });
    console.error('[FATAL] Something happend with DynamoDB connection.');
    Sentry.captureException(error);
    return errorResponse(500, 'Internal server error', quotaParams);
  }
  background.push(createLog(
    'idIssSts',
    {
      existing,
      estateIds: rawEstateIds.map((rawEstateId) => rawEstateId.estateId),
    },
    { apiKey },
  ));

  const richIdResp = !!(authentication.plan === 'paid' || event.isDemoMode);
  const normalizationLevel = finalNormalized.level.toString();
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
          other: estateId.rawBuilding || '',
        },
      },
      status: estateId.status === 'addressPending' ? 'addressPending' : null,
    };
    if (richIdResp) {
      baseResp.geocoding_level = geocodingLevel;
      baseResp.location = estateId.userLocation ? {
        lat: estateId.userLocation.lat.toString(),
        lng: estateId.userLocation.lng.toString(),
      } : location;
    }
    return baseResp;
  });

  if (event.isDebugMode === true) {
    // aggregate debug info
    return json(
      {
        internallyNormalized: prenormalized,
        externallyNormalized: feature,
        cacheHit,
        tileInfo: {
          xy: `${x}/${y}`,
          serial: rawEstateIds.map(({ serial }) => serial),
          ZOOM,
        },
        apiResponse,
      },
      quotaParams,
    );
  } else {
    return json(
      apiResponse,
      quotaParams,
    );
  }
};

export const handler = decorate(_handler,
  [
    logger,
    authenticator('id-req'),
    Sentry.AWSLambda.wrapHandler as Decorator,
  ]
);
