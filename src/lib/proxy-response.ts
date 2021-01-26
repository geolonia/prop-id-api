import util from 'util'

export const error = (statusCode: number, message: string, ...variables: string[]) => {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json'
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
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body),
    }
}