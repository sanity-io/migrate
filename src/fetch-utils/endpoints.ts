type SupportedMethod = 'GET' | 'POST'
export type Endpoint = {
  global: boolean
  method: SupportedMethod
  path: `/${string}`
  searchParams: [param: string, value: string][]
}

export const endpoints = {
  data: {
    export: (dataset: string, documentTypes?: string[]): Endpoint => ({
      global: false,
      method: 'GET',
      path: `/data/export/${dataset}`,
      searchParams:
        documentTypes && documentTypes?.length > 0 ? [['types', documentTypes.join(',')]] : [],
    }),
    mutate: (
      dataset: string,
      options?: {
        autoGenerateArrayKeys?: boolean
        dryRun?: boolean
        returnDocuments?: boolean
        returnIds?: boolean
        tag?: string
        visibility?: 'async' | 'deferred' | 'sync'
      },
    ): Endpoint => {
      const params = [
        options?.tag && ['tag', options.tag],
        options?.returnIds && ['returnIds', 'true'],
        options?.returnDocuments && ['returnDocuments', 'true'],
        options?.autoGenerateArrayKeys && ['autoGenerateArrayKeys', 'true'],
        options?.visibility && ['visibility', options.visibility],
        options?.dryRun && ['dryRun', 'true'],
      ].filter(Boolean) as [string, string][]

      return {
        global: false,
        method: 'POST',
        path: `/data/mutate/${dataset}`,
        searchParams: params,
      }
    },
    query: (dataset: string): Endpoint => ({
      global: false,
      method: 'GET',
      path: `/query/${dataset}`,
      searchParams: [['perspective', 'raw']],
    }),
  },
  users: {
    me: (): Endpoint => ({
      global: true,
      method: 'GET',
      path: '/users/me',
      searchParams: [],
    }),
  },
}
