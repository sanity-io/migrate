import {expect, test} from 'vitest'

import {endpoints} from '../endpoints.js'
import {toFetchOptions} from '../sanityRequestOptions.js'

test('toFetchOptions', () => {
  expect(
    toFetchOptions({
      apiHost: 'api.sanity.io',
      apiVersion: 'v2025-01-31',
      endpoint: endpoints.data.query('my-dataset'),
      projectId: 'xyz',
    }),
  ).toEqual({
    init: {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': expect.stringMatching(/^@sanity\/migrate@\d+\./),
      },
      method: 'GET',
    },
    url: 'https://xyz.api.sanity.io//v2025-01-31/query/my-dataset?perspective=raw',
  })
})
