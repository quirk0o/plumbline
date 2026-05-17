import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { db } from '@/server/db'
import { createTestUser, cleanupUser, createTestLegacy, createTestChallenge, createTestChallengePhase, createTestChallengeRun } from '@/test/helpers'
import { evaluateSpec, recomputeLegacyTrackers, resolveThresholds, countThresholdsCrossed } from './trackerComputation'

describe('resolveThresholds', () => {
  it('returns explicit thresholds array', () => {
    expect(resolveThresholds({ thresholds: [2, 5, 10] })).toEqual([2, 5, 10])
  })
  it('expands arithmetic progression', () => {
    expect(resolveThresholds({ start: 2, step: 3, count: 4 })).toEqual([2, 5, 8, 11])
  })
  it('returns null for null input', () => {
    expect(resolveThresholds(null)).toBeNull()
  })
  it('returns null when no valid shape', () => {
    expect(resolveThresholds({ goalValue: 10 })).toBeNull()
  })
  it('returns null for an array input', () => {
    expect(resolveThresholds([1, 2, 3])).toBeNull()
  })
  it('returns null when count is zero', () => {
    expect(resolveThresholds({ start: 0, step: 1, count: 0 })).toBeNull()
  })
  it('returns null when thresholds array contains non-numbers', () => {
    expect(resolveThresholds({ thresholds: [1, '5', 10] })).toBeNull()
  })
})

describe('countThresholdsCrossed', () => {
  it('counts thresholds where rawValue >= threshold', () => {
    expect(countThresholdsCrossed(7, [2, 5, 10])).toBe(2)
    expect(countThresholdsCrossed(10, [2, 5, 10])).toBe(3)
    expect(countThresholdsCrossed(1, [2, 5, 10])).toBe(0)
    expect(countThresholdsCrossed(5, [2, 5, 10])).toBe(2)
  })
  it('returns 0 when rawValue is below all thresholds', () => {
    expect(countThresholdsCrossed(0, [5, 10, 15])).toBe(0)
  })
  it('returns thresholds.length when rawValue exceeds all', () => {
    expect(countThresholdsCrossed(100, [5, 10, 15])).toBe(3)
  })
})

describe('evaluateSpec — skill maxed (single condition)', () => {
  let userId: string
  let legacyId: string
  let simId: string

  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
    const legacy = await createTestLegacy(userId)
    legacyId = legacy.id
    const sim = await db.sim.create({
      data: { legacyId, firstName: 'Bella', lastName: 'Goth', gender: 'FEMALE', lifeStage: 'YOUNG_ADULT', generationNumber: 1 },
    })
    simId = sim.id
  })

  afterEach(async () => { await cleanupUser(userId) })

  it('returns false when sim has not maxed the skill', async () => {
    const skill = await db.skill.findFirst()
    if (!skill) return
    await db.simSkill.create({ data: { simId, skillId: skill.id, level: 1 } })
    const result = await evaluateSpec(db, legacyId, {
      simFilter: { generationNumber: 1 },
      conditions: [{ source: 'skills', dataFilter: { skillId: skill.id, maxed: true } }],
      aggregation: { op: 'any' },
      valueKind: 'BOOLEAN',
    }, {})
    expect(result).toBe(false)
  })

  it('returns true when sim has maxed the skill', async () => {
    const skill = await db.skill.findFirst()
    if (!skill) return
    await db.simSkill.create({ data: { simId, skillId: skill.id, level: skill.maxLevel } })
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
  let userId: string
  let legacyId: string
  let simId: string

  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
    const legacy = await createTestLegacy(userId)
    legacyId = legacy.id
    const sim = await db.sim.create({
      data: { legacyId, firstName: 'Don', lastName: 'Lothario', gender: 'MALE', lifeStage: 'YOUNG_ADULT', generationNumber: 1 },
    })
    simId = sim.id
  })

  afterEach(async () => { await cleanupUser(userId) })

  it('returns false when aspiration not completed', async () => {
    const aspiration = await db.aspiration.findFirst()
    if (!aspiration) return
    await db.simAspiration.create({ data: { simId, aspirationId: aspiration.id } })
    const result = await evaluateSpec(db, legacyId, {
      simFilter: { generationNumber: 1 },
      conditions: [{ source: 'aspirations', dataFilter: { aspirationId: aspiration.id, completed: true } }],
      aggregation: { op: 'any' },
      valueKind: 'BOOLEAN',
    }, {})
    expect(result).toBe(false)
  })

  it('returns true when aspiration is completed', async () => {
    const aspiration = await db.aspiration.findFirst()
    if (!aspiration) return
    await db.simAspiration.create({ data: { simId, aspirationId: aspiration.id, completedAt: new Date() } })
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
  let userId: string
  let legacyId: string

  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
    const legacy = await createTestLegacy(userId)
    legacyId = legacy.id
  })

  afterEach(async () => { await cleanupUser(userId) })

  it('returns false when no sim has died by fire', async () => {
    await db.sim.create({ data: { legacyId, firstName: 'A', lastName: 'B', gender: 'FEMALE', lifeStage: 'YOUNG_ADULT' } })
    const result = await evaluateSpec(db, legacyId, {
      simFilter: {},
      conditions: [{ source: 'sims', dataFilter: { causeOfDeath: 'FIRE' } }],
      aggregation: { op: 'any' },
      valueKind: 'BOOLEAN',
    }, {})
    expect(result).toBe(false)
  })

  it('returns true when a sim died by fire', async () => {
    await db.sim.create({ data: { legacyId, firstName: 'A', lastName: 'B', gender: 'FEMALE', lifeStage: 'ELDER', causeOfDeath: 'FIRE' } })
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
  let userId: string
  let legacyId: string

  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
    const legacy = await createTestLegacy(userId)
    legacyId = legacy.id
  })

  afterEach(async () => { await cleanupUser(userId) })

  it('counts distinct personality traits across generation sims', async () => {
    const traits = await db.personalityTrait.findMany({ take: 3 })
    if (traits.length < 2) return
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
  let userId: string
  let legacyId: string

  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
    const legacy = await createTestLegacy(userId)
    legacyId = legacy.id
  })

  afterEach(async () => { await cleanupUser(userId) })

  it('returns false when no single sim satisfies all conditions', async () => {
    const skills = await db.skill.findMany({ take: 2 })
    if (skills.length < 2) return
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

  it('returns true when one sim satisfies all conditions', async () => {
    const skills = await db.skill.findMany({ take: 2 })
    if (skills.length < 2) return
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

describe('recomputeLegacyTrackers', () => {
  let userId: string
  let legacyId: string

  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
    const legacy = await createTestLegacy(userId)
    legacyId = legacy.id
  })

  afterEach(async () => { await cleanupUser(userId) })

  it('stamps completedAt when a built-in tracker becomes satisfied', async () => {
    const skill = await db.skill.findFirst()
    if (!skill) return

    const trackerType = await db.trackerType.findFirst({ where: { name: 'Skill Maxed' } })
    if (!trackerType) return

    const challenge = await createTestChallenge(userId)
    const phase = await createTestChallengePhase(challenge.id, { generationNumber: 1 })
    await db.trackerDefinition.create({
      data: { challengePhaseId: phase.id, trackerTypeId: trackerType.id, name: 'Max Cooking', config: { skillId: skill.id } },
    })
    const run = await createTestChallengeRun(legacyId, { sourceChallengeId: challenge.id })
    const runPhase = await db.challengeRunPhase.create({ data: { challengeRunId: run.id, generationNumber: 1, sortOrder: 0 } })
    const runTracker = await db.challengeRunTracker.create({
      data: { challengeRunPhaseId: runPhase.id, trackerTypeId: trackerType.id, name: 'Max Cooking', config: { skillId: skill.id }, sortOrder: 0 },
    })
    await db.trackerProgress.create({ data: { challengeRunTrackerId: runTracker.id, isManual: false } })

    const sim = await db.sim.create({ data: { legacyId, firstName: 'A', lastName: 'B', gender: 'FEMALE', lifeStage: 'YOUNG_ADULT', generationNumber: 1 } })
    await recomputeLegacyTrackers(db, legacyId)
    const progressBefore = await db.trackerProgress.findUnique({ where: { challengeRunTrackerId: runTracker.id } })
    expect(progressBefore?.completedAt).toBeNull()

    await db.simSkill.create({ data: { simId: sim.id, skillId: skill.id, level: skill.maxLevel } })
    await recomputeLegacyTrackers(db, legacyId)
    const progressAfter = await db.trackerProgress.findUnique({ where: { challengeRunTrackerId: runTracker.id } })
    expect(progressAfter?.completedAt).not.toBeNull()
  })
})

describe('evaluateSpec — $phase.generationNumber = null returns no match', () => {
  let userId: string
  let legacyId: string

  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
    const legacy = await createTestLegacy(userId)
    legacyId = legacy.id
    await db.sim.create({ data: { legacyId, firstName: 'A', lastName: 'B', gender: 'FEMALE', lifeStage: 'YOUNG_ADULT', generationNumber: 1 } })
  })
  afterEach(async () => { await cleanupUser(userId) })

  it('returns false when phaseGenerationNumber is null (no sims match)', async () => {
    const result = await evaluateSpec(db, legacyId, {
      simFilter: { generationNumber: '$phase.generationNumber' },
      conditions: [{ source: 'skills', dataFilter: {} }],
      aggregation: { op: 'any' },
      valueKind: 'BOOLEAN',
    }, {}, null)
    expect(result).toBe(false)
  })

  it('returns 0 for count op when phaseGenerationNumber is null', async () => {
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
  let userId: string
  let legacyId: string
  let simId: string

  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
    const legacy = await createTestLegacy(userId)
    legacyId = legacy.id
    const sim = await db.sim.create({ data: { legacyId, firstName: 'A', lastName: 'B', gender: 'FEMALE', lifeStage: 'YOUNG_ADULT', generationNumber: 1 } })
    simId = sim.id
  })
  afterEach(async () => { await cleanupUser(userId) })

  it('resolves $config.skillId token in dataFilter', async () => {
    const skill = await db.skill.findFirst()
    if (!skill) return
    await db.simSkill.create({ data: { simId, skillId: skill.id, level: skill.maxLevel } })
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
  let userId: string
  let legacyId: string

  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
    const legacy = await createTestLegacy(userId)
    legacyId = legacy.id
  })
  afterEach(async () => { await cleanupUser(userId) })

  it('returns false when only some sims satisfy the condition', async () => {
    const skill = await db.skill.findFirst()
    if (!skill) return
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

  it('returns true when all sims satisfy the condition', async () => {
    const skill = await db.skill.findFirst()
    if (!skill) return
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
  let userId: string
  let legacyId: string

  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
    const legacy = await createTestLegacy(userId)
    legacyId = legacy.id
  })
  afterEach(async () => { await cleanupUser(userId) })

  it('does not overwrite completedAt once stamped', async () => {
    const skill = await db.skill.findFirst()
    if (!skill) return
    const trackerType = await db.trackerType.findFirst({ where: { name: 'Skill Maxed' } })
    if (!trackerType) return

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

  it('skips manual trackers during recompute', async () => {
    const trackerType = await db.trackerType.findFirst({ where: { name: 'Manual Goal' } })
    if (!trackerType) return
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

describe('evaluateSpec — unknown simFilter keys throw', () => {
  let userId: string
  let legacyId: string

  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
    const legacy = await createTestLegacy(userId)
    legacyId = legacy.id
  })
  afterEach(async () => { await cleanupUser(userId) })

  it('throws an error for unrecognised simFilter keys', async () => {
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
  let userId: string
  let legacyId: string
  let simId: string

  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
    const legacy = await createTestLegacy(userId)
    legacyId = legacy.id
    const sim = await db.sim.create({
      data: { legacyId, firstName: 'Mortimer', lastName: 'Goth', gender: 'MALE', lifeStage: 'YOUNG_ADULT', generationNumber: 1 },
    })
    simId = sim.id
  })
  afterEach(async () => { await cleanupUser(userId) })

  it('returns false when sim has a different trait than required', async () => {
    const traits = await db.trait.findMany({ take: 2 })
    if (traits.length < 2) return
    await db.simTrait.create({ data: { simId, traitId: traits[0].id } })
    const result = await evaluateSpec(db, legacyId, {
      simFilter: { generationNumber: 1 },
      conditions: [{ source: 'traits', dataFilter: { traitId: traits[1].id } }],
      aggregation: { op: 'any' },
      valueKind: 'BOOLEAN',
    }, {})
    expect(result).toBe(false)
  })

  it('returns true when sim has the required trait', async () => {
    const trait = await db.trait.findFirst()
    if (!trait) return
    await db.simTrait.create({ data: { simId, traitId: trait.id } })
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
  let userId: string
  let legacyId: string

  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
    const legacy = await createTestLegacy(userId)
    legacyId = legacy.id
  })
  afterEach(async () => { await cleanupUser(userId) })

  it('stores earnedPoints (thresholds crossed) and only completes when all thresholds crossed', async () => {
    const skill = await db.skill.findFirst()
    if (!skill) return

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
    const simA = await db.sim.create({ data: { legacyId, firstName: 'A', lastName: 'X', gender: 'FEMALE', lifeStage: 'YOUNG_ADULT' } })
    await db.simSkill.create({ data: { simId: simA.id, skillId: skill.id, level: skill.maxLevel } })

    await recomputeLegacyTrackers(db, legacyId)
    const before = await db.trackerProgress.findUnique({ where: { challengeRunTrackerId: runTracker.id } })
    expect(before?.completedAt).toBeNull()
    expect(before?.value).toBe(1)  // earnedPoints = 1

    // Second sim maxes the same skill — rawValue = 2, crosses thresholds [1,2] → earnedPoints = 2 → complete
    const simB = await db.sim.create({ data: { legacyId, firstName: 'B', lastName: 'X', gender: 'MALE', lifeStage: 'YOUNG_ADULT' } })
    await db.simSkill.create({ data: { simId: simB.id, skillId: skill.id, level: skill.maxLevel } })

    await recomputeLegacyTrackers(db, legacyId)
    const after = await db.trackerProgress.findUnique({ where: { challengeRunTrackerId: runTracker.id } })
    expect(after?.completedAt).not.toBeNull()
    expect(after?.value).toBe(2)  // earnedPoints = 2
  })

  it('stores earnedPoints using arithmetic progression goalConfig', async () => {
    const skill = await db.skill.findFirst()
    if (!skill) return

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
    const simA = await db.sim.create({ data: { legacyId, firstName: 'A', lastName: 'X', gender: 'FEMALE', lifeStage: 'YOUNG_ADULT' } })
    const simB = await db.sim.create({ data: { legacyId, firstName: 'B', lastName: 'X', gender: 'MALE', lifeStage: 'YOUNG_ADULT' } })
    await db.simSkill.create({ data: { simId: simA.id, skillId: skill.id, level: skill.maxLevel } })
    await db.simSkill.create({ data: { simId: simB.id, skillId: skill.id, level: skill.maxLevel } })

    await recomputeLegacyTrackers(db, legacyId)
    const progress = await db.trackerProgress.findUnique({ where: { challengeRunTrackerId: runTracker.id } })
    expect(progress?.value).toBe(2)    // crossed 2 of 3 thresholds
    expect(progress?.completedAt).toBeNull()  // not complete: need 3
  })
})
