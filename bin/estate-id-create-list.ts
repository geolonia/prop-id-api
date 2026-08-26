import { promisify } from 'util'
import path from 'path'
import fs from 'fs/promises'
import async from 'async'
import {
  AthenaClient,
  StartQueryExecutionCommand,
  GetQueryResultsCommand,
  GetQueryResultsCommandInput
} from '@aws-sdk/client-athena'
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { BatchGetCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const sleep = promisify(setTimeout)

// Create a new Athena client. You can also provide configuration options here if needed.
const athenaClient = new AthenaClient({})

export async function* executeAthenaQuery(querySql: string) {
  // Start the query execution
  const startQueryResponse = await athenaClient.send(new StartQueryExecutionCommand({
    QueryString: querySql,
    ResultConfiguration: {
      OutputLocation: `s3://estate-id-api-nja-log-test/results`
    }
  }))

  let nextToken: string | undefined
  while (true) {
    try {
      const params: GetQueryResultsCommandInput = {
        QueryExecutionId: startQueryResponse.QueryExecutionId!,
      }
      if (nextToken) {
        params.NextToken = nextToken
      }

      // Get query results
      const result = await athenaClient.send(new GetQueryResultsCommand(params))
      const rows = result.ResultSet?.Rows || []
      yield *rows

      // Check if there are more results to fetch
      if (!result.NextToken) {
        break
      } else {
        nextToken = result.NextToken
      }

    } catch (err: any) {
      // Handle "QUEUED" or "RUNNING" states by waiting before retry
      if (err.name === 'InvalidRequestException' &&
         (err.message.includes('QUEUED') || err.message.includes('RUNNING'))) {
        await sleep(3000)
      } else {
        throw err
      }
    }
  }
}

// Main function
export async function main(argv: string[]) {
  const outFilePath = argv[0]
  if (!outFilePath) {
    throw new Error('Output file path is required')
  }
  console.log(`Output file path: ${outFilePath}`)

  const idStats: Map<string, {min_createat: string, max_createat: string, cnt: number}> = new Map()
  const idAttributes: Map<string, {address: string, rawAddress: string}> = new Map()

  await fs.mkdir(path.dirname(outFilePath), {recursive: true})
  const out = await fs.open(outFilePath, 'w')
  await out.write('id,min_createat,max_createat,cnt,address,rawAddress\n')
  const idOutputQueue = async.queue<string>(async (id) => {
    const {min_createat, max_createat, cnt} = idStats.get(id)!;
    const {address, rawAddress} = idAttributes.get(id)!;
    await out.write(`${id},${min_createat},${max_createat},${cnt},${address},${rawAddress}\n`);
    idStats.delete(id);
    idAttributes.delete(id);
  }, 1)

  const idFetchQueue = async.cargoQueue<Record<string, string>>(async (task) => {
    const command = new BatchGetCommand({
      RequestItems: {
        'estate-id-v1': {
          // Each entry in Keys is an object that specifies a primary key.
          Keys: task,
          // Only return the "Title" and "PageCount" attributes.
          ProjectionExpression: "estateId, address, rawAddress",
        },
      },
    });
    const response = await docClient.send(command);
    // Re-queue unprocessed keys, but still write out the items that were returned in this batch.
    const unprocessedKeys = response.UnprocessedKeys?.['estate-id-v1']?.Keys || [];
    if (unprocessedKeys.length > 0) {
      console.error(`Unprocessed items (${unprocessedKeys.length}), re-queueing`);
      idFetchQueue.push(unprocessedKeys as Record<string, string>[]);
    }
    const items = response.Responses?.['estate-id-v1'] || [];
    for (const item of items) {
      idAttributes.set(item.estateId, {address: item.address, rawAddress: item.rawAddress});
      idOutputQueue.push(item.estateId);
    }
  }, 10, 100)

  const querySql = `
    SELECT
        t.id,
        min(p.createat) as min_createat,
        max(p.createat) as max_createat,
        COUNT(*) AS cnt
    FROM propid_api_logs_v1 p
    CROSS JOIN UNNEST(
        CAST(json_extract(p."json", '$.estateIds') AS ARRAY(VARCHAR))
    ) AS t (id)
    WHERE p.logtype = 'idIssSts'
    GROUP BY t.id;
  `;
  let header = true
  for await (const row of executeAthenaQuery(querySql)) {
    if (header) {
      header = false
      continue
    }
    const [id, min_createat, max_createat, cnt] = row.Data!.map(({VarCharValue}) => VarCharValue)
    // console.log(`${id}: ${cnt}`)
    idStats.set(id!, {min_createat: min_createat!, max_createat: max_createat!, cnt: parseInt(cnt!)})
    idFetchQueue.push({estateId: id!})
  }

  await idFetchQueue.drain()
  await idOutputQueue.drain()
  await out.close()
}

main(process.argv.slice(2))
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
