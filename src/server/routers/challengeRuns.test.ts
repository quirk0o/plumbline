import { describe, expect } from 'vitest'
import { authedCaller } from '@/test/caller'
import { createTestUser, cleanupUser, createTestTrackerType, createTestSim, getAnySkill, getTrackerTypeByName, getAnyBuiltInTrackerType } from '@/test/helpers'
import { test as base } from '@/test/fixtures'
import { db } from '@/server/db'
import { recomputeLegacyTrackers } from '@/server/lib/trackerComputation'

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

const test = base.extend<{ trackerTypeId: string }>({
  trackerTypeId: async ({ userId }, provide) => {
    const tt = await createTestTrackerType({ ownerId: userId })
    await provide(tt.id)
  },
})

describe('challengeRuns.link', () => {
  test('creates a ChallengeRun with copied phases and trackers', async ({ trpcCaller, userId, legacyId, trackerTypeId }) => {
    const { challenge } = await buildChallengeWithPhaseAndTracker(userId, trackerTypeId)
    const run = await trpcCaller.challengeRuns.link({ legacyId, challengeId: challenge.id })

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

  test('marks progress as manual when trackerType has no computationSpec', async ({ trpcCaller, userId, legacyId, trackerTypeId }) => {
    const { challenge } = await buildChallengeWithPhaseAndTracker(userId, trackerTypeId)
    const run = await trpcCaller.challengeRuns.link({ legacyId, challengeId: challenge.id })
    const phases = await db.challengeRunPhase.findMany({ where: { challengeRunId: run.id } })
    const trackers = await db.challengeRunTracker.findMany({ where: { challengeRunPhaseId: phases[0].id } })
    const progress = await db.trackerProgress.findUnique({ where: { challengeRunTrackerId: trackers[0].id } })
    expect(progress?.isManual).toBe(true)
  })

  test('throws NOT_FOUND when the legacy does not belong to caller', async ({ trpcCaller, legacyId }) => {
    const other = await createTestUser()
    const challenge = await trpcCaller.challenges.create({ name: `C ${Date.now()}` })
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
  test('returns run with nested phases, trackers, and progress', async ({ trpcCaller, userId, legacyId }) => {
    const tt = await createTestTrackerType({ ownerId: userId })
    const { challenge } = await buildChallengeWithPhaseAndTracker(userId, tt.id)
    const run = await trpcCaller.challengeRuns.link({ legacyId, challengeId: challenge.id })
    const result = await trpcCaller.challengeRuns.getById({ id: run.id })
    expect(result.phases).toHaveLength(1)
    expect(result.phases[0].trackers).toHaveLength(1)
    expect(result.phases[0].trackers[0].progress).toMatchObject({ value: false, completedAt: null, isManual: true })
  })
})

describe('challengeRuns.getById — completion derivation', () => {
  test('sets isComplete true on phase and run when all trackers have completedAt', async ({ trpcCaller, userId, legacyId }) => {
    const tt = await createTestTrackerType({ ownerId: userId, valueKind: 'BOOLEAN' })
    const { challenge } = await buildChallengeWithPhaseAndTracker(userId, tt.id)
    const run = await trpcCaller.challengeRuns.link({ legacyId, challengeId: challenge.id })

    const phases = await db.challengeRunPhase.findMany({ where: { challengeRunId: run.id } })
    const trackers = await db.challengeRunTracker.findMany({ where: { challengeRunPhaseId: phases[0].id } })
    // Mark tracker complete by updating its progress directly
    await db.trackerProgress.update({
      where: { challengeRunTrackerId: trackers[0].id },
      data: { completedAt: new Date() },
    })

    const result = await trpcCaller.challengeRuns.getById({ id: run.id })
    expect(result.phases[0].isComplete).toBe(true)
    expect(result.isComplete).toBe(true)
  })

  test('sets isComplete false on phase and run when any tracker lacks completedAt', async ({ trpcCaller, userId, legacyId }) => {
    const tt = await createTestTrackerType({ ownerId: userId, valueKind: 'BOOLEAN' })
    const { challenge } = await buildChallengeWithPhaseAndTracker(userId, tt.id)
    // Also add a second tracker so one stays incomplete
    const phases = await db.challengePhase.findMany({ where: { challengeId: challenge.id } })
    const tt2 = await createTestTrackerType({ ownerId: userId, valueKind: 'BOOLEAN' })
    await trpcCaller.challenges.addTracker({
      challengePhaseId: phases[0].id,
      trackerTypeId: tt2.id,
      name: 'Second Tracker',
      config: {},
    })
    const run = await trpcCaller.challengeRuns.link({ legacyId, challengeId: challenge.id })

    // Complete only the first of the two trackers in the run
    const runPhases = await db.challengeRunPhase.findMany({ where: { challengeRunId: run.id } })
    const runTrackers = await db.challengeRunTracker.findMany({ where: { challengeRunPhaseId: runPhases[0].id } })
    await db.trackerProgress.update({
      where: { challengeRunTrackerId: runTrackers[0].id },
      data: { completedAt: new Date() },
    })
    // Leave runTrackers[1].completedAt as null

    const result = await trpcCaller.challengeRuns.getById({ id: run.id })
    expect(result.phases[0].isComplete).toBe(false)
    expect(result.isComplete).toBe(false)
  })

  test('sets isComplete false for a phase with no trackers', async ({ trpcCaller, legacyId }) => {
    // Create a challenge with a phase that has no trackers
    const challenge = await trpcCaller.challenges.create({ name: `Empty Phase ${Date.now()}` })
    await trpcCaller.challenges.addPhase({ challengeId: challenge.id, generationNumber: 1, title: 'Empty Gen' })
    const run = await trpcCaller.challengeRuns.link({ legacyId, challengeId: challenge.id })

    const result = await trpcCaller.challengeRuns.getById({ id: run.id })
    expect(result.phases[0].isComplete).toBe(false)
    expect(result.isComplete).toBe(false)
  })
})

describe('challengeRuns.updateProgress', () => {
  test('updates value on a manual tracker and stamps completedAt for BOOLEAN true', async ({ trpcCaller, userId, legacyId }) => {
    const tt = await createTestTrackerType({ ownerId: userId, valueKind: 'BOOLEAN' })
    const { challenge } = await buildChallengeWithPhaseAndTracker(userId, tt.id)
    const run = await trpcCaller.challengeRuns.link({ legacyId, challengeId: challenge.id })
    const phases = await db.challengeRunPhase.findMany({ where: { challengeRunId: run.id } })
    const trackers = await db.challengeRunTracker.findMany({ where: { challengeRunPhaseId: phases[0].id } })

    await trpcCaller.challengeRuns.updateProgress({
      challengeRunTrackerId: trackers[0].id,
      value: true,
    })
    const progress = await db.trackerProgress.findUnique({ where: { challengeRunTrackerId: trackers[0].id } })
    expect(progress?.value).toBe(true)
    expect(progress?.completedAt).not.toBeNull()
  })
})

describe('challengeRuns.link — transactional rollback', () => {
  test('leaves no partial ChallengeRun when the challenge does not exist', async ({ trpcCaller, legacyId }) => {
    const runsBefore = await db.challengeRun.findMany({ where: { legacyId } })
    await expect(
      trpcCaller.challengeRuns.link({ legacyId, challengeId: 'nonexistent-id' })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    const runsAfter = await db.challengeRun.findMany({ where: { legacyId } })
    expect(runsAfter).toHaveLength(runsBefore.length)
  })
})

describe('challengeRuns.updateProgress — additional scenarios', () => {
  test('throws BAD_REQUEST for a non-manual tracker', async ({ trpcCaller, userId, legacyId }) => {
    const builtIn = await getAnyBuiltInTrackerType({ requireComputationSpec: true })
    const { challenge } = await buildChallengeWithPhaseAndTracker(userId, builtIn.id)
    const run = await trpcCaller.challengeRuns.link({ legacyId, challengeId: challenge.id })
    const phases = await db.challengeRunPhase.findMany({ where: { challengeRunId: run.id } })
    const trackers = await db.challengeRunTracker.findMany({ where: { challengeRunPhaseId: phases[0].id } })
    await expect(
      trpcCaller.challengeRuns.updateProgress({ challengeRunTrackerId: trackers[0].id, value: true })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  test('does not overwrite completedAt once set', async ({ trpcCaller, userId, legacyId }) => {
    const tt = await createTestTrackerType({ ownerId: userId, valueKind: 'BOOLEAN' })
    const { challenge } = await buildChallengeWithPhaseAndTracker(userId, tt.id)
    const run = await trpcCaller.challengeRuns.link({ legacyId, challengeId: challenge.id })
    const phases = await db.challengeRunPhase.findMany({ where: { challengeRunId: run.id } })
    const trackers = await db.challengeRunTracker.findMany({ where: { challengeRunPhaseId: phases[0].id } })

    await trpcCaller.challengeRuns.updateProgress({ challengeRunTrackerId: trackers[0].id, value: true })
    const first = await db.trackerProgress.findUnique({ where: { challengeRunTrackerId: trackers[0].id } })

    await trpcCaller.challengeRuns.updateProgress({ challengeRunTrackerId: trackers[0].id, value: true })
    const second = await db.trackerProgress.findUnique({ where: { challengeRunTrackerId: trackers[0].id } })
    expect(second?.completedAt).toEqual(first?.completedAt)
  })

  test('throws FORBIDDEN when updating progress for another user legacy', async ({ trpcCaller, userId, legacyId }) => {
    const other = await createTestUser()
    const tt = await createTestTrackerType({ ownerId: userId, valueKind: 'BOOLEAN' })
    const { challenge } = await buildChallengeWithPhaseAndTracker(userId, tt.id)
    const run = await trpcCaller.challengeRuns.link({ legacyId, challengeId: challenge.id })
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

  test('does not stamp completedAt when NUMERICAL value is below goalValue', async ({ trpcCaller, userId, legacyId }) => {
    const tt = await createTestTrackerType({ ownerId: userId, valueKind: 'NUMERICAL' })
    // Create a challenge with a tracker that has a goalConfig
    const challenge = await trpcCaller.challenges.create({ name: `C ${Date.now()}` })
    const phase = await trpcCaller.challenges.addPhase({ challengeId: challenge.id, generationNumber: 1 })
    await trpcCaller.challenges.addTracker({
      challengePhaseId: phase.id,
      trackerTypeId: tt.id,
      name: 'Count',
      config: {},
      goalConfig: { goalValue: 5 },
    })
    const run = await trpcCaller.challengeRuns.link({ legacyId, challengeId: challenge.id })
    const phases = await db.challengeRunPhase.findMany({ where: { challengeRunId: run.id } })
    const trackers = await db.challengeRunTracker.findMany({ where: { challengeRunPhaseId: phases[0].id } })

    await trpcCaller.challengeRuns.updateProgress({ challengeRunTrackerId: trackers[0].id, value: 3 })
    const progress = await db.trackerProgress.findUnique({ where: { challengeRunTrackerId: trackers[0].id } })
    expect(progress?.completedAt).toBeNull()

    await trpcCaller.challengeRuns.updateProgress({ challengeRunTrackerId: trackers[0].id, value: 5 })
    const done = await db.trackerProgress.findUnique({ where: { challengeRunTrackerId: trackers[0].id } })
    expect(done?.completedAt).not.toBeNull()
  })

  test('stores earnedPoints for THRESHOLD tracker and completes when all thresholds crossed', async ({ trpcCaller, userId, legacyId }) => {
    const tt = await createTestTrackerType({ ownerId: userId, valueKind: 'THRESHOLD' })
    const challenge = await trpcCaller.challenges.create({ name: `C ${Date.now()}` })
    const phase = await trpcCaller.challenges.addPhase({ challengeId: challenge.id, generationNumber: 1 })
    // thresholds: [5, 10, 15] — 3 milestones
    await trpcCaller.challenges.addTracker({
      challengePhaseId: phase.id,
      trackerTypeId: tt.id,
      name: 'Threshold Tracker',
      config: {},
      goalConfig: { thresholds: [5, 10, 15] },
    })
    const run = await trpcCaller.challengeRuns.link({ legacyId, challengeId: challenge.id })
    const phases = await db.challengeRunPhase.findMany({ where: { challengeRunId: run.id } })
    const trackers = await db.challengeRunTracker.findMany({ where: { challengeRunPhaseId: phases[0].id } })

    // rawValue 7 crosses threshold 5 only → earnedPoints = 1, not complete
    await trpcCaller.challengeRuns.updateProgress({ challengeRunTrackerId: trackers[0].id, value: 7 })
    const partial = await db.trackerProgress.findUnique({ where: { challengeRunTrackerId: trackers[0].id } })
    expect(partial?.value).toBe(1)
    expect(partial?.completedAt).toBeNull()

    // rawValue 15 crosses all 3 thresholds → earnedPoints = 3, complete
    await trpcCaller.challengeRuns.updateProgress({ challengeRunTrackerId: trackers[0].id, value: 15 })
    const done = await db.trackerProgress.findUnique({ where: { challengeRunTrackerId: trackers[0].id } })
    expect(done?.value).toBe(3)
    expect(done?.completedAt).not.toBeNull()
  })

  test('throws BAD_REQUEST for THRESHOLD tracker with no valid goalConfig', async ({ trpcCaller, userId, legacyId }) => {
    const tt = await createTestTrackerType({ ownerId: userId, valueKind: 'THRESHOLD' })
    const challenge = await trpcCaller.challenges.create({ name: `C ${Date.now()}` })
    const phase = await trpcCaller.challenges.addPhase({ challengeId: challenge.id, generationNumber: 1 })
    // goalConfig has no thresholds or progression — invalid
    await trpcCaller.challenges.addTracker({
      challengePhaseId: phase.id,
      trackerTypeId: tt.id,
      name: 'Bad Threshold',
      config: {},
      goalConfig: { goalValue: 10 },
    })
    const run = await trpcCaller.challengeRuns.link({ legacyId, challengeId: challenge.id })
    const phases = await db.challengeRunPhase.findMany({ where: { challengeRunId: run.id } })
    const trackers = await db.challengeRunTracker.findMany({ where: { challengeRunPhaseId: phases[0].id } })

    await expect(
      trpcCaller.challengeRuns.updateProgress({ challengeRunTrackerId: trackers[0].id, value: 10 })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  test('throws BAD_REQUEST when THRESHOLD tracker receives a boolean value', async ({ trpcCaller, userId, legacyId }) => {
    const tt = await createTestTrackerType({ ownerId: userId, valueKind: 'THRESHOLD' })
    const challenge = await trpcCaller.challenges.create({ name: `C ${Date.now()}` })
    const phase = await trpcCaller.challenges.addPhase({ challengeId: challenge.id, generationNumber: 1 })
    await trpcCaller.challenges.addTracker({
      challengePhaseId: phase.id,
      trackerTypeId: tt.id,
      name: 'Boolean into Threshold',
      config: {},
      goalConfig: { thresholds: [5, 10] },
    })
    const run = await trpcCaller.challengeRuns.link({ legacyId, challengeId: challenge.id })
    const phases = await db.challengeRunPhase.findMany({ where: { challengeRunId: run.id } })
    const trackers = await db.challengeRunTracker.findMany({ where: { challengeRunPhaseId: phases[0].id } })

    await expect(
      trpcCaller.challengeRuns.updateProgress({ challengeRunTrackerId: trackers[0].id, value: true })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })
})

describe('challengeRuns.listByLegacy', () => {
  test('returns runs for the legacy', async ({ trpcCaller, userId, legacyId }) => {
    const tt = await createTestTrackerType({ ownerId: userId })
    const { challenge } = await buildChallengeWithPhaseAndTracker(userId, tt.id)
    await trpcCaller.challengeRuns.link({ legacyId, challengeId: challenge.id })
    const result = await trpcCaller.challengeRuns.listByLegacy({ legacyId })
    expect(result.length).toBeGreaterThan(0)
  })

  test('throws NOT_FOUND for another user legacy', async ({ legacyId }) => {
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

// ---------------------------------------------------------------------------
// Full flow: template → link → sim mutation → recompute
// ---------------------------------------------------------------------------

describe('full flow — link creates correct initial state for auto-computed tracker', () => {
  test('initializes TrackerProgress.value to 0 and isManual to false for a NUMERICAL auto-computed tracker', async ({ trpcCaller, userId, legacyId }) => {
    // Build a tracker type whose computationSpec counts sims in the phase generation.
    // A fresh legacy has no sims, so the initial count is 0.
    const autoTt = await db.trackerType.create({
      data: {
        name: `Auto NUMERICAL ${Date.now()}`,
        valueKind: 'NUMERICAL',
        configSchema: {},
        isBuiltIn: false,
        isPublic: false,
        ownerId: userId,
        computationSpec: {
          simFilter: { generationNumber: '$phase.generationNumber' },
          conditions: [{ source: 'skills', dataFilter: {} }],
          aggregation: { op: 'count' },
          valueKind: 'NUMERICAL',
        },
      },
    })

    const challenge = await trpcCaller.challenges.create({ name: `C ${Date.now()}` })
    const phase = await trpcCaller.challenges.addPhase({
      challengeId: challenge.id,
      generationNumber: 1,
      title: 'Gen 1',
    })
    await trpcCaller.challenges.addTracker({
      challengePhaseId: phase.id,
      trackerTypeId: autoTt.id,
      name: 'Sim Skill Count',
      config: {},
    })

    const run = await trpcCaller.challengeRuns.link({ legacyId, challengeId: challenge.id })

    const phases = await db.challengeRunPhase.findMany({ where: { challengeRunId: run.id } })
    const trackers = await db.challengeRunTracker.findMany({ where: { challengeRunPhaseId: phases[0].id } })
    const progress = await db.trackerProgress.findUnique({ where: { challengeRunTrackerId: trackers[0].id } })

    expect(progress).not.toBeNull()
    expect(progress?.value).toBe(0)
    expect(progress?.isManual).toBe(false)
  })
})

describe('full flow — recompute updates tracker progress after sim mutation', () => {
  test('updates TrackerProgress.value and stamps completedAt when the BOOLEAN condition becomes true', async ({ trpcCaller, legacyId }) => {
    // Use the seeded "Skill Maxed" built-in tracker type — its computationSpec uses
    // aggregation: { op: 'any' } over skills with maxed: true, returning a boolean.
    const skillMaxedType = await getTrackerTypeByName('Skill Maxed')

    // Pick any skill with maxLevel 10 so we can fully max it
    const skill = await getAnySkill({ maxLevel: 10 })

    const challenge = await trpcCaller.challenges.create({ name: `C ${Date.now()}` })
    const phase = await trpcCaller.challenges.addPhase({
      challengeId: challenge.id,
      generationNumber: 1,
      title: 'Gen 1',
    })
    await trpcCaller.challenges.addTracker({
      challengePhaseId: phase.id,
      trackerTypeId: skillMaxedType.id,
      name: 'Max a skill',
      config: { skillId: skill.id },
    })

    const run = await trpcCaller.challengeRuns.link({ legacyId, challengeId: challenge.id })

    // Before mutation: progress should be false, not complete
    const phases = await db.challengeRunPhase.findMany({ where: { challengeRunId: run.id } })
    const trackers = await db.challengeRunTracker.findMany({ where: { challengeRunPhaseId: phases[0].id } })
    const progressBefore = await db.trackerProgress.findUnique({ where: { challengeRunTrackerId: trackers[0].id } })
    expect(progressBefore?.value).toBe(false)
    expect(progressBefore?.completedAt).toBeNull()

    // Create a gen-1 sim and max the skill
    const sim = await createTestSim(legacyId)
    await db.sim.update({ where: { id: sim.id }, data: { generationNumber: 1 } })
    await db.simSkill.create({ data: { simId: sim.id, skillId: skill.id, level: skill.maxLevel } })

    // Recompute
    await recomputeLegacyTrackers(db, legacyId)

    const progressAfter = await db.trackerProgress.findUnique({ where: { challengeRunTrackerId: trackers[0].id } })
    expect(progressAfter?.value).toBe(true)
    expect(progressAfter?.completedAt).not.toBeNull()
  })
})

describe('full flow — THRESHOLD tracker earns points per threshold crossed via recompute', () => {
  test('increments earnedPoints as more sims acquire the skill, completing when all thresholds are crossed', async ({ trpcCaller, userId, legacyId }) => {
    // Design: a THRESHOLD tracker type whose computationSpec counts sims in gen 1
    // that have a specific skill at any level (minLevel: 1).
    // goalConfig thresholds [1, 2, 3] means: 1 sim earned, 2 sims earned, 3 sims earned.
    // As we add sims with that skill, recompute advances the stored value.
    const skill = await getAnySkill({ maxLevel: 10 })

    const thresholdTt = await db.trackerType.create({
      data: {
        name: `Threshold Skill Count ${Date.now()}`,
        valueKind: 'THRESHOLD',
        configSchema: {},
        isBuiltIn: false,
        isPublic: false,
        ownerId: userId,
        computationSpec: {
          simFilter: { generationNumber: '$phase.generationNumber' },
          conditions: [{ source: 'skills', dataFilter: { skillId: skill.id, minLevel: 1 } }],
          aggregation: { op: 'count' },
          valueKind: 'THRESHOLD',
        },
      },
    })

    const challenge = await trpcCaller.challenges.create({ name: `C ${Date.now()}` })
    const phase = await trpcCaller.challenges.addPhase({
      challengeId: challenge.id,
      generationNumber: 1,
      title: 'Gen 1',
    })
    // thresholds [1, 2, 3] — each sim that acquires the skill crosses one threshold
    await trpcCaller.challenges.addTracker({
      challengePhaseId: phase.id,
      trackerTypeId: thresholdTt.id,
      name: 'Skill Holders',
      config: {},
      goalConfig: { thresholds: [1, 2, 3] },
    })

    const run = await trpcCaller.challengeRuns.link({ legacyId, challengeId: challenge.id })
    const phases = await db.challengeRunPhase.findMany({ where: { challengeRunId: run.id } })
    const trackers = await db.challengeRunTracker.findMany({ where: { challengeRunPhaseId: phases[0].id } })

    // Initial state: 0 sims have skill → rawValue = 0 → 0 thresholds crossed
    const progressInit = await db.trackerProgress.findUnique({ where: { challengeRunTrackerId: trackers[0].id } })
    expect(progressInit?.value).toBe(0)
    expect(progressInit?.completedAt).toBeNull()

    // Add sim 1 with the skill → rawValue = 1 → crosses threshold 1 → earnedPoints = 1
    const sim1 = await createTestSim(legacyId)
    await db.sim.update({ where: { id: sim1.id }, data: { generationNumber: 1 } })
    await db.simSkill.create({ data: { simId: sim1.id, skillId: skill.id, level: 7 } })
    await recomputeLegacyTrackers(db, legacyId)

    const progress1 = await db.trackerProgress.findUnique({ where: { challengeRunTrackerId: trackers[0].id } })
    expect(progress1?.value).toBe(1)
    expect(progress1?.completedAt).toBeNull()

    // Add sim 2 with the skill → rawValue = 2 → crosses threshold 2 → earnedPoints = 2
    const sim2 = await createTestSim(legacyId)
    await db.sim.update({ where: { id: sim2.id }, data: { generationNumber: 1 } })
    await db.simSkill.create({ data: { simId: sim2.id, skillId: skill.id, level: 12 } })
    await recomputeLegacyTrackers(db, legacyId)

    const progress2 = await db.trackerProgress.findUnique({ where: { challengeRunTrackerId: trackers[0].id } })
    expect(progress2?.value).toBe(2)
    expect(progress2?.completedAt).toBeNull()

    // Add sim 3 with the skill → rawValue = 3 → crosses all 3 thresholds → earnedPoints = 3, complete
    const sim3 = await createTestSim(legacyId)
    await db.sim.update({ where: { id: sim3.id }, data: { generationNumber: 1 } })
    await db.simSkill.create({ data: { simId: sim3.id, skillId: skill.id, level: 15 } })
    await recomputeLegacyTrackers(db, legacyId)

    const progress3 = await db.trackerProgress.findUnique({ where: { challengeRunTrackerId: trackers[0].id } })
    expect(progress3?.value).toBe(3)
    expect(progress3?.completedAt).not.toBeNull()
  })
})

describe('challengeRuns.link — isManual and initial value correctness', () => {
  test('assigns correct isManual when two trackers share (trackerTypeId, name)', async ({ trpcCaller, userId, legacyId }) => {
    // One tracker type with computationSpec (auto-computed) and one without (manual).
    // Both trackers share the same name so the old find-by-name logic would misassign one.
    const autoTt = await db.trackerType.create({
      data: {
        name: `Auto TT ${Date.now()}`,
        valueKind: 'NUMERICAL',
        configSchema: {},
        isBuiltIn: false,
        isPublic: false,
        ownerId: userId,
        computationSpec: { source: 'simoleons' },
      },
    })
    const manualTt = await db.trackerType.create({
      data: {
        name: `Manual TT ${Date.now()}`,
        valueKind: 'NUMERICAL',
        configSchema: {},
        isBuiltIn: false,
        isPublic: false,
        ownerId: userId,
      },
    })

    const challenge = await trpcCaller.challenges.create({ name: `C ${Date.now()}` })
    const phase = await trpcCaller.challenges.addPhase({ challengeId: challenge.id, generationNumber: 1, title: 'Gen 1' })

    // Add two trackers with the same name but different trackerTypeIds
    await trpcCaller.challenges.addTracker({
      challengePhaseId: phase.id,
      trackerTypeId: autoTt.id,
      name: 'Shared Name',
      config: {},
    })
    await trpcCaller.challenges.addTracker({
      challengePhaseId: phase.id,
      trackerTypeId: manualTt.id,
      name: 'Shared Name',
      config: {},
    })

    const run = await trpcCaller.challengeRuns.link({ legacyId, challengeId: challenge.id })
    const phases = await db.challengeRunPhase.findMany({ where: { challengeRunId: run.id } })
    const trackers = await db.challengeRunTracker.findMany({ where: { challengeRunPhaseId: phases[0].id } })
    expect(trackers).toHaveLength(2)

    const progressRecords = await db.trackerProgress.findMany({
      where: { challengeRunTrackerId: { in: trackers.map((t) => t.id) } },
      include: { tracker: true },
    })
    expect(progressRecords).toHaveLength(2)

    // The tracker that came from autoTt should have isManual = false
    const autoProgress = progressRecords.find((p) => p.tracker.trackerTypeId === autoTt.id)
    const manualProgress = progressRecords.find((p) => p.tracker.trackerTypeId === manualTt.id)
    expect(autoProgress?.isManual).toBe(false)
    expect(manualProgress?.isManual).toBe(true)
  })

  test('initializes TrackerProgress.value to 0 for NUMERICAL trackers', async ({ trpcCaller, userId, legacyId }) => {
    const tt = await createTestTrackerType({ ownerId: userId, valueKind: 'NUMERICAL' })
    const { challenge } = await buildChallengeWithPhaseAndTracker(userId, tt.id)
    const run = await trpcCaller.challengeRuns.link({ legacyId, challengeId: challenge.id })
    const phases = await db.challengeRunPhase.findMany({ where: { challengeRunId: run.id } })
    const trackers = await db.challengeRunTracker.findMany({ where: { challengeRunPhaseId: phases[0].id } })
    const progress = await db.trackerProgress.findUnique({ where: { challengeRunTrackerId: trackers[0].id } })
    expect(progress?.value).toBe(0)
  })

  test('initializes TrackerProgress.value to false for BOOLEAN trackers', async ({ trpcCaller, userId, legacyId }) => {
    const tt = await createTestTrackerType({ ownerId: userId, valueKind: 'BOOLEAN' })
    const { challenge } = await buildChallengeWithPhaseAndTracker(userId, tt.id)
    const run = await trpcCaller.challengeRuns.link({ legacyId, challengeId: challenge.id })
    const phases = await db.challengeRunPhase.findMany({ where: { challengeRunId: run.id } })
    const trackers = await db.challengeRunTracker.findMany({ where: { challengeRunPhaseId: phases[0].id } })
    const progress = await db.trackerProgress.findUnique({ where: { challengeRunTrackerId: trackers[0].id } })
    expect(progress?.value).toBe(false)
  })
})
