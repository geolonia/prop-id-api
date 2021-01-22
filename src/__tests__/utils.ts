// Test utility for Lambda Handler
export const promisify = (handler: EstateAPI.LambdaHandler) =>
    (
        event: Parameters<EstateAPI.LambdaHandler>[0],
        context: Parameters<EstateAPI.LambdaHandler>[1]
    ) => new Promise((resolve) => {
        // Lambda Proxy Response
        handler(event, context, (_0, result) => {
            resolve(result as any)
        })
    })
