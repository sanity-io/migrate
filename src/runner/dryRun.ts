import {type SanityDocument} from '@sanity/types'

import {bufferThroughFile} from '../fs-webstream/bufferThroughFile.js'
import {decodeText} from '../it-utils/index.js'
import {parse, stringify} from '../it-utils/ndjson.js'
import {fromExportArchive} from '../sources/fromExportArchive.js'
import {fromExportEndpoint, safeJsonParser} from '../sources/fromExportEndpoint.js'
import {type APIConfig, type Migration, type MigrationContext} from '../types.js'
import {asyncIterableToStream} from '../utils/asyncIterableToStream.js'
import {streamToAsyncIterator} from '../utils/streamToAsyncIterator.js'
import {collectMigrationMutations} from './collectMigrationMutations.js'
import {applyFilters} from './utils/applyFilters.js'
import {createContextClient} from './utils/createContextClient.js'
import {createFilteredDocumentsClient} from './utils/createFilteredDocumentsClient.js'
import {createBufferFile} from './utils/getBufferFile.js'

/**
 * @public
 */
export interface MigrationRunnerOptions {
  api: APIConfig

  exportPath?: string
}

/**
 * @public
 */
export async function* dryRun(config: MigrationRunnerOptions, migration: Migration) {
  const source = config.exportPath
    ? fromExportArchive(config.exportPath)
    : streamToAsyncIterator(
        await fromExportEndpoint({
          ...config.api,
          ...(migration.documentTypes !== undefined && {documentTypes: migration.documentTypes}),
        }),
      )

  const filteredDocuments = applyFilters(
    migration,
    parse<SanityDocument>(decodeText(source), {parse: safeJsonParser}),
  )

  const abortController = new AbortController()

  const createReader = bufferThroughFile(
    asyncIterableToStream(stringify(filteredDocuments)),
    await createBufferFile(),
    {signal: abortController.signal},
  )

  // Create a client exposed to the migration script. This will have a max concurrency of 10
  const client = createContextClient({...config.api, useCdn: false})

  const filteredDocumentsClient = createFilteredDocumentsClient(createReader)
  const context: MigrationContext = {
    client,
    dryRun: true,
    filtered: filteredDocumentsClient,
  }

  yield* collectMigrationMutations(
    migration,
    () => parse(decodeText(streamToAsyncIterator(createReader())), {parse: safeJsonParser}),
    context,
  )

  // stop buffering the export once we're done collecting all mutations
  abortController.abort()
}
