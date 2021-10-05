const STAGE = "test";

process.env.AWS_DYNAMODB_API_KEY_TABLE_NAME = `estate-id-api-key-${STAGE}`;
process.env.AWS_DYNAMODB_ESTATE_ID_TABLE_NAME = `estate-id-${STAGE}`;
process.env.AWS_DYNAMODB_LOG_TABLE_NAME = `estate-id-log-${STAGE}`;

module.exports = {
  tables: [
    {
      TableName: process.env.AWS_DYNAMODB_API_KEY_TABLE_NAME,
      ProvisionedThroughput: {
        ReadCapacityUnits: 10,
        WriteCapacityUnits: 10,
      },
      "AttributeDefinitions": [
        {
          "AttributeName": "apiKey",
          "AttributeType": "S"
        },
        {
          "AttributeName": "GSI1PK",
          "AttributeType": "S"
        },
        {
          "AttributeName": "GSI1SK",
          "AttributeType": "S"
        }
      ],
      "KeySchema": [
        {
          "AttributeName": "apiKey",
          "KeyType": "HASH"
        }
      ],
      "GlobalSecondaryIndexes": [
        {
          "IndexName": "GSI1PK-GSI1SK-index",
          "KeySchema": [
            {
              "AttributeName": "GSI1PK",
              "KeyType": "HASH"
            },
            {
              "AttributeName": "GSI1SK",
              "KeyType": "RANGE"
            },
          ],
          "Projection": {
            "ProjectionType": "ALL"
          },
          ProvisionedThroughput: {
            ReadCapacityUnits: 10,
            WriteCapacityUnits: 10,
          },
        },
      ],
    },
    {
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
      ],
    },
    {
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
      ],
    },
  ],
};
