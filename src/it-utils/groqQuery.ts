import {type SanityDocument} from '@sanity/types'
import {evaluate, parse} from 'groq-js'

import {toArray} from './toArray.js'

function parseGroq(query: string) {
  try {
    return parse(query)
  } catch (err) {
    if (err instanceof Error) {
      err.message = `Failed to parse GROQ filter "${query}": ${err.message}`
      throw err
    }
    throw new Error(`Failed to parse GROQ filter "${query}": ${String(err)}`)
  }
}

export async function groqQuery<T>(
  it: AsyncIterableIterator<SanityDocument>,
  query: string,
  params?: Record<string, unknown>,
): Promise<T> {
  const parsedFilter = parseGroq(query)
  const all = await toArray(it)
  return (await evaluate(parsedFilter, {dataset: all, ...(params !== undefined && {params})})).get()
}
