import {evaluate, type ExprNode, parse} from 'groq-js'

export function parseGroqFilter(filter: string) {
  try {
    return parse(`*[${filter}]`)
  } catch (err) {
    if (err instanceof Error) {
      err.message = `Failed to parse GROQ filter "${filter}": ${err.message}`
      throw err
    }
    throw new Error(`Failed to parse GROQ filter "${filter}": ${String(err)}`)
  }
}

export async function matchesFilter(parsedFilter: ExprNode, document: unknown) {
  const result = await (await evaluate(parsedFilter, {dataset: [document]})).get()
  return result.length === 1
}
