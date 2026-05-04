import { initTRPC, TRPCError } from '@trpc/server'
import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch'
import type { Session } from 'next-auth'
import { db } from './db'
import { auth } from '../../auth'

export const createTRPCContext = async (_opts: FetchCreateContextFnOptions) => {
  const session = await auth()
  return { db, session }
}

type Context = Awaited<ReturnType<typeof createTRPCContext>>

const t = initTRPC.context<Context>().create()

const enforceAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user?.id) throw new TRPCError({ code: 'UNAUTHORIZED' })
  return next({
    ctx: {
      ...ctx,
      session: ctx.session as Session & { user: { id: string } },
    },
  })
})

export const router = t.router
export const publicProcedure = t.procedure
export const protectedProcedure = t.procedure.use(enforceAuth)
export const createCallerFactory = t.createCallerFactory
