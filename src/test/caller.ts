import { createCallerFactory } from '@/server/trpc'
import { appRouter } from '@/server/routers'
import { db } from '@/server/db'
import type { Session } from 'next-auth'

const createCaller = createCallerFactory(appRouter)

export function authedCaller(userId: string) {
  const session = { user: { id: userId } } as Session & { user: { id: string } }
  return createCaller({ db, session })
}

export function unauthCaller() {
  return createCaller({ db, session: null })
}
