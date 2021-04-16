import '.'
import { EstateId, getEstateIdForAddress, store, StoreEstateIdReq } from './lib/dynamodb'
import { verifyAddress, coord2XY, getPrefCode, VerifyAddressResult, incrementPGeocode, normalizeBuilding } from './lib/index'
import { errorResponse, json } from './lib/proxy-response'
import Sentry from './lib/sentry'
import { normalize, NormalizeResult } from '@geolonia/normalize-japanese-addresses'
import { Handler, APIGatewayProxyResult } from 'aws-lambda'
import { authenticateEvent, extractApiKey } from './lib/authentication'
import { createLog } from './lib/dynamodb_logs'

export const _handler: Handler<PublicHandlerEvent, APIGatewayProxyResult> = async (event) => {
  const address = event.queryStringParameters?.q
  const building = event.queryStringParameters?.building
  const ZOOM = parseInt(process.env.ZOOM, 10)
  const quotaType = "id-req"

  const { apiKey } = extractApiKey(event)
  const authenticationResult = await authenticateEvent(event, quotaType)
  if ('statusCode' in authenticationResult) {
    return authenticationResult
  }

  if(!address) {
    return errorResponse(400, 'Missing querystring parameter `q`.')
  }

  Sentry.setContext("query", {
    address,
    debug: event.isDebugMode,
  })
  Sentry.setUser({
    id: event.isDemoMode ? "demo" : apiKey
  })

  // Internal normalization
  let prenormalizedAddress: NormalizeResult
  try {
    prenormalizedAddress = await normalize(address)

    await createLog(`normLogsNJA`, {
      input: address,
      normalized: JSON.stringify(prenormalizedAddress),
    })

  } catch (error) {
    Sentry.captureException(error)
    console.error({ error })
    if ('address' in error) {
      // this is a normalize-japanese-addressses error
      await createLog(`normFailNJA`, {
        input: address,
        errorMsg: error.message,
      })
    }
    return errorResponse(400, `address ${address} can not be normalized.`)
  }
  const normalizedBuilding = normalizeBuilding(building)

  if (!prenormalizedAddress.town || prenormalizedAddress.town === '') {
    await createLog('normFailNoTown', {
      input: address
    })
  }

  const normalizedAddressNJA = `${prenormalizedAddress.pref}${prenormalizedAddress.city}${prenormalizedAddress.town}${prenormalizedAddress.addr}`
  const ipcResult = await incrementPGeocode(normalizedAddressNJA)
  if (!ipcResult) {
    return errorResponse(500, 'Internal server error')
  }

  const {
    feature,
    cacheHit
  } = ipcResult

  // Features not found
  if (!feature || feature.geometry === null) {
    Sentry.captureException(new Error(`The address '${address}' is not verified.`))
    await createLog('normFailNoIPCGeom', {
      input: address,
      prenormalized: normalizedAddressNJA,
      ipcResult: JSON.stringify(ipcResult),
    })
    return errorResponse(404, "The address '%s' is not verified.", address)
  }

  const [lng, lat] = feature.geometry.coordinates as [number, number]
  const { geocoding_level } = feature.properties
  const prefCode = getPrefCode(feature.properties.pref)
  const { x, y } = coord2XY([lat, lng], ZOOM)

  if (!prefCode) {
    console.log(`[FATAL] Invalid \`properties.pref\` response from API: '${feature.properties.pref}'.`)
    Sentry.captureException(new Error(`Invalid \`properties.pref\` response from API: '${feature.properties.pref}'`))
    return errorResponse(500, 'Internal Server Error.')
  }

  const addressObject = {
    ja: {
      prefecture: prenormalizedAddress.pref,
      city: prenormalizedAddress.city,
      address1: prenormalizedAddress.town,
      address2: prenormalizedAddress.addr,
      other: normalizedBuilding ? normalizedBuilding : ""
    },
  }
  const location = {
    geocoding_level: geocoding_level.toString(),
    lat: lat.toString(),
    lng: lng.toString()
  }

  let estateId: EstateId
  try {
    const existingEstateId = await getEstateIdForAddress(normalizedAddressNJA, normalizedBuilding)
    if (existingEstateId) {
      estateId = existingEstateId
    } else {

      const storeParams: StoreEstateIdReq = {
        zoom: ZOOM,
        tileXY: `${x}/${y}`,
        rawAddress: address,
        address: normalizedAddressNJA,
        prefCode,
      }
      if (building) {
        storeParams.rawBuilding = building
        storeParams.building = normalizedBuilding
      }
      estateId = await store(storeParams)
    }
  } catch (error) {
    console.error({ ZOOM, addressObject, apiKey, error })
    console.error('[FATAL] Something happend with DynamoDB connection.')
    Sentry.captureException(error)
    return errorResponse(500, 'Internal Server Error.')
  }

  const ID = estateId!.estateId

  let body: any
  if (authenticationResult.plan === "paid" || event.isDemoMode) {
    body = { ID, address: addressObject, location }
  } else {
    body = { ID }
  }

  if (event.isDebugMode && event.isDemoMode) {
    // aggregate debug info
    return json({
      internallyNormalized: prenormalizedAddress,
      externallyNormalized: feature,
      cacheHit,
      tileInfo: { xy: `${x}/${y}`, serial: estateId!.serial, ZOOM },
      apiResponse: [ body ]
    })
  } else {
    return json([ body ])
  }
}

export const handler = Sentry.AWSLambda.wrapHandler(_handler)
