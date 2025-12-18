import {createRequire} from 'node:module'

import {type Endpoint} from './endpoints.js'
import {type FetchOptions} from './fetchStream.js'

const require = createRequire(import.meta.url)

function getUserAgent() {
  if ((globalThis as Record<string, unknown>).window === undefined) {
    // only set UA if we're in a non-browser environment
    try {
      const pkg = require('../../package.json')
      return `${pkg.name}@${pkg.version}`
      // eslint-disable-next-line no-empty
    } catch {}
  }
  return null
}

interface SanityRequestOptions {
  apiHost: string
  apiVersion: 'vX' | `v${number}-${number}-${number}`
  endpoint: Endpoint
  projectId: string

  body?: string
  tag?: string
  token?: string
}

function normalizeApiHost(apiHost: string) {
  return apiHost.replace(/^https?:\/\//, '')
}

export function toFetchOptions(req: SanityRequestOptions): FetchOptions {
  const {apiHost, apiVersion, body, endpoint, projectId, tag, token} = req
  const requestInit: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
    },
    method: endpoint.method || 'GET',
    ...(body !== undefined && {body}),
  }
  const ua = getUserAgent()
  if (ua) {
    requestInit.headers = {
      ...requestInit.headers,
      'User-Agent': ua,
    }
  }
  if (token) {
    requestInit.headers = {
      ...requestInit.headers,
      Authorization: `bearer ${token}`,
    }
  }
  const normalizedApiHost = normalizeApiHost(apiHost)
  const path = `/${apiVersion}${endpoint.path}`
  const host = endpoint.global ? normalizedApiHost : `${projectId}.${normalizedApiHost}`
  const searchParams = new URLSearchParams([
    ...endpoint.searchParams,
    ...(tag ? [['tag', tag]] : []),
  ]).toString()

  return {
    init: requestInit,
    url: `https://${host}/${path}${searchParams ? `?${searchParams}` : ''}`,
  }
}
