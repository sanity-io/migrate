import {type SanityDocument} from '@sanity/types'
import {type MockResponseDef, streamBody} from 'get-it/mock'
import {afterEach, describe, expect, it, vi} from 'vitest'

import {at, patch, set} from '../../mutations/index.js'
import {type APIConfig, type Migration, type MigrationProgress} from '../../types.js'
import {run} from '../run.js'

const {fetchMock, mock} = await vi.hoisted(async () => {
  const {createMockFetch} = await import('get-it/mock')
  const mock = createMockFetch()
  return {fetchMock: vi.fn(mock.fetch), mock}
})

vi.mock('get-it/node', () => ({createNodeFetch: () => fetchMock}))

const api: APIConfig = {
  apiVersion: 'v2024-01-01',
  dataset: 'test',
  projectId: 'abc123',
  token: 'token',
}

// Big enough that batchMutations (256KB max body size) puts 4 mutations in each batch
const FILLER = 'x'.repeat(64 * 1024)

function createDocuments(count: number): SanityDocument[] {
  return Array.from({length: count}, (_unused, i) => ({
    _createdAt: '2024-02-16T14:13:59Z',
    _id: `doc-${i}`,
    _rev: 'rev',
    _type: 'article',
    _updatedAt: '2024-02-16T14:13:59Z',
  }))
}

const migration: Migration = {
  migrate: {
    document(doc) {
      return patch(doc._id, [at('filler', set(FILLER))])
    },
  },
  title: 'test migration',
}

function isMutateBody(value: unknown): value is {mutations: unknown[]; transactionId?: string} {
  if (typeof value !== 'object' || value === null || !('mutations' in value)) return false
  if (!Array.isArray(value.mutations)) return false
  return !('transactionId' in value) || typeof value.transactionId === 'string'
}

/** Asserts and narrows in one go, so tests can use the value without a non-null assertion */
function expectString(value: unknown): string {
  expect(value).toEqual(expect.any(String))
  if (typeof value !== 'string') throw new TypeError('expected a string')
  return value
}

/** Mimics an undici client-side timeout: `TypeError: fetch failed` wrapping a code-carrying cause */
function headersTimeoutError(): TypeError {
  const cause = new Error('Headers Timeout Error')
  cause.name = 'HeadersTimeoutError'
  Object.assign(cause, {code: 'UND_ERR_HEADERS_TIMEOUT'})
  return new TypeError('fetch failed', {cause})
}

function stubRequests(documents: SanityDocument[]) {
  mock
    .on('GET', (url) => url.includes('/data/export/'))
    .respond({
      body: streamBody(...documents.map((doc) => `${JSON.stringify(doc)}\n`)),
    })
  return mock.on('POST', (url) => url.includes('/data/mutate/'))
}

function mutateCalls() {
  return mock
    .getRequests()
    .filter((req) => req.url.includes('/data/mutate/'))
    .map(({body}) => {
      if (!isMutateBody(body)) throw new Error('Unexpected mutate request body')
      return body
    })
}

function okResponse(transactionId = 'server-txn'): MockResponseDef {
  return {body: {results: [], transactionId}}
}

describe('run', () => {
  afterEach(() => {
    fetchMock.mockReset()
    mock.assertAllConsumed()
    mock.clear()
  })

  it('reports transactions that committed before another request failed', async () => {
    const documents = createDocuments(8)
    const failFirst = Promise.withResolvers<void>()
    const timeout = headersTimeoutError()
    stubRequests(documents).respondWithError(timeout).respond(okResponse('committed-txn'))
    fetchMock
      .mockImplementationOnce(mock.fetch) // Export request.
      .mockImplementationOnce(async (...args) => {
        try {
          return await mock.fetch(...args)
        } catch (error) {
          // Record the first mutation request, but hold its failure until the second commits.
          await failFirst.promise
          throw error
        }
      })

    const progress: MigrationProgress[] = []
    const result = run(
      {
        api,
        concurrency: 2,
        onProgress(event) {
          progress.push({...event, completedTransactions: [...event.completedTransactions]})
        },
      },
      migration,
    ).catch((cause: unknown) => cause)

    try {
      await vi.waitFor(() => {
        expect(progress.at(-1)?.completedTransactions).toHaveLength(1)
      })
    } finally {
      // Settle the stalled request even if the progress assertion fails.
      failFirst.resolve()
      await result
    }
    const error: unknown = await result
    expect(error).toBeInstanceOf(Error)
    expect(error).toMatchObject({cause: timeout, name: 'UnknownTransactionOutcomeError'})
    expect(mutateCalls()).toHaveLength(2)
    expect(progress.at(-1)?.completedTransactions).toEqual([
      {results: [], transactionId: 'committed-txn'},
    ])
  })

  it('assigns a transaction id to every submitted transaction', async () => {
    const documents = createDocuments(8)
    stubRequests(documents).respondPersist(okResponse())

    await run({api}, migration)

    const calls = mutateCalls()
    expect(calls.length).toBeGreaterThan(1)
    const ids = calls.map((call) => expectString(call.transactionId))
    expect(new Set(ids).size).toBe(calls.length)
  })

  it('reports the outcome of a timed-out transaction as unknown, naming its transaction id', async () => {
    const documents = createDocuments(1)
    stubRequests(documents).respondWithError(headersTimeoutError())

    const [error] = await run({api}, migration).then(
      () => [undefined],
      (err: unknown) => [err],
    )

    expect(error).toBeInstanceOf(Error)
    if (!(error instanceof Error)) throw new Error('expected an Error')

    // Must not imply nothing was written, and must name the transaction so it can be looked up
    expect(error.message).toMatch(/unknown/i)
    expect(error.message).toContain(expectString(mutateCalls().at(0)?.transactionId))
    expect(error.message).toMatch(/history/i)
  })

  it('reports a rejected transaction as not applied', async () => {
    const documents = createDocuments(1)
    stubRequests(documents).respond({
      body: {error: {description: 'Nope', type: 'mutationError'}},
      status: 400,
    })

    const [error] = await run({api}, migration).then(
      () => [undefined],
      (err: unknown) => [err],
    )

    expect(error).toBeInstanceOf(Error)
    if (!(error instanceof Error)) throw new Error('expected an Error')
    expect(error.message).toContain('Nope')
    expect(error.message).not.toMatch(/unknown/i)
  })

  it('reports server failures as unknown without retrying the mutation', async () => {
    stubRequests(createDocuments(1)).respond({
      body: {error: 'Service unavailable'},
      status: 503,
    })

    const error: unknown = await run({api}, migration).catch((cause: unknown) => cause)
    expect(error).toBeInstanceOf(Error)
    if (!(error instanceof Error)) throw new Error('expected an Error')
    expect(error.name).toBe('UnknownTransactionOutcomeError')
    expect(error.cause).toMatchObject({name: 'HttpError', status: 503})
    expect(mutateCalls()).toHaveLength(1)
  })

  it('decrements pending as requests settle', async () => {
    const documents = createDocuments(8)
    stubRequests(documents).respondPersist({...okResponse(), delay: 5})

    const progress: MigrationProgress[] = []
    await run({api, onProgress: (event) => progress.push(event)}, migration)

    expect(progress.at(-1)?.pending).toBe(0)
  })
})
