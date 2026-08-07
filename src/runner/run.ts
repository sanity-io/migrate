import {randomUUID} from 'node:crypto'

import {type MultipleMutationResult} from '@sanity/client'
import {type SanityDocument} from '@sanity/types'
import arrify from 'arrify'

import baseDebug from '../debug.js'
import {endpoints} from '../fetch-utils/endpoints.js'
import {fetchAsyncIterator, type FetchOptions, HTTPError} from '../fetch-utils/fetchStream.js'
import {toFetchOptions} from '../fetch-utils/sanityRequestOptions.js'
import {bufferThroughFile} from '../fs-webstream/bufferThroughFile.js'
import {concatStr} from '../it-utils/concatStr.js'
import {decodeText, parseJSON} from '../it-utils/index.js'
import {lastValueFrom} from '../it-utils/lastValueFrom.js'
import {mapAsync} from '../it-utils/mapAsync.js'
import {parse, stringify} from '../it-utils/ndjson.js'
import {tap} from '../it-utils/tap.js'
import {fromExportEndpoint, safeJsonParser} from '../sources/fromExportEndpoint.js'
import {
  type APIConfig,
  type Migration,
  type MigrationContext,
  type MigrationProgress,
} from '../types.js'
import {asyncIterableToStream} from '../utils/asyncIterableToStream.js'
import {streamToAsyncIterator} from '../utils/streamToAsyncIterator.js'
import {collectMigrationMutations} from './collectMigrationMutations.js'
import {
  DEFAULT_MUTATION_CONCURRENCY,
  MAX_MUTATION_CONCURRENCY,
  MUTATION_ENDPOINT_MAX_BODY_SIZE,
} from './constants.js'
import {UnknownTransactionOutcomeError} from './errors.js'
import {applyFilters} from './utils/applyFilters.js'
import {batchMutations} from './utils/batchMutations.js'
import {createContextClient} from './utils/createContextClient.js'
import {createFilteredDocumentsClient} from './utils/createFilteredDocumentsClient.js'
import {createBufferFile} from './utils/getBufferFile.js'
import {toSanityMutations, type TransactionPayload} from './utils/toSanityMutations.js'

const debug = baseDebug.extend('run')

/**
 * A transaction that is guaranteed to carry an ID we chose ourselves, so it can be looked up in the
 * transaction log even if we never get to see the API response.
 */
type IdentifiedTransactionPayload = TransactionPayload & {transactionId: string}

/**
 * @public
 */
export interface MigrationRunnerConfig {
  api: APIConfig

  concurrency?: number
  onProgress?: (event: MigrationProgress) => void
}

function toTransactionFetchOptions(
  apiConfig: APIConfig,
  transaction: TransactionPayload,
): FetchOptions {
  return toFetchOptions({
    apiHost: apiConfig.apiHost ?? 'api.sanity.io',
    apiVersion: apiConfig.apiVersion,
    body: JSON.stringify(transaction),
    endpoint: endpoints.data.mutate(apiConfig.dataset, {
      autoGenerateArrayKeys: true,
      returnIds: true,
      visibility: 'async',
    }),
    projectId: apiConfig.projectId,
    tag: 'sanity.migration.mutate',
    token: apiConfig.token,
  })
}

/**
 * @public
 */
export async function* toFetchOptionsIterable(
  apiConfig: APIConfig,
  mutations: AsyncIterableIterator<TransactionPayload>,
) {
  for await (const transaction of mutations) {
    yield toTransactionFetchOptions(apiConfig, transaction)
  }
}

/**
 * Assigns an ID to every transaction that doesn't already have one. Without a client-side ID, a
 * request that never returns leaves us with no way to name, and therefore no way to look up, the
 * transaction it may have committed.
 */
async function* withTransactionIds(
  transactions: AsyncIterableIterator<TransactionPayload>,
): AsyncIterableIterator<IdentifiedTransactionPayload> {
  for await (const transaction of transactions) {
    yield transaction.transactionId === undefined
      ? {...transaction, transactionId: randomUUID()}
      : {...transaction, transactionId: transaction.transactionId}
  }
}

/**
 * Whether the error tells us the API rejected the transaction, in which case we know nothing was
 * written. Client-side timeouts, dropped connections and server errors all leave the outcome
 * undetermined: the transaction may well have committed before we gave up on the response.
 */
function isRejectedByApi(error: unknown): boolean {
  return error instanceof HTTPError && error.statusCode >= 400 && error.statusCode < 500
}

/**
 * @public
 */
export async function run(config: MigrationRunnerConfig, migration: Migration) {
  const stats: MigrationProgress = {
    completedTransactions: [],
    currentTransactions: [],
    documents: 0,
    mutations: 0,
    pending: 0,
    queuedBatches: 0,
  }

  const filteredDocuments = applyFilters(
    migration,
    parse<SanityDocument>(
      decodeText(
        streamToAsyncIterator(
          await fromExportEndpoint({
            ...config.api,
            ...(migration.documentTypes !== undefined && {documentTypes: migration.documentTypes}),
          }),
        ),
      ),
      {parse: safeJsonParser},
    ),
  )
  const abortController = new AbortController()

  const createReader = bufferThroughFile(
    asyncIterableToStream(stringify(filteredDocuments)),
    await createBufferFile(),
    {signal: abortController.signal},
  )

  const client = createContextClient({
    ...config.api,
    requestTagPrefix: 'sanity.migration',
    useCdn: false,
  })

  const filteredDocumentsClient = createFilteredDocumentsClient(createReader)
  const context: MigrationContext = {
    client,
    dryRun: false,
    filtered: filteredDocumentsClient,
  }

  const documents = () =>
    tap(
      parse<SanityDocument>(decodeText(streamToAsyncIterator(createReader())), {
        parse: safeJsonParser,
      }),
      () => {
        config.onProgress?.({...stats, documents: ++stats.documents})
      },
    )

  const mutations = tap(collectMigrationMutations(migration, documents, context), (muts) => {
    stats.currentTransactions = arrify(muts)
    config.onProgress?.({
      ...stats,
      mutations: ++stats.mutations,
    })
  })

  const concurrency = config?.concurrency ?? DEFAULT_MUTATION_CONCURRENCY

  if (concurrency > MAX_MUTATION_CONCURRENCY) {
    throw new Error(`Concurrency exceeds maximum allowed value (${MAX_MUTATION_CONCURRENCY})`)
  }

  const batches = tap(
    batchMutations(toSanityMutations(mutations), MUTATION_ENDPOINT_MAX_BODY_SIZE),
    () => {
      config.onProgress?.({...stats, queuedBatches: ++stats.queuedBatches})
    },
  )

  const submit = async (opts: FetchOptions): Promise<MultipleMutationResult> =>
    lastValueFrom(parseJSON(concatStr(decodeText(await fetchAsyncIterator(opts)))))

  // Transactions we have submitted but not heard back about. An entry is removed once the API has
  // either confirmed the commit or rejected it. Whatever is left when the run fails is, by
  // definition, in an unknown state.
  const unresolvedTransactions = new Set<string>()

  const commits = await mapAsync(
    withTransactionIds(batches),
    async (transaction) => {
      unresolvedTransactions.add(transaction.transactionId)
      config.onProgress?.({...stats, pending: ++stats.pending})
      try {
        const result = await submit(toTransactionFetchOptions(config.api, transaction))
        unresolvedTransactions.delete(transaction.transactionId)
        stats.pending--
        // Record the commit here rather than where results are consumed: results are delivered in
        // submission order, so a transaction that commits behind a slower request that later fails
        // would otherwise never be reported, making committed work look uncommitted.
        stats.completedTransactions.push(result)
        config.onProgress?.({...stats})
        return result
      } catch (error) {
        stats.pending--
        if (isRejectedByApi(error)) {
          unresolvedTransactions.delete(transaction.transactionId)
        }
        throw error
      }
    },
    concurrency,
  )

  try {
    for await (const result of commits) {
      debug('Committed transaction %s', result.transactionId)
    }
    config.onProgress?.({
      ...stats,
      done: true,
    })
  } catch (error) {
    // Anything still unresolved either failed without a response, or was in flight when we gave up.
    // Either way we can't claim it wasn't written.
    throw unresolvedTransactions.size > 0
      ? new UnknownTransactionOutcomeError([...unresolvedTransactions], {
          api: config.api,
          cause: error,
        })
      : error
  } finally {
    // Cancel export/buffer stream, it's not needed anymore
    abortController.abort()
  }
}
