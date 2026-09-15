import {createTarDecoder} from 'modern-tar'

import {maybeDecompress} from '../fs-webstream/maybeDecompress.js'
import {readFileAsWebStream} from '../fs-webstream/readFileAsWebStream.js'
import {streamToAsyncIterator} from '../utils/streamToAsyncIterator.js'

/**
 * @public
 */
export async function* fromExportArchive(path: string): AsyncGenerator<Uint8Array, void, unknown> {
  for await (const {body, header} of streamToAsyncIterator(
    (await maybeDecompress(readFileAsWebStream(path))).pipeThrough(
      createTarDecoder({strict: true}),
    ),
  )) {
    if (header.type === 'file' && header.name.endsWith('.ndjson')) {
      for await (const chunk of streamToAsyncIterator(body)) {
        yield chunk
      }
    } else {
      // Cancel skipped entries so the decoder can advance to the next header.
      await body.cancel()
    }
  }
}
