import {type SanityDocument} from '@sanity/types'
import {afterEach, describe, expect, it, vi} from 'vitest'

import {at, patch, set} from '../../mutations/index.js'
import {type APIConfig, type Migration, type MigrationProgress} from '../../types.js'
import {run} from '../run.js'

const api: APIConfig = {
  apiVersion: 'v2024-01-01',
  dataset: 'test',
  projectId: 'abc123',
  token: 'token',
}

// Big enough that batchMutations (256KB max body size) spreads the mutations over several batches
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

interface MutateCall {
  mutationCount: number
  transactionId: string | undefined
}

function isMutateBody(value: unknown): value is {mutations: unknown[]; transactionId?: string} {
  if (typeof value !== 'object' || value === null || !('mutations' in value)) return false
  if (!Array.isArray(value.mutations)) return false
  return !('transactionId' in value) || typeof value.transactionId === 'string'
}

/** Mimics an undici client-side timeout: `TypeError: fetch failed` wrapping a code-carrying cause */
function headersTimeoutError(): TypeError {
  const cause = new Error('Headers Timeout Error')
  cause.name = 'HeadersTimeoutError'
  Object.assign(cause, {code: 'UND_ERR_HEADERS_TIMEOUT'})
  return new TypeError('fetch failed', {cause})
}

/**
 * Stubs `fetch` so the export endpoint streams `documents`, and each mutate request is handed to
 * `onMutate`, which decides how (and when) that request settles.
 */
function stubFetch(
  documents: SanityDocument[],
  onMutate: (call: MutateCall, index: number) => Promise<Response>,
) {
  const calls: MutateCall[] = []
  const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
    const href = String(url)
    if (href.includes('/data/export/')) {
      return new Response(documents.map((doc) => JSON.stringify(doc)).join('\n'), {status: 200})
    }
    if (href.includes('/data/mutate/')) {
      const body: unknown = JSON.parse(String(init?.body))
      if (!isMutateBody(body)) {
        throw new Error(`Unexpected mutate request body: ${String(init?.body)}`)
      }
      const call: MutateCall = {
        mutationCount: body.mutations.length,
        transactionId: body.transactionId,
      }
      const index = calls.length
      calls.push(call)
      return onMutate(call, index)
    }
    throw new Error(`Unexpected request to ${href}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return calls
}

function okResponse(transactionId: string | undefined): Response {
  return Response.json({results: [], transactionId: transactionId ?? 'server-txn'}, {status: 200})
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe('run', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reports transactions that committed before another request failed', async () => {
    // Enough documents to fill more batches than the default concurrency of 6
    const documents = createDocuments(24)
    let committed = 0
    stubFetch(documents, async (call, index) => {
      if (index === 0) {
        // The first request stalls long enough for the rest to commit, then times out client-side
        await wait(50)
        throw headersTimeoutError()
      }
      await wait(5)
      committed++
      return okResponse(call.transactionId)
    })

    const progress: MigrationProgress[] = []
    const [error] = await run({api, onProgress: (event) => progress.push(event)}, migration).then(
      () => [undefined],
      (err: unknown) => [err],
    )

    expect(error).toBeInstanceOf(Error)

    // Every transaction the server committed must be reported as committed
    expect(committed).toBeGreaterThan(0)
    expect(progress.at(-1)?.completedTransactions).toHaveLength(committed)
  })

  it('decrements pending as requests settle', async () => {
    const documents = createDocuments(8)
    stubFetch(documents, async (call) => {
      await wait(5)
      return okResponse(call.transactionId)
    })

    const progress: MigrationProgress[] = []
    await run({api, onProgress: (event) => progress.push(event)}, migration)

    expect(progress.at(-1)?.pending).toBe(0)
  })
})
