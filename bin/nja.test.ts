import { normalize } from '@geolonia/normalize-japanese-addresses'
import njapkg from '@geolonia/normalize-japanese-addresses/package.json';
import AWS from 'aws-sdk'

AWS.config.region = 'ap-northeast-1'

const { PREV_NJA_VERSION = '0.0.0', STAGE = 'dev'} = process.env
const CURRENT_NJA_VERSION = njapkg.version

console.error(`[${STAGE}] Testing regression between NJA@${PREV_NJA_VERSION}...${CURRENT_NJA_VERSION}.`)

const [major, minor, patch] = CURRENT_NJA_VERSION.split('.')

const athena = new AWS.Athena()
const sleep = (msec: number) => new Promise<void>((resolve) => setTimeout(() => resolve(), msec))

const startQuery = async () => {
    const [MAJOR_SELECTOR, MINOR_SELECTOR, PATCH_SELECTOR] = [1,2,3].map(index => `cast(split(coalesce(cast(json_extract(json, '$.deps.nja') AS varchar), '0.0.0'), '.')[${index}] AS integer)`)
    const startQueryExecutionInput: AWS.Athena.StartQueryExecutionInput = {
      QueryString: `
      SELECT cast(json_extract(json, '$.input') AS varchar) AS input,
            cast(json_extract(json, '$.nja') AS varchar) AS output,
            ${MAJOR_SELECTOR} AS minor,
            ${MINOR_SELECTOR} AS patch,
            ${PATCH_SELECTOR} AS major,
            YEAR,
            MONTH,
            DAY,
            createat
      FROM default.propid_api_logs_${STAGE}
      WHERE
        logType = 'normLogsNJA'
        AND ${major} > ${MAJOR_SELECTOR}
        OR (
          ${major} = ${MAJOR_SELECTOR}
          AND ${minor} > ${MINOR_SELECTOR}
        )
        OR (
          ${major} = ${MAJOR_SELECTOR}
          AND ${minor} = ${MINOR_SELECTOR}
          AND ${patch} > ${PATCH_SELECTOR}
        )
      `,
      ResultConfiguration: {
        OutputLocation: 's3://estate-id-api-nja-log-test/results'
      }
    }
    const startQueryExecutionOutput = await athena.startQueryExecution(startQueryExecutionInput).promise()
    return startQueryExecutionOutput.QueryExecutionId!
}

const waitQuery = async (queryExecutionId: string) => {
  let running = true
  let state: string = ''
  do {
    await sleep(1000)
    const getQueryExecutionInput: AWS.Athena.GetQueryExecutionInput = { QueryExecutionId: queryExecutionId }
    const queryExecution = await athena.getQueryExecution(getQueryExecutionInput).promise()
    state = queryExecution.QueryExecution?.Status?.State || ''
  } while (running = (state  === 'RUNNING' || state === 'QUEUED'));

  if (state !== 'SUCCEEDED') {
    throw new Error(`Query ${queryExecutionId} failed.`)
  }
}

async function * getQueryResult (queryExecutionId: string) {

  const getQueryResultsInputBase: AWS.Athena.GetQueryResultsInput = { QueryExecutionId: queryExecutionId }
  let nextToken: undefined | string = undefined
  let hasHeaderSkipped = false

  do {
    const getQueryResultsInput: AWS.Athena.GetQueryResultsInput = { ...getQueryResultsInputBase, NextToken: nextToken }
    const { ResultSet: { Rows, ResultSetMetadata } = {}, NextToken } = await athena.getQueryResults(getQueryResultsInput).promise()
    const { ColumnInfo } = ResultSetMetadata || { ColumnInfo: [] }

    const rows = Rows || []
    if (!hasHeaderSkipped) {
      rows.shift()
      hasHeaderSkipped = true
    }

    const items = rows.map((row) => {
      const cols = row.Data || []
      const item = cols.reduce<any>((prev, col, index) => {
        const key = ColumnInfo![index].Name as string
        prev[key] = col.VarCharValue
        return prev
      }, {})
      return item
    })


    yield items
    nextToken = NextToken
  } while (nextToken);
}

export type NJARegressionResult = {
  data: { input: string, createAt: string, prevOutput: string, currentOutput: string }[],
  meta: {
    PREV_NJA_VERSION: string,
    CURRENT_NJA_VERSION: string,
    STAGE: string,
  }
}

const main = async () => {

  // start and wait the athena query execution
  const quertExecutionId = await startQuery()
  await waitQuery(quertExecutionId)

  const results: NJARegressionResult = { data: [], meta: { PREV_NJA_VERSION, CURRENT_NJA_VERSION, STAGE } }
  for await (const rows of getQueryResult(quertExecutionId)) {
    console.error(`Testing ${rows.length} items...`)
    for (const row of rows) {
      const { input, createat: createAt, output: prevOutput } = row
      const { pref, city, town, addr } = await normalize(input)
      const currentOutput = `${pref}${city}${town}${addr}`
      if(currentOutput !== prevOutput) {
        results.data.push({ input, createAt, prevOutput, currentOutput })
      }
    }
  }
  process.stdout.write(JSON.stringify(results, null, 2) + '\n')
}

main()
