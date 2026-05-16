import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { db } from '@/server/db'
import { createTestUser, cleanupUser, createTestLegacy } from '@/test/helpers'
import { evaluateSpec } from './trackerComputation'

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
