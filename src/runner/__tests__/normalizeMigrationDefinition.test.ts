import {type SanityDocument} from '@sanity/types'
import {describe, expect, it, vitest} from 'vitest'

import {createIfNotExists} from '../../mutations/index.js'
import {type Migration, type MigrationContext, type NodeMigration} from '../../types.js'
import {
  createAsyncIterableMutation,
  normalizeMigrateDefinition,
} from '../normalizeMigrateDefinition.js'

const mockAsyncIterableIterator = () => {
  const data: SanityDocument[] = [
    {
      _createdAt: '2024-02-16T14:13:59Z',
      _id: 'mockId',
      _rev: 'xyz',
      _type: 'mockDocumentType',
      _updatedAt: '2024-02-16T14:13:59Z',
    },
  ]
  return async function* documents() {
    for (const doc of data) {
      yield doc
    }
  }
}

describe('#normalizeMigrateDefinition', () => {
  it('should return the migrate is a function', async () => {
    const mockMigration: Migration = {
      documentTypes: ['mockDocumentType'],
      async *migrate() {
        yield createIfNotExists({_id: 'mockId', _type: 'mockDocumentType'})
      },
      title: 'mockMigration',
    }

    const result = normalizeMigrateDefinition(mockMigration)

    const res = []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Mock context not used in this test
    for await (const item of result(vitest.fn(), {} as any)) {
      res.push(item)
    }

    expect(res.flat()).toEqual([createIfNotExists({_id: 'mockId', _type: 'mockDocumentType'})])
  })

  it('should return a new mutations if migrate is not a function', async () => {
    const mockMigration: Migration = {
      documentTypes: ['mockDocumentType'],
      migrate: {
        document() {
          return createIfNotExists({_id: 'mockId', _type: 'mockDocumentType'})
        },
      },
      title: 'mockMigration',
    }

    const result = normalizeMigrateDefinition(mockMigration)
    const res = []

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Mock context not used in this test
    for await (const item of result(mockAsyncIterableIterator(), {} as any)) {
      res.push(item)
    }

    expect(res.flat()).toEqual([createIfNotExists({_id: 'mockId', _type: 'mockDocumentType'})])
  })

  it('should not return undefined if migrate is returning undefined', async () => {
    const mockMigration: Migration = {
      documentTypes: ['mockDocumentType'],
      migrate: {
        document() {
          return undefined
        },
      },
      title: 'mockMigration',
    }

    const result = normalizeMigrateDefinition(mockMigration)
    const res = []

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Mock context not used in this test
    for await (const item of result(mockAsyncIterableIterator(), {} as any)) {
      res.push(item)
    }

    expect(res.flat()).toEqual([])
  })
})

describe('#createAsyncIterableMutation', () => {
  it('should return an async iterable', async () => {
    const mockMigration: NodeMigration = {
      document: vitest.fn(),
    }

    const iterable = createAsyncIterableMutation(mockMigration, {documentTypes: ['foo']})

    expect(typeof iterable).toBe('function')

    const iterator = iterable(mockAsyncIterableIterator(), {} as MigrationContext)
    expect(typeof iterator.next).toBe('function')
    expect(typeof iterator.return).toBe('function')
    expect(typeof iterator.throw).toBe('function')
  })
})
