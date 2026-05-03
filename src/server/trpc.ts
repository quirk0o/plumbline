import { initTRPC } from '@trpc/server'

// Replace with a real createContext function when auth is added.
export const createTRPCContext = async (_opts: { req: Request }) => {
  return {}
}

type Context = Awaited<ReturnType<typeof createTRPCContext>>

const t = initTRPC.context<Context>().create()

export const router = t.router
export const publicProcedure = t.procedure
export const createCallerFactory = t.createCallerFactory
