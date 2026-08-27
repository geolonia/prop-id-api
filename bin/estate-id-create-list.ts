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

// Maximum number of times a key is allowed to come back in UnprocessedKeys before we give up
// on it and fail loudly, instead of retrying forever.
export const MAX_BATCH_GET_RETRIES = 5
// Base delay (ms) for the exponential backoff applied before re-queueing unprocessed keys.
export const BATCH_GET_BASE_DELAY_MS = 100
// Upper bound (ms) for the exponential backoff, so the delay doesn't grow unbounded.
export const BATCH_GET_MAX_DELAY_MS = 5000

// Exponential backoff delay for the given (1-indexed) retry attempt, capped at maxDelayMs.
export function computeBackoffDelayMs(
  attempt: number,
  baseDelayMs: number = BATCH_GET_BASE_DELAY_MS,
  maxDelayMs: number = BATCH_GET_MAX_DELAY_MS,
): number {
  return Math.min(baseDelayMs * (2 ** (attempt - 1)), maxDelayMs)
}

interface CreateIdFetchQueueOptions {
  docClient: { send: (command: BatchGetCommand) => Promise<any> }
  idAttributes: Map<string, {address: string, rawAddress: string}>
  idOutputQueue: { push: (id: string) => void }
  maxRetries?: number
  sleepFn?: (ms: number) => Promise<void>
}

// Builds the cargoQueue that drives BatchGetItem calls, re-queueing UnprocessedKeys with
// exponential backoff up to `maxRetries` times. Extracted from `main` so it can be unit
// tested with a mocked docClient/sleepFn, without touching real DynamoDB or real timers.
export function createIdFetchQueue(options: CreateIdFetchQueueOptions) {
  const maxRetries = options.maxRetries ?? MAX_BATCH_GET_RETRIES
  const sleepFn = options.sleepFn ?? sleep
  // How many times each estateId has come back in UnprocessedKeys so far.
  const retryAttempts: Map<string, number> = new Map()
  // Errors raised by the worker (e.g. a key exceeding maxRetries) end up here instead of
  // being silently dropped by async's cargoQueue, which does not reject on worker errors.
  const fetchErrors: Error[] = []

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
    const response = await options.docClient.send(command);

    // Write out the items that were returned in this batch first, regardless of whether
    // some keys in the same response are unprocessed or later exceed the retry limit.
    const items = response.Responses?.['estate-id-v1'] || [];
    for (const item of items) {
      options.idAttributes.set(item.estateId, {address: item.address, rawAddress: item.rawAddress});
      options.idOutputQueue.push(item.estateId);
    }

    const unprocessedKeys = response.UnprocessedKeys?.['estate-id-v1']?.Keys || [];
    if (unprocessedKeys.length === 0) {
      return
    }

    const toRetry: Record<string, string>[] = []
    const exceeded: Record<string, string>[] = []
    let maxAttempt = 0
    for (const key of unprocessedKeys as Record<string, string>[]) {
      const attempt = (retryAttempts.get(key.estateId) || 0) + 1
      retryAttempts.set(key.estateId, attempt)
      maxAttempt = Math.max(maxAttempt, attempt)
      if (attempt > maxRetries) {
        exceeded.push(key)
      } else {
        toRetry.push(key)
      }
    }

    if (toRetry.length > 0) {
      console.error(`Unprocessed items (${toRetry.length}), re-queueing after backoff (attempt ${maxAttempt}/${maxRetries})`);
      await sleepFn(computeBackoffDelayMs(maxAttempt))
      idFetchQueue.push(toRetry);
    }

    if (exceeded.length > 0) {
      // Fail loudly instead of retrying forever or silently dropping these keys: the caller
      // (main) surfaces this via fetchErrors and exits non-zero once the queue drains.
      throw new Error(
        `BatchGet: exceeded max retries (${maxRetries}) for ${exceeded.length} key(s): ${JSON.stringify(exceeded)}`
      )
    }
  }, 10, 100)

  // cargoQueue does not reject drain()/the push() promise on worker errors - it only emits
  // an 'error' event and keeps processing other tasks. Capture it here so main() can still
  // fail the process instead of silently continuing as if nothing happened.
  idFetchQueue.error((err: unknown) => {
    fetchErrors.push(err instanceof Error ? err : new Error(String(err)))
  })

  return { idFetchQueue, fetchErrors }
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
