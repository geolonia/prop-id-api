// Test utility for Lambda Handler
export const promisify = (handler: EstateAPI.LambdaHandler) =>
    (
        event: Parameters<EstateAPI.LambdaHandler>[0],
        context: Parameters<EstateAPI.LambdaHandler>[1]
    ) => new Promise((resolve, reject) => {
        handler(event, context, (error, result) => {
            if(error) {
                reject(error)
            } else {
                resolve(result as any)
            }
        })
    }) 