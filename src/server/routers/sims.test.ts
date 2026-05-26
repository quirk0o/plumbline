import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Gender, FamilyRelationshipType, RomanticStatus } from '@prisma/client'
import { authedCaller, unauthCaller } from '@/test/caller'
import {
  createTestUser,
  cleanupUser,
  createTestLegacy,
  createTestSim,
  getAnyTrait,
  getConflictingTraits,
  createTestChallenge,
  createTestChallengePhase,
  createTestChallengeRun,
} from '@/test/helpers'
import { db } from '@/server/db'

describe('sims.create', () => {
  let userId: string
  let legacyId: string

  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
    const legacy = await createTestLegacy(userId)
    legacyId = legacy.id
  })

  afterEach(async () => {
    await cleanupUser(userId)
  })

  it('creates a Sim in the database and returns it', async () => {
    const caller = authedCaller(userId)
    const result = await caller.sims.create({
      legacyId,
      firstName: 'Bella',
      lastName: 'Goth',
      gender: Gender.FEMALE,
    })
    expect(result.firstName).toBe('Bella')
    expect(result.lastName).toBe('Goth')
    const record = await db.sim.findUnique({ where: { id: result.id } })
    expect(record).not.toBeNull()
  })

  it('creates SimPersonalityTrait junction rows when traits are provided', async () => {
    const trait = await getAnyTrait()
    const caller = authedCaller(userId)
    const result = await caller.sims.create({
      legacyId,
      firstName: 'Don',
      lastName: 'Lothario',
      gender: Gender.MALE,
      personalityTraitIds: [trait.id],
    })
    const traitRows = await db.simPersonalityTrait.findMany({
      where: { simId: result.id },
    })
    expect(traitRows).toHaveLength(1)
    expect(traitRows[0].personalityTraitId).toBe(trait.id)
  })

  it('throws BAD_REQUEST when two conflicting traits are provided', async () => {
    const { traitA, traitB } = await getConflictingTraits()
    const caller = authedCaller(userId)
    await expect(
      caller.sims.create({
        legacyId,
        firstName: 'A',
        lastName: 'B',
        gender: Gender.MALE,
        personalityTraitIds: [traitA.id, traitB.id],
      })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('throws NOT_FOUND when the legacy belongs to a different user', async () => {
    const otherUser = await createTestUser()
    try {
      const otherLegacy = await createTestLegacy(otherUser.id)
      const caller = authedCaller(userId)
      await expect(
        caller.sims.create({
          legacyId: otherLegacy.id,
          firstName: 'A',
          lastName: 'B',
          gender: Gender.MALE,
        })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    } finally {
      await cleanupUser(otherUser.id)
    }
  })

  it('throws NOT_FOUND for a non-existent legacyId', async () => {
    const caller = authedCaller(userId)
    await expect(
      caller.sims.create({
        legacyId: 'clnonexistentlegacyid000000',
        firstName: 'A',
        lastName: 'B',
        gender: Gender.MALE,
      })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('throws UNAUTHORIZED without a session', async () => {
    const caller = unauthCaller()
    await expect(
      caller.sims.create({
        legacyId,
        firstName: 'A',
        lastName: 'B',
        gender: Gender.MALE,
      })
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })
})

describe('sims.getById', () => {
  let userId: string
  let legacyId: string
  let simId: string

  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
    const legacy = await createTestLegacy(userId)
    legacyId = legacy.id
    const sim = await createTestSim(legacyId)
    simId = sim.id
  })

  afterEach(async () => {
    await cleanupUser(userId)
  })

  it('returns the sim with nested relations for the owner', async () => {
    const caller = authedCaller(userId)
    const result = await caller.sims.getById({ id: simId })
    expect(result.id).toBe(simId)
    expect(result.personalityTraits).toBeDefined()
    expect(result.skills).toBeDefined()
  })

  it('throws NOT_FOUND when the sim belongs to a different user', async () => {
    const other = await createTestUser()
    try {
      await expect(
        authedCaller(other.id).sims.getById({ id: simId })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    } finally {
      await cleanupUser(other.id)
    }
  })
})

describe('sims.listByLegacy', () => {
  let userId: string
  let legacyId: string

  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
    const legacy = await createTestLegacy(userId)
    legacyId = legacy.id
    await createTestSim(legacyId, { firstName: 'Alice' })
    await createTestSim(legacyId, { firstName: 'Bob' })
  })

  afterEach(async () => {
    await cleanupUser(userId)
  })

  it('returns all sims in the legacy', async () => {
    const result = await authedCaller(userId).sims.listByLegacy({ legacyId })
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ firstName: expect.any(String), imageUrl: null })
  })

  it('throws NOT_FOUND for a legacy belonging to another user', async () => {
    const other = await createTestUser()
    try {
      await expect(
        authedCaller(other.id).sims.listByLegacy({ legacyId })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    } finally {
      await cleanupUser(other.id)
    }
  })
})

describe('sims.update', () => {
  let userId: string
  let legacyId: string
  let simId: string

  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
    const legacy = await createTestLegacy(userId)
    legacyId = legacy.id
    const sim = await createTestSim(legacyId)
    simId = sim.id
  })

  afterEach(async () => {
    await cleanupUser(userId)
  })

  it('updates scalar fields', async () => {
    await authedCaller(userId).sims.update({ id: simId, firstName: 'Nova', lifeStage: 'ELDER' })
    const record = await db.sim.findUnique({ where: { id: simId } })
    expect(record?.firstName).toBe('Nova')
    expect(record?.lifeStage).toBe('ELDER')
  })

  it('sets cause of death', async () => {
    await authedCaller(userId).sims.update({ id: simId, causeOfDeath: 'OLD_AGE' })
    const record = await db.sim.findUnique({ where: { id: simId } })
    expect(record?.causeOfDeath).toBe('OLD_AGE')
  })

  it('swaps aspiration', async () => {
    const aspiration = await db.aspiration.findFirst()
    if (!aspiration) return
    await authedCaller(userId).sims.update({ id: simId, aspirationId: aspiration.id })
    const rows = await db.simAspiration.findMany({ where: { simId, completedAt: null } })
    expect(rows).toHaveLength(1)
    expect(rows[0].aspirationId).toBe(aspiration.id)
  })

  it("throws NOT_FOUND for another user's sim", async () => {
    const other = await createTestUser()
    try {
      await expect(
        authedCaller(other.id).sims.update({ id: simId, firstName: 'Hacker' })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    } finally {
      await cleanupUser(other.id)
    }
  })
})

describe('sims.addTrait / sims.removeTrait', () => {
  let userId: string
  let legacyId: string
  let simId: string

  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
    const legacy = await createTestLegacy(userId)
    legacyId = legacy.id
    const sim = await createTestSim(legacyId)
    simId = sim.id
  })

  afterEach(async () => {
    await cleanupUser(userId)
  })

  it('adds a trait', async () => {
    const trait = await getAnyTrait()
    await authedCaller(userId).sims.addTrait({ simId, traitId: trait.id })
    const rows = await db.simPersonalityTrait.findMany({ where: { simId } })
    expect(rows).toHaveLength(1)
  })

  it('removes a trait', async () => {
    const trait = await getAnyTrait()
    await db.simPersonalityTrait.create({ data: { simId, personalityTraitId: trait.id } })
    await authedCaller(userId).sims.removeTrait({ simId, traitId: trait.id })
    const rows = await db.simPersonalityTrait.findMany({ where: { simId } })
    expect(rows).toHaveLength(0)
  })

  it('throws BAD_REQUEST when adding a conflicting trait', async () => {
    const { traitA, traitB } = await getConflictingTraits()
    await db.simPersonalityTrait.create({ data: { simId, personalityTraitId: traitA.id } })
    await expect(
      authedCaller(userId).sims.addTrait({ simId, traitId: traitB.id })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('throws BAD_REQUEST when already at 6 traits', async () => {
    const traits = await db.personalityTrait.findMany({ take: 7 })
    if (traits.length < 7) return // not enough seed data
    for (const t of traits.slice(0, 6)) {
      await db.simPersonalityTrait.create({ data: { simId, personalityTraitId: t.id } })
    }
    await expect(
      authedCaller(userId).sims.addTrait({ simId, traitId: traits[6].id })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })
})

describe('sims.addSkill / sims.setSkillLevel / sims.removeSkill', () => {
  let userId: string
  let legacyId: string
  let simId: string

  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
    const legacy = await createTestLegacy(userId)
    legacyId = legacy.id
    const sim = await createTestSim(legacyId)
    simId = sim.id
  })

  afterEach(async () => {
    await cleanupUser(userId)
  })

  it('adds a skill at the given level', async () => {
    const skill = await db.skill.findFirst()
    if (!skill) return
    await authedCaller(userId).sims.addSkill({ simId, skillId: skill.id, level: 1 })
    const row = await db.simSkill.findUnique({ where: { simId_skillId: { simId, skillId: skill.id } } })
    expect(row?.level).toBe(1)
  })

  it('throws BAD_REQUEST when level exceeds maxLevel', async () => {
    const skill = await db.skill.findFirst()
    if (!skill) return
    await expect(
      authedCaller(userId).sims.addSkill({ simId, skillId: skill.id, level: skill.maxLevel + 1 })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('updates skill level', async () => {
    const skill = await db.skill.findFirst()
    if (!skill) return
    await db.simSkill.create({ data: { simId, skillId: skill.id, level: 1 } })
    await authedCaller(userId).sims.setSkillLevel({ simId, skillId: skill.id, level: 3 })
    const row = await db.simSkill.findUnique({ where: { simId_skillId: { simId, skillId: skill.id } } })
    expect(row?.level).toBe(3)
  })

  it('removes a skill', async () => {
    const skill = await db.skill.findFirst()
    if (!skill) return
    await db.simSkill.create({ data: { simId, skillId: skill.id, level: 2 } })
    await authedCaller(userId).sims.removeSkill({ simId, skillId: skill.id })
    const row = await db.simSkill.findUnique({ where: { simId_skillId: { simId, skillId: skill.id } } })
    expect(row).toBeNull()
  })

  it("throws NOT_FOUND for another user's sim", async () => {
    const other = await createTestUser()
    try {
      const skill = await db.skill.findFirst()
      if (!skill) return
      await expect(
        authedCaller(other.id).sims.addSkill({ simId, skillId: skill.id, level: 1 })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    } finally {
      await cleanupUser(other.id)
    }
  })
})

describe('sims.addFamilyRelationship / sims.removeFamilyRelationship', () => {
  let userId: string
  let parentId: string
  let childId: string

  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
    const legacy = await createTestLegacy(userId)
    const parent = await createTestSim(legacy.id, { firstName: 'Parent' })
    const child = await createTestSim(legacy.id, { firstName: 'Child' })
    parentId = parent.id
    childId = child.id
  })

  afterEach(async () => {
    await cleanupUser(userId)
  })

  it('creates a family relationship', async () => {
    await authedCaller(userId).sims.addFamilyRelationship({
      parentId,
      childId,
      type: FamilyRelationshipType.BIOLOGICAL,
    })
    const row = await db.familyRelationship.findUnique({
      where: { parentId_childId: { parentId, childId } },
    })
    expect(row?.type).toBe(FamilyRelationshipType.BIOLOGICAL)
  })

  it('removes a family relationship', async () => {
    await db.familyRelationship.create({ data: { parentId, childId, type: FamilyRelationshipType.BIOLOGICAL } })
    await authedCaller(userId).sims.removeFamilyRelationship({ parentId, childId })
    const row = await db.familyRelationship.findUnique({
      where: { parentId_childId: { parentId, childId } },
    })
    expect(row).toBeNull()
  })

  it('throws NOT_FOUND when parent belongs to another user', async () => {
    const other = await createTestUser()
    const otherLegacy = await createTestLegacy(other.id)
    const otherSim = await createTestSim(otherLegacy.id)
    try {
      await expect(
        authedCaller(userId).sims.addFamilyRelationship({
          parentId: otherSim.id,
          childId,
          type: FamilyRelationshipType.BIOLOGICAL,
        })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    } finally {
      await cleanupUser(other.id)
    }
  })

  it('throws NOT_FOUND when child belongs to another user', async () => {
    const other = await createTestUser()
    const otherLegacy = await createTestLegacy(other.id)
    const otherSim = await createTestSim(otherLegacy.id)
    try {
      await db.familyRelationship.create({ data: { parentId, childId, type: FamilyRelationshipType.BIOLOGICAL } })
      await expect(
        authedCaller(userId).sims.removeFamilyRelationship({
          parentId,
          childId: otherSim.id,
        })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    } finally {
      await cleanupUser(other.id)
    }
  })

  it('throws BAD_REQUEST when parentId equals childId', async () => {
    await expect(
      authedCaller(userId).sims.addFamilyRelationship({
        parentId,
        childId: parentId,
        type: FamilyRelationshipType.BIOLOGICAL,
      })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('throws BAD_REQUEST when sims belong to different legacies', async () => {
    const secondLegacy = await createTestLegacy(userId)
    const secondLegacySim = await createTestSim(secondLegacy.id)
    await expect(
      authedCaller(userId).sims.addFamilyRelationship({
        parentId,
        childId: secondLegacySim.id,
        type: FamilyRelationshipType.BIOLOGICAL,
      })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('throws NOT_FOUND when parent belongs to another user in removeFamilyRelationship', async () => {
    const other = await createTestUser()
    const otherLegacy = await createTestLegacy(other.id)
    const otherSim = await createTestSim(otherLegacy.id)
    try {
      await expect(
        authedCaller(userId).sims.removeFamilyRelationship({
          parentId: otherSim.id,
          childId,
        })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    } finally {
      await cleanupUser(other.id)
    }
  })

  it('derives child generationNumber from parent when child has no generationNumber', async () => {
    await db.sim.update({ where: { id: parentId }, data: { generationNumber: 1 } })
    await authedCaller(userId).sims.addFamilyRelationship({
      parentId,
      childId,
      type: FamilyRelationshipType.BIOLOGICAL,
    })
    const record = await db.sim.findUnique({ where: { id: childId } })
    expect(record?.generationNumber).toBe(2)
  })

  it('does not override child generationNumber if already set', async () => {
    await db.sim.update({ where: { id: parentId }, data: { generationNumber: 1 } })
    await db.sim.update({ where: { id: childId }, data: { generationNumber: 5 } })
    await authedCaller(userId).sims.addFamilyRelationship({
      parentId,
      childId,
      type: FamilyRelationshipType.BIOLOGICAL,
    })
    const record = await db.sim.findUnique({ where: { id: childId } })
    expect(record?.generationNumber).toBe(5)
  })

  it('uses minimum parent gen when multiple parents already exist', async () => {
    const { legacyId } = await db.sim.findUniqueOrThrow({ where: { id: parentId }, select: { legacyId: true } })
    const existingParent = await createTestSim(legacyId, { firstName: 'OtherParent' })
    await db.sim.update({ where: { id: existingParent.id }, data: { generationNumber: 3 } })
    await db.sim.update({ where: { id: parentId }, data: { generationNumber: 2 } })
    await db.familyRelationship.create({
      data: { parentId: existingParent.id, childId, type: FamilyRelationshipType.BIOLOGICAL },
    })
    await authedCaller(userId).sims.addFamilyRelationship({
      parentId,
      childId,
      type: FamilyRelationshipType.BIOLOGICAL,
    })
    const record = await db.sim.findUnique({ where: { id: childId } })
    expect(record?.generationNumber).toBe(3)
  })

  it('updates child generationNumber after removing one parent when another remains', async () => {
    const { legacyId } = await db.sim.findUniqueOrThrow({ where: { id: parentId }, select: { legacyId: true } })
    const parent2 = await createTestSim(legacyId, { firstName: 'Parent2' })
    await db.sim.update({ where: { id: parentId }, data: { generationNumber: 1 } })
    await db.sim.update({ where: { id: parent2.id }, data: { generationNumber: 3 } })
    await db.sim.update({ where: { id: childId }, data: { generationNumber: 2 } })
    await db.familyRelationship.createMany({
      data: [
        { parentId, childId, type: FamilyRelationshipType.BIOLOGICAL },
        { parentId: parent2.id, childId, type: FamilyRelationshipType.BIOLOGICAL },
      ],
    })
    await authedCaller(userId).sims.removeFamilyRelationship({ parentId, childId })
    const record = await db.sim.findUnique({ where: { id: childId } })
    expect(record?.generationNumber).toBe(4)
  })

  it('clears child generationNumber when all parents are removed', async () => {
    await db.sim.update({ where: { id: parentId }, data: { generationNumber: 1 } })
    await db.sim.update({ where: { id: childId }, data: { generationNumber: 2 } })
    await db.familyRelationship.create({
      data: { parentId, childId, type: FamilyRelationshipType.BIOLOGICAL },
    })
    await authedCaller(userId).sims.removeFamilyRelationship({ parentId, childId })
    const record = await db.sim.findUnique({ where: { id: childId } })
    expect(record?.generationNumber).toBeNull()
  })
})

describe('sims.addSocialRelationship / sims.updateSocialRelationship / sims.removeSocialRelationship', () => {
  let userId: string
  let simAId: string
  let simBId: string

  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
    const legacy = await createTestLegacy(userId)
    const simA = await createTestSim(legacy.id, { firstName: 'Alpha' })
    const simB = await createTestSim(legacy.id, { firstName: 'Beta' })
    ;[simAId, simBId] = [simA.id, simB.id].sort()
  })

  afterEach(async () => {
    await cleanupUser(userId)
  })

  it('creates a social relationship with normalised IDs', async () => {
    await authedCaller(userId).sims.addSocialRelationship({
      simAId,
      simBId,
      romanticStatus: RomanticStatus.NONE,
    })
    const row = await db.socialRelationship.findUnique({
      where: { simAId_simBId: { simAId, simBId } },
    })
    expect(row).not.toBeNull()
    expect(row?.friendshipScore).toBe(0)
  })

  it('normalises ID order regardless of input order', async () => {
    await authedCaller(userId).sims.addSocialRelationship({
      simAId: simBId,
      simBId: simAId,
      romanticStatus: RomanticStatus.NONE,
    })
    const row = await db.socialRelationship.findUnique({
      where: { simAId_simBId: { simAId, simBId } },
    })
    expect(row).not.toBeNull()
  })

  it('updates romantic status', async () => {
    await db.socialRelationship.create({
      data: { simAId, simBId, romanticStatus: RomanticStatus.NONE, friendshipScore: 0, romanceScore: 0 },
    })
    await authedCaller(userId).sims.updateSocialRelationship({
      simAId,
      simBId,
      romanticStatus: RomanticStatus.MARRIED,
    })
    const row = await db.socialRelationship.findUnique({
      where: { simAId_simBId: { simAId, simBId } },
    })
    expect(row?.romanticStatus).toBe(RomanticStatus.MARRIED)
  })

  it('removes the relationship', async () => {
    await db.socialRelationship.create({
      data: { simAId, simBId, romanticStatus: RomanticStatus.NONE, friendshipScore: 0, romanceScore: 0 },
    })
    await authedCaller(userId).sims.removeSocialRelationship({ simAId, simBId })
    const row = await db.socialRelationship.findUnique({
      where: { simAId_simBId: { simAId, simBId } },
    })
    expect(row).toBeNull()
  })

  it("throws NOT_FOUND for another user's sim in addSocialRelationship", async () => {
    const other = await createTestUser()
    const otherLegacy = await createTestLegacy(other.id)
    const otherSim = await createTestSim(otherLegacy.id)
    try {
      await expect(
        authedCaller(userId).sims.addSocialRelationship({
          simAId,
          simBId: otherSim.id,
          romanticStatus: RomanticStatus.NONE,
        })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    } finally {
      await cleanupUser(other.id)
    }
  })

  it('throws BAD_REQUEST when both IDs are the same', async () => {
    await expect(
      authedCaller(userId).sims.addSocialRelationship({
        simAId,
        simBId: simAId,
        romanticStatus: RomanticStatus.NONE,
      })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })
})

describe('sims — generationNumber population', () => {
  let userId: string
  let legacyId: string

  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
    const legacy = await createTestLegacy(userId)
    legacyId = legacy.id
  })

  afterEach(async () => { await cleanupUser(userId) })

  it('sets generationNumber from input when provided', async () => {
    const result = await authedCaller(userId).sims.create({
      legacyId,
      firstName: 'Alice',
      lastName: 'Smith',
      gender: Gender.FEMALE,
      generationNumber: 1,
    })
    const record = await db.sim.findUnique({ where: { id: result.id } })
    expect(record?.generationNumber).toBe(1)
  })

  it('derives generationNumber from parent when parentIds provided', async () => {
    const parent = await createTestSim(legacyId, { firstName: 'Parent' })
    await db.sim.update({ where: { id: parent.id }, data: { generationNumber: 1 } })
    const result = await authedCaller(userId).sims.create({
      legacyId,
      firstName: 'Child',
      lastName: 'Smith',
      gender: Gender.FEMALE,
      parentIds: [parent.id],
    })
    const record = await db.sim.findUnique({ where: { id: result.id } })
    expect(record?.generationNumber).toBe(2)
  })

  it('uses min parent generationNumber when multiple parents', async () => {
    const parent1 = await createTestSim(legacyId, { firstName: 'P1' })
    const parent2 = await createTestSim(legacyId, { firstName: 'P2' })
    await db.sim.update({ where: { id: parent1.id }, data: { generationNumber: 2 } })
    await db.sim.update({ where: { id: parent2.id }, data: { generationNumber: 3 } })
    const result = await authedCaller(userId).sims.create({
      legacyId, firstName: 'Child', lastName: 'Smith', gender: Gender.FEMALE,
      parentIds: [parent1.id, parent2.id],
    })
    const record = await db.sim.findUnique({ where: { id: result.id } })
    expect(record?.generationNumber).toBe(3)
  })

  it('sims.update accepts generationNumber override', async () => {
    const sim = await createTestSim(legacyId)
    await authedCaller(userId).sims.update({ id: sim.id, generationNumber: 5 })
    const record = await db.sim.findUnique({ where: { id: sim.id } })
    expect(record?.generationNumber).toBe(5)
  })

  it('sims.update accepts isHeir flag', async () => {
    const sim = await createTestSim(legacyId)
    await authedCaller(userId).sims.update({ id: sim.id, isHeir: true })
    const record = await db.sim.findUnique({ where: { id: sim.id } })
    expect(record?.isHeir).toBe(true)
  })

  it('setting isHeir clears the previous heir in the same generation', async () => {
    const simA = await db.sim.create({
      data: { legacyId, firstName: 'A', lastName: 'X', gender: 'FEMALE', lifeStage: 'YOUNG_ADULT', generationNumber: 2, isHeir: true },
    })
    const simB = await db.sim.create({
      data: { legacyId, firstName: 'B', lastName: 'X', gender: 'MALE', lifeStage: 'YOUNG_ADULT', generationNumber: 2 },
    })
    await authedCaller(userId).sims.update({ id: simB.id, isHeir: true })
    const recordA = await db.sim.findUnique({ where: { id: simA.id } })
    const recordB = await db.sim.findUnique({ where: { id: simB.id } })
    expect(recordA?.isHeir).toBe(false)
    expect(recordB?.isHeir).toBe(true)
  })

  it('setting isHeir does not clear heir in a different generation', async () => {
    const simA = await db.sim.create({
      data: { legacyId, firstName: 'A', lastName: 'X', gender: 'FEMALE', lifeStage: 'YOUNG_ADULT', generationNumber: 1, isHeir: true },
    })
    const simB = await db.sim.create({
      data: { legacyId, firstName: 'B', lastName: 'X', gender: 'MALE', lifeStage: 'YOUNG_ADULT', generationNumber: 2 },
    })
    await authedCaller(userId).sims.update({ id: simB.id, isHeir: true })
    const recordA = await db.sim.findUnique({ where: { id: simA.id } })
    expect(recordA?.isHeir).toBe(true)
  })

  it('exactly one heir exists in the generation after setting isHeir on a new sim', async () => {
    const simA = await db.sim.create({
      data: { legacyId, firstName: 'A', lastName: 'X', gender: 'FEMALE', lifeStage: 'YOUNG_ADULT', generationNumber: 3, isHeir: true },
    })
    const simB = await db.sim.create({
      data: { legacyId, firstName: 'B', lastName: 'X', gender: 'MALE', lifeStage: 'YOUNG_ADULT', generationNumber: 3 },
    })
    await authedCaller(userId).sims.update({ id: simB.id, isHeir: true })
    const heirs = await db.sim.findMany({
      where: { legacyId, generationNumber: 3, isHeir: true },
    })
    expect(heirs).toHaveLength(1)
    expect(heirs[0].id).toBe(simB.id)
    const recordA = await db.sim.findUnique({ where: { id: simA.id } })
    expect(recordA?.isHeir).toBe(false)
  })

  it('updating only firstName does not call recomputeLegacyTrackers path (update succeeds without error)', async () => {
    const sim = await createTestSim(legacyId)
    // This test verifies the firstName-only update path does not trigger recompute.
    // If recompute were triggered with broken data it would throw; here it should succeed silently.
    await authedCaller(userId).sims.update({ id: sim.id, firstName: 'Renamed' })
    const record = await db.sim.findUnique({ where: { id: sim.id } })
    expect(record?.firstName).toBe('Renamed')
  })
})

describe('recomputeLegacyTrackers — triggered by sim mutations', () => {
  let userId: string
  let legacyId: string

  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
    const legacy = await createTestLegacy(userId)
    legacyId = legacy.id
  })

  afterEach(async () => { await cleanupUser(userId) })

  it('stamps completedAt on Skill Maxed tracker when skill is maxed via addSkill', async () => {
    const skill = await db.skill.findFirst()
    if (!skill) return
    const trackerType = await db.trackerType.findFirst({ where: { name: 'Skill Maxed' } })
    if (!trackerType) return

    const challenge = await createTestChallenge(userId)
    const phase = await createTestChallengePhase(challenge.id, { generationNumber: 1 })
    await db.trackerDefinition.create({
      data: { challengePhaseId: phase.id, trackerTypeId: trackerType.id, name: 'Max Skill', config: { skillId: skill.id } },
    })
    const run = await createTestChallengeRun(legacyId, { sourceChallengeId: challenge.id })
    const runPhase = await db.challengeRunPhase.create({ data: { challengeRunId: run.id, generationNumber: 1, sortOrder: 0 } })
    const runTracker = await db.challengeRunTracker.create({
      data: { challengeRunPhaseId: runPhase.id, trackerTypeId: trackerType.id, name: 'Max Skill', config: { skillId: skill.id }, sortOrder: 0 },
    })
    await db.trackerProgress.create({ data: { challengeRunTrackerId: runTracker.id, isManual: false } })

    const sim = await createTestSim(legacyId)
    await db.sim.update({ where: { id: sim.id }, data: { generationNumber: 1 } })

    await authedCaller(userId).sims.addSkill({ simId: sim.id, skillId: skill.id, level: skill.maxLevel })

    const progress = await db.trackerProgress.findUnique({ where: { challengeRunTrackerId: runTracker.id } })
    expect(progress?.completedAt).not.toBeNull()
  })
})

describe('sims.create — parentIds validation', () => {
  let userId: string
  let legacyId: string

  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
    const legacy = await createTestLegacy(userId)
    legacyId = legacy.id
  })
  afterEach(async () => { await cleanupUser(userId) })

  it('throws BAD_REQUEST when a parentId does not belong to this legacy', async () => {
    const other = await createTestUser()
    const otherLegacy = await createTestLegacy(other.id)
    const foreignSim = await createTestSim(otherLegacy.id)
    await db.sim.update({ where: { id: foreignSim.id }, data: { generationNumber: 1 } })
    try {
      await expect(
        authedCaller(userId).sims.create({
          legacyId,
          firstName: 'Child',
          lastName: 'Smith',
          gender: Gender.FEMALE,
          parentIds: [foreignSim.id],
        })
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    } finally {
      await cleanupUser(other.id)
    }
  })

  it('persists FamilyRelationship rows with type BIOLOGICAL when parentIds are provided', async () => {
    const parent = await createTestSim(legacyId, { firstName: 'Parent' })
    await db.sim.update({ where: { id: parent.id }, data: { generationNumber: 1 } })
    const result = await authedCaller(userId).sims.create({
      legacyId,
      firstName: 'Child',
      lastName: 'Smith',
      gender: Gender.FEMALE,
      parentIds: [parent.id],
    })
    const relationships = await db.familyRelationship.findMany({
      where: { childId: result.id },
    })
    expect(relationships).toHaveLength(1)
    expect(relationships[0].parentId).toBe(parent.id)
    expect(relationships[0].type).toBe('BIOLOGICAL')
  })

  it('persists FamilyRelationship rows for multiple parents', async () => {
    const parent1 = await createTestSim(legacyId, { firstName: 'Parent1' })
    const parent2 = await createTestSim(legacyId, { firstName: 'Parent2' })
    await db.sim.update({ where: { id: parent1.id }, data: { generationNumber: 1 } })
    await db.sim.update({ where: { id: parent2.id }, data: { generationNumber: 1 } })
    const result = await authedCaller(userId).sims.create({
      legacyId,
      firstName: 'Child',
      lastName: 'Smith',
      gender: Gender.FEMALE,
      parentIds: [parent1.id, parent2.id],
    })
    const relationships = await db.familyRelationship.findMany({
      where: { childId: result.id },
      orderBy: { parentId: 'asc' },
    })
    expect(relationships).toHaveLength(2)
    expect(relationships.every((r) => r.type === 'BIOLOGICAL')).toBe(true)
  })
})

describe('sims.completeAspiration', () => {
  let userId: string
  let legacyId: string
  let simId: string

  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
    const legacy = await createTestLegacy(userId)
    legacyId = legacy.id
    const sim = await createTestSim(legacyId)
    simId = sim.id
  })

  afterEach(async () => {
    await cleanupUser(userId)
  })

  it('sets completedAt on the SimAspiration record', async () => {
    const aspiration = await db.aspiration.findFirst()
    if (!aspiration) return
    await db.simAspiration.create({ data: { simId, aspirationId: aspiration.id } })

    await authedCaller(userId).sims.completeAspiration({ simId, aspirationId: aspiration.id })

    const record = await db.simAspiration.findUnique({
      where: { simId_aspirationId: { simId, aspirationId: aspiration.id } },
    })
    expect(record?.completedAt).not.toBeNull()
  })

  it('returns NOT_FOUND when sim does not belong to the user', async () => {
    const other = await createTestUser()
    const otherLegacy = await createTestLegacy(other.id)
    const otherSim = await createTestSim(otherLegacy.id)
    const aspiration = await db.aspiration.findFirst()
    if (!aspiration) return
    await db.simAspiration.create({ data: { simId: otherSim.id, aspirationId: aspiration.id } })
    try {
      await expect(
        authedCaller(userId).sims.completeAspiration({ simId: otherSim.id, aspirationId: aspiration.id })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    } finally {
      await cleanupUser(other.id)
    }
  })

  it('returns NOT_FOUND when aspiration is not on the sim', async () => {
    const aspiration = await db.aspiration.findFirst()
    if (!aspiration) return
    // no SimAspiration row created — aspiration not on sim
    await expect(
      authedCaller(userId).sims.completeAspiration({ simId, aspirationId: aspiration.id })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('returns BAD_REQUEST when aspiration is already completed', async () => {
    const aspiration = await db.aspiration.findFirst()
    if (!aspiration) return
    await db.simAspiration.create({ data: { simId, aspirationId: aspiration.id, completedAt: new Date() } })

    await expect(
      authedCaller(userId).sims.completeAspiration({ simId, aspirationId: aspiration.id })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })
})

describe('sims.endCareer', () => {
  let userId: string
  let legacyId: string
  let simId: string

  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
    const legacy = await createTestLegacy(userId)
    legacyId = legacy.id
    const sim = await createTestSim(legacyId)
    simId = sim.id
  })

  afterEach(async () => {
    await cleanupUser(userId)
  })

  it('sets endedAt on the active SimCareer record', async () => {
    const career = await db.career.findFirst()
    if (!career) return
    await db.simCareer.create({
      data: { simId, careerId: career.id, employmentType: 'EMPLOYED', startedAt: new Date() },
    })

    await authedCaller(userId).sims.endCareer({ simId })

    const record = await db.simCareer.findFirst({ where: { simId } })
    expect(record?.endedAt).not.toBeNull()
  })

  it('returns NOT_FOUND when sim does not belong to the user', async () => {
    const other = await createTestUser()
    const otherLegacy = await createTestLegacy(other.id)
    const otherSim = await createTestSim(otherLegacy.id)
    try {
      await expect(
        authedCaller(userId).sims.endCareer({ simId: otherSim.id })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    } finally {
      await cleanupUser(other.id)
    }
  })

  it('returns NOT_FOUND when there is no active career', async () => {
    // No SimCareer row created — no active career to end
    await expect(
      authedCaller(userId).sims.endCareer({ simId })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})

describe('sims — isHeir with null generationNumber', () => {
  let userId: string
  let legacyId: string

  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
    const legacy = await createTestLegacy(userId)
    legacyId = legacy.id
  })
  afterEach(async () => { await cleanupUser(userId) })

  it('does not clear other null-gen sims when setting isHeir on a null-gen sim', async () => {
    const simA = await db.sim.create({
      data: { legacyId, firstName: 'A', lastName: 'X', gender: 'FEMALE', lifeStage: 'YOUNG_ADULT', generationNumber: null, isHeir: true },
    })
    const simB = await db.sim.create({
      data: { legacyId, firstName: 'B', lastName: 'X', gender: 'MALE', lifeStage: 'YOUNG_ADULT', generationNumber: null },
    })
    await authedCaller(userId).sims.update({ id: simB.id, isHeir: true })
    const recordA = await db.sim.findUnique({ where: { id: simA.id } })
    expect(recordA?.isHeir).toBe(true)
  })
})

describe('sims.getTreeData', () => {
  let userId: string
  let legacyId: string
  let legacySlug: string

  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
    const legacy = await createTestLegacy(userId)
    legacyId = legacy.id
    legacySlug = legacy.slug
  })

  afterEach(async () => {
    await cleanupUser(userId)
  })

  it('returns all sims in the legacy', async () => {
    const caller = authedCaller(userId)
    const s1 = await createTestSim(legacyId, { firstName: 'Mortimer' })
    const s2 = await createTestSim(legacyId, { firstName: 'Bella' })
    const result = await caller.sims.getTreeData({ legacySlug })
    expect(result.sims.map((s) => s.id)).toEqual(expect.arrayContaining([s1.id, s2.id]))
  })

  it('returns biological and adoptive family edges but not step edges', async () => {
    const caller = authedCaller(userId)
    const parent = await createTestSim(legacyId, { firstName: 'Parent' })
    const bioChild = await createTestSim(legacyId, { firstName: 'BioChild' })
    const adoptedChild = await createTestSim(legacyId, { firstName: 'AdoptedChild' })
    const stepChild = await createTestSim(legacyId, { firstName: 'StepChild' })
    await db.familyRelationship.create({
      data: { parentId: parent.id, childId: bioChild.id, type: FamilyRelationshipType.BIOLOGICAL },
    })
    await db.familyRelationship.create({
      data: { parentId: parent.id, childId: adoptedChild.id, type: FamilyRelationshipType.ADOPTIVE },
    })
    await db.familyRelationship.create({
      data: { parentId: parent.id, childId: stepChild.id, type: FamilyRelationshipType.STEP },
    })
    const result = await caller.sims.getTreeData({ legacySlug })
    expect(result.familyEdges).toContainEqual({ parentId: parent.id, childId: bioChild.id })
    expect(result.familyEdges).toContainEqual({ parentId: parent.id, childId: adoptedChild.id })
    expect(result.familyEdges).not.toContainEqual({ parentId: parent.id, childId: stepChild.id })
  })

  it('returns partner edges for non-NONE romantic relationships', async () => {
    const caller = authedCaller(userId)
    const simA = await createTestSim(legacyId, { firstName: 'SimA' })
    const simB = await createTestSim(legacyId, { firstName: 'SimB' })
    const simC = await createTestSim(legacyId, { firstName: 'SimC' })
    const [idA, idB] = [simA.id, simB.id].sort()
    const [idA2, idC] = [simA.id, simC.id].sort()
    await db.socialRelationship.create({
      data: {
        simAId: idA,
        simBId: idB,
        romanticStatus: RomanticStatus.MARRIED,
        friendshipScore: 0,
        romanceScore: 0,
      },
    })
    await db.socialRelationship.create({
      data: {
        simAId: idA2,
        simBId: idC,
        romanticStatus: RomanticStatus.NONE,
        friendshipScore: 50,
        romanceScore: 0,
      },
    })
    const result = await caller.sims.getTreeData({ legacySlug })
    expect(result.partnerEdges).toContainEqual({ simAId: idA, simBId: idB })
    expect(result.partnerEdges).not.toContainEqual({ simAId: idA2, simBId: idC })
  })

  it('throws NOT_FOUND for a legacy that does not belong to the user', async () => {
    const otherUser = await createTestUser()
    const otherLegacy = await createTestLegacy(otherUser.id)
    const caller = authedCaller(userId)
    await expect(
      caller.sims.getTreeData({ legacySlug: otherLegacy.slug }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await cleanupUser(otherUser.id)
  })

  it('throws UNAUTHORIZED without a session', async () => {
    const caller = unauthCaller()
    await expect(
      caller.sims.getTreeData({ legacySlug }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('returns empty arrays for a legacy with no sims', async () => {
    const caller = authedCaller(userId)
    const result = await caller.sims.getTreeData({ legacySlug })
    expect(result).toEqual({ sims: [], familyEdges: [], partnerEdges: [] })
  })

  it('does not return partner edges that cross legacy boundaries', async () => {
    // Two users, each with their own legacy and a MARRIED pair
    const userA = await createTestUser()
    const userB = await createTestUser()
    try {
      const legacyA = await createTestLegacy(userA.id)
      const legacyB = await createTestLegacy(userB.id)
      const simA1 = await createTestSim(legacyA.id, { firstName: 'A1' })
      const simA2 = await createTestSim(legacyA.id, { firstName: 'A2' })
      const simB1 = await createTestSim(legacyB.id, { firstName: 'B1' })
      const simB2 = await createTestSim(legacyB.id, { firstName: 'B2' })

      // Legitimate edges within each legacy
      const [a1, a2] = [simA1.id, simA2.id].sort()
      await db.socialRelationship.create({
        data: { simAId: a1, simBId: a2, romanticStatus: RomanticStatus.MARRIED, friendshipScore: 0, romanceScore: 0 },
      })
      const [b1, b2] = [simB1.id, simB2.id].sort()
      await db.socialRelationship.create({
        data: { simAId: b1, simBId: b2, romanticStatus: RomanticStatus.MARRIED, friendshipScore: 0, romanceScore: 0 },
      })

      const callerA = authedCaller(userA.id)
      const result = await callerA.sims.getTreeData({ legacySlug: legacyA.slug })
      const edgeIds = result.partnerEdges.flatMap((e) => [e.simAId, e.simBId])
      expect(edgeIds).not.toContain(simB1.id)
      expect(edgeIds).not.toContain(simB2.id)
    } finally {
      await cleanupUser(userA.id)
      await cleanupUser(userB.id)
    }
  })
})

describe('sims.getMiniTreeData', () => {
  let userId: string
  let legacyId: string

  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
    const legacy = await createTestLegacy(userId)
    legacyId = legacy.id
  })

  afterEach(async () => {
    await cleanupUser(userId)
  })

  it('includes the focused sim, their parents, and grandparents', async () => {
    const caller = authedCaller(userId)
    const grandparent = await createTestSim(legacyId, { firstName: 'Grandparent' })
    const parent = await createTestSim(legacyId, { firstName: 'Parent' })
    const child = await createTestSim(legacyId, { firstName: 'Child' })
    await db.familyRelationship.createMany({
      data: [
        { parentId: grandparent.id, childId: parent.id, type: FamilyRelationshipType.BIOLOGICAL },
        { parentId: parent.id, childId: child.id, type: FamilyRelationshipType.BIOLOGICAL },
      ],
    })
    const result = await caller.sims.getMiniTreeData({ simId: child.id })
    const ids = result.sims.map((s) => s.id)
    expect(ids).toContain(child.id)
    expect(ids).toContain(parent.id)
    expect(ids).toContain(grandparent.id)
  })

  it("includes the focused sim's children", async () => {
    const caller = authedCaller(userId)
    const parent = await createTestSim(legacyId, { firstName: 'Parent' })
    const child = await createTestSim(legacyId, { firstName: 'Child' })
    await db.familyRelationship.create({
      data: { parentId: parent.id, childId: child.id, type: FamilyRelationshipType.BIOLOGICAL },
    })
    const result = await caller.sims.getMiniTreeData({ simId: parent.id })
    expect(result.sims.map((s) => s.id)).toContain(child.id)
  })

  it('excludes step-parent edges', async () => {
    const caller = authedCaller(userId)
    const parent = await createTestSim(legacyId, { firstName: 'Parent' })
    const child = await createTestSim(legacyId, { firstName: 'Child' })
    await db.familyRelationship.create({
      data: { parentId: parent.id, childId: child.id, type: FamilyRelationshipType.STEP },
    })
    const result = await caller.sims.getMiniTreeData({ simId: child.id })
    expect(result.familyEdges).not.toContainEqual({ parentId: parent.id, childId: child.id })
  })

  it("includes the focused sim's partner in sims and partnerEdges", async () => {
    const caller = authedCaller(userId)
    const focused = await createTestSim(legacyId, { firstName: 'Focused' })
    const partner = await createTestSim(legacyId, { firstName: 'Partner' })
    const [idA, idB] = [focused.id, partner.id].sort()
    await db.socialRelationship.create({
      data: {
        simAId: idA,
        simBId: idB,
        romanticStatus: RomanticStatus.MARRIED,
        friendshipScore: 0,
        romanceScore: 0,
      },
    })
    const result = await caller.sims.getMiniTreeData({ simId: focused.id })
    const ids = result.sims.map((s) => s.id)
    expect(ids).toContain(focused.id)
    expect(ids).toContain(partner.id)
    expect(result.partnerEdges).toContainEqual({ simAId: idA, simBId: idB })
  })

  it('throws NOT_FOUND for a sim that does not belong to the user', async () => {
    const otherUser = await createTestUser()
    const otherLegacy = await createTestLegacy(otherUser.id)
    const otherSim = await createTestSim(otherLegacy.id)
    const caller = authedCaller(userId)
    await expect(caller.sims.getMiniTreeData({ simId: otherSim.id })).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await cleanupUser(otherUser.id)
  })

  it('throws UNAUTHORIZED without a session', async () => {
    const sim = await createTestSim(legacyId, { firstName: 'Focused' })
    const caller = unauthCaller()
    await expect(caller.sims.getMiniTreeData({ simId: sim.id })).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('includes an ADOPTIVE parent in sims and familyEdges', async () => {
    const caller = authedCaller(userId)
    const parent = await createTestSim(legacyId, { firstName: 'AdoptiveParent' })
    const child = await createTestSim(legacyId, { firstName: 'AdoptedChild' })
    await db.familyRelationship.create({
      data: { parentId: parent.id, childId: child.id, type: FamilyRelationshipType.ADOPTIVE },
    })
    const result = await caller.sims.getMiniTreeData({ simId: child.id })
    expect(result.sims.map((s) => s.id)).toContain(parent.id)
    expect(result.familyEdges).toContainEqual({ parentId: parent.id, childId: child.id })
  })

  it('does not include the great-grandparent (4-generation chain)', async () => {
    const caller = authedCaller(userId)
    const greatGrandparent = await createTestSim(legacyId, { firstName: 'GreatGrandparent' })
    const grandparent = await createTestSim(legacyId, { firstName: 'Grandparent' })
    const parent = await createTestSim(legacyId, { firstName: 'Parent' })
    const child = await createTestSim(legacyId, { firstName: 'Child' })
    await db.familyRelationship.createMany({
      data: [
        { parentId: greatGrandparent.id, childId: grandparent.id, type: FamilyRelationshipType.BIOLOGICAL },
        { parentId: grandparent.id, childId: parent.id, type: FamilyRelationshipType.BIOLOGICAL },
        { parentId: parent.id, childId: child.id, type: FamilyRelationshipType.BIOLOGICAL },
      ],
    })
    const result = await caller.sims.getMiniTreeData({ simId: child.id })
    const ids = result.sims.map((s) => s.id)
    expect(ids).toContain(child.id)
    expect(ids).toContain(parent.id)
    expect(ids).toContain(grandparent.id)
    expect(ids).not.toContain(greatGrandparent.id)
  })

  it('includes EX_PARTNER in partnerEdges', async () => {
    const caller = authedCaller(userId)
    const focused = await createTestSim(legacyId, { firstName: 'Focused' })
    const exPartner = await createTestSim(legacyId, { firstName: 'ExPartner' })
    const [idA, idB] = [focused.id, exPartner.id].sort()
    await db.socialRelationship.create({
      data: {
        simAId: idA,
        simBId: idB,
        romanticStatus: RomanticStatus.EX_PARTNER,
        friendshipScore: 0,
        romanceScore: 0,
      },
    })
    const result = await caller.sims.getMiniTreeData({ simId: focused.id })
    expect(result.partnerEdges).toContainEqual({ simAId: idA, simBId: idB })
    expect(result.sims.map((s) => s.id)).toContain(exPartner.id)
  })

  it('does not include a partner sim from another legacy in the backfill', async () => {
    // After the backfill fix, missingPartnerIds are scoped to the user's own legacies only.
    // We manufacture the scenario by directly creating a cross-legacy social relationship
    // between a sim in our legacy (simA) and a sim in another user's legacy (simB).
    // The backfill query must not return simB.
    const otherUser = await createTestUser()
    try {
      const otherLegacy = await createTestLegacy(otherUser.id)
      const ourSim = await createTestSim(legacyId, { firstName: 'OurSim' })
      const theirSim = await createTestSim(otherLegacy.id, { firstName: 'TheirSim' })

      // Force-insert a cross-legacy social relationship directly (bypassing the tRPC guard)
      const [idA, idB] = [ourSim.id, theirSim.id].sort()
      await db.socialRelationship.create({
        data: {
          simAId: idA,
          simBId: idB,
          romanticStatus: RomanticStatus.MARRIED,
          friendshipScore: 0,
          romanceScore: 0,
        },
      })

      const result = await authedCaller(userId).sims.getMiniTreeData({ simId: ourSim.id })
      expect(result.sims.map((s) => s.id)).not.toContain(theirSim.id)
    } finally {
      await cleanupUser(otherUser.id)
    }
  })
})
