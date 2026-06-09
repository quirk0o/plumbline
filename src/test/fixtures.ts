// src/test/fixtures.ts
import { beforeEach, afterEach } from 'vitest'
import { authedCaller } from '@/test/caller'
import { createTestUser, cleanupUser, createTestLegacy } from '@/test/helpers'

export interface TestUserContext {
  userId: string
  caller: ReturnType<typeof authedCaller>
}

export interface TestLegacyContext extends TestUserContext {
  legacyId: string
}

/**
 * Registers beforeEach/afterEach on the enclosing describe block to create and
 * tear down a fresh test user per test. Returns a context object whose fields
 * are populated before each test body runs.
 *
 * Usage:
 *   describe('packs.getAll', () => {
 *     const ctx = withTestUser()
 *     it('...', async () => { await ctx.caller.packs.getAll() })
 *   })
 */
export function withTestUser(): TestUserContext {
  const ctx = {} as TestUserContext
  beforeEach(async () => {
    const user = await createTestUser()
    ctx.userId = user.id
    ctx.caller = authedCaller(user.id)
  })
  afterEach(async () => {
    // Guard against a failed beforeEach leaving userId unset: cleanupUser(undefined)
    // resolves to a WHERE-less deleteMany and would wipe every user in the test DB.
    if (ctx.userId) await cleanupUser(ctx.userId)
  })
  return ctx
}

/**
 * Like withTestUser, but also creates a legacy owned by that user. Composes
 * withTestUser so the teardown (and its guard) lives in one place; cleanupUser
 * cascades to the legacy, so no extra teardown is needed.
 */
export function withTestLegacy(): TestLegacyContext {
  const ctx = withTestUser() as TestLegacyContext
  beforeEach(async () => {
    const legacy = await createTestLegacy(ctx.userId)
    ctx.legacyId = legacy.id
  })
  return ctx
}
