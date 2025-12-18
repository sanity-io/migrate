import {endpoints} from '../fetch-utils/endpoints.js'
import {fetchAsyncIterator} from '../fetch-utils/fetchStream.js'
import {toFetchOptions} from '../fetch-utils/sanityRequestOptions.js'
import {type APIConfig} from '../types.js'

export function fromQueryEndpoint(options: APIConfig) {
  return fetchAsyncIterator(
    toFetchOptions({
      apiHost: options.apiHost ?? 'api.sanity.io',
      apiVersion: options.apiVersion,
      endpoint: endpoints.data.query(options.dataset),
      projectId: options.projectId,
      token: options.token,
    }),
  )
}
