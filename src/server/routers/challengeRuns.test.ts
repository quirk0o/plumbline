import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { authedCaller } from '@/test/caller'
import { createTestUser, cleanupUser, createTestLegacy, createTestTrackerType } from '@/test/helpers'
import { db } from '@/server/db'
import { Prisma } from '@prisma/client'

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

describe('challengeRuns.link — transactional rollback', () => {
  let userId: string
  let legacyId: string

  beforeEach(async () => {
    ({ id: userId } = await createTestUser())
    const legacy = await createTestLegacy(userId)
    legacyId = legacy.id
  })
  afterEach(async () => { await cleanupUser(userId) })

  it('leaves no partial ChallengeRun when the challenge does not exist', async () => {
    const runsBefore = await db.challengeRun.findMany({ where: { legacyId } })
    await expect(
      authedCaller(userId).challengeRuns.link({ legacyId, challengeId: 'nonexistent-id' })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    const runsAfter = await db.challengeRun.findMany({ where: { legacyId } })
    expect(runsAfter).toHaveLength(runsBefore.length)
  })
})

describe('challengeRuns.updateProgress — additional scenarios', () => {
  let userId: string
  let legacyId: string

  beforeEach(async () => {
    ({ id: userId } = await createTestUser())
    const legacy = await createTestLegacy(userId)
    legacyId = legacy.id
  })
  afterEach(async () => { await cleanupUser(userId) })

  it('throws BAD_REQUEST for a non-manual tracker', async () => {
    const builtIn = await db.trackerType.findFirst({ where: { isBuiltIn: true, computationSpec: { not: Prisma.AnyNull } } })
    if (!builtIn) return
    const { challenge } = await buildChallengeWithPhaseAndTracker(userId, builtIn.id)
    const run = await authedCaller(userId).challengeRuns.link({ legacyId, challengeId: challenge.id })
    const phases = await db.challengeRunPhase.findMany({ where: { challengeRunId: run.id } })
    const trackers = await db.challengeRunTracker.findMany({ where: { challengeRunPhaseId: phases[0].id } })
    await expect(
      authedCaller(userId).challengeRuns.updateProgress({ challengeRunTrackerId: trackers[0].id, value: true })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('does not overwrite completedAt once set', async () => {
    const tt = await createTestTrackerType({ ownerId: userId, valueKind: 'BOOLEAN' })
    const { challenge } = await buildChallengeWithPhaseAndTracker(userId, tt.id)
    const run = await authedCaller(userId).challengeRuns.link({ legacyId, challengeId: challenge.id })
    const phases = await db.challengeRunPhase.findMany({ where: { challengeRunId: run.id } })
    const trackers = await db.challengeRunTracker.findMany({ where: { challengeRunPhaseId: phases[0].id } })

    await authedCaller(userId).challengeRuns.updateProgress({ challengeRunTrackerId: trackers[0].id, value: true })
    const first = await db.trackerProgress.findUnique({ where: { challengeRunTrackerId: trackers[0].id } })

    await authedCaller(userId).challengeRuns.updateProgress({ challengeRunTrackerId: trackers[0].id, value: true })
    const second = await db.trackerProgress.findUnique({ where: { challengeRunTrackerId: trackers[0].id } })
    expect(second?.completedAt).toEqual(first?.completedAt)
  })

  it('throws FORBIDDEN when updating progress for another user legacy', async () => {
    const other = await createTestUser()
    const tt = await createTestTrackerType({ ownerId: userId, valueKind: 'BOOLEAN' })
    const { challenge } = await buildChallengeWithPhaseAndTracker(userId, tt.id)
    const run = await authedCaller(userId).challengeRuns.link({ legacyId, challengeId: challenge.id })
    const phases = await db.challengeRunPhase.findMany({ where: { challengeRunId: run.id } })
    const trackers = await db.challengeRunTracker.findMany({ where: { challengeRunPhaseId: phases[0].id } })
    try {
      await expect(
        authedCaller(other.id).challengeRuns.updateProgress({ challengeRunTrackerId: trackers[0].id, value: true })
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    } finally {
      await cleanupUser(other.id)
    }
  })

  it('does not stamp completedAt when NUMERICAL value is below goalValue', async () => {
    const tt = await createTestTrackerType({ ownerId: userId, valueKind: 'NUMERICAL' })
    // Create a challenge with a tracker that has a goalConfig
    const challenge = await authedCaller(userId).challenges.create({ name: `C ${Date.now()}` })
    const phase = await authedCaller(userId).challenges.addPhase({ challengeId: challenge.id, generationNumber: 1 })
    await authedCaller(userId).challenges.addTracker({
      challengePhaseId: phase.id,
      trackerTypeId: tt.id,
      name: 'Count',
      config: {},
      goalConfig: { goalValue: 5 },
    })
    const run = await authedCaller(userId).challengeRuns.link({ legacyId, challengeId: challenge.id })
    const phases = await db.challengeRunPhase.findMany({ where: { challengeRunId: run.id } })
    const trackers = await db.challengeRunTracker.findMany({ where: { challengeRunPhaseId: phases[0].id } })

    await authedCaller(userId).challengeRuns.updateProgress({ challengeRunTrackerId: trackers[0].id, value: 3 })
    const progress = await db.trackerProgress.findUnique({ where: { challengeRunTrackerId: trackers[0].id } })
    expect(progress?.completedAt).toBeNull()

    await authedCaller(userId).challengeRuns.updateProgress({ challengeRunTrackerId: trackers[0].id, value: 5 })
    const done = await db.trackerProgress.findUnique({ where: { challengeRunTrackerId: trackers[0].id } })
    expect(done?.completedAt).not.toBeNull()
  })

  it('stamps completedAt for THRESHOLD tracker when value meets goalValue', async () => {
    const tt = await createTestTrackerType({ ownerId: userId, valueKind: 'THRESHOLD' })
    const challenge = await authedCaller(userId).challenges.create({ name: `C ${Date.now()}` })
    const phase = await authedCaller(userId).challenges.addPhase({ challengeId: challenge.id, generationNumber: 1 })
    await authedCaller(userId).challenges.addTracker({
      challengePhaseId: phase.id,
      trackerTypeId: tt.id,
      name: 'Threshold Tracker',
      config: {},
      goalConfig: { goalValue: 10 },
    })
    const run = await authedCaller(userId).challengeRuns.link({ legacyId, challengeId: challenge.id })
    const phases = await db.challengeRunPhase.findMany({ where: { challengeRunId: run.id } })
    const trackers = await db.challengeRunTracker.findMany({ where: { challengeRunPhaseId: phases[0].id } })

    await authedCaller(userId).challengeRuns.updateProgress({ challengeRunTrackerId: trackers[0].id, value: 7 })
    const before = await db.trackerProgress.findUnique({ where: { challengeRunTrackerId: trackers[0].id } })
    expect(before?.completedAt).toBeNull()

    await authedCaller(userId).challengeRuns.updateProgress({ challengeRunTrackerId: trackers[0].id, value: 10 })
    const after = await db.trackerProgress.findUnique({ where: { challengeRunTrackerId: trackers[0].id } })
    expect(after?.completedAt).not.toBeNull()
  })
})

describe('challengeRuns.listByLegacy', () => {
  let userId: string
  let legacyId: string

  beforeEach(async () => {
    ({ id: userId } = await createTestUser())
    const legacy = await createTestLegacy(userId)
    legacyId = legacy.id
  })
  afterEach(async () => { await cleanupUser(userId) })

  it('returns runs for the legacy', async () => {
    const tt = await createTestTrackerType({ ownerId: userId })
    const { challenge } = await buildChallengeWithPhaseAndTracker(userId, tt.id)
    await authedCaller(userId).challengeRuns.link({ legacyId, challengeId: challenge.id })
    const result = await authedCaller(userId).challengeRuns.listByLegacy({ legacyId })
    expect(result.length).toBeGreaterThan(0)
  })

  it('throws NOT_FOUND for another user legacy', async () => {
    const other = await createTestUser()
    try {
      await expect(
        authedCaller(other.id).challengeRuns.listByLegacy({ legacyId })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    } finally {
      await cleanupUser(other.id)
    }
  })
})
