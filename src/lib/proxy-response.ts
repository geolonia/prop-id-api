import util from 'util'

export const error = (statusCode: number, message: string, ...variables: string[]) => {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Headers': 'x-access-token',
        },
        body: JSON.stringify({
            message: util.format(message, ...variables)
        })
    }
}

export const json = (body: object) => {
    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Headers': 'x-access-token',
        },
        body: JSON.stringify(body),
    }
}
