import fs from 'fs'
import path from 'path'
import { APIGatewayProxyResult } from 'aws-lambda'
import { _updateServiceUsageQuota, _getServiceUsageQuotaItem } from './lib/dynamodb.test'
import { _handler as handler } from './public'

const lines = fs
.readFileSync(path.join(path.dirname(__filename), '/addresses.csv'), {
  encoding: 'utf-8',
})
.split(/\n/)
lines.shift() // 見出し行

lines.forEach((line) => {
  if (line) {
    const data = line.trim().split(/,/)

    test(data[0], async () => {
      const event = {
        isDemoMode: true,
        queryStringParameters: {
          q: data[0],
          building: '',
        },
      }

      // @ts-ignore
      const lambdaResult = await handler(event) as APIGatewayProxyResult
      const body = JSON.parse(lambdaResult.body)

      const address = body[0].address.ja

      expect(address.prefecture).toEqual(data[1])
      expect(address.city).toEqual(data[2])
      expect(address.address1).toEqual(data[3])
      expect(address.address2).toEqual(data[4])

    })
  }
})
