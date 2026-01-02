import {type SanityDocument} from '@sanity/types'

import {type Migration, type MigrationContext} from '../types.js'
import {normalizeMigrateDefinition} from './normalizeMigrateDefinition.js'

function wrapDocumentsIteratorProducer(factory: () => AsyncIterableIterator<SanityDocument>) {
  function documents() {
    return factory()
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Need to dynamically add Symbol property to function
  ;(documents as any)[Symbol.asyncIterator] = () => {
    throw new Error(
      `The migration is attempting to iterate over the "documents" function, please call the function instead:

      // BAD:
      for await (const document of documents) {
        // ...
      }

      // GOOD:                        👇 This is a function and has to be called
      for await (const document of documents()) {
        // ...
      }
      `,
    )
  }
  return documents
}

/**
 * @public
 */
export function collectMigrationMutations(
  migration: Migration,
  documents: () => AsyncIterableIterator<SanityDocument>,
  context: MigrationContext,
) {
  const migrate = normalizeMigrateDefinition(migration)
  return migrate(wrapDocumentsIteratorProducer(documents), context)
}
