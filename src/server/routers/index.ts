import { router } from '../trpc'
import { packsRouter } from './packs'
import { traitsRouter } from './traits'
import { aspirationsRouter } from './aspirations'
import { careersRouter } from './careers'
import { legaciesRouter } from './legacies'
import { simsRouter } from './sims'
import { trackerTypesRouter } from './trackerTypes'
import { challengesRouter } from './challenges'
import { challengeRunsRouter } from './challengeRuns'
import { milestonesRouter } from './milestones'

export const appRouter = router({
  packs: packsRouter,
  traits: traitsRouter,
  aspirations: aspirationsRouter,
  careers: careersRouter,
  legacies: legaciesRouter,
  sims: simsRouter,
  trackerTypes: trackerTypesRouter,
  challenges: challengesRouter,
  challengeRuns: challengeRunsRouter,
  milestones: milestonesRouter,
})

export type AppRouter = typeof appRouter
