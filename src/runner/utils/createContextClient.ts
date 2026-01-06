import {createClient, type SanityClient} from '@sanity/client'

import {limitClientConcurrency} from './limitClientConcurrency.js'

export function createContextClient(config: Parameters<typeof createClient>[0]): RestrictedClient {
  return restrictClient(
    limitClientConcurrency(
      createClient({...config, requestTagPrefix: 'sanity.migration', useCdn: false}),
    ),
  )
}

/**
 * @public
 */
export const ALLOWED_PROPERTIES = [
  'fetch',
  'clone',
  'config',
  'withConfig',
  'getDocument',
  'getDocuments',
  'users',
  'projects',
] as const

/**
 * @public
 */
export type AllowedMethods = (typeof ALLOWED_PROPERTIES)[number]

/**
 * @public
 */
export type RestrictedClient = Pick<SanityClient, AllowedMethods>

function restrictClient(client: SanityClient): RestrictedClient {
  return new Proxy(client, {
    get: (target, property) => {
      switch (property) {
        case 'clone': {
          return (...args: Parameters<SanityClient['clone']>) => {
            return restrictClient(target.clone(...args))
          }
        }
        case 'config': {
          return (...args: Parameters<SanityClient['config']>) => {
            const result = target.config(...args)

            // if there is a config, it returns a client so we need to wrap again
            if (args[0]) return restrictClient(result)
            return result
          }
        }
        case 'withConfig': {
          return (...args: Parameters<SanityClient['withConfig']>) => {
            return restrictClient(target.withConfig(...args))
          }
        }
        default: {
          if (
            typeof property === 'string' &&
            ALLOWED_PROPERTIES.includes(property as AllowedMethods)
          ) {
            return target[property as keyof SanityClient]
          }
          throw new Error(
            `Client method "${String(
              property,
            )}" can not be called during a migration. Only ${ALLOWED_PROPERTIES.join(
              ', ',
            )} are allowed.`,
          )
        }
      }
    },
  })
}
