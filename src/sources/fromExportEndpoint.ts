import {type SanityDocument} from '@sanity/types'
import {createSafeJsonParser} from '@sanity/util/createSafeJsonParser'

import {endpoints} from '../fetch-utils/endpoints.js'
import {fetchStream} from '../fetch-utils/fetchStream.js'
import {toFetchOptions} from '../fetch-utils/sanityRequestOptions.js'
import {type ExportAPIConfig} from '../types.js'

/**
 * @public
 */
export function fromExportEndpoint(options: ExportAPIConfig) {
  return fetchStream(
    toFetchOptions({
      apiHost: options.apiHost ?? 'api.sanity.io',
      apiVersion: options.apiVersion,
      endpoint: endpoints.data.export(options.dataset, options.documentTypes),
      projectId: options.projectId,
      tag: 'sanity.migration.export',
      token: options.token,
    }),
  )
}

/**
 * Safe JSON parser that is able to handle lines interrupted by an error object.
 *
 * This may occur when streaming NDJSON from the Export HTTP API.
 *
 * @public
 * @see {@link https://github.com/sanity-io/sanity/pull/1787 | Initial pull request}
 */
export const safeJsonParser = createSafeJsonParser<SanityDocument>({
  errorLabel: 'Error streaming dataset',
})
