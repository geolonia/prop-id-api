const AWS = require('aws-sdk')
const { configure } = require('./dynamodb.config')

const client = new AWS.DynamoDB({
  endpoint: 'http://localhost:8000',
  region: 'local-env',
  sslEnabled: false,
  credentials: {
    accessKeyId: 'XXX',
    secretAccessKey: 'XXX',
  },
})

const { tables } = configure()

module.exports = async () => {
  for (const table of tables) {
    await client.deleteTable({ TableName: table.TableName }).promise()
  }
}
