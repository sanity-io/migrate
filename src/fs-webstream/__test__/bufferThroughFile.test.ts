import {stat} from 'node:fs/promises'
import path from 'node:path'

import {describe, expect, test, vi} from 'vitest'

import {firstValueFrom} from '../../it-utils/firstValueFrom.js'
import {decodeText, parse} from '../../it-utils/index.js'
import {lastValueFrom} from '../../it-utils/lastValueFrom.js'
import {asyncIterableToStream} from '../../utils/asyncIterableToStream.js'
import {streamToAsyncIterator} from '../../utils/streamToAsyncIterator.js'
import {bufferThroughFile} from '../bufferThroughFile.js'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

let id = 0
const getTestBufferFileName = () => path.join(import.meta.dirname, '.tmp', `buffer-${id++}.ndjson`)

describe('using primary stream', () => {
  test('stops buffering when the consumer is done', async () => {
    const encoder = new TextEncoder()

    async function* gen() {
      for (let n = 0; n < 100; n++) {
        yield encoder.encode(`{"foo": ${n},`)
        // simulate a bit of delay in the producer (which is often the case)
        // oxlint-disable-next-line no-await-in-loop
        await sleep(1)
        yield encoder.encode(`"bar": ${n}, "baz": ${n}}`)
        yield encoder.encode('\n')
      }
    }

    const bufferFile = getTestBufferFileName()
    const abortController = new AbortController()
    const createReader = bufferThroughFile(asyncIterableToStream(gen()), bufferFile, {
      keepFile: true,
      signal: abortController.signal,
    })
    const fileBufferStream = createReader()
    const lines = []
    for await (const chunk of parse(decodeText(streamToAsyncIterator(fileBufferStream)))) {
      lines.push(chunk)
      if (lines.length === 3) {
        // we only pick 3 lines and break out of the iteration. This should stop the buffering
        break
      }
      // simulate a slow consumer
      // (the bufferThroughFile stream should still continue to write to the file as fast as possible)
      await sleep(10)
    }

    expect(lines).toEqual([
      {bar: 0, baz: 0, foo: 0},
      {bar: 1, baz: 1, foo: 1},
      {bar: 2, baz: 2, foo: 2},
    ])

    // Note: the stream needs to be explicitly aborted, otherwise the source stream will run to completion
    // would be nice if there was a way to "unref()" the file handle to prevent it from blocking the process,
    // but I don't think there is
    abortController.abort()

    // This asserts that buffer file contains more bytes than the 3 lines above represents
    const bufferFileSize = (await stat(bufferFile)).size

    expect(bufferFileSize).toBeGreaterThan(90)
    // but not the full 100 lines
    expect(bufferFileSize).toBeLessThan(3270)
  })

  test('it runs to completion if consumer needs it', async () => {
    const encoder = new TextEncoder()

    async function* gen() {
      for (let n = 0; n < 100; n++) {
        yield encoder.encode(`{"foo": ${n},`)
        // simulate a bit of delay in the producer (which is often the case)
        await sleep(1)
        yield encoder.encode(`"bar": ${n}, "baz": ${n}}`)
        yield encoder.encode('\n')
      }
    }

    const bufferFile = getTestBufferFileName()
    const controller = new AbortController()
    const createReader = bufferThroughFile(asyncIterableToStream(gen()), bufferFile, {
      keepFile: true,
      signal: controller.signal,
    })
    const fileBufferStream = createReader()
    const lines = []
    for await (const chunk of parse(decodeText(streamToAsyncIterator(fileBufferStream)))) {
      if (lines.length < 3) {
        // in contrast to the test above, we don't break out of the iteration early, but let it run to completion
        lines.push(chunk)
      }
    }

    expect(lines).toEqual([
      {bar: 0, baz: 0, foo: 0},
      {bar: 1, baz: 1, foo: 1},
      {bar: 2, baz: 2, foo: 2},
    ])

    // This asserts that buffer file contains all the yielded lines
    expect((await stat(bufferFile)).size).toBe(3270)
  })
})

describe('using secondary stream', () => {
  test('stops buffering when the consumer is done', async () => {
    const encoder = new TextEncoder()

    async function* gen() {
      for (let n = 0; n < 100; n++) {
        yield encoder.encode(`{"foo": ${n},`)
        // simulate a bit of delay in the producer (which is often the case)
        yield encoder.encode(`"bar": ${n}, "baz": ${n}}`)
        yield encoder.encode('\n')
      }
    }

    const bufferFile = getTestBufferFileName()
    const abortController = new AbortController()
    const createReader = bufferThroughFile(asyncIterableToStream(gen()), bufferFile, {
      keepFile: true,
      signal: abortController.signal,
    })
    const fileBufferStream = createReader()

    const lines = []
    for await (const chunk of parse(decodeText(streamToAsyncIterator(fileBufferStream)))) {
      lines.push(
        chunk,
        await lastValueFrom(parse(decodeText(streamToAsyncIterator(createReader())))),
      )
      if (lines.length === 6) {
        break
      }
    }

    abortController.abort()

    expect(lines).toEqual([
      {bar: 0, baz: 0, foo: 0},
      {bar: 99, baz: 99, foo: 99},
      {bar: 1, baz: 1, foo: 1},
      {bar: 99, baz: 99, foo: 99},
      {bar: 2, baz: 2, foo: 2},
      {bar: 99, baz: 99, foo: 99},
    ])
  })

  test('ends when the primary stream completes', async () => {
    const encoder = new TextEncoder()

    async function* gen() {
      for (let n = 0; n < 100; n++) {
        yield encoder.encode(`{"foo": ${n},`)
        yield encoder.encode(`"bar": ${n}, "baz": ${n}}`)
        yield encoder.encode('\n')
      }
    }

    const bufferFile = getTestBufferFileName()
    const createReader = bufferThroughFile(asyncIterableToStream(gen()), bufferFile)
    const primary = createReader()
    const first = firstValueFrom(parse(decodeText(streamToAsyncIterator(primary))))
    const last = lastValueFrom(parse(decodeText(streamToAsyncIterator(createReader()))))

    expect(await first).toEqual({bar: 0, baz: 0, foo: 0})
    await primary.cancel()

    expect(await last).toEqual({bar: 99, baz: 99, foo: 99})
  })

  test('throws if a new stream is created after abortion', async () => {
    const encoder = new TextEncoder()

    async function* gen() {
      for (let n = 0; n < 100; n++) {
        yield encoder.encode(`{"foo": ${n},`)
        yield encoder.encode(`"bar": ${n}, "baz": ${n}}`)
        yield encoder.encode('\n')
      }
    }

    const bufferFile = getTestBufferFileName()
    const controller = new AbortController()
    const createReader = bufferThroughFile(asyncIterableToStream(gen()), bufferFile, {
      keepFile: true,
      signal: controller.signal,
    })
    const primary = createReader()
    const first = await firstValueFrom(parse(decodeText(streamToAsyncIterator(primary))))

    expect(first).toEqual({bar: 0, baz: 0, foo: 0})

    await primary.cancel()

    controller.abort()

    await expect(() =>
      lastValueFrom(parse(decodeText(streamToAsyncIterator(createReader())))),
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      '[Error: Cannot create new buffered readers on aborted stream]',
    )
  })
})

describe('cleanup', () => {
  test('cleans up the file after cancel', async () => {
    const encoder = new TextEncoder()

    async function* gen() {
      for (let n = 0; n < 100; n++) {
        yield encoder.encode(`{"foo": ${n},`)
        yield encoder.encode(`"bar": ${n}, "baz": ${n}}`)
        yield encoder.encode('\n')
      }
    }

    const bufferFile = getTestBufferFileName()
    const controller = new AbortController()
    const createReader = bufferThroughFile(asyncIterableToStream(gen()), bufferFile, {
      signal: controller.signal,
    })
    const reader = createReader()

    const first = await firstValueFrom(parse(decodeText(streamToAsyncIterator(reader))))

    expect(first).toEqual({bar: 0, baz: 0, foo: 0})

    await reader.cancel()

    await vi.waitFor(async () => {
      await expect(stat(bufferFile)).rejects.toMatchObject({code: 'ENOENT'})
    })
  })
  test('cleans up after reading to the end', async () => {
    const encoder = new TextEncoder()

    async function* gen() {
      for (let n = 0; n < 100; n++) {
        yield encoder.encode(`{"foo": ${n},`)
        yield encoder.encode(`"bar": ${n}, "baz": ${n}}`)
        yield encoder.encode('\n')
      }
    }

    const bufferFile = getTestBufferFileName()
    const controller = new AbortController()
    const createReader = bufferThroughFile(asyncIterableToStream(gen()), bufferFile, {
      signal: controller.signal,
    })

    const firstReader = createReader()

    // Keep the parser alive so any partial JSON read ahead is preserved.
    const records = parse(decodeText(streamToAsyncIterator(firstReader)))
    const {value: first} = await records.next()

    expect(first).toEqual({bar: 0, baz: 0, foo: 0})

    const second = await lastValueFrom(records)
    expect(second).toEqual({bar: 99, baz: 99, foo: 99})

    await expect(stat(bufferFile)).rejects.toMatchObject({code: 'ENOENT'})
  })

  test.each([1, 2])('cleans up on abort with %i paused readers', async (readerCount) => {
    const bufferFile = getTestBufferFileName()
    const controller = new AbortController()
    const source = new ReadableStream<Uint8Array>({
      start(stream) {
        // More than a reader can prefetch, so cleanup cannot depend on another pull.
        stream.enqueue(new Uint8Array(8192))
        stream.close()
      },
    })
    const createReader = bufferThroughFile(source, bufferFile, {signal: controller.signal})
    const readers = Array.from({length: readerCount}, () => createReader().getReader())

    try {
      for (const reader of readers) {
        expect((await reader.read()).done).toBe(false)
      }
      expect((await stat(bufferFile)).size).toBe(8192)
      controller.abort()
      await vi.waitFor(async () => {
        await expect(stat(bufferFile)).rejects.toMatchObject({code: 'ENOENT'})
      })
      // Resuming or cancelling after abort must not try to remove the file twice.
      for (const reader of readers) {
        while (!(await reader.read()).done) {
          // Drain any chunk already queued before abort.
        }
        await reader.cancel()
      }
    } finally {
      controller.abort()
      for (const reader of readers) {
        await reader.cancel()
        reader.releaseLock()
      }
    }
  })

  test('cleans up when aborted during initialization', async () => {
    const bufferFile = getTestBufferFileName()
    const controller = new AbortController()
    const source = new ReadableStream<Uint8Array>({
      start(stream) {
        stream.close()
      },
    })
    const stream = bufferThroughFile(source, bufferFile, {signal: controller.signal})()
    controller.abort()
    const reader = stream.getReader()
    try {
      await expect(reader.read()).resolves.toMatchObject({done: true})
      await vi.waitFor(async () => {
        await expect(stat(bufferFile)).rejects.toMatchObject({code: 'ENOENT'})
      })
    } finally {
      await reader.cancel()
      reader.releaseLock()
    }
  })

  test('preserves the buffer on abort when keepFile is enabled', async () => {
    const bufferFile = getTestBufferFileName()
    const controller = new AbortController()
    const source = new ReadableStream<Uint8Array>({
      start(stream) {
        stream.enqueue(new Uint8Array(8192))
        stream.close()
      },
    })
    const reader = bufferThroughFile(source, bufferFile, {
      keepFile: true,
      signal: controller.signal,
    })().getReader()
    try {
      await reader.read()
      controller.abort()
      while (!(await reader.read()).done) {
        // Drain any chunk already queued before abort.
      }
      expect((await stat(bufferFile)).size).toBe(8192)
    } finally {
      controller.abort()
      await reader.cancel()
      reader.releaseLock()
    }
  })
})
