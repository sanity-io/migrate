export type ArrayElement<A> = A extends readonly (infer T)[] ? T : never

export type NormalizeReadOnlyArray<T> = T extends readonly [infer NP, ...infer Rest]
  ? [NP, ...Rest]
  : T extends readonly (infer NP)[]
    ? NP[]
    : T

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Generic utility type that needs to accept any type
export type AnyArray<T = any> = readonly T[] | T[]

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

// Similar to Arrify only that it preserves tuple information
export type Tuplify<T> = T extends readonly [infer NP, ...infer Rest]
  ? [NP, ...Rest]
  : T extends readonly (infer NP)[]
    ? NP[]
    : [T]
