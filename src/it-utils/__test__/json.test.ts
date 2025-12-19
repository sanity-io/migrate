import {expect, test} from 'vitest'

import {parseJSON} from '../json.js'

async function* createTestJSONGenerator() {
  yield '{"someString": "string"}'
  yield '{"someNumber": 42}'
}

test('parse JSON', async () => {
  const it = parseJSON(createTestJSONGenerator())

  expect(await it.next()).toEqual({done: false, value: {someString: 'string'}})
  expect(await it.next()).toEqual({done: false, value: {someNumber: 42}})
  expect(await it.next()).toEqual({done: true, value: undefined})
})

test('parse JSON with a custom parser', async () => {
  const it = parseJSON(createTestJSONGenerator(), {
    parse: (line) => ({
      parsed: JSON.parse(line),
    }),
  })

  expect(await it.next()).toEqual({done: false, value: {parsed: {someString: 'string'}}})
  expect(await it.next()).toEqual({done: false, value: {parsed: {someNumber: 42}}})
  expect(await it.next()).toEqual({done: true, value: undefined})
})
