import {webcrypto} from 'node:crypto'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

import {expect, test} from 'vitest'

import {readFileAsWebStream} from '../../fs-webstream/readFileAsWebStream.js'
import {toArray} from '../../it-utils/toArray.js'
import {concatUint8Arrays} from '../../uint8arrays/index.js'
import {streamToAsyncIterator} from '../../utils/streamToAsyncIterator.js'
import {drain} from '../drain.js'
import {untar} from '../untar.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function getCrypto() {
  // eslint-disable-next-line n/no-unsupported-features/node-builtins
  if (globalThis.crypto === undefined) {
    return webcrypto
  }
  // eslint-disable-next-line n/no-unsupported-features/node-builtins
  return globalThis.crypto
}

async function shasum(data: Uint8Array) {
  const {subtle} = getCrypto()
  const digest = await subtle.digest('SHA-256', data.buffer as ArrayBuffer)
  return hex(new Uint8Array(digest))
}
function hex(data: Uint8Array) {
  return [...data].map((i) => i.toString(16).padStart(2, '0')).join('')
}

// Sample file to verify checksum against
const file = '7eeec7b86ddfefd7d7b66e137b2b9220a527528f-185x278.jpg'

test('untar movies dataset export', async () => {
  const fileStream = readFileAsWebStream(`${__dirname}/fixtures/movies.tar`)

  for await (const [header, body] of streamToAsyncIterator(untar(fileStream))) {
    if (header.name.includes(file)) {
      const chunks = await toArray<Uint8Array>(streamToAsyncIterator(body))
      const sum = await shasum(concatUint8Arrays(chunks))
      expect(sum).toEqual('02c936cda5695fa4f43f5dc919c1f55c362faa6dd558dfb2d77d524f004069db')
    } else {
      await drain(body)
    }
  }
})
