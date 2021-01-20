import Lambda from 'aws-lambda'

export const handler: Lambda.Handler = async (event, context, callback) => {
    return callback(null, {
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            'hello': 'world'
        }),
    });
}