import { test as base } from 'vitest'
import { authedCaller } from '@/test/caller'
import { createTestUser, cleanupUser, createTestLegacy } from '@/test/helpers'

export interface TestFixtures {
  /** A fresh test user, created before the test and deleted (cascading) after. */
  userId: string
  /** A tRPC caller authenticated as `userId`. */
  trpcCaller: ReturnType<typeof authedCaller>
  /** A legacy owned by `userId`. Only created for tests that destructure it. */
  legacyId: string
}

/**
 * Vitest test extended with database fixtures. Fixtures are lazy: a test only
 * pays for what it destructures, so `test('…', ({ trpcCaller }) => …)` creates a
 * user but no legacy, while `({ legacyId })` creates both.
 *
 * Teardown runs after each test via the `provide()` continuation; deleting the user
 * cascades to the legacy, so no explicit legacy cleanup is needed. Tests that
 * need a second user (ownership checks) or a custom db (rollback tests) create
 * those directly with the `@/test/helpers` factories and `authedCaller`.
 *
 * Files that need extra per-suite entities extend this further, e.g.
 *   const test = base.extend<{ sim: Sim }>({
 *     sim: async ({ legacyId }, provide) => { await provide(await createTestSim(legacyId)) },
 *   })
 */
export const test = base.extend<TestFixtures>({
  userId: async ({}, provide) => {
    const user = await createTestUser()
    await provide(user.id)
    await cleanupUser(user.id)
  },
  trpcCaller: async ({ userId }, provide) => {
    await provide(authedCaller(userId))
  },
  legacyId: async ({ userId }, provide) => {
    const legacy = await createTestLegacy(userId)
    await provide(legacy.id)
  },
})
