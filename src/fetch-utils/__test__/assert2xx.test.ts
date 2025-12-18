import {expect, test} from 'vitest'

import {assert2xx} from '../fetchStream.js'

test('server responds with 2xx', async () => {
  const mockResponse = {
    json: () =>
      Promise.resolve({
        this: 'is fine',
      }),
    status: 200,
    statusText: 'OK',
  }
  await expect(assert2xx(mockResponse as unknown as Response)).resolves.toBeUndefined()
})

test('server responds with 4xx and error response', async () => {
  const mockResponse = {
    json: () =>
      Promise.resolve({
        error: 'Error message',
        message: 'More details',
        status: 400,
      }),
    status: 400,
    statusText: 'Request error',
  }
  await expect(assert2xx(mockResponse as unknown as Response)).rejects.toThrowError(
    expect.objectContaining({
      message: 'Error message: More details',
      statusCode: 400,
    }),
  )
})

test('server responds with 5xx and no json response', async () => {
  const mockResponse = {
    json: () => Promise.reject(new Error('Failed to parse JSON')),
    status: 500,
    statusText: 'Internal Server Error',
  }
  await expect(assert2xx(mockResponse as unknown as Response)).rejects.toThrowError(
    expect.objectContaining({
      message: 'HTTP Error 500: Internal Server Error',
      statusCode: 500,
    }),
  )
})

test('server responds with 5xx and json response', async () => {
  const mockResponse = {
    json: () =>
      Promise.resolve({
        error: {
          description: 'Document is not of valid type',
          type: 'validationError',
        },
        status: 500,
      }),
    status: 500,
    statusText: 'Internal Server Error',
  }
  await expect(assert2xx(mockResponse as unknown as Response)).rejects.toThrowError(
    expect.objectContaining({
      message: 'validationError: Document is not of valid type',
      statusCode: 500,
    }),
  )
})
