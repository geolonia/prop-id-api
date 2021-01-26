import AWS from 'aws-sdk'
import { promises } from 'fs'

export const main = async (stage: 'dev' = 'dev') => {
    const docclient = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10' })
    const scanInput: AWS.DynamoDB.DocumentClient.ScanInput = {
        TableName: `estate-id-api-key-${stage}`,
    }

    const { Items: items = [] } = await docclient.scan(scanInput).promise()
    const apiKeys = items.map(item => ({ ...item, accessToken: void 0 }))
    process.stdout.write(JSON.stringify(apiKeys) + '\n')
}

main()
