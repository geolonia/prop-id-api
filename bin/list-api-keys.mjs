import AWS from 'aws-sdk'

export const main = async (stage = 'dev') => {
    const docclient = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10' })
    const scanInput = {
        TableName: `estate-id-api-key-${stage}`,
    }

    const { Items: items = [] } = await docclient.scan(scanInput).promise()
    const apiKeys = items.map(item => ({
      ...item,
      accessToken: '****',
      lastRequestAt: item.lastRequestAt ? new Date(item.lastRequestAt).toString() : null
     }))
    process.stdout.write(JSON.stringify(apiKeys, null, 2) + '\n')
}

main()
