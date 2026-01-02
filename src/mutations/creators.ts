import {type Path} from '@sanity/types'
import {fromString} from '@sanity/util/paths'
import arrify from 'arrify'

import {type Operation} from './operations/types.js'
import {
  type CreateIfNotExistsMutation,
  type CreateMutation,
  type CreateOrReplaceMutation,
  type DeleteMutation,
  type NodePatch,
  type NodePatchList,
  type PatchMutation,
  type PatchOptions,
  type SanityDocument,
} from './types.js'
import {type NormalizeReadOnlyArray, type Optional, type Tuplify} from './typeUtils.js'

/**
 * Creates a new document.
 * @public
 * @param document - The document to be created.
 * @returns The mutation to create the document.
 */
export function create<Doc extends Optional<SanityDocument, '_id'>>(
  document: Doc,
): CreateMutation<Doc> {
  return {document, type: 'create'}
}

/**
 * Applies a patch to a document.
 * @public
 * @param id - The ID of the document to be patched.
 * @param patches - The patches to be applied.
 * @param options - Optional patch options.
 * @returns The mutation to patch the document.
 */
export function patch<P extends NodePatch | NodePatchList>(
  id: string,
  patches: P,
  options?: PatchOptions,
): PatchMutation<NormalizeReadOnlyArray<Tuplify<P>>> {
  return {
    id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- arrify loses type information, cast needed for tuple type preservation
    patches: arrify(patches) as any,
    type: 'patch',
    ...(options ? {options} : {}),
  }
}

/**
 * Creates a {@link NodePatch} at a specific path.
 * @public
 * @param path - The path where the operation should be applied.
 * @param operation - The operation to be applied.
 * @returns The node patch.
 */
export function at<O extends Operation>(path: Path | string, operation: O): NodePatch<Path, O> {
  return {
    op: operation,
    path: typeof path === 'string' ? fromString(path) : path,
  }
}

/**
 * Creates a document if it does not exist.
 * @public
 * @param document - The document to be created.
 * @returns The mutation operation to create the document if it does not exist.
 */
export function createIfNotExists<Doc extends SanityDocument>(
  document: Doc,
): CreateIfNotExistsMutation<Doc> {
  return {document, type: 'createIfNotExists'}
}

/**
 * Creates or replaces a document.
 * @public
 * @param document - The document to be created or replaced.
 * @returns The mutation operation to create or replace the document.
 */
export function createOrReplace<Doc extends SanityDocument>(
  document: Doc,
): CreateOrReplaceMutation<Doc> {
  return {document, type: 'createOrReplace'}
}

/**
 * Deletes a document.
 * @public
 * @param id - The id of the document to be deleted.
 * @returns The mutation operation to delete the document.
 */
export function delete_(id: string): DeleteMutation {
  return {id, type: 'delete'}
}

/**
 * Alias for delete
 * @public
 */
export const del = delete_
