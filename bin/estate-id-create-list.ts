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
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { createIdFetchQueue } from '../src/lib/batch_get_queue'

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

  const {idFetchQueue, fetchErrors} = createIdFetchQueue({docClient, idAttributes, idOutputQueue})

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
  // Flush everything we did manage to fetch before failing, so a batch that eventually
  // exceeds the retry limit doesn't also discard the items that succeeded elsewhere.
  await idOutputQueue.drain()
  await out.close()

  if (fetchErrors.length > 0) {
    throw new Error(
      `BatchGet failed for ${fetchErrors.length} batch(es) after retrying:\n${fetchErrors.map((e) => e.message).join('\n')}`
    )
  }
}

/* istanbul ignore next -- exercised via manual runs (see README), not unit tests */
if (require.main === module) {
  main(process.argv.slice(2))
    .then(() => {
      process.exit(0)
    })
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}
