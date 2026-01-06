import {type Mutation as SanityMutation} from '@sanity/client'
import {SanityEncoder} from '@sanity/mutate'
import arrify from 'arrify'

import {isTransaction} from '../../mutations/asserters.js'
import {type Mutation, type Transaction} from '../../mutations/index.js'

/**
 * @public
 */
export interface TransactionPayload {
  mutations: SanityMutation[]

  transactionId?: string
}

export async function* toSanityMutations(
  it: AsyncIterableIterator<(Mutation | Transaction)[] | Mutation | Transaction>,
): AsyncIterableIterator<SanityMutation[] | TransactionPayload> {
  for await (const mutation of it) {
    for (const mut of arrify(mutation)) {
      if (isTransaction(mut)) {
        yield {
          ...(mut.id !== undefined && {transactionId: mut.id}),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SanityEncoder.encodeAll requires array of any
          mutations: SanityEncoder.encodeAll(mut.mutations as any[]),
        }
        continue
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SanityEncoder.encodeAll requires array of any
      yield SanityEncoder.encodeAll(arrify(mut) as any[])
    }
  }
}
