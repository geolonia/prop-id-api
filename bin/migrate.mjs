import AWS from 'aws-sdk'

export const main = async (origin = 'dev', dest = 'dev2') => {
    const docclient = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10' })
    const scanInput = {
        TableName: `estate-id-api-key-${origin}`,
    }

    const { Items: items = [] } = await docclient.scan(scanInput).promise()

    for (const item of items) {
        const putItemInput = {
            TableName: `estate-id-api-key-${dest}`,
            Item: item
        }
        await docclient.put(putItemInput).promise()
      }
}

// main()
