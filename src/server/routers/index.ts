import { router } from '../trpc'
import { packsRouter } from './packs'

export const appRouter = router({
  packs: packsRouter,
})

export type AppRouter = typeof appRouter
