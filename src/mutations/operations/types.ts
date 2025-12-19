import {type KeyedSegment} from '@sanity/types'

import {type AnyArray} from '../typeUtils.js'

/**
 * @public
 *
 * Represents an indexed segment in a document.
 */
type IndexedSegment = number

export type {IndexedSegment}

/**
 * @public
 *
 * Represents a set-operation that can be applied to any value
 */
export type SetOp<T> = {
  type: 'set'
  value: T
}

/**
 * @public
 *
 * Represents an unset operation that can be applied to any value
 */
export type UnsetOp = {
  type: 'unset'
}

/**
 * @public
 *
 * Represents a setIfMissing operation that can be applied to any value
 */
export type SetIfMissingOp<T> = {
  type: 'setIfMissing'
  value: T
}

/**
 * @public
 *
 * Represents an increment-operation that can be applied to a number
 */
export type IncOp<Amount extends number> = {
  amount: Amount
  type: 'inc'
}

/**
 * @public
 *
 * Represents a decrement-operation that can be applied to a number
 */
export type DecOp<Amount extends number> = {
  amount: Amount
  type: 'dec'
}

/**
 * @public
 *
 * Represents a relative position in a document.
 */
export type RelativePosition = 'after' | 'before'

/**
 * @public
 *
 * Represents an insert-operation that can be applied to an array
 */
export type InsertOp<
  Items extends AnyArray,
  Pos extends RelativePosition,
  ReferenceItem extends IndexedSegment | KeyedSegment,
> = {
  items: Items
  position: Pos
  referenceItem: ReferenceItem
  type: 'insert'
}

/**
 * @public
 *
 * Represents a truncate-operation that can be applied to an array
 */
export type TruncateOp = {
  endIndex?: number
  startIndex: number
  type: 'truncate'
}

/**
 * @public
 *
 * Represents a replace-operation that can be applied to an array
 */
export type ReplaceOp<
  Items extends AnyArray,
  ReferenceItem extends IndexedSegment | KeyedSegment,
> = {
  items: Items
  referenceItem: ReferenceItem
  type: 'replace'
}

/**
 * @public
 *
 * Represents a diff-match-patch operation that can be applied to a string
 * {@link https://www.npmjs.com/package/@sanity/diff-match-patch}
 */
export type DiffMatchPatchOp = {
  type: 'diffMatchPatch'
  value: string
}

/**
 * @public
 *
 * Represents an operation that can be applied to values of all types
 */
export type Operation = ArrayOp | PrimitiveOp

/**
 * @public
 *
 * Represents an operation that can be applied to values of all types
 */
export type AnyOp = SetIfMissingOp<unknown> | SetOp<unknown> | UnsetOp

/**
 * @public
 *
 * Represents an operation that can be applied to a number
 */
export type NumberOp = DecOp<number> | IncOp<number>

/**
 * @public
 *
 * Represents an operation that can be applied to a string
 */
export type StringOp = DiffMatchPatchOp

/**
 * @public
 *
 * Represents ann operation that can be applied to an array
 */
export type ArrayOp =
  | InsertOp<AnyArray, RelativePosition, IndexedSegment | KeyedSegment>
  | ReplaceOp<AnyArray, IndexedSegment | KeyedSegment>
  | TruncateOp

/**
 * @public
 *
 * Represents an operation that can be applied to any primitive value
 */
export type PrimitiveOp = AnyOp | NumberOp | StringOp

export {type KeyedSegment} from '@sanity/types'
