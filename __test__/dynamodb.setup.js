const AWS = require('aws-sdk')
const { configure } = require('./dynamodb.config')

const STAGE = "test";
process.env.AWS_DYNAMODB_API_KEY_TABLE_NAME = `estate-id-api-key-${STAGE}`;
process.env.AWS_DYNAMODB_ESTATE_ID_TABLE_NAME = `estate-id-${STAGE}`;
process.env.AWS_DYNAMODB_LOG_TABLE_NAME = `estate-id-log-${STAGE}`;

const client = new AWS.DynamoDB({
  endpoint: 'http://localhost:8000',
  region: 'local-region',
  sslEnabled: false,
  credentials: {
    accessKeyId: 'XXX',
    secretAccessKey: 'XXX',
  },
})

const { tables } = configure()

module.exports = async () => {
  for (const table of tables) {
    const { TableName } = table
    try {
      await client.describeTable({ TableName }).promise()
      await client.deleteTable({ TableName }).promise()
    } catch {
    } finally {
      await client.createTable(table).promise()
    }
  }
}
