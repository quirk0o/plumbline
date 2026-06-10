import { describe, expect } from 'vitest'
import { authedCaller, unauthCaller } from '@/test/caller'
import { createTestUser, cleanupUser, createTestTrackerType } from '@/test/helpers'
import { test as base } from '@/test/test'
import { db } from '@/server/db'

const testWithChallenge = base.extend<{ challengeId: string }>({
  challengeId: async ({ trpcCaller }, provide) => {
    const c = await trpcCaller.challenges.create({ name: 'C' })
    await provide(c.id)
  },
})

const testWithPhaseAndTracker = base.extend<{ challengePhaseId: string; trackerTypeId: string }>({
  challengePhaseId: async ({ trpcCaller }, provide) => {
    const c = await trpcCaller.challenges.create({ name: 'C' })
    const phase = await trpcCaller.challenges.addPhase({ challengeId: c.id, generationNumber: 1 })
    await provide(phase.id)
  },
  trackerTypeId: async ({ userId }, provide) => {
    const tt = await createTestTrackerType({ ownerId: userId })
    await provide(tt.id)
  },
})

const testWithChallengeAndPhase = base.extend<{ challengeId: string }>({
  challengeId: async ({ trpcCaller }, provide) => {
    const c = await trpcCaller.challenges.create({ name: 'Full Challenge' })
    await trpcCaller.challenges.addPhase({ challengeId: c.id, generationNumber: 1, title: 'Gen 1' })
    await provide(c.id)
  },
})

describe('challenges.create', () => {
  base('creates a challenge owned by the caller', async ({ trpcCaller, userId }) => {
    const result = await trpcCaller.challenges.create({ name: 'My Legacy Challenge' })
    expect(result.ownerId).toBe(userId)
    expect(await db.challenge.findUnique({ where: { id: result.id } })).not.toBeNull()
  })

  base('throws UNAUTHORIZED without a session', async () => {
    await expect(unauthCaller().challenges.create({ name: 'X' })).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })
})

describe('challenges.addPhase', () => {
  testWithChallenge('adds a generation phase to the challenge', async ({ trpcCaller, challengeId }) => {
    const result = await trpcCaller.challenges.addPhase({
      challengeId,
      generationNumber: 1,
      title: 'The Founder',
    })
    expect(result.generationNumber).toBe(1)
    expect(result.challengeId).toBe(challengeId)
  })

  testWithChallenge('throws FORBIDDEN when challenge belongs to another user', async ({ challengeId }) => {
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
  base('returns NOT_FOUND when the challenge does not exist', async ({ trpcCaller }) => {
    await expect(
      trpcCaller.challenges.update({ id: 'nonexistent-challenge-id', name: 'New Name' })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})

describe('challenges.addTracker', () => {
  testWithPhaseAndTracker('adds a tracker to the phase', async ({ trpcCaller, challengePhaseId, trackerTypeId }) => {
    const result = await trpcCaller.challenges.addTracker({
      challengePhaseId,
      trackerTypeId,
      name: 'Max Cooking',
      config: { skillId: 'abc' },
    })
    expect(result.challengePhaseId).toBe(challengePhaseId)
    expect(result.name).toBe('Max Cooking')
  })

  testWithPhaseAndTracker('returns NOT_FOUND when trackerTypeId belongs to another user (private)', async ({ trpcCaller, challengePhaseId }) => {
    const otherUser = await createTestUser()
    try {
      const privateTrackerType = await createTestTrackerType({ ownerId: otherUser.id })
      await expect(
        trpcCaller.challenges.addTracker({
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
  testWithChallengeAndPhase('returns the challenge with nested phases and trackers', async ({ trpcCaller, challengeId }) => {
    const result = await trpcCaller.challenges.getById({ id: challengeId })
    expect(result.id).toBe(challengeId)
    expect(result.phases).toHaveLength(1)
    expect(result.phases[0].title).toBe('Gen 1')
  })

  testWithChallengeAndPhase('throws NOT_FOUND for a challenge belonging to another user (private)', async ({ challengeId }) => {
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
