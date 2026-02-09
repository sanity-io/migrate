import {pMapIterable} from 'p-map'

export async function mapAsync<T, U>(
  it: AsyncIterableIterator<T>,
  project: (value: T) => Promise<U>,
  concurrency: number,
): Promise<AsyncIterable<U>> {
  return pMapIterable(it, (v) => project(v), {
    concurrency: concurrency,
  })
}
