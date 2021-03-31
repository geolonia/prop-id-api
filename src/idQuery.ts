import { Handler, APIGatewayProxyResult } from 'aws-lambda'
import { incrementPGeocode } from './lib'
import { extractApiKey, authenticateEvent } from './lib/authentication'
import { getEstateId } from './lib/dynamodb'
import { errorResponse, json } from './lib/proxy-response'
import Sentry from './lib/sentry'

export const _handler: Handler<PublicHandlerEvent, APIGatewayProxyResult> = async (event) => {
  const quotaType = "id-query"
  // const { apiKey } = extractApiKey(event)
  const authenticationResult = await authenticateEvent(event, quotaType)
  if (authenticationResult !== true) {
    return authenticationResult
  }

  const estateId = event.pathParameters?.estateId
  if (!estateId) {
    return errorResponse(400, 'Missing estate ID.')
  }

  const estateIdObj = await getEstateId(estateId)

  if (!estateIdObj) {
    return json({
      error: true,
      error_description: "not_found",
    }, 404)
  }

  const ipcResult = await incrementPGeocode(estateIdObj.address)
  if (!ipcResult) {
    return errorResponse(500, 'Internal server error')
  }

  const {
    feature,
  } = ipcResult

  const [lng, lat] = feature.geometry.coordinates as [number, number]

  const location = {
    lat: lat.toString(),
    lng: lng.toString()
  }

  return json([
    {
      ID: estateIdObj.estateId,
      address: estateIdObj.address,
      location,
    }
  ])
}

export const handler = Sentry.AWSLambda.wrapHandler(_handler)
