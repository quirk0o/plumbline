import { router } from '../trpc'
import { packsRouter } from './packs'
import { traitsRouter } from './traits'
import { aspirationsRouter } from './aspirations'
import { careersRouter } from './careers'
import { legaciesRouter } from './legacies'
import { simsRouter } from './sims'
import { trackerTypesRouter } from './trackerTypes'
import { challengesRouter } from './challenges'

export const appRouter = router({
  packs: packsRouter,
  traits: traitsRouter,
  aspirations: aspirationsRouter,
  careers: careersRouter,
  legacies: legaciesRouter,
  sims: simsRouter,
  trackerTypes: trackerTypesRouter,
  challenges: challengesRouter,
})

export type AppRouter = typeof appRouter
