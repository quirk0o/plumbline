import { describe, expect } from 'vitest'
import { db } from '@/server/db'
import { createTestChallenge, createTestChallengePhase, createTestChallengeRun, getAnySkill, getAnyAspiration, getTrackerTypeByName, getGameTraits, getPersonalityTraits, getSkills } from '@/test/helpers'
import { test as base } from '@/test/fixtures'
import { evaluateSpec, recomputeLegacyTrackers } from './trackerComputation'
import type { Sim } from '@prisma/client'

const test = base.extend<{ sim: Sim }>({
  sim: async ({ legacyId }, provide) => {
    const sim = await db.sim.create({
      data: { legacyId, firstName: 'Test', lastName: 'Sim', gender: 'FEMALE', lifeStage: 'YOUNG_ADULT', generationNumber: 1 },
    })
    await provide(sim)
  },
})

describe('evaluateSpec — skill maxed (single condition)', () => {
  test('returns false when sim has not maxed the skill', async ({ legacyId, sim }) => {
    const skill = await getAnySkill()
    await db.simSkill.create({ data: { simId: sim.id, skillId: skill.id, level: 1 } })
    const result = await evaluateSpec(db, legacyId, {
      simFilter: { generationNumber: 1 },
      conditions: [{ source: 'skills', dataFilter: { skillId: skill.id, maxed: true } }],
      aggregation: { op: 'any' },
      valueKind: 'BOOLEAN',
    }, {})
    expect(result).toBe(false)
  })

  test('returns true when sim has maxed the skill', async ({ legacyId, sim }) => {
    const skill = await getAnySkill()
    await db.simSkill.create({ data: { simId: sim.id, skillId: skill.id, level: skill.maxLevel } })
    const result = await evaluateSpec(db, legacyId, {
      simFilter: { generationNumber: 1 },
      conditions: [{ source: 'skills', dataFilter: { skillId: skill.id, maxed: true } }],
      aggregation: { op: 'any' },
      valueKind: 'BOOLEAN',
    }, {})
    expect(result).toBe(true)
  })
})

describe('evaluateSpec — aspiration completed (single condition)', () => {
  test('returns false when aspiration not completed', async ({ legacyId, sim }) => {
    const aspiration = await getAnyAspiration()
    await db.simAspiration.create({ data: { simId: sim.id, aspirationId: aspiration.id } })
    const result = await evaluateSpec(db, legacyId, {
      simFilter: { generationNumber: 1 },
      conditions: [{ source: 'aspirations', dataFilter: { aspirationId: aspiration.id, completed: true } }],
      aggregation: { op: 'any' },
      valueKind: 'BOOLEAN',
    }, {})
    expect(result).toBe(false)
  })

  test('returns true when aspiration is completed', async ({ legacyId, sim }) => {
    const aspiration = await getAnyAspiration()
    await db.simAspiration.create({ data: { simId: sim.id, aspirationId: aspiration.id, completedAt: new Date() } })
    const result = await evaluateSpec(db, legacyId, {
      simFilter: { generationNumber: 1 },
      conditions: [{ source: 'aspirations', dataFilter: { aspirationId: aspiration.id, completed: true } }],
      aggregation: { op: 'any' },
      valueKind: 'BOOLEAN',
    }, {})
    expect(result).toBe(true)
  })
})

describe('evaluateSpec — source: sims (causeOfDeath)', () => {
  test('returns false when no sim has died by fire', async ({ legacyId }) => {
    await db.sim.create({ data: { legacyId, firstName: 'A', lastName: 'B', gender: 'FEMALE', lifeStage: 'YOUNG_ADULT', generationNumber: 1 } })
    const result = await evaluateSpec(db, legacyId, {
      simFilter: {},
      conditions: [{ source: 'sims', dataFilter: { causeOfDeath: 'FIRE' } }],
      aggregation: { op: 'any' },
      valueKind: 'BOOLEAN',
    }, {})
    expect(result).toBe(false)
  })

  test('returns true when a sim died by fire', async ({ legacyId }) => {
    await db.sim.create({ data: { legacyId, firstName: 'A', lastName: 'B', gender: 'FEMALE', lifeStage: 'ELDER', causeOfDeath: 'FIRE', generationNumber: 1 } })
    const result = await evaluateSpec(db, legacyId, {
      simFilter: {},
      conditions: [{ source: 'sims', dataFilter: { causeOfDeath: 'FIRE' } }],
      aggregation: { op: 'any' },
      valueKind: 'BOOLEAN',
    }, {})
    expect(result).toBe(true)
  })
})

describe('evaluateSpec — countUnique personality traits', () => {
  test('counts distinct personality traits across generation sims', async ({ legacyId }) => {
    const traits = await getPersonalityTraits(2)
    const simA = await db.sim.create({ data: { legacyId, firstName: 'A', lastName: 'X', gender: 'FEMALE', lifeStage: 'YOUNG_ADULT', generationNumber: 1 } })
    const simB = await db.sim.create({ data: { legacyId, firstName: 'B', lastName: 'X', gender: 'MALE', lifeStage: 'YOUNG_ADULT', generationNumber: 1 } })
    await db.simPersonalityTrait.create({ data: { simId: simA.id, personalityTraitId: traits[0].id } })
    await db.simPersonalityTrait.create({ data: { simId: simB.id, personalityTraitId: traits[0].id } })
    await db.simPersonalityTrait.create({ data: { simId: simB.id, personalityTraitId: traits[1].id } })
    const result = await evaluateSpec(db, legacyId, {
      simFilter: { generationNumber: 1 },
      conditions: [{ source: 'personalityTraits', dataFilter: {} }],
      aggregation: { op: 'countUnique', field: 'personalityTraitId' },
      valueKind: 'NUMERICAL',
    }, {})
    expect(result).toBe(2)
  })
})

describe('evaluateSpec — multi-condition (same-sim)', () => {
  test('returns false when no single sim satisfies all conditions', async ({ legacyId }) => {
    const skills = await getSkills(2)
    const simA = await db.sim.create({ data: { legacyId, firstName: 'A', lastName: 'X', gender: 'FEMALE', lifeStage: 'YOUNG_ADULT', generationNumber: 1 } })
    const simB = await db.sim.create({ data: { legacyId, firstName: 'B', lastName: 'X', gender: 'MALE', lifeStage: 'YOUNG_ADULT', generationNumber: 1 } })
    await db.simSkill.create({ data: { simId: simA.id, skillId: skills[0].id, level: skills[0].maxLevel } })
    await db.simSkill.create({ data: { simId: simB.id, skillId: skills[1].id, level: skills[1].maxLevel } })
    const result = await evaluateSpec(db, legacyId, {
      simFilter: { generationNumber: 1 },
      conditions: [
        { source: 'skills', dataFilter: { skillId: skills[0].id, maxed: true } },
        { source: 'skills', dataFilter: { skillId: skills[1].id, maxed: true } },
      ],
      aggregation: { op: 'any' },
      valueKind: 'BOOLEAN',
    }, {})
    expect(result).toBe(false)
  })

  test('returns true when one sim satisfies all conditions', async ({ legacyId }) => {
    const skills = await getSkills(2)
    const sim = await db.sim.create({ data: { legacyId, firstName: 'A', lastName: 'X', gender: 'FEMALE', lifeStage: 'YOUNG_ADULT', generationNumber: 1 } })
    await db.simSkill.create({ data: { simId: sim.id, skillId: skills[0].id, level: skills[0].maxLevel } })
    await db.simSkill.create({ data: { simId: sim.id, skillId: skills[1].id, level: skills[1].maxLevel } })
    const result = await evaluateSpec(db, legacyId, {
      simFilter: { generationNumber: 1 },
      conditions: [
        { source: 'skills', dataFilter: { skillId: skills[0].id, maxed: true } },
        { source: 'skills', dataFilter: { skillId: skills[1].id, maxed: true } },
      ],
      aggregation: { op: 'any' },
      valueKind: 'BOOLEAN',
    }, {})
    expect(result).toBe(true)
  })
})

describe('evaluateSpec — $phase.generationNumber = null returns no match', () => {
  test('returns false when phaseGenerationNumber is null (no sims match)', async ({ legacyId }) => {
    await db.sim.create({ data: { legacyId, firstName: 'A', lastName: 'B', gender: 'FEMALE', lifeStage: 'YOUNG_ADULT', generationNumber: 1 } })
    const result = await evaluateSpec(db, legacyId, {
      simFilter: { generationNumber: '$phase.generationNumber' },
      conditions: [{ source: 'skills', dataFilter: {} }],
      aggregation: { op: 'any' },
      valueKind: 'BOOLEAN',
    }, {}, null)
    expect(result).toBe(false)
  })

  test('returns 0 for count op when phaseGenerationNumber is null', async ({ legacyId }) => {
    await db.sim.create({ data: { legacyId, firstName: 'A', lastName: 'B', gender: 'FEMALE', lifeStage: 'YOUNG_ADULT', generationNumber: 1 } })
    const result = await evaluateSpec(db, legacyId, {
      simFilter: { generationNumber: '$phase.generationNumber' },
      conditions: [{ source: 'skills', dataFilter: {} }],
      aggregation: { op: 'count' },
      valueKind: 'NUMERICAL',
    }, {}, null)
    expect(result).toBe(0)
  })
})

describe('evaluateSpec — $config.* token resolution', () => {
  test('resolves $config.skillId token in dataFilter', async ({ legacyId, sim }) => {
    const skill = await getAnySkill()
    await db.simSkill.create({ data: { simId: sim.id, skillId: skill.id, level: skill.maxLevel } })
    const result = await evaluateSpec(db, legacyId, {
      simFilter: { generationNumber: 1 },
      conditions: [{ source: 'skills', dataFilter: { skillId: '$config.skillId', maxed: true } }],
      aggregation: { op: 'any' },
      valueKind: 'BOOLEAN',
    }, { skillId: skill.id })
    expect(result).toBe(true)
  })
})

describe('evaluateSpec — op: all', () => {
  test('returns false when only some sims satisfy the condition', async ({ legacyId }) => {
    const skill = await getAnySkill()
    const simA = await db.sim.create({ data: { legacyId, firstName: 'A', lastName: 'X', gender: 'FEMALE', lifeStage: 'YOUNG_ADULT', generationNumber: 1 } })
    await db.sim.create({ data: { legacyId, firstName: 'B', lastName: 'X', gender: 'MALE', lifeStage: 'YOUNG_ADULT', generationNumber: 1 } })
    await db.simSkill.create({ data: { simId: simA.id, skillId: skill.id, level: skill.maxLevel } })
    const result = await evaluateSpec(db, legacyId, {
      simFilter: { generationNumber: 1 },
      conditions: [{ source: 'skills', dataFilter: { skillId: skill.id, maxed: true } }],
      aggregation: { op: 'all' },
      valueKind: 'BOOLEAN',
    }, {})
    expect(result).toBe(false)
  })

  test('returns true when all sims satisfy the condition', async ({ legacyId }) => {
    const skill = await getAnySkill()
    const simA = await db.sim.create({ data: { legacyId, firstName: 'A', lastName: 'X', gender: 'FEMALE', lifeStage: 'YOUNG_ADULT', generationNumber: 1 } })
    const simB = await db.sim.create({ data: { legacyId, firstName: 'B', lastName: 'X', gender: 'MALE', lifeStage: 'YOUNG_ADULT', generationNumber: 1 } })
    await db.simSkill.create({ data: { simId: simA.id, skillId: skill.id, level: skill.maxLevel } })
    await db.simSkill.create({ data: { simId: simB.id, skillId: skill.id, level: skill.maxLevel } })
    const result = await evaluateSpec(db, legacyId, {
      simFilter: { generationNumber: 1 },
      conditions: [{ source: 'skills', dataFilter: { skillId: skill.id, maxed: true } }],
      aggregation: { op: 'all' },
      valueKind: 'BOOLEAN',
    }, {})
    expect(result).toBe(true)
  })
})

describe('recomputeLegacyTrackers — completedAt is one-way', () => {
  test('does not overwrite completedAt once stamped', async ({ legacyId, userId }) => {
    const skill = await getAnySkill()
    const trackerType = await getTrackerTypeByName('Skill Maxed')

    const challenge = await createTestChallenge(userId)
    const _phase = await createTestChallengePhase(challenge.id, { generationNumber: 1 })
    const run = await createTestChallengeRun(legacyId)
    const runPhase = await db.challengeRunPhase.create({ data: { challengeRunId: run.id, generationNumber: 1, sortOrder: 0 } })
    const runTracker = await db.challengeRunTracker.create({
      data: { challengeRunPhaseId: runPhase.id, trackerTypeId: trackerType.id, name: 'T', config: { skillId: skill.id }, sortOrder: 0 },
    })
    const sim = await db.sim.create({ data: { legacyId, firstName: 'A', lastName: 'B', gender: 'FEMALE', lifeStage: 'YOUNG_ADULT', generationNumber: 1 } })
    await db.simSkill.create({ data: { simId: sim.id, skillId: skill.id, level: skill.maxLevel } })
    await db.trackerProgress.create({ data: { challengeRunTrackerId: runTracker.id, isManual: false } })

    await recomputeLegacyTrackers(db, legacyId)
    const first = await db.trackerProgress.findUnique({ where: { challengeRunTrackerId: runTracker.id } })
    const firstStamp = first?.completedAt

    await recomputeLegacyTrackers(db, legacyId)
    const second = await db.trackerProgress.findUnique({ where: { challengeRunTrackerId: runTracker.id } })
    // completedAt should not change on second call
    expect(second?.completedAt).toEqual(firstStamp)
  })

  test('skips manual trackers during recompute', async ({ legacyId }) => {
    const trackerType = await getTrackerTypeByName('Manual Goal')
    const run = await createTestChallengeRun(legacyId)
    const runPhase = await db.challengeRunPhase.create({ data: { challengeRunId: run.id, sortOrder: 0 } })
    const runTracker = await db.challengeRunTracker.create({
      data: { challengeRunPhaseId: runPhase.id, trackerTypeId: trackerType.id, name: 'Manual', config: {}, sortOrder: 0 },
    })
    await db.trackerProgress.create({ data: { challengeRunTrackerId: runTracker.id, isManual: true } })

    await recomputeLegacyTrackers(db, legacyId)
    const progress = await db.trackerProgress.findUnique({ where: { challengeRunTrackerId: runTracker.id } })
    expect(progress?.completedAt).toBeNull()
    expect(progress?.evaluatedAt).toBeNull()
  })
})

describe('evaluateSpec — unknown condition source throws', () => {
  test('throws when condition source is unknown', async ({ legacyId }) => {
    await db.sim.create({ data: { legacyId, firstName: 'A', lastName: 'B', gender: 'FEMALE', lifeStage: 'YOUNG_ADULT', generationNumber: 1 } })
    await expect(
      evaluateSpec(db, legacyId, {
        simFilter: { generationNumber: 1 },
        conditions: [{ source: 'skill' as unknown as 'skills', dataFilter: {} }],
        aggregation: { op: 'any' },
        valueKind: 'BOOLEAN',
      }, {}),
    ).rejects.toThrow(/Unknown condition source/)
  })
})

describe('recomputeLegacyTrackers — swallows internal errors instead of rejecting', () => {
  test('resolves without throwing when any internal DB access throws', async () => {
    // Intended contract: recompute is fired from mutations (sometimes un-awaited);
    // an internal failure must never reject and crash the caller.
    // Every property access on this proxy throws, so the test holds no matter
    // which query recompute happens to run first.
    const brokenDb = new Proxy({} as Parameters<typeof recomputeLegacyTrackers>[0], {
      get() {
        throw new Error('simulated DB failure')
      },
    })
    await expect(recomputeLegacyTrackers(brokenDb, 'non-existent-legacy')).resolves.toBeUndefined()
  })
})

describe('evaluateSpec — unknown simFilter keys throw', () => {
  test('throws an error for unrecognised simFilter keys', async ({ legacyId }) => {
    await expect(
      evaluateSpec(db, legacyId, {
        simFilter: { unknownField: 'some-value' },
        conditions: [],
        aggregation: { op: 'any' },
        valueKind: 'BOOLEAN',
      }, {}),
    ).rejects.toThrow('Unknown simFilter keys: unknownField')
  })
})

describe('evaluateSpec — traits condition respects dataFilter', () => {
  test('returns false when sim has a different trait than required', async ({ legacyId, sim }) => {
    const traits = await getGameTraits(2)
    await db.simTrait.create({ data: { simId: sim.id, traitId: traits[0].id } })
    const result = await evaluateSpec(db, legacyId, {
      simFilter: { generationNumber: 1 },
      conditions: [{ source: 'traits', dataFilter: { traitId: traits[1].id } }],
      aggregation: { op: 'any' },
      valueKind: 'BOOLEAN',
    }, {})
    expect(result).toBe(false)
  })

  test('returns true when sim has the required trait', async ({ legacyId, sim }) => {
    const [trait] = await getGameTraits(1)
    await db.simTrait.create({ data: { simId: sim.id, traitId: trait.id } })
    const result = await evaluateSpec(db, legacyId, {
      simFilter: { generationNumber: 1 },
      conditions: [{ source: 'traits', dataFilter: { traitId: trait.id } }],
      aggregation: { op: 'any' },
      valueKind: 'BOOLEAN',
    }, {})
    expect(result).toBe(true)
  })
})

describe('recomputeLegacyTrackers — THRESHOLD earnedPoints and completion', () => {
  test('stores earnedPoints (thresholds crossed) and only completes when all thresholds crossed', async ({ legacyId }) => {
    const skill = await getAnySkill()

    // Tracker type with count aggregation for THRESHOLD
    // goalConfig uses explicit thresholds array: [1, 2] — 2 thresholds
    const trackerType = await db.trackerType.create({
      data: {
        name: `Threshold Tracker ${Date.now()}`,
        valueKind: 'THRESHOLD',
        computationSpec: {
          simFilter: {},
          conditions: [{ source: 'skills', dataFilter: { skillId: skill.id, maxed: true } }],
          aggregation: { op: 'count' },
          valueKind: 'THRESHOLD',
        },
        configSchema: {},
        isBuiltIn: false,
        isPublic: false,
        ownerId: null,
      },
    })

    const run = await createTestChallengeRun(legacyId)
    const runPhase = await db.challengeRunPhase.create({ data: { challengeRunId: run.id, sortOrder: 0 } })
    const runTracker = await db.challengeRunTracker.create({
      data: {
        challengeRunPhaseId: runPhase.id,
        trackerTypeId: trackerType.id,
        name: 'Count threshold',
        config: {},
        goalConfig: { thresholds: [1, 2] },
        sortOrder: 0,
      },
    })
    await db.trackerProgress.create({ data: { challengeRunTrackerId: runTracker.id, isManual: false } })

    // One sim with skill maxed — rawValue = 1, crosses threshold 1 → earnedPoints = 1, not complete
    const simA = await db.sim.create({ data: { legacyId, firstName: 'A', lastName: 'X', gender: 'FEMALE', lifeStage: 'YOUNG_ADULT', generationNumber: 1 } })
    await db.simSkill.create({ data: { simId: simA.id, skillId: skill.id, level: skill.maxLevel } })

    await recomputeLegacyTrackers(db, legacyId)
    const before = await db.trackerProgress.findUnique({ where: { challengeRunTrackerId: runTracker.id } })
    expect(before?.completedAt).toBeNull()
    expect(before?.value).toBe(1)  // earnedPoints = 1

    // Second sim maxes the same skill — rawValue = 2, crosses thresholds [1,2] → earnedPoints = 2 → complete
    const simB = await db.sim.create({ data: { legacyId, firstName: 'B', lastName: 'X', gender: 'MALE', lifeStage: 'YOUNG_ADULT', generationNumber: 1 } })
    await db.simSkill.create({ data: { simId: simB.id, skillId: skill.id, level: skill.maxLevel } })

    await recomputeLegacyTrackers(db, legacyId)
    const after = await db.trackerProgress.findUnique({ where: { challengeRunTrackerId: runTracker.id } })
    expect(after?.completedAt).not.toBeNull()
    expect(after?.value).toBe(2)  // earnedPoints = 2
  })

  test('stores earnedPoints using arithmetic progression goalConfig', async ({ legacyId }) => {
    const skill = await getAnySkill()

    const trackerType = await db.trackerType.create({
      data: {
        name: `Arithmetic Threshold ${Date.now()}`,
        valueKind: 'THRESHOLD',
        computationSpec: {
          simFilter: {},
          conditions: [{ source: 'skills', dataFilter: { skillId: skill.id, maxed: true } }],
          aggregation: { op: 'count' },
          valueKind: 'THRESHOLD',
        },
        configSchema: {},
        isBuiltIn: false,
        isPublic: false,
        ownerId: null,
      },
    })

    const run = await createTestChallengeRun(legacyId)
    const runPhase = await db.challengeRunPhase.create({ data: { challengeRunId: run.id, sortOrder: 0 } })
    // goalConfig: start=1, step=1, count=3 → thresholds [1,2,3]
    const runTracker = await db.challengeRunTracker.create({
      data: {
        challengeRunPhaseId: runPhase.id,
        trackerTypeId: trackerType.id,
        name: 'Arithmetic threshold',
        config: {},
        goalConfig: { start: 1, step: 1, count: 3 },
        sortOrder: 0,
      },
    })
    await db.trackerProgress.create({ data: { challengeRunTrackerId: runTracker.id, isManual: false } })

    // Two sims with maxed skill → rawValue = 2, crosses thresholds [1,2] → earnedPoints = 2
    const simA = await db.sim.create({ data: { legacyId, firstName: 'A', lastName: 'X', gender: 'FEMALE', lifeStage: 'YOUNG_ADULT', generationNumber: 1 } })
    const simB = await db.sim.create({ data: { legacyId, firstName: 'B', lastName: 'X', gender: 'MALE', lifeStage: 'YOUNG_ADULT', generationNumber: 1 } })
    await db.simSkill.create({ data: { simId: simA.id, skillId: skill.id, level: skill.maxLevel } })
    await db.simSkill.create({ data: { simId: simB.id, skillId: skill.id, level: skill.maxLevel } })

    await recomputeLegacyTrackers(db, legacyId)
    const progress = await db.trackerProgress.findUnique({ where: { challengeRunTrackerId: runTracker.id } })
    expect(progress?.value).toBe(2)    // crossed 2 of 3 thresholds
    expect(progress?.completedAt).toBeNull()  // not complete: need 3
  })

  test('stores a null value and never auto-completes when goalConfig is malformed', async ({ legacyId }) => {
    const skill = await getAnySkill()

    const trackerType = await db.trackerType.create({
      data: {
        name: `Malformed Threshold ${Date.now()}`,
        valueKind: 'THRESHOLD',
        computationSpec: {
          simFilter: {},
          conditions: [{ source: 'skills', dataFilter: { skillId: skill.id, maxed: true } }],
          aggregation: { op: 'count' },
          valueKind: 'THRESHOLD',
        },
        configSchema: {},
        isBuiltIn: false,
        isPublic: false,
        ownerId: null,
      },
    })

    const run = await createTestChallengeRun(legacyId)
    const runPhase = await db.challengeRunPhase.create({ data: { challengeRunId: run.id, sortOrder: 0 } })
    // count: 0 yields no thresholds — resolveThresholds returns null
    const runTracker = await db.challengeRunTracker.create({
      data: {
        challengeRunPhaseId: runPhase.id,
        trackerTypeId: trackerType.id,
        name: 'Malformed threshold',
        config: {},
        goalConfig: { start: 1, step: 1, count: 0 },
        sortOrder: 0,
      },
    })
    await db.trackerProgress.create({ data: { challengeRunTrackerId: runTracker.id, isManual: false } })

    // A sim that would cross thresholds if any existed
    const sim = await db.sim.create({ data: { legacyId, firstName: 'A', lastName: 'X', gender: 'FEMALE', lifeStage: 'YOUNG_ADULT', generationNumber: 1 } })
    await db.simSkill.create({ data: { simId: sim.id, skillId: skill.id, level: skill.maxLevel } })

    await recomputeLegacyTrackers(db, legacyId)
    const progress = await db.trackerProgress.findUnique({ where: { challengeRunTrackerId: runTracker.id } })
    expect(progress?.value).toBeNull()
    expect(progress?.completedAt).toBeNull()
  })
})
