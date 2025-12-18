import {type SanityDocument} from '@sanity/types'
import {evaluate, type ExprNode, parse} from 'groq-js'

import {type Migration} from '../../types.js'

function isSystemDocumentId(id: string) {
  return id.startsWith('_.')
}

function parseGroqFilter(filter: string) {
  try {
    return parse(`*[${filter}]`)
  } catch (err) {
    if (err instanceof Error) {
      err.message = `Failed to parse GROQ filter "${filter}": ${err.message}`
      throw err
    }
    throw new Error(`Failed to parse GROQ filter "${filter}": ${String(err)}`)
  }
}

export async function matchesFilter(parsedFilter: ExprNode, document: SanityDocument) {
  const result = await (await evaluate(parsedFilter, {dataset: [document]})).get()
  return result.length === 1
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
