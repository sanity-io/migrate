import {expect, test} from 'vitest'

import {split} from '../split.js'

test('split multiple chunks by newline', async () => {
  // eslint-disable-next-line unicorn/consistent-function-scoping
  const gen = async function* () {
    yield 'first\nsec'
    yield 'ond\nthir'
    yield 'd'
  }

  const it = split(gen(), '\n')

  expect(await it.next()).toEqual({done: false, value: 'first'})
  expect(await it.next()).toEqual({done: false, value: 'second'})
  expect(await it.next()).toEqual({done: false, value: 'third'})
  expect(await it.next()).toEqual({done: true, value: undefined})
})

test('split multiple chunks with several delimiters', async () => {
  // eslint-disable-next-line unicorn/consistent-function-scoping
  const gen = async function* () {
    yield 'first\nsecond\nthird\n'
    yield 'f'
    yield 'o'
    yield 'u'
    yield 'r'
    yield 'th'
  }

  const it = split(gen(), '\n')

  expect(await it.next()).toEqual({done: false, value: 'first'})
  expect(await it.next()).toEqual({done: false, value: 'second'})
  expect(await it.next()).toEqual({done: false, value: 'third'})
  expect(await it.next()).toEqual({done: false, value: 'fourth'})
  expect(await it.next()).toEqual({done: true, value: undefined})
})
