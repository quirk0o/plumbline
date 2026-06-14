import { mergeRouters, router } from '../../trpc'
import { simsCoreRouter } from './core'
import { simsTreeRouter } from './tree'
import { simsLifecycleRouter } from './lifecycle'
import { simSkillsRouter } from './skills'
import { simTraitsRouter } from './traits'
import { simFamilyRouter } from './family'
import { simSocialRouter } from './social'

export const simsRouter = mergeRouters(
  simsCoreRouter,
  simsTreeRouter,
  simsLifecycleRouter,
  router({
    skills: simSkillsRouter,
    traits: simTraitsRouter,
    family: simFamilyRouter,
    social: simSocialRouter,
  }),
)
