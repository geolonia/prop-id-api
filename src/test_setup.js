const AWS = require("aws-sdk")

module.exports = async () => {
  process.env.AWS_DYNAMODB_API_KEY_TABLE_NAME = "estate-id-api-key-local"
  process.env.AWS_DYNAMODB_ESTATE_ID_TABLE_NAME = "estate-id-local"
  process.env.AWS_DYNAMODB_LOG_TABLE_NAME = "estate-id-log-local"

  const DB = new AWS.DynamoDB({ endpoint: "http://127.0.0.1:8000", region: "us-west-2" })
  try {
    await DB.describeTable({
      TableName: process.env.AWS_DYNAMODB_API_KEY_TABLE_NAME
    }).promise()
    await DB.deleteTable({
      TableName: process.env.AWS_DYNAMODB_API_KEY_TABLE_NAME
    }).promise()
  } catch (e) {
  } finally {
    await DB.createTable({
      TableName: process.env.AWS_DYNAMODB_API_KEY_TABLE_NAME,
      ProvisionedThroughput: {
        ReadCapacityUnits: 10,
        WriteCapacityUnits: 10,
      },
      "AttributeDefinitions": [
        {
          "AttributeName": "apiKey",
          "AttributeType": "S"
        }
      ],
      "KeySchema": [
        {
          "AttributeName": "apiKey",
          "KeyType": "HASH"
        }
      ]
    }).promise()
    console.log("Created", process.env.AWS_DYNAMODB_API_KEY_TABLE_NAME)
  }

  try {
    await DB.describeTable({
      TableName: process.env.AWS_DYNAMODB_ESTATE_ID_TABLE_NAME
    }).promise()
    await DB.deleteTable({
      TableName: process.env.AWS_DYNAMODB_ESTATE_ID_TABLE_NAME
    }).promise()
  } catch (e) {
  } finally {
    await DB.createTable({
      TableName: process.env.AWS_DYNAMODB_ESTATE_ID_TABLE_NAME,
      ProvisionedThroughput: {
        ReadCapacityUnits: 10,
        WriteCapacityUnits: 10,
      },
      "AttributeDefinitions": [
        {
          "AttributeName": "address",
          "AttributeType": "S"
        },
        {
          "AttributeName": "estateId",
          "AttributeType": "S"
        },
        {
          "AttributeName": "serial",
          "AttributeType": "N"
        },
        {
          "AttributeName": "tileXY",
          "AttributeType": "S"
        }
      ],
      "KeySchema": [
        {
          "AttributeName": "estateId",
          "KeyType": "HASH"
        }
      ],
      "GlobalSecondaryIndexes": [
        {
          "IndexName": "address-index",
          "KeySchema": [
            {
              "AttributeName": "address",
              "KeyType": "HASH"
            }
          ],
          "Projection": {
            "ProjectionType": "ALL"
          },
          ProvisionedThroughput: {
            ReadCapacityUnits: 10,
            WriteCapacityUnits: 10,
          },
        },
        {
          "IndexName": "tileXY-index",
          "KeySchema": [
            {
              "AttributeName": "tileXY",
              "KeyType": "HASH"
            },
            {
              "AttributeName": "serial",
              "KeyType": "RANGE"
            }
          ],
          "Projection": {
            "ProjectionType": "ALL"
          },
          ProvisionedThroughput: {
            ReadCapacityUnits: 10,
            WriteCapacityUnits: 10,
          },
        }
      ]
    }).promise()
    console.log("Created", process.env.AWS_DYNAMODB_ESTATE_ID_TABLE_NAME)
  }

  try {
    await DB.describeTable({
      TableName: process.env.AWS_DYNAMODB_LOG_TABLE_NAME
    }).promise()
    await DB.deleteTable({
      TableName: process.env.AWS_DYNAMODB_LOG_TABLE_NAME
    }).promise()
  } catch (e) {
  } finally {
    await DB.createTable({
      TableName: process.env.AWS_DYNAMODB_LOG_TABLE_NAME,
      ProvisionedThroughput: {
        ReadCapacityUnits: 10,
        WriteCapacityUnits: 10,
      },
      "AttributeDefinitions": [
        {
          "AttributeName": "PK",
          "AttributeType": "S"
        },
        {
          "AttributeName": "SK",
          "AttributeType": "S"
        }
      ],
      "KeySchema": [
        {
          "AttributeName": "PK",
          "KeyType": "HASH"
        },
        {
          "AttributeName": "SK",
          "KeyType": "RANGE"
        }
      ]
    }).promise()
    console.log("Created", process.env.AWS_DYNAMODB_LOG_TABLE_NAME)
  }

}
