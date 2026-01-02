import {maybeDecompress} from '../fs-webstream/maybeDecompress.js'
import {readFileAsWebStream} from '../fs-webstream/readFileAsWebStream.js'
import {drain} from '../tar-webstream/drain.js'
import {untar} from '../tar-webstream/untar.js'
import {streamToAsyncIterator} from '../utils/streamToAsyncIterator.js'

/**
 * @public
 */
export async function* fromExportArchive(path: string): AsyncGenerator<Uint8Array, void, unknown> {
  for await (const [header, entry] of streamToAsyncIterator(
    untar(await maybeDecompress(readFileAsWebStream(path))),
  )) {
    if (header.type === 'file' && header.name.endsWith('.ndjson')) {
      for await (const chunk of streamToAsyncIterator(entry)) {
        yield chunk
      }
    } else {
      // It's not ndjson, so drain the entry stream, so we can move on with the next entry
      await drain(entry)
    }
  }
}
