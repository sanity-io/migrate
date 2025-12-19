import {type MultipleMutationResult} from '@sanity/client'

import {fetchAsyncIterator, type FetchOptions} from '../fetch-utils/fetchStream.js'
import {concatStr} from '../it-utils/concatStr.js'
import {decodeText} from '../it-utils/decodeText.js'
import {parseJSON} from '../it-utils/json.js'
import {lastValueFrom} from '../it-utils/lastValueFrom.js'
import {mapAsync} from '../it-utils/mapAsync.js'

export async function commitMutations(
  fetchOptions: AsyncIterableIterator<FetchOptions>,
  options: {concurrency: number},
) {
  return mapAsync(
    fetchOptions,
    async (opts): Promise<MultipleMutationResult> =>
      lastValueFrom(parseJSON(concatStr(decodeText(await fetchAsyncIterator(opts))))),
    options.concurrency,
  )
}
