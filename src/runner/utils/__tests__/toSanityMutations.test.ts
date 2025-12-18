import {SanityEncoder} from '@sanity/mutate'
// Note: for some reason, this needs to be imported before the mocked module
import {afterEach, describe, expect, it, vitest} from 'vitest'

import {type Mutation, type Transaction} from '../../../mutations/index.js'
import {toSanityMutations, type TransactionPayload} from '../toSanityMutations.js'

vitest.mock('@sanity/mutate', async () => {
  const actual = await vitest.importActual<typeof import('@sanity/mutate')>('@sanity/mutate')
  return {
    ...actual,
    SanityEncoder: {
      ...actual.SanityEncoder,
      encodeAll: vitest.fn().mockImplementation(actual.SanityEncoder.encodeAll),
    },
  }
})

afterEach(() => {
  vitest.clearAllMocks()
})

describe('#toSanityMutations', () => {
  it('should handle single mutation', async () => {
    const mockMutation: Mutation = {
      id: 'drafts.f9b1dc7a-9dd6-4949-8292-9738bf9e2969',
      patches: [{op: {type: 'setIfMissing', value: []}, path: ['prependTest']}],
      type: 'patch',
    }

    const mockMutationIterable = async function* () {
      yield mockMutation
    }

    const iterable = toSanityMutations(mockMutationIterable())

    const result = []
    for await (const mutation of iterable) {
      result.push(mutation)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SanityEncoder.encodeAll requires array of any
    expect(result.flat()).toEqual(SanityEncoder.encodeAll([mockMutation] as any[]))
    expect(SanityEncoder.encodeAll).toHaveBeenCalledWith([mockMutation])
  })

  it('should handle multiple mutations', async () => {
    const mockMutations: Mutation[] = [
      {
        id: 'drafts.f9b1dc7a-9dd6-4949-8292-9738bf9e2969',
        patches: [{op: {type: 'setIfMissing', value: []}, path: ['prependTest']}],
        type: 'patch',
      },
      {
        id: 'drafts.f9b1dc7a-9dd6-4949-8292-9738bf9e2969',
        patches: [
          {
            op: {
              items: [{_type: 'oops', name: 'test'}],
              position: 'before',
              referenceItem: 0,
              type: 'insert',
            },
            path: ['prependTest'],
          },
        ],
        type: 'patch',
      },
    ]

    const mockMutationIterable = async function* () {
      yield mockMutations
    }

    const iterable = toSanityMutations(mockMutationIterable())

    const result = []
    for await (const mutation of iterable) {
      result.push(mutation)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SanityEncoder.encodeAll requires array of any
    expect(result.flat()).toEqual(SanityEncoder.encodeAll(mockMutations as any[]))
    expect(SanityEncoder.encodeAll).toHaveBeenCalledWith(mockMutations)
  })

  it('should handle transaction', async () => {
    const mockTransaction: Transaction = {
      id: 'transaction1',
      mutations: [
        {
          id: 'drafts.f9b1dc7a-9dd6-4949-8292-9738bf9e2969',
          patches: [{op: {type: 'setIfMissing', value: []}, path: ['prependTest']}],
          type: 'patch',
        },
      ],
      type: 'transaction',
    }

    const iterable = toSanityMutations(
      (async function* () {
        yield mockTransaction
      })(),
    )

    const result = []
    for await (const mutation of iterable) {
      result.push(mutation)
    }

    const expected: TransactionPayload = {
      ...(mockTransaction.id !== undefined && {transactionId: mockTransaction.id}),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SanityEncoder.encodeAll requires array of any
      mutations: SanityEncoder.encodeAll(mockTransaction.mutations as any[]),
    }

    expect(result).toEqual([expected])
    expect(SanityEncoder.encodeAll).toHaveBeenCalledWith(mockTransaction.mutations)
  })
})
