import {createReadStream} from 'node:fs'
import {Readable} from 'node:stream'

export function readFileAsWebStream(filename: string): globalThis.ReadableStream<Uint8Array> {
  // eslint-disable-next-line n/no-unsupported-features/node-builtins -- Available since Node 17; marked stable in Node 22.17.
  return Readable.toWeb(createReadStream(filename), {
    strategy: {
      size: (chunk: Uint8Array) => chunk.byteLength,
    },
  })
}
