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

  it('each trait has the expected shape with a conflictsWith array', async () => {
    const caller = authedCaller(userId)
    const result = await caller.traits.getAll()
    for (const trait of result) {
      expect(typeof trait.id).toBe('string')
      expect(typeof trait.name).toBe('string')
      expect(Array.isArray(trait.conflictsWith)).toBe(true)
    }
  })

  it('throws UNAUTHORIZED without a session', async () => {
    const caller = unauthCaller()
    await expect(caller.traits.getAll()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })
})
