import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { authedCaller, unauthCaller } from '@/test/caller'
import { createTestUser, cleanupUser } from '@/test/helpers'

describe('traits.getAll', () => {
  let userId: string

  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
  })

  afterEach(async () => {
    await cleanupUser(userId)
  })

  it('returns a non-empty array of personality traits', async () => {
    const caller = authedCaller(userId)
    const result = await caller.traits.getAll()
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
  })

  it('includes the conflictsWith relation on every trait', async () => {
    const result = await authedCaller(userId).traits.getAll()
    expect(result.length).toBeGreaterThan(0)
    for (const trait of result) {
      expect(Array.isArray(trait.conflictsWith)).toBe(true)
    }
  })

  it('throws UNAUTHORIZED without a session', async () => {
    const caller = unauthCaller()
    await expect(caller.traits.getAll()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })
})
