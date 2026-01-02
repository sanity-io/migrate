import {type MultipleMutationResult} from '@sanity/client'
import {type SanityDocument} from '@sanity/types'
import arrify from 'arrify'

import {endpoints} from '../fetch-utils/endpoints.js'
import {fetchAsyncIterator, type FetchOptions} from '../fetch-utils/fetchStream.js'
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
import {applyFilters} from './utils/applyFilters.js'
import {batchMutations} from './utils/batchMutations.js'
import {createContextClient} from './utils/createContextClient.js'
import {createFilteredDocumentsClient} from './utils/createFilteredDocumentsClient.js'
import {createBufferFile} from './utils/getBufferFile.js'
import {toSanityMutations, type TransactionPayload} from './utils/toSanityMutations.js'

/**
 * @public
 */
export interface MigrationRunnerConfig {
  api: APIConfig

  concurrency?: number
  onProgress?: (event: MigrationProgress) => void
}

/**
 * @public
 */
export async function* toFetchOptionsIterable(
  apiConfig: APIConfig,
  mutations: AsyncIterableIterator<TransactionPayload>,
) {
  for await (const transaction of mutations) {
    yield toFetchOptions({
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

  const commits = await mapAsync(
    toFetchOptionsIterable(config.api, batches),
    (opts) => {
      config.onProgress?.({...stats, pending: ++stats.pending})
      return submit(opts)
    },
    concurrency,
  )

  for await (const result of commits) {
    stats.completedTransactions.push(result)
    config.onProgress?.({
      ...stats,
    })
  }
  config.onProgress?.({
    ...stats,
    done: true,
  })

  // Cancel export/buffer stream, it's not needed anymore
  abortController.abort()
}
