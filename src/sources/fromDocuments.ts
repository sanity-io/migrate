import {type SanityDocument} from '@sanity/types'

/**
 * @public
 */
export function* fromDocuments(documents: SanityDocument[]) {
  for (const document of documents) {
    yield document
  }
}
