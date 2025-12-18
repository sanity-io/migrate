import {type FileHandle, open} from 'node:fs/promises'

import baseDebug from '../debug.js'

const debug = baseDebug.extend('readFileAsWebStream')

const CHUNK_SIZE = 1024 * 16

export function readFileAsWebStream(filename: string): ReadableStream<Uint8Array> {
  let fileHandle: FileHandle
  let position = 0

  return new ReadableStream({
    async pull(controller) {
      const {buffer, bytesRead} = await fileHandle.read(
        new Uint8Array(CHUNK_SIZE),
        0,
        CHUNK_SIZE,
        position,
      )
      if (bytesRead === 0) {
        await fileHandle.close()
        debug('Closing readable stream from', filename)
        controller.close()
      } else {
        position += bytesRead
        controller.enqueue(buffer.subarray(0, bytesRead))
      }
    },
    async start() {
      debug('Starting readable stream from', filename)
      fileHandle = await open(filename, 'r')
    },

    cancel() {
      debug('Cancelling readable stream from', filename)
      return fileHandle.close()
    },
  })
}
