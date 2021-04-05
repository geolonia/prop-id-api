import AWS from 'aws-sdk'
import * as crypto from 'crypto'
import { promisify } from 'util'

const scrypt = promisify(crypto.scrypt)

const randomToken = (length) => {
  return crypto.randomBytes(length).reduce((p, i) => p + (i % 36).toString(36), '')
}

const hashTokenV2 = async (apiKey, accessToken) => {
  // use api key as salt
  const buf = await scrypt(accessToken, apiKey, 10)
  return buf.toString('base64')
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
          hashedToken: await hashTokenV2(apiKey, accessToken),
          plan: "paid",
          description: description
        }
    }

    await docclient.put(putItemInput).promise()
}

main()
