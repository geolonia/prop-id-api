import { authenticate, EstateId, getEstateIdForAddress, store, StoreEstateIdReq, updateTimestamp, checkServiceUsageQuota, incrementServiceUsage } from './lib/dynamodb'
import { decapitalize, verifyAddress, coord2XY, hashXY, getPrefCode, VerifyAddressResult } from './lib/index'
import { errorResponse, json } from './lib/proxy-response'
import Sentry from './lib/sentry'
// @ts-ignore
import { normalize } from '@geolonia/normalize-japanese-addresses'
import { APIGatewayProxyEvent, Handler, APIGatewayProxyResult } from 'aws-lambda'

export interface PublicHandlerEvent extends APIGatewayProxyEvent {
  isDemoMode?: boolean
  isDebugMode?: boolean
}

export interface NormalizeResult {
  pref: string
  city: string
  town: string
  addr: string
}

export const rawHandler: Handler<PublicHandlerEvent, APIGatewayProxyResult> = async (event) => {

  const address = event.queryStringParameters?.q
  const apiKey = event.queryStringParameters ? event.queryStringParameters['api-key'] : undefined
  const accessToken = decapitalize(event.headers)['x-access-token']
  const ZOOM = parseInt(process.env.ZOOM, 10)
  const quotaType: string = "id-req"

  if(!address) {
    return errorResponse(400, 'Missing querystring parameter `q`.')
  }

  if (!event.isDemoMode) {
    // authentication is skipped when in demo mode
    if (!apiKey || !accessToken) {
      return errorResponse(403, 'Incorrect querystring parameter `api-key` or `x-access-token` header value.')
    }
    const authenticateResult = await authenticate(apiKey, accessToken)
    if (!authenticateResult) {
      return errorResponse(403, 'Incorrect querystring parameter `api-key` or `x-access-token` header value.')
    }

    // Todo?: [Alfa feature] Authenticate even if q['api-key'] not specified

    const { authenticated, lastRequestAt } = authenticateResult

    if (!authenticated) {
      return errorResponse(403, 'Incorrect querystring parameter `api-key` or `x-access-token` header value.')
    }

    const checkServiceUsageQuotaResult = await checkServiceUsageQuota({ apiKey, quotaType })
    if (!checkServiceUsageQuotaResult) {
      return errorResponse(403, `Exceed requests limit.`)
    }

    if (lastRequestAt) {
      const diff = Date.now() - lastRequestAt
      if (diff < 3000) {
        return errorResponse(429, 'Please request after a few second.')
      }
    }

    await incrementServiceUsage({ apiKey, quotaType })
    await updateTimestamp(apiKey, Date.now())
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


  // Request Increment P Address Verification API
  let verifiedResult: VerifyAddressResult
  try {
    verifiedResult = await verifyAddress(`${prenormalizedAddress.pref}${prenormalizedAddress.city}${prenormalizedAddress.town}${prenormalizedAddress.addr}`)
  } catch (error) {
    Sentry.captureException(error)
    console.error({ error })
    console.error('[FATAL] API or Network Down Detected.')
    return errorResponse(500, 'Internal Server Error.')
  }

  // API key for Increment P should valid.
  if(!verifiedResult.ok) {
    if(verifiedResult.status === 403) {
      console.error('[FATAL] API Authentication failed.')
    } else {
      console.error('[FATAL] Unknown status code detected.')
    }
    Sentry.captureException(new Error(`error from Increment P: ${JSON.stringify(verifiedResult)}`))
    return errorResponse(500, 'Internal Server Error.')
  }

  const feature = verifiedResult.body.features[0]

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
      cacheHit: verifiedResult.headers.get('X-Cache') === 'Hit from cloudfront',
      tileInfo: { xy: `${x}/${y}`, serial: estateId!.serial, ZOOM },
      apiResponse: [ body ]
    })
  } else {
    return json([ body ])
  }
}

export const handler = Sentry.AWSLambda.wrapHandler(rawHandler)
