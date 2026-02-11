import {type SanityDocument} from '@sanity/types'

import {matchesFilter, parseGroqFilter} from '../../it-utils/groqFilter.js'
import {type Migration} from '../../types.js'

function isSystemDocumentId(id: string) {
  return id.startsWith('_.')
}

export async function* applyFilters(
  migration: Migration,
  documents: AsyncIterableIterator<SanityDocument>,
) {
  const documentTypes = migration.documentTypes
  const parsedFilter = migration.filter ? parseGroqFilter(migration.filter) : undefined

  for await (const doc of documents) {
    if (isSystemDocumentId(doc._id)) {
      continue
    }
    if (documentTypes && documentTypes.length > 0 && !documentTypes.includes(doc._type)) {
      continue
    }
    if (parsedFilter && !(await matchesFilter(parsedFilter, doc))) {
      continue
    }
    yield doc
  }
}
