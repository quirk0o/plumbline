import { initTRPC } from '@trpc/server'
import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch'
import { db } from './db'

// Add session/auth to the returned object when authentication is implemented.
export const createTRPCContext = async (_opts: FetchCreateContextFnOptions) => {
  return { db }
}

type Context = Awaited<ReturnType<typeof createTRPCContext>>

const t = initTRPC.context<Context>().create()

export const router = t.router
export const publicProcedure = t.procedure
export const createCallerFactory = t.createCallerFactory
