import {type Mutation as RawMutation} from '@sanity/client'
import {SanityEncoder} from '@sanity/mutate'
import {type Path, type SanityDocument} from '@sanity/types'
import arrify from 'arrify'

import {type JsonArray, type JsonObject, type JsonValue} from '../json.js'
import {isMutation, isNodePatch, isOperation, isTransaction} from '../mutations/asserters.js'
import {
  at,
  type Mutation,
  type NodePatch,
  type Operation,
  patch,
  type Transaction,
} from '../mutations/index.js'
import {
  type AsyncIterableMigration,
  type Migration,
  type MigrationContext,
  type NodeMigration,
  type NodeMigrationReturnValue,
} from '../types.js'
import {flatMapDeep} from './utils/flatMapDeep.js'
import {getValueType} from './utils/getValueType.js'

export function normalizeMigrateDefinition(migration: Migration): AsyncIterableMigration {
  if (typeof migration.migrate == 'function') {
    // assume AsyncIterableMigration
    return normalizeIteratorValues(migration.migrate)
  }
  return createAsyncIterableMutation(migration.migrate, {
    ...(migration.filter !== undefined && {filter: migration.filter}),
    ...(migration.documentTypes !== undefined && {documentTypes: migration.documentTypes}),
  })
}

function normalizeIteratorValues(asyncIterable: AsyncIterableMigration): AsyncIterableMigration {
  return async function* run(docs, context) {
    for await (const documentMutations of asyncIterable(docs, context)) {
      yield normalizeMutation(documentMutations)
    }
  }
}

/**
 * Normalize a mutation or a NodePatch to a document mutation
 * @param documentId - The document id
 * @param change - The Mutation or NodePatch
 */
function normalizeMutation(
  change: (Mutation | RawMutation | Transaction)[] | Mutation | RawMutation | Transaction,
): (Mutation | Transaction)[] {
  if (Array.isArray(change)) {
    return change.flatMap((ch) => normalizeMutation(ch))
  }
  if (isRawMutation(change)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SanityEncoder.decodeAll requires specific mutation format
    return SanityEncoder.decodeAll([change] as any) as Mutation[]
  }
  return [change]
}

function isRawMutation(
  mutation: Mutation | NodePatch | Operation | RawMutation | Transaction,
): mutation is RawMutation {
  return (
    'createIfNotExists' in mutation ||
    'createOrReplace' in mutation ||
    'create' in mutation ||
    'patch' in mutation ||
    'delete' in mutation
  )
}
export function createAsyncIterableMutation(
  migration: NodeMigration,
  opts: {documentTypes?: string[]; filter?: string},
): AsyncIterableMigration {
  const documentTypesSet = new Set(opts.documentTypes)

  return async function* run(docs, context) {
    for await (const doc of docs()) {
      if (opts.documentTypes && !documentTypesSet.has(doc._type)) continue

      const documentMutations = await collectDocumentMutations(migration, doc, context)
      if (documentMutations.length > 0) {
        yield documentMutations
      }
    }
  }
}

async function collectDocumentMutations(
  migration: NodeMigration,
  doc: SanityDocument,
  context: MigrationContext,
): Promise<(Mutation | Transaction)[]> {
  const documentMutations = Promise.resolve(migration.document?.(doc, context))
  const nodeMigrations = flatMapDeep(doc as JsonValue, async (value, path) => {
    const [nodeReturnValues, nodeTypeReturnValues] = await Promise.all([
      Promise.resolve(migration.node?.(value, path, context)),
      Promise.resolve(migrateNodeType(migration, value, path, context)),
    ])

    return [...arrify(nodeReturnValues), ...arrify(nodeTypeReturnValues)].map(
      (change) => change && normalizeNodeMutation(path, change),
    )
  })

  const resolvedDocumentMutations = arrify(await documentMutations)
  const resolvedNodeMigrations = await Promise.all(nodeMigrations)

  return [...resolvedDocumentMutations, ...resolvedNodeMigrations]
    .flat()
    .flatMap((change) => (change ? normalizeDocumentMutation(doc._id, change) : []))
}

/**
 * Normalize a mutation or a NodePatch to a document mutation
 * @param documentId - The document id
 * @param change - The Mutation or NodePatch
 */
function normalizeDocumentMutation(
  documentId: string,
  change:
    | (Mutation | NodePatch | RawMutation | Transaction)[]
    | Mutation
    | NodePatch
    | RawMutation
    | Transaction,
): (Mutation | Transaction)[] | Mutation | Transaction {
  if (Array.isArray(change)) {
    return change.flatMap((ch) => normalizeDocumentMutation(documentId, ch))
  }
  if (isRawMutation(change)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SanityEncoder.decodeAll requires specific mutation format
    return SanityEncoder.decodeAll([change] as any)[0] as Mutation
  }
  if (isTransaction(change)) {
    return change
  }
  return isMutation(change) ? change : patch(documentId, change)
}

/**
 * Normalize a mutation or a NodePatch to a document mutation
 * @param path - The path the operation should be applied at
 * @param change - The Mutation or NodePatch
 */
function normalizeNodeMutation(
  path: Path,
  change: Mutation | NodePatch | Operation | RawMutation | RawMutation[],
): (Mutation | NodePatch)[] | Mutation | NodePatch {
  if (Array.isArray(change)) {
    return change.flatMap((ch) => normalizeNodeMutation(path, ch))
  }
  if (isRawMutation(change)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SanityEncoder.decodeAll requires specific mutation format
    return SanityEncoder.decodeAll([change] as any)[0] as Mutation
  }

  if (isNodePatch(change)) {
    return at([...path, ...change.path], change.op)
  }
  return isOperation(change) ? at(path, change) : change
}

function migrateNodeType(
  migration: NodeMigration,
  value: JsonValue,
  path: Path,
  context: MigrationContext,
): NodeMigrationReturnValue | Promise<NodeMigrationReturnValue | void> | void {
  switch (getValueType(value)) {
    case 'array': {
      return migration.array?.(value as JsonArray, path, context)
    }
    case 'boolean': {
      return migration.boolean?.(value as boolean, path, context)
    }
    case 'null': {
      return migration.null?.(value as null, path, context)
    }
    case 'number': {
      return migration.number?.(value as number, path, context)
    }
    case 'object': {
      return migration.object?.(value as JsonObject, path, context)
    }
    case 'string': {
      return migration.string?.(value as string, path, context)
    }
    default: {
      throw new Error('Unknown value type')
    }
  }
}
