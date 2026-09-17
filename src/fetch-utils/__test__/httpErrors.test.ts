import {HttpError} from 'get-it'
import {afterEach, expect, test, vi} from 'vitest'

import {fetchStream} from '../fetchStream.js'

const {mock} = await vi.hoisted(async () => {
  const {createMockFetch} = await import('get-it/mock')
  return {mock: createMockFetch()}
})

vi.mock('get-it/node', () => ({createNodeFetch: () => mock.fetch}))

afterEach(() => {
  mock.assertAllConsumed()
  mock.clear()
})

test.each([
  {
    body: {error: 'Error message', message: 'More details'},
    message: 'Error message: More details',
    status: 400,
  },
  {
    body: 'Not JSON',
    message: 'HTTP Error 500: Internal Server Error',
    status: 500,
  },
  {
    body: {error: {description: 'Document is not of valid type', type: 'validationError'}},
    message: 'validationError: Document is not of valid type',
    status: 500,
  },
])('server responds with $status: $message', async ({body, message, status}) => {
  mock.on('GET', '/test').respond({body, status})
  const result = fetchStream({init: {}, url: 'https://example.com/test'})
  await expect(result).rejects.toBeInstanceOf(HttpError)
  await expect(result).rejects.toMatchObject({message, status})
})
