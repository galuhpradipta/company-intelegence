import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function createContext(_opts: FetchCreateContextFnOptions) {
  return {}
}

export type Context = Awaited<ReturnType<typeof createContext>>
