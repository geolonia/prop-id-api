import util from 'util'

export const errorResponse = (statusCode: number, message: string, ...variables: string[]) => {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Headers': 'x-access-token, authorization',
      'Access-Control-Allow-Origin': '*', // CORS origin authentication is done using API Gateway
      'Cache-Control': 'no-store, max-age=0',
    },
    body: JSON.stringify({
      message: util.format(message, ...variables)
    })
  }
}

export const json = (body: object, statusCode: number = 200) => {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Headers': 'x-access-token, authorization',
      'Access-Control-Allow-Origin': '*', // CORS origin authentication is done using API Gateway
      'Cache-Control': 'no-store, max-age=0',
    },
    body: JSON.stringify(body),
  }
}
