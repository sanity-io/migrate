import {type SanityDocument} from '@sanity/types'

import {decodeText, type JSONParser, parse} from '../../it-utils/index.js'
import {safeJsonParser} from '../../sources/fromExportEndpoint.js'
import {type MigrationContext} from '../../types.js'
import {streamToAsyncIterator} from '../../utils/streamToAsyncIterator.js'

export function createFilteredDocumentsClient(
  getFilteredDocumentsReadableStream: () => ReadableStream<Uint8Array>,
): MigrationContext['filtered'] {
  function getAllDocumentsFromBuffer<T extends SanityDocument>() {
    return parse<T>(decodeText(streamToAsyncIterator(getFilteredDocumentsReadableStream())), {
      parse: safeJsonParser as JSONParser<T>,
    })
  }

  async function getDocumentsFromBuffer<T extends SanityDocument>(ids: string[]): Promise<T[]> {
    const found: {[id: string]: T} = {}
    let remaining = ids.length
    for await (const doc of getAllDocumentsFromBuffer<T>()) {
      if (ids.includes(doc._id)) {
        remaining--
        found[doc._id] = doc
      }
      if (remaining === 0) break
    }
    return ids.map((id) => found[id]).filter((item): item is T => item !== undefined)
  }

  async function getDocumentFromBuffer<T extends SanityDocument>(
    id: string,
  ): Promise<T | undefined> {
    return (await getDocumentsFromBuffer<T>([id]))[0]
  }

  return {
    getDocument: getDocumentFromBuffer,
    getDocuments: getDocumentsFromBuffer,
  }
}
