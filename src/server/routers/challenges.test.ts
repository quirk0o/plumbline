import { describe, it, expect, beforeEach } from 'vitest'
import { authedCaller, unauthCaller } from '@/test/caller'
import { createTestUser, cleanupUser, createTestTrackerType } from '@/test/helpers'
import { withTestUser } from '@/test/fixtures'
import { db } from '@/server/db'

describe('challenges.create', () => {
  const ctx = withTestUser()

  it('creates a challenge owned by the caller', async () => {
    const result = await ctx.caller.challenges.create({ name: 'My Legacy Challenge' })
    expect(result.ownerId).toBe(ctx.userId)
    expect(await db.challenge.findUnique({ where: { id: result.id } })).not.toBeNull()
  })

  it('throws UNAUTHORIZED without a session', async () => {
    await expect(unauthCaller().challenges.create({ name: 'X' })).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })
})

describe('challenges.addPhase', () => {
  const ctx = withTestUser()
  let challengeId: string

  beforeEach(async () => {
    const c = await ctx.caller.challenges.create({ name: 'C' })
    challengeId = c.id
  })

  it('adds a generation phase to the challenge', async () => {
    const result = await ctx.caller.challenges.addPhase({
      challengeId,
      generationNumber: 1,
      title: 'The Founder',
    })
    expect(result.generationNumber).toBe(1)
    expect(result.challengeId).toBe(challengeId)
  })

  it('throws FORBIDDEN when challenge belongs to another user', async () => {
    const other = await createTestUser()
    try {
      await expect(
        authedCaller(other.id).challenges.addPhase({ challengeId, generationNumber: 1 })
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    } finally {
      await cleanupUser(other.id)
    }
  })
})

describe('challenges.update', () => {
  const ctx = withTestUser()

  it('returns NOT_FOUND when the challenge does not exist', async () => {
    await expect(
      ctx.caller.challenges.update({ id: 'nonexistent-challenge-id', name: 'New Name' })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})

describe('challenges.addTracker', () => {
  const ctx = withTestUser()
  let challengePhaseId: string
  let trackerTypeId: string

  beforeEach(async () => {
    const c = await ctx.caller.challenges.create({ name: 'C' })
    const phase = await ctx.caller.challenges.addPhase({ challengeId: c.id, generationNumber: 1 })
    challengePhaseId = phase.id
    const tt = await createTestTrackerType({ ownerId: ctx.userId })
    trackerTypeId = tt.id
  })

  it('adds a tracker to the phase', async () => {
    const result = await ctx.caller.challenges.addTracker({
      challengePhaseId,
      trackerTypeId,
      name: 'Max Cooking',
      config: { skillId: 'abc' },
    })
    expect(result.challengePhaseId).toBe(challengePhaseId)
    expect(result.name).toBe('Max Cooking')
  })

  it('returns NOT_FOUND when trackerTypeId belongs to another user (private)', async () => {
    const otherUser = await createTestUser()
    try {
      const privateTrackerType = await createTestTrackerType({ ownerId: otherUser.id })
      await expect(
        ctx.caller.challenges.addTracker({
          challengePhaseId,
          trackerTypeId: privateTrackerType.id,
          name: 'Stolen Tracker',
          config: {},
        })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    } finally {
      await cleanupUser(otherUser.id)
    }
  })
})

describe('challenges.getById', () => {
  const ctx = withTestUser()
  let challengeId: string

  beforeEach(async () => {
    const c = await ctx.caller.challenges.create({ name: 'Full Challenge' })
    challengeId = c.id
    await ctx.caller.challenges.addPhase({ challengeId, generationNumber: 1, title: 'Gen 1' })
  })

  it('returns the challenge with nested phases and trackers', async () => {
    const result = await ctx.caller.challenges.getById({ id: challengeId })
    expect(result.id).toBe(challengeId)
    expect(result.phases).toHaveLength(1)
    expect(result.phases[0].title).toBe('Gen 1')
  })

  it('throws NOT_FOUND for a challenge belonging to another user (private)', async () => {
    const other = await createTestUser()
    try {
      await expect(
        authedCaller(other.id).challenges.getById({ id: challengeId })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    } finally {
      await cleanupUser(other.id)
    }
  })
})
