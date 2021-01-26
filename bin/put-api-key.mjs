import AWS from 'aws-sdk'
import * as crypto from 'crypto'

const randomToken = (length) => {
    return crypto.randomBytes(length).reduce((p, i) => p + (i % 36).toString(36), '')
}

// Do not change because same function is embedded in Lambda handler
const hashToken = (accessToken) => {
    return crypto.scryptSync(accessToken, process.env.ACCESS_TOKEN_SALT, 10).toString()
}

export const main = async (stage = 'dev') => {

    let [,,apiKey, accessToken] = process.argv
    if(!apiKey) {
        process.stderr.write('No apiKey provided.')
        process.exit(1)
    }

    if(!accessToken) {
        accessToken = randomToken(32)
        process.stderr.write(`Access for ${apiKey} has been automatically generated.\n`)
        process.stderr.write(accessToken)
    }

    process.stderr.write(`Creating api key at \`${stage}\` env..`)
    const docclient = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10' })
    const putItemInput = {
        TableName: `estate-id-api-key-${stage}`,
        Item: {
            apiKey,
            accessToken: hashToken(accessToken)
        }
    }

    await docclient.put(putItemInput).promise()
}

main()
