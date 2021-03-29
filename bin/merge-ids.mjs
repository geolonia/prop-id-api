import { mergeEstateId } from "../dist/lib/dynamodb.js"

export const main = async (stage = 'dev') => {
  const [,,fromId,toId] = process.argv

  process.stderr.write(`Stage: ${stage}\n`)
  process.stderr.write(`Merge ID: ${fromId}\n`)
  process.stderr.write(`Merge ID To: ${toId}\n`)

  const resp = await mergeEstateId({
    from: [fromId],
    to: toId,
  })

  if (resp.error) {
    process.stderr.write(`Error: ${resp.errorType}\n`)
    process.exit(1)
  }

  process.stderr.write(`Done!\n`)
}

main()
