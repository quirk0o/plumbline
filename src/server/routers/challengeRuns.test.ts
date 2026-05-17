import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { authedCaller } from '@/test/caller'
import { createTestUser, cleanupUser, createTestLegacy, createTestTrackerType } from '@/test/helpers'
import { db } from '@/server/db'

async function buildChallengeWithPhaseAndTracker(userId: string, trackerTypeId: string) {
  const challenge = await authedCaller(userId).challenges.create({ name: `Test Challenge ${Date.now()}` })
  const phase = await authedCaller(userId).challenges.addPhase({ challengeId: challenge.id, generationNumber: 1, title: 'Gen 1' })
  const tracker = await authedCaller(userId).challenges.addTracker({
    challengePhaseId: phase.id,
    trackerTypeId,
    name: 'Test Tracker',
    config: {},
  })
  return { challenge, phase, tracker }
}

describe('challengeRuns.link', () => {
  let userId: string
  let legacyId: string
  let trackerTypeId: string

  beforeEach(async () => {
    ({ id: userId } = await createTestUser())
    const legacy = await createTestLegacy(userId)
    legacyId = legacy.id
    const tt = await createTestTrackerType({ ownerId: userId })
    trackerTypeId = tt.id
  })
  afterEach(async () => { await cleanupUser(userId) })

  it('creates a ChallengeRun with copied phases and trackers', async () => {
    const { challenge } = await buildChallengeWithPhaseAndTracker(userId, trackerTypeId)
    const run = await authedCaller(userId).challengeRuns.link({ legacyId, challengeId: challenge.id })

    expect(run.legacyId).toBe(legacyId)
    expect(run.sourceChallengeId).toBe(challenge.id)

    const phases = await db.challengeRunPhase.findMany({ where: { challengeRunId: run.id } })
    expect(phases).toHaveLength(1)
    expect(phases[0].generationNumber).toBe(1)

    const trackers = await db.challengeRunTracker.findMany({ where: { challengeRunPhaseId: phases[0].id } })
    expect(trackers).toHaveLength(1)

    const progress = await db.trackerProgress.findMany({ where: { challengeRunTrackerId: trackers[0].id } })
    expect(progress).toHaveLength(1)
  })

  it('marks progress as manual when trackerType has no computationSpec', async () => {
    const { challenge } = await buildChallengeWithPhaseAndTracker(userId, trackerTypeId)
    const run = await authedCaller(userId).challengeRuns.link({ legacyId, challengeId: challenge.id })
    const phases = await db.challengeRunPhase.findMany({ where: { challengeRunId: run.id } })
    const trackers = await db.challengeRunTracker.findMany({ where: { challengeRunPhaseId: phases[0].id } })
    const progress = await db.trackerProgress.findUnique({ where: { challengeRunTrackerId: trackers[0].id } })
    expect(progress?.isManual).toBe(true)
  })

  it('throws NOT_FOUND when the legacy does not belong to caller', async () => {
    const other = await createTestUser()
    const challenge = await authedCaller(userId).challenges.create({ name: `C ${Date.now()}` })
    try {
      await expect(
        authedCaller(other.id).challengeRuns.link({ legacyId, challengeId: challenge.id })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    } finally {
      await cleanupUser(other.id)
    }
  })
})

describe('challengeRuns.getById', () => {
  let userId: string
  let legacyId: string

  beforeEach(async () => {
    ({ id: userId } = await createTestUser())
    const legacy = await createTestLegacy(userId)
    legacyId = legacy.id
  })
  afterEach(async () => { await cleanupUser(userId) })

  it('returns run with nested phases, trackers, and progress', async () => {
    const tt = await createTestTrackerType({ ownerId: userId })
    const { challenge } = await buildChallengeWithPhaseAndTracker(userId, tt.id)
    const run = await authedCaller(userId).challengeRuns.link({ legacyId, challengeId: challenge.id })
    const result = await authedCaller(userId).challengeRuns.getById({ id: run.id })
    expect(result.phases).toHaveLength(1)
    expect(result.phases[0].trackers).toHaveLength(1)
    expect(result.phases[0].trackers[0].progress).toBeDefined()
  })
})

describe('challengeRuns.updateProgress', () => {
  let userId: string
  let legacyId: string

  beforeEach(async () => {
    ({ id: userId } = await createTestUser())
    const legacy = await createTestLegacy(userId)
    legacyId = legacy.id
  })
  afterEach(async () => { await cleanupUser(userId) })

  it('updates value on a manual tracker and stamps completedAt for BOOLEAN true', async () => {
    const tt = await createTestTrackerType({ ownerId: userId, valueKind: 'BOOLEAN' })
    const { challenge } = await buildChallengeWithPhaseAndTracker(userId, tt.id)
    const run = await authedCaller(userId).challengeRuns.link({ legacyId, challengeId: challenge.id })
    const phases = await db.challengeRunPhase.findMany({ where: { challengeRunId: run.id } })
    const trackers = await db.challengeRunTracker.findMany({ where: { challengeRunPhaseId: phases[0].id } })

    await authedCaller(userId).challengeRuns.updateProgress({
      challengeRunTrackerId: trackers[0].id,
      value: true,
    })
    const progress = await db.trackerProgress.findUnique({ where: { challengeRunTrackerId: trackers[0].id } })
    expect(progress?.value).toBe(true)
    expect(progress?.completedAt).not.toBeNull()
  })
})
