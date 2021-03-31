import { EstateId, getEstateIdForAddress, store } from './lib/dynamodb'
import { verifyAddress, coord2XY, getPrefCode, VerifyAddressResult, incrementPGeocode } from './lib/index'
import { errorResponse, json } from './lib/proxy-response'
import Sentry from './lib/sentry'
import { normalize, NormalizeResult } from '@geolonia/normalize-japanese-addresses'
import { Handler, APIGatewayProxyResult } from 'aws-lambda'
import { authenticateEvent, extractApiKey } from './lib/authentication'

export const _handler: Handler<PublicHandlerEvent, APIGatewayProxyResult> = async (event) => {
  const address = event.queryStringParameters?.q
  const ZOOM = parseInt(process.env.ZOOM, 10)
  const quotaType: string = "id-req"

  const { apiKey } = extractApiKey(event)
  const authenticationResult = await authenticateEvent(event, quotaType)
  if (authenticationResult !== true) {
    return authenticationResult
  }

  if(!address) {
    return errorResponse(400, 'Missing querystring parameter `q`.')
  }

  // Internal normalization
  let prenormalizedAddress: NormalizeResult
  try {
    prenormalizedAddress = await normalize(address)
  } catch (error) {
    Sentry.captureException(error)
    console.error({ error })
    return errorResponse(400, `address ${address} can not be normalized.`)
  }

  const ipcResult = await incrementPGeocode(`${prenormalizedAddress.pref}${prenormalizedAddress.city}${prenormalizedAddress.town}${prenormalizedAddress.addr}`)
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
    return errorResponse(404, "The address '%s' is not verified.", address)
  }

  // not enough match
  if (!feature.properties.city) {
    Sentry.captureException(new Error(`The address '${address}' is not verified sufficiently.`))
    return errorResponse(400, "The address '%s' is not verified sufficiently.", address)
  }

  const normalizedAddress = feature.properties.place_name
  const [lng, lat] = feature.geometry.coordinates as [number, number]
  const prefCode = getPrefCode(feature.properties.pref)
  const { x, y } = coord2XY([lat, lng], ZOOM)

  if (!prefCode) {
    console.log(`[FATAL] Invalid \`properties.pref\` response from API: '${feature.properties.pref}'.`)
    Sentry.captureException(new Error(`Invalid \`properties.pref\` response from API: '${feature.properties.pref}'`))
    return errorResponse(500, 'Internal Server Error.')
  }

  const addressObject = {
    ja: {
      prefecture: feature.properties.pref,
      city: feature.properties.city,
      address1: feature.properties.area + feature.properties.koaza_chome,
      address2: feature.properties.banchi_go,
      other: feature.properties.building + feature.properties.building_number
    },
  }
  const location = {
    lat: lat.toString(),
    lng: lng.toString()
  }

  let estateId: EstateId
  try {
    // TODO: Change to prenormalizedAddress
    const existingEstateId = await getEstateIdForAddress(normalizedAddress)
    if (existingEstateId) {
      estateId = existingEstateId
    } else {
      estateId = await store({
        zoom: ZOOM,
        tileXY: `${x}/${y}`,
        address: normalizedAddress,
        prefCode,
      })
    }
  } catch (error) {
    console.error({ ZOOM, addressObject, apiKey, error })
    console.error('[FATAL] Something happend with DynamoDB connection.')
    Sentry.captureException(error)
    return errorResponse(500, 'Internal Server Error.')
  }

  const ID = estateId!.estateId

  let body
  if (apiKey || event.isDemoMode) {
    // apiKey has been authenticated and return rich results
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
