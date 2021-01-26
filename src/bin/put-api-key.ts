import AWS from 'aws-sdk'
import crypto from 'crypto'

export const randomToken = (length: number) => {
    return crypto.randomBytes(length).reduce((p, i) => p + (i % 36).toString(36), '')
}

export const main = async (stage: 'dev' = 'dev') => {

    let [,,apiKey, accessToken] = process.argv
    if(!apiKey) {
        process.stderr.write('No apiKey provided.')
        process.exit(1)
    }

    if(!accessToken) {
        accessToken = randomToken(32)
        process.stderr.write('Access token will be automatically generated.\n')
    }

    accessToken = crypto.scryptSync(accessToken, process.env.ACCESS_TOKEN_SALT, 10).toString()

    process.stdout.write(`Creating api key at \`${stage}\` env..`)
    const docclient = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10' })
    const putItemInput: AWS.DynamoDB.DocumentClient.PutItemInput = {
        TableName: `estate-id-api-key-${stage}`,
        Item: {
            apiKey,
            accessToken
        }
    }

    await docclient.put(putItemInput).promise()
}

main()