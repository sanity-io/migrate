import {type APIConfig} from '../types.js'

const HISTORY_API_DOCS_URL = 'https://www.sanity.io/docs/history-api'

function transactionLogUrl(api: APIConfig, transactionId: string): string {
  const host = (api.apiHost ?? 'api.sanity.io').replace(/^https?:\/\//, '')
  const searchParams = new URLSearchParams({
    excludeContent: 'true',
    fromTransaction: transactionId,
    limit: '1',
  })
  return `https://${api.projectId}.${host}/${api.apiVersion}/data/history/${api.dataset}/transactions?${searchParams}`
}

function formatMessage(api: APIConfig, transactionIds: string[]): string {
  const count = transactionIds.length
  return [
    `Mutation request failed before the API confirmed the outcome, so the outcome of ${count} ${
      count === 1 ? 'transaction' : 'transactions'
    } is unknown: ${count === 1 ? 'it' : 'they'} may or may not have been committed.`,
    '',
    `Check the transaction log to see what was written before re-running this migration. Re-running it will apply any non-idempotent mutations (append, create, inc, insert) a second time:`,
    ...transactionIds.map((id) => `  ${id}\n    ${transactionLogUrl(api, id)}`),
    '',
    `See ${HISTORY_API_DOCS_URL} for how to read the transaction log.`,
  ].join('\n')
}

/**
 * Thrown when a mutation request fails without the API having confirmed the outcome, typically
 * because the request timed out client side or the connection was dropped. The transactions listed
 * in `transactionIds` may or may not have been committed, so the dataset is in an unknown state and
 * re-running the migration may apply non-idempotent mutations twice.
 *
 * @public
 */
export class UnknownTransactionOutcomeError extends Error {
  /**
   * IDs of the transactions whose outcome could not be determined. Look these up in the transaction
   * log to find out whether they were committed.
   */
  readonly transactionIds: string[]

  constructor(transactionIds: string[], options: {api: APIConfig; cause: unknown}) {
    super(formatMessage(options.api, transactionIds), {cause: options.cause})
    this.name = 'UnknownTransactionOutcomeError'
    this.transactionIds = transactionIds
  }
}
