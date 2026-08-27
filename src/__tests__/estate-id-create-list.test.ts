import {
  createIdFetchQueue,
  computeBackoffDelayMs,
  MAX_BATCH_GET_RETRIES,
} from '../../bin/estate-id-create-list'

type Key = { estateId: string }
type Item = { estateId: string, address: string, rawAddress: string }

const toItem = (key: Key): Item => ({ estateId: key.estateId, address: `addr-${key.estateId}`, rawAddress: `raw-${key.estateId}` })

// A minimal stand-in for DynamoDBDocumentClient: each call is answered by shifting the next
// scripted response off `responses`, keyed by the batch of keys the caller asked for.
const makeMockDocClient = (responder: (keys: Key[], callIndex: number) => {
  processed: Key[],
  unprocessed: Key[],
}) => {
  let callIndex = 0
  const calls: Key[][] = []
  const send = jest.fn(async (command: any) => {
    const keys: Key[] = command.input.RequestItems['estate-id-v1'].Keys
    calls.push(keys)
    const { processed, unprocessed } = responder(keys, callIndex)
    callIndex += 1
    return {
      Responses: { 'estate-id-v1': processed.map(toItem) },
      UnprocessedKeys: unprocessed.length > 0
        ? { 'estate-id-v1': { Keys: unprocessed } }
        : undefined,
    }
  })
  return { send, calls }
}

const runQueue = async (keys: Key[], docClient: { send: jest.Mock }, opts: { maxRetries?: number, sleepFn?: (ms: number) => Promise<void> } = {}) => {
  const idAttributes: Map<string, { address: string, rawAddress: string }> = new Map()
  const output: string[] = []
  const idOutputQueue = { push: (id: string) => { output.push(id) } }

  const { idFetchQueue, fetchErrors } = createIdFetchQueue({
    docClient,
    idAttributes,
    idOutputQueue,
    ...opts,
  })

  for (const key of keys) {
    idFetchQueue.push(key)
  }
  await idFetchQueue.drain()

  return { idAttributes, output, fetchErrors }
}

describe('computeBackoffDelayMs', () => {
  it('grows exponentially with the attempt number', () => {
    expect(computeBackoffDelayMs(1, 100, 5000)).toBe(100)
    expect(computeBackoffDelayMs(2, 100, 5000)).toBe(200)
    expect(computeBackoffDelayMs(3, 100, 5000)).toBe(400)
    expect(computeBackoffDelayMs(4, 100, 5000)).toBe(800)
  })

  it('caps the delay at maxDelayMs', () => {
    expect(computeBackoffDelayMs(10, 100, 5000)).toBe(5000)
  })
})

describe('createIdFetchQueue', () => {
  it('keeps items returned in a response even when the same response has UnprocessedKeys (regression for #437)', async () => {
    const keys: Key[] = [{ estateId: 'a' }, { estateId: 'b' }, { estateId: 'c' }, { estateId: 'd' }, { estateId: 'e' }, { estateId: 'f' }]
    const { send, calls } = makeMockDocClient((requested, callIndex) => {
      if (callIndex === 0) {
        // First call: e and f come back unprocessed, a-d succeed.
        const unprocessed = requested.filter((k) => k.estateId === 'e' || k.estateId === 'f')
        const processed = requested.filter((k) => !unprocessed.includes(k))
        return { processed, unprocessed }
      }
      // Retry call: everything succeeds.
      return { processed: requested, unprocessed: [] }
    })

    const { idAttributes, output, fetchErrors } = await runQueue(keys, { send }, { sleepFn: async () => {} })

    expect(fetchErrors).toHaveLength(0)
    expect(idAttributes.size).toBe(6)
    expect(new Set(output)).toEqual(new Set(['a', 'b', 'c', 'd', 'e', 'f']))
    // No duplicates: each key should have been written out exactly once.
    expect(output).toHaveLength(new Set(output).size)
    expect(send).toHaveBeenCalledTimes(2)
  })

  it('handles a response with no Responses and only UnprocessedKeys (all keys unprocessed)', async () => {
    const keys: Key[] = [{ estateId: 'x' }, { estateId: 'y' }]
    const { send } = makeMockDocClient((requested, callIndex) => {
      if (callIndex === 0) {
        return { processed: [], unprocessed: requested }
      }
      return { processed: requested, unprocessed: [] }
    })

    const { idAttributes, output, fetchErrors } = await runQueue(keys, { send }, { sleepFn: async () => {} })

    expect(fetchErrors).toHaveLength(0)
    expect(idAttributes.size).toBe(2)
    expect(new Set(output)).toEqual(new Set(['x', 'y']))
  })

  it('fails loudly with the offending keys once a key exceeds maxRetries, without dropping other items', async () => {
    const keys: Key[] = [{ estateId: 'stuck' }, { estateId: 'fine' }]
    const { send } = makeMockDocClient((requested) => {
      // 'stuck' never succeeds; 'fine' succeeds on the very first call.
      const unprocessed = requested.filter((k) => k.estateId === 'stuck')
      const processed = requested.filter((k) => k.estateId === 'fine')
      return { processed, unprocessed }
    })

    const { idAttributes, output, fetchErrors } = await runQueue(keys, { send }, { maxRetries: 2, sleepFn: async () => {} })

    // 'fine' must still make it through even though 'stuck' ultimately fails.
    expect(idAttributes.size).toBe(1)
    expect(output).toEqual(['fine'])

    expect(fetchErrors).toHaveLength(1)
    expect(fetchErrors[0].message).toContain('exceeded max retries (2)')
    expect(fetchErrors[0].message).toContain('stuck')

    // 1 initial + 2 retries = 3 attempts total for the stuck key, then it gives up.
    expect(send).toHaveBeenCalledTimes(3)
  })

  it('uses the default MAX_BATCH_GET_RETRIES when maxRetries is not given', async () => {
    const keys: Key[] = [{ estateId: 'stuck' }]
    const { send } = makeMockDocClient(() => ({ processed: [], unprocessed: keys }))

    const { fetchErrors } = await runQueue(keys, { send }, { sleepFn: async () => {} })

    expect(fetchErrors).toHaveLength(1)
    expect(fetchErrors[0].message).toContain(`exceeded max retries (${MAX_BATCH_GET_RETRIES})`)
    expect(send).toHaveBeenCalledTimes(MAX_BATCH_GET_RETRIES + 1)
  })

  it('backs off with growing delays between retries, without waiting in real time', async () => {
    const keys: Key[] = [{ estateId: 'stuck' }]
    const { send } = makeMockDocClient((requested, callIndex) => {
      if (callIndex < 2) {
        return { processed: [], unprocessed: requested }
      }
      return { processed: requested, unprocessed: [] }
    })
    const sleepFn = jest.fn(async (_ms: number) => {})

    const { fetchErrors } = await runQueue(keys, { send }, { sleepFn })

    expect(fetchErrors).toHaveLength(0)
    expect(sleepFn).toHaveBeenCalledTimes(2)
    expect(sleepFn).toHaveBeenNthCalledWith(1, computeBackoffDelayMs(1))
    expect(sleepFn).toHaveBeenNthCalledWith(2, computeBackoffDelayMs(2))
    expect(sleepFn.mock.calls[1][0]).toBeGreaterThan(sleepFn.mock.calls[0][0])
  })
})
