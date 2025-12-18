import {expect, test} from 'vitest'

import {at, create, createIfNotExists, createOrReplace, del, patch} from '../creators.js'
import {inc, insert, set, setIfMissing, unset} from '../operations/creators.js'

test('single patch mutation', () => {
  expect(patch('cat', at(['title'], set('hello world')))).toStrictEqual({
    id: 'cat',
    patches: [
      {
        op: {type: 'set', value: 'hello world'},
        path: ['title'],
      },
    ],
    type: 'patch',
  })
})

test('single create mutation', () => {
  expect(create({_id: 'cat', _type: 'hello'})).toStrictEqual({
    document: {_id: 'cat', _type: 'hello'},
    type: 'create',
  })
})

test('two patch mutations', () => {
  expect(
    patch('cat', [at(['title'], set('hello world')), at(['subtitle'], set('nice to see you'))]),
  ).toStrictEqual({
    id: 'cat',
    patches: [
      {
        op: {
          type: 'set',
          value: 'hello world',
        },
        path: ['title'],
      },
      {
        op: {
          type: 'set',
          value: 'nice to see you',
        },
        path: ['subtitle'],
      },
    ],
    type: 'patch',
  })
})

test('single patch with revision', () => {
  expect(patch('cat', at(['title'], set('hello world')), {ifRevision: 'rev0'})).toStrictEqual({
    id: 'cat',
    options: {ifRevision: 'rev0'},
    patches: [
      {
        op: {
          type: 'set',
          value: 'hello world',
        },
        path: ['title'],
      },
    ],
    type: 'patch',
  })
})

test('multiple mutations', () => {
  expect([
    createOrReplace({_id: 'foo', _type: 'lol', count: 1}),
    patch('foo', [at('title', set('hello')), at('count', inc(2))], {
      ifRevision: 'someRev',
    }),
  ]).toEqual([
    {
      document: {
        _id: 'foo',
        _type: 'lol',
        count: 1,
      },
      type: 'createOrReplace',
    },
    {
      id: 'foo',
      options: {
        ifRevision: 'someRev',
      },
      patches: [
        {
          op: {type: 'set', value: 'hello'},
          path: ['title'],
        },
        {
          op: {amount: 2, type: 'inc'},
          path: ['count'],
        },
      ],
      type: 'patch',
    },
  ])
})

test('multiple ops in a single patch mutation', () => {
  expect([
    createIfNotExists({_id: 'foo', _type: 'lol', count: 1}),
    patch('foo', [at('title', set('hello')), at('count', inc(2))], {
      ifRevision: 'someRev',
    }),
  ]).toEqual([
    {
      document: {
        _id: 'foo',
        _type: 'lol',
        count: 1,
      },
      type: 'createIfNotExists',
    },
    {
      id: 'foo',
      options: {ifRevision: 'someRev'},
      patches: [
        {
          op: {
            type: 'set',
            value: 'hello',
          },
          path: ['title'],
        },
        {
          op: {
            amount: 2,
            type: 'inc',
          },
          path: ['count'],
        },
      ],
      type: 'patch',
    },
  ])
})

test('all permutations', () => {
  const mutations = [
    create({_id: 'foo', _type: 'foo', count: 0}),
    createIfNotExists({_id: 'bar', _type: 'bar', count: 1}),
    createOrReplace({_id: 'baz', _type: 'baz', count: 2}),
    patch(
      'qux',
      [
        at('title', set('hello')),
        at('items', setIfMissing([])),
        at('items', insert([1, 2, 3], 'after', 1)),
        at('title', unset()),
        at('count', inc(2)),
      ],
      {ifRevision: 'someRev'},
    ),
    patch('quux', [
      at('title', set('hello')),
      at('items', setIfMissing([])),
      at('items', insert([1, 2, 3], 'after', 0)),
      at('title', unset()),
      at('count', inc(2)),
    ]),
    del('quuz'),
    del('corge'),
  ]

  expect(mutations).toEqual([
    {
      document: {
        _id: 'foo',
        _type: 'foo',
        count: 0,
      },
      type: 'create',
    },
    {
      document: {
        _id: 'bar',
        _type: 'bar',
        count: 1,
      },
      type: 'createIfNotExists',
    },
    {
      document: {
        _id: 'baz',
        _type: 'baz',
        count: 2,
      },
      type: 'createOrReplace',
    },
    {
      id: 'qux',
      options: {
        ifRevision: 'someRev',
      },
      patches: [
        {
          op: {
            type: 'set',
            value: 'hello',
          },
          path: ['title'],
        },
        {
          op: {type: 'setIfMissing', value: []},
          path: ['items'],
        },
        {
          op: {
            items: [1, 2, 3],
            position: 'after',
            referenceItem: 1,
            type: 'insert',
          },
          path: ['items'],
        },
        {op: {type: 'unset'}, path: ['title']},
        {op: {amount: 2, type: 'inc'}, path: ['count']},
      ],
      type: 'patch',
    },
    {
      id: 'quux',
      patches: [
        {
          op: {
            type: 'set',
            value: 'hello',
          },
          path: ['title'],
        },
        {
          op: {
            type: 'setIfMissing',
            value: [],
          },
          path: ['items'],
        },
        {
          op: {
            items: [1, 2, 3],
            position: 'after',
            referenceItem: 0,
            type: 'insert',
          },
          path: ['items'],
        },
        {
          op: {type: 'unset'},
          path: ['title'],
        },
        {
          op: {
            amount: 2,
            type: 'inc',
          },
          path: ['count'],
        },
      ],
      type: 'patch',
    },
    {
      id: 'quuz',
      type: 'delete',
    },
    {
      id: 'corge',
      type: 'delete',
    },
  ])
})
