declare module 'fast-fifo' {
  class FixedFIFO<T> {
    btm: number
    buffer: T[]
    mask: number
    next: FixedFIFO<T> | null
    top: number
    constructor(hwm: number)
    isEmpty(): boolean
    peek(): T
    push(data: T): boolean
    shift(): T | undefined
  }
  class FastFIFO<T> {
    head: FixedFIFO<T>
    hwm: number
    tail: FixedFIFO<T>
    constructor(hwm?: number)
    isEmpty(): boolean
    peek(): T
    push(val: T): void
    shift(): T | undefined
  }
  export default FastFIFO
}
