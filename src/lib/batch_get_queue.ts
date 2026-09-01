import async from 'async'
import { BatchGetCommand, BatchGetCommandOutput } from "@aws-sdk/lib-dynamodb";
import { sleep } from './util'

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
  docClient: { send: (command: BatchGetCommand) => Promise<BatchGetCommandOutput> }
  idAttributes: Map<string, {address: string, rawAddress: string}>
  idOutputQueue: { push: (id: string) => void }
  maxRetries?: number
  sleepFn?: (ms: number) => Promise<void>
}

// Builds the cargoQueue that drives BatchGetItem calls against the estate-id-v1 table,
// re-queueing UnprocessedKeys with exponential backoff up to `maxRetries` times. Extracted
// from bin/estate-id-create-list.ts so it can be unit tested with a mocked docClient/sleepFn,
// without touching real DynamoDB or real timers.
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
    const response: BatchGetCommandOutput = await options.docClient.send(command);

    // Write out the items that were returned in this batch first, regardless of whether
    // some keys in the same response are unprocessed or later exceed the retry limit.
    const items = response.Responses?.['estate-id-v1'] || [];
    for (const item of items) {
      const estateId = item.estateId as string
      options.idAttributes.set(estateId, {address: item.address as string, rawAddress: item.rawAddress as string});
      options.idOutputQueue.push(estateId);
      // A key that has now succeeded doesn't need its attempt count remembered anymore.
      retryAttempts.delete(estateId)
    }

    const unprocessedKeys = (response.UnprocessedKeys?.['estate-id-v1']?.Keys || []) as Record<string, string>[];
    if (unprocessedKeys.length === 0) {
      return
    }

    const toRetry: Record<string, string>[] = []
    const exceeded: Record<string, string>[] = []
    let maxAttempt = 0
    for (const key of unprocessedKeys) {
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
