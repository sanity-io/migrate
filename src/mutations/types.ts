import {type Path} from '@sanity/types'

import {type Operation} from './operations/types.js'
import {type Optional} from './typeUtils.js'

/**
 * @public
 *
 * A list of {@link NodePatch} objects.
 */
export type NodePatchList =
  | [NodePatch, ...NodePatch[]]
  | NodePatch[]
  | readonly [NodePatch, ...NodePatch[]]
  | readonly NodePatch[]

/**
 * @public
 *
 * A Sanity Content Lake document
 */
export type SanityDocument = {
  _createdAt?: string
  _id?: string
  _rev?: string
  _type: string
  _updatedAt?: string
}

/**
 * @public
 *
 * Represents a mutation that creates a new document in the Sanity Content Lake. This mutation will fail if the ID already exist.
 */
export type CreateMutation<Doc extends Optional<SanityDocument, '_id'>> = {
  document: Doc
  type: 'create'
}

/**
 * @public
 *
 * Represents a mutation that can create a new document in the Sanity Content Lake if its ID does not exist.
 */
export type CreateIfNotExistsMutation<Doc extends SanityDocument> = {
  document: Doc
  type: 'createIfNotExists'
}

/**
 * @public
 *
 * Represents a mutation that can create or replace a document in the Sanity Content Lake given its ID.
 */
export type CreateOrReplaceMutation<Doc extends SanityDocument> = {
  document: Doc
  type: 'createOrReplace'
}

/**
 * @public
 *
 * Represents a mutation that can delete a document in the Sanity Content Lake.
 */
export type DeleteMutation = {
  id: string
  type: 'delete'
}

/**
 * @public
 *
 * Represents a patch mutation that can change a value for a document in the Sanity Content Lake.
 */
export type PatchMutation<Patches extends NodePatchList = NodePatchList> = {
  id: string
  options?: PatchOptions
  patches: Patches
  type: 'patch'
}

/**
 * @public
 *
 * Represents a mutation that can be applied to a document in the Sanity Content Lake.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Public API generic type that defaults to any for flexibility
export type Mutation<Doc extends SanityDocument = any> =
  | CreateIfNotExistsMutation<Doc>
  | CreateMutation<Doc>
  | CreateOrReplaceMutation<Doc>
  | DeleteMutation
  | PatchMutation

/**
 * @public
 *
 * A NodePatch represents a single operation that can be applied at a node at a specific path in a Sanity document.
 */
export type NodePatch<P extends Path = Path, O extends Operation = Operation> = {
  op: O
  path: P
}

/**
 * @public
 *
 * Options for a patch operation.
 */
export type PatchOptions = {
  /**
   * {@link https://www.sanity.io/docs/http-mutations#26600a871378}
   */
  ifRevision?: string
}
