/**
 * @public
 */
export type JSONParser<Type> = (line: string) => Type

/**
 * @public
 */
export interface JSONOptions<Type> {
  parse?: JSONParser<Type>
}

/**
 * @public
 */
export async function* parseJSON<Type>(
  it: AsyncIterableIterator<string>,
  {parse = JSON.parse}: JSONOptions<Type> = {},
): AsyncIterableIterator<Type> {
  for await (const chunk of it) {
    yield parse(chunk)
  }
}

/**
 * @public
 */
export async function* stringifyJSON(it: AsyncIterableIterator<unknown>) {
  for await (const chunk of it) {
    yield JSON.stringify(chunk)
  }
}
