import {expect, test} from 'vitest'

import {readFileAsWebStream} from '../../fs-webstream/readFileAsWebStream.js'
import {streamToAsyncIterator} from '../../utils/streamToAsyncIterator.js'
import {untar} from '../untar.js'

async function* extract(file: string) {
  const fileStream = readFileAsWebStream(file)
  for await (const [header, body] of streamToAsyncIterator(untar(fileStream))) {
    if (body) {
      yield [header.name, streamToAsyncIterator(body)]
    }
  }
}

test('untar an empty tar file', async () => {
  await expect(async () => {
    for await (const [, body] of extract(`${import.meta.dirname}/fixtures/empty.tar`)) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _chunk of body!) {
        // should throw before reaching here
      }
    }
  }).rejects.toThrowErrorMatchingInlineSnapshot(
    '[Error: Unexpected end of tar file. Expected 512 bytes of headers.]',
  )
})

test('untar an invalid tar file of > 512b', async () => {
  await expect(async () => {
    for await (const [, body] of extract(`${import.meta.dirname}/fixtures/invalid.tar`)) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _chunk of body!) {
        // should throw before reaching here
      }
    }
  }).rejects.toThrowErrorMatchingInlineSnapshot(
    '[Error: Invalid tar header. Maybe the tar is corrupted or it needs to be gunzipped?]',
  )
})

test('untar a corrupted tar file', async () => {
  await expect(async () => {
    for await (const [, body] of extract(`${import.meta.dirname}/fixtures/corrupted.tar`)) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _chunk of body!) {
        // should throw before reaching here
      }
    }
  }).rejects.toThrowErrorMatchingInlineSnapshot(
    '[Error: Invalid tar header. Maybe the tar is corrupted or it needs to be gunzipped?]',
  )
})
