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

    let [,,description] = process.argv
    const apiKey = randomToken(20)
    const accessToken = randomToken(32)

    process.stderr.write(`Stage: ${stage}\n`)
    process.stderr.write(`API key: ${apiKey}\n`)
    process.stderr.write(`Access Token: ${accessToken}\n`)
    process.stderr.write(`Description: ${description}\n`)

    const docclient = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10' })
    const putItemInput = {
        TableName: `estate-id-api-key-${stage}`,
        Item: {
          apiKey,
          accessToken: hashToken(accessToken),
          description: description
        }
    }

    await docclient.put(putItemInput).promise()
}

main()
