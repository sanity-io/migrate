import {HttpError, TimeoutError} from 'get-it'
import {streamBody, streamError, streamStall} from 'get-it/mock'
import {afterEach, expect, test, vi} from 'vitest'

import {fetchAsyncIterator, fetchStream} from '../fetchStream.js'

const {mock} = await vi.hoisted(async () => {
  const {createMockFetch} = await import('get-it/mock')
  return {mock: createMockFetch()}
})

vi.mock('get-it/node', () => ({createNodeFetch: () => mock.fetch}))

afterEach(() => {
  vi.useRealTimers()
  mock.assertAllConsumed()
  mock.clear()
})

const url = new URL('https://example.com/export')

test('returns chunks without buffering the whole response', async () => {
  const body = streamBody('first chunk', streamStall())
  mock.on('GET', '/export').respond({body})

  const reader = (await fetchStream({init: {}, url})).getReader()
  expect(await reader.read()).toEqual({done: false, value: new TextEncoder().encode('first chunk')})
  await reader.cancel()
  expect(body.cancelCount).toBe(1)
})

test('forwards the method, headers, body, and abort signal', async () => {
  const controller = new AbortController()
  const body = streamBody('partial', streamStall())
  mock
    .on('POST', '/export', {
      body: {mutations: []},
      headers: {authorization: 'bearer token'},
    })
    .respond({body})

  const reader = (
    await fetchStream({
      init: {
        body: JSON.stringify({mutations: []}),
        headers: {authorization: 'bearer token', 'content-type': 'application/json'},
        method: 'POST',
        signal: controller.signal,
      },
      url,
    })
  ).getReader()
  await reader.read()
  controller.abort()
  await expect(reader.read()).rejects.toThrow()
  expect(body.abortCount).toBe(1)
})

test('preserves HTTP errors used to classify rejected transactions', async () => {
  mock.on('GET', '/export').respond({body: {error: 'Bad request'}, status: 400})
  await expect(fetchStream({init: {}, url})).rejects.toBeInstanceOf(HttpError)
})

test('returns an empty stream for a response without a body', async () => {
  mock.on('GET', '/export').respond({status: 204})
  const reader = (await fetchStream({init: {}, url})).getReader()
  await expect(reader.read()).resolves.toEqual({done: true, value: undefined})
})

test('propagates failures while consuming the response', async () => {
  const error = new Error('Connection dropped')
  mock.on('GET', '/export').respond({body: streamBody('partial', streamError(error))})
  const iterator = await fetchAsyncIterator({init: {}, url})
  await expect(iterator.next()).resolves.toEqual({
    done: false,
    value: new TextEncoder().encode('partial'),
  })
  await expect(iterator.next()).rejects.toBe(error)
})

test('times out waiting for response headers through get-it', async () => {
  vi.useFakeTimers()
  mock.on('GET', '/export').respond({body: 'late', delay: 120_001})
  const result = expect(fetchStream({init: {}, url})).rejects.toBeInstanceOf(TimeoutError)
  await vi.advanceTimersByTimeAsync(120_000)
  await result
})

test('allows export streams to run beyond the default total timeout', async () => {
  vi.useFakeTimers()
  const body = streamBody('first chunk', streamStall())
  mock.on('GET', '/export').respond({body})
  const reader = (await fetchStream({init: {}, url})).getReader()
  await reader.read()
  await vi.advanceTimersByTimeAsync(120_001)
  expect(body.abortCount).toBe(0)
  await reader.cancel()
})
