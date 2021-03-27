import AWS from "aws-sdk"

const DB = new AWS.DynamoDB.DocumentClient()

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
