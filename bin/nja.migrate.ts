import AWS from 'aws-sdk'
import fs from 'fs/promises'
import type { NJARegressionResult } from './nja.test'

AWS.config.region = 'ap-northeast-1'

const { STAGE = 'dev'} = process.env


const readOutJSONFromStdin = async () => {
  const input = await fs.readFile("/dev/stdin", "utf8");
  const { data, meta }: NJARegressionResult = JSON.parse(input)
  return { data, meta }
}

async function *scanPropIdDb() {
  const client = new AWS.DynamoDB.DocumentClient()
  const scanInput: AWS.DynamoDB.DocumentClient.ScanInput = {
    TableName: `estate-id-${STAGE}`,
  }
  do {
    const result = await client.scan(scanInput).promise()
    yield result.Items || []
    scanInput.ExclusiveStartKey = result.LastEvaluatedKey
  } while (scanInput.ExclusiveStartKey);
  return
}

const main = async () => {
  const { data, meta: { PREV_NJA_VERSION, CURRENT_NJA_VERSION, STAGE: STAGE_IN_DATA } } = await readOutJSONFromStdin()
  if(STAGE !== STAGE_IN_DATA) {
    console.error(`STAGE mismatch: specified:${STAGE}...target:${STAGE_IN_DATA}.`)
    process.exit(1)
  }
  console.error(`[${STAGE}] Migrating regression between NJA@${PREV_NJA_VERSION}...${CURRENT_NJA_VERSION}.`)

  const affectedAddressSet = new Set<string>(data.map(item => item.input))
  for await (const items of scanPropIdDb()) {
    for (const item of items) {
      if(affectedAddressSet.has(item.rawAddress)) {
        console.log(item)
      }
    }
  }

}

main()
