import { describe, it, expect, beforeEach } from 'vitest'
import { authedCaller } from '@/test/caller'
import { createTestUser, cleanupUser, createTestTrackerType, createTestSim, getAnySkill, getTrackerTypeByName, getAnyBuiltInTrackerType } from '@/test/helpers'
import { withTestLegacy } from '@/test/fixtures'
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

describe('challengeRuns.link', () => {
  const ctx = withTestLegacy()
  let trackerTypeId: string

  beforeEach(async () => {
    const tt = await createTestTrackerType({ ownerId: ctx.userId })
    trackerTypeId = tt.id
  })

  it('creates a ChallengeRun with copied phases and trackers', async () => {
    const { challenge } = await buildChallengeWithPhaseAndTracker(ctx.userId, trackerTypeId)
    const run = await ctx.caller.challengeRuns.link({ legacyId: ctx.legacyId, challengeId: challenge.id })

    expect(run.legacyId).toBe(ctx.legacyId)
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
    const { challenge } = await buildChallengeWithPhaseAndTracker(ctx.userId, trackerTypeId)
    const run = await ctx.caller.challengeRuns.link({ legacyId: ctx.legacyId, challengeId: challenge.id })
    const phases = await db.challengeRunPhase.findMany({ where: { challengeRunId: run.id } })
    const trackers = await db.challengeRunTracker.findMany({ where: { challengeRunPhaseId: phases[0].id } })
    const progress = await db.trackerProgress.findUnique({ where: { challengeRunTrackerId: trackers[0].id } })
    expect(progress?.isManual).toBe(true)
  })

  it('throws NOT_FOUND when the legacy does not belong to caller', async () => {
    const other = await createTestUser()
    const challenge = await ctx.caller.challenges.create({ name: `C ${Date.now()}` })
    try {
      await expect(
        authedCaller(other.id).challengeRuns.link({ legacyId: ctx.legacyId, challengeId: challenge.id })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    } finally {
      await cleanupUser(other.id)
    }
  })
})

describe('challengeRuns.getById', () => {
  const ctx = withTestLegacy()

  it('returns run with nested phases, trackers, and progress', async () => {
    const tt = await createTestTrackerType({ ownerId: ctx.userId })
    const { challenge } = await buildChallengeWithPhaseAndTracker(ctx.userId, tt.id)
    const run = await ctx.caller.challengeRuns.link({ legacyId: ctx.legacyId, challengeId: challenge.id })
    const result = await ctx.caller.challengeRuns.getById({ id: run.id })
    expect(result.phases).toHaveLength(1)
    expect(result.phases[0].trackers).toHaveLength(1)
    expect(result.phases[0].trackers[0].progress).toMatchObject({ value: false, completedAt: null, isManual: true })
  })
})

describe('challengeRuns.getById — completion derivation', () => {
  const ctx = withTestLegacy()

  it('sets isComplete true on phase and run when all trackers have completedAt', async () => {
    const tt = await createTestTrackerType({ ownerId: ctx.userId, valueKind: 'BOOLEAN' })
    const { challenge } = await buildChallengeWithPhaseAndTracker(ctx.userId, tt.id)
    const run = await ctx.caller.challengeRuns.link({ legacyId: ctx.legacyId, challengeId: challenge.id })

    const phases = await db.challengeRunPhase.findMany({ where: { challengeRunId: run.id } })
    const trackers = await db.challengeRunTracker.findMany({ where: { challengeRunPhaseId: phases[0].id } })
    // Mark tracker complete by updating its progress directly
    await db.trackerProgress.update({
      where: { challengeRunTrackerId: trackers[0].id },
      data: { completedAt: new Date() },
    })

    const result = await ctx.caller.challengeRuns.getById({ id: run.id })
    expect(result.phases[0].isComplete).toBe(true)
    expect(result.isComplete).toBe(true)
  })

  it('sets isComplete false on phase and run when any tracker lacks completedAt', async () => {
    const tt = await createTestTrackerType({ ownerId: ctx.userId, valueKind: 'BOOLEAN' })
    const { challenge } = await buildChallengeWithPhaseAndTracker(ctx.userId, tt.id)
    // Also add a second tracker so one stays incomplete
    const phases = await db.challengePhase.findMany({ where: { challengeId: challenge.id } })
    const tt2 = await createTestTrackerType({ ownerId: ctx.userId, valueKind: 'BOOLEAN' })
    await ctx.caller.challenges.addTracker({
      challengePhaseId: phases[0].id,
      trackerTypeId: tt2.id,
      name: 'Second Tracker',
      config: {},
    })
    const run = await ctx.caller.challengeRuns.link({ legacyId: ctx.legacyId, challengeId: challenge.id })

    // Complete only the first of the two trackers in the run
    const runPhases = await db.challengeRunPhase.findMany({ where: { challengeRunId: run.id } })
    const runTrackers = await db.challengeRunTracker.findMany({ where: { challengeRunPhaseId: runPhases[0].id } })
    await db.trackerProgress.update({
      where: { challengeRunTrackerId: runTrackers[0].id },
      data: { completedAt: new Date() },
    })
    // Leave runTrackers[1].completedAt as null

    const result = await ctx.caller.challengeRuns.getById({ id: run.id })
    expect(result.phases[0].isComplete).toBe(false)
    expect(result.isComplete).toBe(false)
  })

  it('sets isComplete false for a phase with no trackers', async () => {
    // Create a challenge with a phase that has no trackers
    const challenge = await ctx.caller.challenges.create({ name: `Empty Phase ${Date.now()}` })
    await ctx.caller.challenges.addPhase({ challengeId: challenge.id, generationNumber: 1, title: 'Empty Gen' })
    const run = await ctx.caller.challengeRuns.link({ legacyId: ctx.legacyId, challengeId: challenge.id })

    const result = await ctx.caller.challengeRuns.getById({ id: run.id })
    expect(result.phases[0].isComplete).toBe(false)
    expect(result.isComplete).toBe(false)
  })
})

describe('challengeRuns.updateProgress', () => {
  const ctx = withTestLegacy()

  it('updates value on a manual tracker and stamps completedAt for BOOLEAN true', async () => {
    const tt = await createTestTrackerType({ ownerId: ctx.userId, valueKind: 'BOOLEAN' })
    const { challenge } = await buildChallengeWithPhaseAndTracker(ctx.userId, tt.id)
    const run = await ctx.caller.challengeRuns.link({ legacyId: ctx.legacyId, challengeId: challenge.id })
    const phases = await db.challengeRunPhase.findMany({ where: { challengeRunId: run.id } })
    const trackers = await db.challengeRunTracker.findMany({ where: { challengeRunPhaseId: phases[0].id } })

    await ctx.caller.challengeRuns.updateProgress({
      challengeRunTrackerId: trackers[0].id,
      value: true,
    })
    const progress = await db.trackerProgress.findUnique({ where: { challengeRunTrackerId: trackers[0].id } })
    expect(progress?.value).toBe(true)
    expect(progress?.completedAt).not.toBeNull()
  })
})

describe('challengeRuns.link — transactional rollback', () => {
  const ctx = withTestLegacy()

  it('leaves no partial ChallengeRun when the challenge does not exist', async () => {
    const runsBefore = await db.challengeRun.findMany({ where: { legacyId: ctx.legacyId } })
    await expect(
      ctx.caller.challengeRuns.link({ legacyId: ctx.legacyId, challengeId: 'nonexistent-id' })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    const runsAfter = await db.challengeRun.findMany({ where: { legacyId: ctx.legacyId } })
    expect(runsAfter).toHaveLength(runsBefore.length)
  })
})

describe('challengeRuns.updateProgress — additional scenarios', () => {
  const ctx = withTestLegacy()

  it('throws BAD_REQUEST for a non-manual tracker', async () => {
    const builtIn = await getAnyBuiltInTrackerType({ requireComputationSpec: true })
    const { challenge } = await buildChallengeWithPhaseAndTracker(ctx.userId, builtIn.id)
    const run = await ctx.caller.challengeRuns.link({ legacyId: ctx.legacyId, challengeId: challenge.id })
    const phases = await db.challengeRunPhase.findMany({ where: { challengeRunId: run.id } })
    const trackers = await db.challengeRunTracker.findMany({ where: { challengeRunPhaseId: phases[0].id } })
    await expect(
      ctx.caller.challengeRuns.updateProgress({ challengeRunTrackerId: trackers[0].id, value: true })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('does not overwrite completedAt once set', async () => {
    const tt = await createTestTrackerType({ ownerId: ctx.userId, valueKind: 'BOOLEAN' })
    const { challenge } = await buildChallengeWithPhaseAndTracker(ctx.userId, tt.id)
    const run = await ctx.caller.challengeRuns.link({ legacyId: ctx.legacyId, challengeId: challenge.id })
    const phases = await db.challengeRunPhase.findMany({ where: { challengeRunId: run.id } })
    const trackers = await db.challengeRunTracker.findMany({ where: { challengeRunPhaseId: phases[0].id } })

    await ctx.caller.challengeRuns.updateProgress({ challengeRunTrackerId: trackers[0].id, value: true })
    const first = await db.trackerProgress.findUnique({ where: { challengeRunTrackerId: trackers[0].id } })

    await ctx.caller.challengeRuns.updateProgress({ challengeRunTrackerId: trackers[0].id, value: true })
    const second = await db.trackerProgress.findUnique({ where: { challengeRunTrackerId: trackers[0].id } })
    expect(second?.completedAt).toEqual(first?.completedAt)
  })

  it('throws FORBIDDEN when updating progress for another user legacy', async () => {
    const other = await createTestUser()
    const tt = await createTestTrackerType({ ownerId: ctx.userId, valueKind: 'BOOLEAN' })
    const { challenge } = await buildChallengeWithPhaseAndTracker(ctx.userId, tt.id)
    const run = await ctx.caller.challengeRuns.link({ legacyId: ctx.legacyId, challengeId: challenge.id })
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
    const tt = await createTestTrackerType({ ownerId: ctx.userId, valueKind: 'NUMERICAL' })
    // Create a challenge with a tracker that has a goalConfig
    const challenge = await ctx.caller.challenges.create({ name: `C ${Date.now()}` })
    const phase = await ctx.caller.challenges.addPhase({ challengeId: challenge.id, generationNumber: 1 })
    await ctx.caller.challenges.addTracker({
      challengePhaseId: phase.id,
      trackerTypeId: tt.id,
      name: 'Count',
      config: {},
      goalConfig: { goalValue: 5 },
    })
    const run = await ctx.caller.challengeRuns.link({ legacyId: ctx.legacyId, challengeId: challenge.id })
    const phases = await db.challengeRunPhase.findMany({ where: { challengeRunId: run.id } })
    const trackers = await db.challengeRunTracker.findMany({ where: { challengeRunPhaseId: phases[0].id } })

    await ctx.caller.challengeRuns.updateProgress({ challengeRunTrackerId: trackers[0].id, value: 3 })
    const progress = await db.trackerProgress.findUnique({ where: { challengeRunTrackerId: trackers[0].id } })
    expect(progress?.completedAt).toBeNull()

    await ctx.caller.challengeRuns.updateProgress({ challengeRunTrackerId: trackers[0].id, value: 5 })
    const done = await db.trackerProgress.findUnique({ where: { challengeRunTrackerId: trackers[0].id } })
    expect(done?.completedAt).not.toBeNull()
  })

  it('stores earnedPoints for THRESHOLD tracker and completes when all thresholds crossed', async () => {
    const tt = await createTestTrackerType({ ownerId: ctx.userId, valueKind: 'THRESHOLD' })
    const challenge = await ctx.caller.challenges.create({ name: `C ${Date.now()}` })
    const phase = await ctx.caller.challenges.addPhase({ challengeId: challenge.id, generationNumber: 1 })
    // thresholds: [5, 10, 15] — 3 milestones
    await ctx.caller.challenges.addTracker({
      challengePhaseId: phase.id,
      trackerTypeId: tt.id,
      name: 'Threshold Tracker',
      config: {},
      goalConfig: { thresholds: [5, 10, 15] },
    })
    const run = await ctx.caller.challengeRuns.link({ legacyId: ctx.legacyId, challengeId: challenge.id })
    const phases = await db.challengeRunPhase.findMany({ where: { challengeRunId: run.id } })
    const trackers = await db.challengeRunTracker.findMany({ where: { challengeRunPhaseId: phases[0].id } })

    // rawValue 7 crosses threshold 5 only → earnedPoints = 1, not complete
    await ctx.caller.challengeRuns.updateProgress({ challengeRunTrackerId: trackers[0].id, value: 7 })
    const partial = await db.trackerProgress.findUnique({ where: { challengeRunTrackerId: trackers[0].id } })
    expect(partial?.value).toBe(1)
    expect(partial?.completedAt).toBeNull()

    // rawValue 15 crosses all 3 thresholds → earnedPoints = 3, complete
    await ctx.caller.challengeRuns.updateProgress({ challengeRunTrackerId: trackers[0].id, value: 15 })
    const done = await db.trackerProgress.findUnique({ where: { challengeRunTrackerId: trackers[0].id } })
    expect(done?.value).toBe(3)
    expect(done?.completedAt).not.toBeNull()
  })

  it('throws BAD_REQUEST for THRESHOLD tracker with no valid goalConfig', async () => {
    const tt = await createTestTrackerType({ ownerId: ctx.userId, valueKind: 'THRESHOLD' })
    const challenge = await ctx.caller.challenges.create({ name: `C ${Date.now()}` })
    const phase = await ctx.caller.challenges.addPhase({ challengeId: challenge.id, generationNumber: 1 })
    // goalConfig has no thresholds or progression — invalid
    await ctx.caller.challenges.addTracker({
      challengePhaseId: phase.id,
      trackerTypeId: tt.id,
      name: 'Bad Threshold',
      config: {},
      goalConfig: { goalValue: 10 },
    })
    const run = await ctx.caller.challengeRuns.link({ legacyId: ctx.legacyId, challengeId: challenge.id })
    const phases = await db.challengeRunPhase.findMany({ where: { challengeRunId: run.id } })
    const trackers = await db.challengeRunTracker.findMany({ where: { challengeRunPhaseId: phases[0].id } })

    await expect(
      ctx.caller.challengeRuns.updateProgress({ challengeRunTrackerId: trackers[0].id, value: 10 })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('throws BAD_REQUEST when THRESHOLD tracker receives a boolean value', async () => {
    const tt = await createTestTrackerType({ ownerId: ctx.userId, valueKind: 'THRESHOLD' })
    const challenge = await ctx.caller.challenges.create({ name: `C ${Date.now()}` })
    const phase = await ctx.caller.challenges.addPhase({ challengeId: challenge.id, generationNumber: 1 })
    await ctx.caller.challenges.addTracker({
      challengePhaseId: phase.id,
      trackerTypeId: tt.id,
      name: 'Boolean into Threshold',
      config: {},
      goalConfig: { thresholds: [5, 10] },
    })
    const run = await ctx.caller.challengeRuns.link({ legacyId: ctx.legacyId, challengeId: challenge.id })
    const phases = await db.challengeRunPhase.findMany({ where: { challengeRunId: run.id } })
    const trackers = await db.challengeRunTracker.findMany({ where: { challengeRunPhaseId: phases[0].id } })

    await expect(
      ctx.caller.challengeRuns.updateProgress({ challengeRunTrackerId: trackers[0].id, value: true })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })
})

describe('challengeRuns.listByLegacy', () => {
  const ctx = withTestLegacy()

  it('returns runs for the legacy', async () => {
    const tt = await createTestTrackerType({ ownerId: ctx.userId })
    const { challenge } = await buildChallengeWithPhaseAndTracker(ctx.userId, tt.id)
    await ctx.caller.challengeRuns.link({ legacyId: ctx.legacyId, challengeId: challenge.id })
    const result = await ctx.caller.challengeRuns.listByLegacy({ legacyId: ctx.legacyId })
    expect(result.length).toBeGreaterThan(0)
  })

  it('throws NOT_FOUND for another user legacy', async () => {
    const other = await createTestUser()
    try {
      await expect(
        authedCaller(other.id).challengeRuns.listByLegacy({ legacyId: ctx.legacyId })
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
  const ctx = withTestLegacy()

  it('initializes TrackerProgress.value to 0 and isManual to false for a NUMERICAL auto-computed tracker', async () => {
    // Build a tracker type whose computationSpec counts sims in the phase generation.
    // A fresh legacy has no sims, so the initial count is 0.
    const autoTt = await db.trackerType.create({
      data: {
        name: `Auto NUMERICAL ${Date.now()}`,
        valueKind: 'NUMERICAL',
        configSchema: {},
        isBuiltIn: false,
        isPublic: false,
        ownerId: ctx.userId,
        computationSpec: {
          simFilter: { generationNumber: '$phase.generationNumber' },
          conditions: [{ source: 'skills', dataFilter: {} }],
          aggregation: { op: 'count' },
          valueKind: 'NUMERICAL',
        },
      },
    })

    const challenge = await ctx.caller.challenges.create({ name: `C ${Date.now()}` })
    const phase = await ctx.caller.challenges.addPhase({
      challengeId: challenge.id,
      generationNumber: 1,
      title: 'Gen 1',
    })
    await ctx.caller.challenges.addTracker({
      challengePhaseId: phase.id,
      trackerTypeId: autoTt.id,
      name: 'Sim Skill Count',
      config: {},
    })

    const run = await ctx.caller.challengeRuns.link({ legacyId: ctx.legacyId, challengeId: challenge.id })

    const phases = await db.challengeRunPhase.findMany({ where: { challengeRunId: run.id } })
    const trackers = await db.challengeRunTracker.findMany({ where: { challengeRunPhaseId: phases[0].id } })
    const progress = await db.trackerProgress.findUnique({ where: { challengeRunTrackerId: trackers[0].id } })

    expect(progress).not.toBeNull()
    expect(progress?.value).toBe(0)
    expect(progress?.isManual).toBe(false)
  })
})

describe('full flow — recompute updates tracker progress after sim mutation', () => {
  const ctx = withTestLegacy()

  it('updates TrackerProgress.value and stamps completedAt when the BOOLEAN condition becomes true', async () => {
    // Use the seeded "Skill Maxed" built-in tracker type — its computationSpec uses
    // aggregation: { op: 'any' } over skills with maxed: true, returning a boolean.
    const skillMaxedType = await getTrackerTypeByName('Skill Maxed')

    // Pick any skill with maxLevel 10 so we can fully max it
    const skill = await getAnySkill({ maxLevel: 10 })

    const challenge = await ctx.caller.challenges.create({ name: `C ${Date.now()}` })
    const phase = await ctx.caller.challenges.addPhase({
      challengeId: challenge.id,
      generationNumber: 1,
      title: 'Gen 1',
    })
    await ctx.caller.challenges.addTracker({
      challengePhaseId: phase.id,
      trackerTypeId: skillMaxedType.id,
      name: 'Max a skill',
      config: { skillId: skill.id },
    })

    const run = await ctx.caller.challengeRuns.link({ legacyId: ctx.legacyId, challengeId: challenge.id })

    // Before mutation: progress should be false, not complete
    const phases = await db.challengeRunPhase.findMany({ where: { challengeRunId: run.id } })
    const trackers = await db.challengeRunTracker.findMany({ where: { challengeRunPhaseId: phases[0].id } })
    const progressBefore = await db.trackerProgress.findUnique({ where: { challengeRunTrackerId: trackers[0].id } })
    expect(progressBefore?.value).toBe(false)
    expect(progressBefore?.completedAt).toBeNull()

    // Create a gen-1 sim and max the skill
    const sim = await createTestSim(ctx.legacyId)
    await db.sim.update({ where: { id: sim.id }, data: { generationNumber: 1 } })
    await db.simSkill.create({ data: { simId: sim.id, skillId: skill.id, level: skill.maxLevel } })

    // Recompute
    await recomputeLegacyTrackers(db, ctx.legacyId)

    const progressAfter = await db.trackerProgress.findUnique({ where: { challengeRunTrackerId: trackers[0].id } })
    expect(progressAfter?.value).toBe(true)
    expect(progressAfter?.completedAt).not.toBeNull()
  })
})

describe('full flow — THRESHOLD tracker earns points per threshold crossed via recompute', () => {
  const ctx = withTestLegacy()

  it('increments earnedPoints as more sims acquire the skill, completing when all thresholds are crossed', async () => {
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
        ownerId: ctx.userId,
        computationSpec: {
          simFilter: { generationNumber: '$phase.generationNumber' },
          conditions: [{ source: 'skills', dataFilter: { skillId: skill.id, minLevel: 1 } }],
          aggregation: { op: 'count' },
          valueKind: 'THRESHOLD',
        },
      },
    })

    const challenge = await ctx.caller.challenges.create({ name: `C ${Date.now()}` })
    const phase = await ctx.caller.challenges.addPhase({
      challengeId: challenge.id,
      generationNumber: 1,
      title: 'Gen 1',
    })
    // thresholds [1, 2, 3] — each sim that acquires the skill crosses one threshold
    await ctx.caller.challenges.addTracker({
      challengePhaseId: phase.id,
      trackerTypeId: thresholdTt.id,
      name: 'Skill Holders',
      config: {},
      goalConfig: { thresholds: [1, 2, 3] },
    })

    const run = await ctx.caller.challengeRuns.link({ legacyId: ctx.legacyId, challengeId: challenge.id })
    const phases = await db.challengeRunPhase.findMany({ where: { challengeRunId: run.id } })
    const trackers = await db.challengeRunTracker.findMany({ where: { challengeRunPhaseId: phases[0].id } })

    // Initial state: 0 sims have skill → rawValue = 0 → 0 thresholds crossed
    const progressInit = await db.trackerProgress.findUnique({ where: { challengeRunTrackerId: trackers[0].id } })
    expect(progressInit?.value).toBe(0)
    expect(progressInit?.completedAt).toBeNull()

    // Add sim 1 with the skill → rawValue = 1 → crosses threshold 1 → earnedPoints = 1
    const sim1 = await createTestSim(ctx.legacyId)
    await db.sim.update({ where: { id: sim1.id }, data: { generationNumber: 1 } })
    await db.simSkill.create({ data: { simId: sim1.id, skillId: skill.id, level: 7 } })
    await recomputeLegacyTrackers(db, ctx.legacyId)

    const progress1 = await db.trackerProgress.findUnique({ where: { challengeRunTrackerId: trackers[0].id } })
    expect(progress1?.value).toBe(1)
    expect(progress1?.completedAt).toBeNull()

    // Add sim 2 with the skill → rawValue = 2 → crosses threshold 2 → earnedPoints = 2
    const sim2 = await createTestSim(ctx.legacyId)
    await db.sim.update({ where: { id: sim2.id }, data: { generationNumber: 1 } })
    await db.simSkill.create({ data: { simId: sim2.id, skillId: skill.id, level: 12 } })
    await recomputeLegacyTrackers(db, ctx.legacyId)

    const progress2 = await db.trackerProgress.findUnique({ where: { challengeRunTrackerId: trackers[0].id } })
    expect(progress2?.value).toBe(2)
    expect(progress2?.completedAt).toBeNull()

    // Add sim 3 with the skill → rawValue = 3 → crosses all 3 thresholds → earnedPoints = 3, complete
    const sim3 = await createTestSim(ctx.legacyId)
    await db.sim.update({ where: { id: sim3.id }, data: { generationNumber: 1 } })
    await db.simSkill.create({ data: { simId: sim3.id, skillId: skill.id, level: 15 } })
    await recomputeLegacyTrackers(db, ctx.legacyId)

    const progress3 = await db.trackerProgress.findUnique({ where: { challengeRunTrackerId: trackers[0].id } })
    expect(progress3?.value).toBe(3)
    expect(progress3?.completedAt).not.toBeNull()
  })
})

describe('challengeRuns.link — isManual and initial value correctness', () => {
  const ctx = withTestLegacy()

  it('assigns correct isManual when two trackers share (trackerTypeId, name)', async () => {
    // One tracker type with computationSpec (auto-computed) and one without (manual).
    // Both trackers share the same name so the old find-by-name logic would misassign one.
    const autoTt = await db.trackerType.create({
      data: {
        name: `Auto TT ${Date.now()}`,
        valueKind: 'NUMERICAL',
        configSchema: {},
        isBuiltIn: false,
        isPublic: false,
        ownerId: ctx.userId,
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
        ownerId: ctx.userId,
      },
    })

    const challenge = await ctx.caller.challenges.create({ name: `C ${Date.now()}` })
    const phase = await ctx.caller.challenges.addPhase({ challengeId: challenge.id, generationNumber: 1, title: 'Gen 1' })

    // Add two trackers with the same name but different trackerTypeIds
    await ctx.caller.challenges.addTracker({
      challengePhaseId: phase.id,
      trackerTypeId: autoTt.id,
      name: 'Shared Name',
      config: {},
    })
    await ctx.caller.challenges.addTracker({
      challengePhaseId: phase.id,
      trackerTypeId: manualTt.id,
      name: 'Shared Name',
      config: {},
    })

    const run = await ctx.caller.challengeRuns.link({ legacyId: ctx.legacyId, challengeId: challenge.id })
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

  it('initializes TrackerProgress.value to 0 for NUMERICAL trackers', async () => {
    const tt = await createTestTrackerType({ ownerId: ctx.userId, valueKind: 'NUMERICAL' })
    const { challenge } = await buildChallengeWithPhaseAndTracker(ctx.userId, tt.id)
    const run = await ctx.caller.challengeRuns.link({ legacyId: ctx.legacyId, challengeId: challenge.id })
    const phases = await db.challengeRunPhase.findMany({ where: { challengeRunId: run.id } })
    const trackers = await db.challengeRunTracker.findMany({ where: { challengeRunPhaseId: phases[0].id } })
    const progress = await db.trackerProgress.findUnique({ where: { challengeRunTrackerId: trackers[0].id } })
    expect(progress?.value).toBe(0)
  })

  it('initializes TrackerProgress.value to false for BOOLEAN trackers', async () => {
    const tt = await createTestTrackerType({ ownerId: ctx.userId, valueKind: 'BOOLEAN' })
    const { challenge } = await buildChallengeWithPhaseAndTracker(ctx.userId, tt.id)
    const run = await ctx.caller.challengeRuns.link({ legacyId: ctx.legacyId, challengeId: challenge.id })
    const phases = await db.challengeRunPhase.findMany({ where: { challengeRunId: run.id } })
    const trackers = await db.challengeRunTracker.findMany({ where: { challengeRunPhaseId: phases[0].id } })
    const progress = await db.trackerProgress.findUnique({ where: { challengeRunTrackerId: trackers[0].id } })
    expect(progress?.value).toBe(false)
  })
})
