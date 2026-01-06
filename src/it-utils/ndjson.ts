import {filter} from './filter.js'
import {type JSONOptions, parseJSON} from './json.js'
import {split} from './split.js'

/**
 * @public
 */
export function parse<Type>(
  it: AsyncIterableIterator<string>,
  options?: JSONOptions<Type>,
): AsyncIterableIterator<Type> {
  return parseJSON(
    filter(split(it, '\n'), (line) => Boolean(line && line.trim())),
    options,
  )
}

/**
 * @public
 */
export async function* stringify(iterable: AsyncIterableIterator<unknown>) {
  for await (const doc of iterable) {
    yield `${JSON.stringify(doc)}\n`
  }
}
