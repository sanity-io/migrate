import {createRequester, type FetchInit, isHttpError} from 'get-it'
import {createNodeFetch} from 'get-it/node'

import {streamToAsyncIterator} from '../utils/streamToAsyncIterator.js'

const request = createRequester({
  as: 'stream',
  fetch: createNodeFetch(),
  middleware: [
    async (options, next) => {
      try {
        return await next(options)
      } catch (error) {
        if (isHttpError(error)) {
          error.message = errorMessage(error.status, error.statusText, error.body)
        }
        throw error
      }
    },
  ],
  // Large exports may take longer than the default two-minute total timeout.
  timeout: {headers: 120_000, total: false},
})

/**
 * @public
 */
export interface FetchOptions {
  init: FetchInit
  url: string | URL
}

interface ErrorResponse {
  error?:
    | string
    | {
        description?: string
        type?: string
      }
  message?: string
}

function errorMessage(status: number, statusText: string, body: unknown): string {
  let response: ErrorResponse | null = null
  try {
    response = typeof body === 'string' ? JSON.parse(body) : null
  } catch {
    // Non-JSON errors use the HTTP status message.
  }

  if (response?.error) {
    if (typeof response.error === 'object') {
      return `${response.error.type || status}: ${
        response.error.description || response.message || 'Unknown error'
      }`
    }
    return `${response.error}: ${response.message || ''}`
  }
  return `HTTP Error ${status}: ${statusText}`
}

export async function fetchStream({init, url}: FetchOptions) {
  const response = await request({...init, url: String(url)})
  return response.body
}

export async function fetchAsyncIterator(options: FetchOptions) {
  return streamToAsyncIterator(await fetchStream(options))
}
