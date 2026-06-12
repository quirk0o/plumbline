import { describe, expect } from 'vitest'
import { Gender, FamilyRelationshipType, RomanticStatus, LifeStage } from '@prisma/client'
import { authedCaller, unauthCaller } from '@/test/caller'
import { deriveRomanticState } from '@/lib/romantic-status'
import { computeKinshipLabels } from '@/components/lineage-tree/kinship'
import {
  createTestUser,
  cleanupUser,
  createTestLegacy,
  createTestSim,
  createTestHousehold,
  getAnyTrait,
  getConflictingTraits,
  getAnySkill,
  getAnyAspiration,
  getAnyCareer,
  getTrackerTypeByName,
  getPersonalityTraits,
  createTestPersonalityTrait,
  createTestChallenge,
  createTestChallengePhase,
  createTestChallengeRun,
} from '@/test/helpers'
import { test, test as base } from '@/test/test'
import { db } from '@/server/db'

/**
 * A caller-injectable db client whose given model operation always throws —
 * for asserting transactional rollback. Query extensions apply inside
 * interactive transactions too, so the fault fires within $transaction.
 */
function failingDb(model: string, operation: string): typeof db {
  // The computed keys defeat $extends's mapped-type inference (it expects
  // literal model/operation names), so the argument is cast once here; the
  // call sites stay cast-free.
  const extension = {
    query: {
      [model]: {
        [operation]() {
          throw new Error(`injected failure: ${model}.${operation}`)
        },
      },
    },
  }
  return db.$extends(extension as never) as unknown as typeof db
}

describe('sims.create', () => {
  test('creates a Sim in the database and returns it', async ({ trpcCaller, legacyId }) => {
    const result = await trpcCaller.sims.create({
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

  test('creates SimPersonalityTrait junction rows when traits are provided', async ({ trpcCaller, legacyId }) => {
    const trait = await getAnyTrait()
    const result = await trpcCaller.sims.create({
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

  test('throws BAD_REQUEST when two conflicting traits are provided', async ({ trpcCaller, legacyId }) => {
    const { traitA, traitB } = await getConflictingTraits()
    await expect(
      trpcCaller.sims.create({
        legacyId,
        firstName: 'A',
        lastName: 'B',
        gender: Gender.MALE,
        personalityTraitIds: [traitA.id, traitB.id],
      })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  test('throws NOT_FOUND when the legacy belongs to a different user', async ({ trpcCaller }) => {
    const otherUser = await createTestUser()
    try {
      const otherLegacy = await createTestLegacy(otherUser.id)
      await expect(
        trpcCaller.sims.create({
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

  test('throws NOT_FOUND for a non-existent legacyId', async ({ trpcCaller }) => {
    await expect(
      trpcCaller.sims.create({
        legacyId: 'clnonexistentlegacyid000000',
        firstName: 'A',
        lastName: 'B',
        gender: Gender.MALE,
      })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  test('throws UNAUTHORIZED without a session', async ({ legacyId }) => {
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

  test('designates the first parentless sim as the founder (generation 1)', async ({ trpcCaller, legacyId }) => {
    const founder = await trpcCaller.sims.create({
      legacyId,
      firstName: 'Dina',
      lastName: 'Caliente',
      gender: Gender.FEMALE,
    })

    const legacy = await db.legacy.findUnique({ where: { id: legacyId } })
    expect(legacy?.founderSimId).toBe(founder.id)
    const record = await db.sim.findUnique({ where: { id: founder.id } })
    expect(record?.generationNumber).toBe(1)
  })

  test('does not change the founder once one exists', async ({ trpcCaller, legacyId }) => {
    const first = await trpcCaller.sims.create({
      legacyId,
      firstName: 'Dina',
      lastName: 'Caliente',
      gender: Gender.FEMALE,
    })
    const second = await trpcCaller.sims.create({
      legacyId,
      firstName: 'Nina',
      lastName: 'Caliente',
      gender: Gender.FEMALE,
    })

    const legacy = await db.legacy.findUnique({ where: { id: legacyId } })
    expect(legacy?.founderSimId).toBe(first.id)
    expect(legacy?.founderSimId).not.toBe(second.id)
  })

  test('does not auto-designate a sim with parents as the founder', async ({ trpcCaller, legacyId }) => {
    // Seed a parent directly (not via the create mutation) so the legacy still
    // has no founder when the child is created.
    const parent = await createTestSim(legacyId)
    await db.sim.update({
      where: { id: parent.id },
      data: { generationNumber: 1 },
    })

    const child = await trpcCaller.sims.create({
      legacyId,
      firstName: 'Cassandra',
      lastName: 'Goth',
      gender: Gender.FEMALE,
      parentIds: [parent.id],
    })

    const legacy = await db.legacy.findUnique({ where: { id: legacyId } })
    expect(legacy?.founderSimId).toBeNull()
    const record = await db.sim.findUnique({ where: { id: child.id } })
    expect(record?.generationNumber).toBe(2)
  })

  test('creates the sim unhoused when no householdId is given', async ({ trpcCaller, legacyId }) => {
    const result = await trpcCaller.sims.create({
      legacyId,
      firstName: 'Free',
      lastName: 'Spirit',
      gender: Gender.FEMALE,
    })
    const record = await db.sim.findUnique({ where: { id: result.id } })
    expect(record!.householdId).toBeNull()
    expect(await db.household.count({ where: { legacyId } })).toBe(0)
  })

  test('assigns the sim to the given household', async ({ trpcCaller, legacyId }) => {
    const household = await createTestHousehold(legacyId)
    const result = await trpcCaller.sims.create({
      legacyId,
      firstName: 'Housed',
      lastName: 'Sim',
      gender: Gender.MALE,
      householdId: household.id,
    })
    expect((await db.sim.findUnique({ where: { id: result.id } }))!.householdId).toBe(household.id)
  })

  test("rejects a householdId from another legacy", async ({ trpcCaller, userId, legacyId }) => {
    const otherLegacy = await createTestLegacy(userId, { slug: `other-${Date.now()}` })
    const foreignHousehold = await createTestHousehold(otherLegacy.id)
    await expect(
      trpcCaller.sims.create({
        legacyId,
        firstName: 'X',
        lastName: 'Y',
        gender: Gender.MALE,
        householdId: foreignHousehold.id,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })
})

describe('sims.create — atomicity', () => {
  test('does not persist the sim when the family relationship write fails', async ({ userId, legacyId }) => {
    const parent = await createTestSim(legacyId, { firstName: 'Parent' })
    await db.sim.update({ where: { id: parent.id }, data: { generationNumber: 1 } })
    await expect(
      authedCaller(userId, failingDb('familyRelationship', 'createMany')).sims.create({
        legacyId,
        firstName: 'Orphaned',
        lastName: 'Child',
        gender: Gender.FEMALE,
        parentIds: [parent.id],
      })
    ).rejects.toThrow()

    const orphan = await db.sim.findFirst({ where: { legacyId, firstName: 'Orphaned' } })
    expect(orphan).toBeNull()
  })

  test('does not persist the sim when founder designation fails', async ({ userId, legacyId }) => {
    await expect(
      authedCaller(userId, failingDb('legacy', 'updateMany')).sims.create({
        legacyId,
        firstName: 'Undesignated',
        lastName: 'Founder',
        gender: Gender.MALE,
      })
    ).rejects.toThrow()

    expect(await db.sim.count({ where: { legacyId } })).toBe(0)
    const legacy = await db.legacy.findUnique({ where: { id: legacyId } })
    expect(legacy?.founderSimId).toBeNull()
  })

  test('does not overwrite a founder designated concurrently mid-create', async ({ userId, legacyId }) => {
    // Simulate the race: a rival founder is committed (separate connection)
    // between the pre-transaction founder check and the founder write.
    let rivalId: string | undefined
    const racingDb = db.$extends({
      query: {
        sim: {
          async create({ args, query }) {
            const rival = await db.sim.create({
              data: {
                legacyId,
                firstName: 'Rival',
                lastName: 'Founder',
                gender: Gender.FEMALE,
                lifeStage: LifeStage.YOUNG_ADULT,
                generationNumber: 1,
              },
            })
            rivalId = rival.id
            await db.legacy.update({ where: { id: legacyId }, data: { founderSimId: rival.id } })
            return query(args)
          },
        },
      },
    }) as unknown as typeof db

    await expect(
      authedCaller(userId, racingDb).sims.create({
        legacyId,
        firstName: 'Latecomer',
        lastName: 'Founder',
        gender: Gender.MALE,
      })
    ).rejects.toThrow()

    const legacy = await db.legacy.findUnique({ where: { id: legacyId } })
    expect(legacy?.founderSimId).toBe(rivalId)
    expect(await db.sim.count({ where: { legacyId, firstName: 'Latecomer' } })).toBe(0)
  })
})

describe('sims.getById', () => {
  test('returns the sim with nested relations for the owner', async ({ trpcCaller, legacyId }) => {
    const sim = await createTestSim(legacyId)
    const result = await trpcCaller.sims.getById({ id: sim.id })
    expect(result.id).toBe(sim.id)
    expect(result.personalityTraits).toEqual([])
    expect(result.skills).toEqual([])
  })

  test('throws NOT_FOUND when the sim belongs to a different user', async ({ legacyId }) => {
    const sim = await createTestSim(legacyId)
    const other = await createTestUser()
    try {
      await expect(
        authedCaller(other.id).sims.getById({ id: sim.id })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    } finally {
      await cleanupUser(other.id)
    }
  })
})

describe('sims.listByLegacy', () => {
  test('returns all sims in the legacy', async ({ trpcCaller, legacyId }) => {
    await createTestSim(legacyId, { firstName: 'Alice' })
    await createTestSim(legacyId, { firstName: 'Bob' })
    const result = await trpcCaller.sims.listByLegacy({ legacyId })
    expect(result.map((s) => s.firstName).sort()).toEqual(['Alice', 'Bob'])
    for (const sim of result) {
      expect(sim.imageUrl).toBeNull()
    }
  })

  test('throws NOT_FOUND for a legacy belonging to another user', async ({ legacyId }) => {
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
  test('updates scalar fields', async ({ trpcCaller, legacyId }) => {
    const sim = await createTestSim(legacyId)
    await trpcCaller.sims.update({ id: sim.id, firstName: 'Nova', lifeStage: 'ELDER' })
    const record = await db.sim.findUnique({ where: { id: sim.id } })
    expect(record?.firstName).toBe('Nova')
    expect(record?.lifeStage).toBe('ELDER')
  })

  test('sets cause of death', async ({ trpcCaller, legacyId }) => {
    const sim = await createTestSim(legacyId)
    await trpcCaller.sims.update({ id: sim.id, causeOfDeath: 'OLD_AGE' })
    const record = await db.sim.findUnique({ where: { id: sim.id } })
    expect(record?.causeOfDeath).toBe('OLD_AGE')
  })

  test('swaps aspiration', async ({ trpcCaller, legacyId }) => {
    const sim = await createTestSim(legacyId)
    const aspiration = await getAnyAspiration()
    await trpcCaller.sims.update({ id: sim.id, aspirationId: aspiration.id })
    const rows = await db.simAspiration.findMany({ where: { simId: sim.id, completedAt: null } })
    expect(rows).toHaveLength(1)
    expect(rows[0].aspirationId).toBe(aspiration.id)
  })

  test("throws NOT_FOUND for another user's sim", async ({ legacyId }) => {
    const sim = await createTestSim(legacyId)
    const other = await createTestUser()
    try {
      await expect(
        authedCaller(other.id).sims.update({ id: sim.id, firstName: 'Hacker' })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    } finally {
      await cleanupUser(other.id)
    }
  })

  test('keeps the active aspiration when swapping to an invalid aspiration fails', async ({ trpcCaller, legacyId }) => {
    const sim = await createTestSim(legacyId)
    const aspiration = await getAnyAspiration()
    await db.simAspiration.create({ data: { simId: sim.id, aspirationId: aspiration.id } })

    await expect(
      trpcCaller.sims.update({ id: sim.id, aspirationId: 'clnonexistentaspiration0000' })
    ).rejects.toThrow()

    const rows = await db.simAspiration.findMany({ where: { simId: sim.id, completedAt: null } })
    expect(rows).toHaveLength(1)
    expect(rows[0].aspirationId).toBe(aspiration.id)
  })

  test('keeps the active career when swapping to an invalid career fails', async ({ trpcCaller, legacyId }) => {
    const sim = await createTestSim(legacyId)
    const career = await getAnyCareer()
    await db.simCareer.create({
      data: { simId: sim.id, careerId: career.id, employmentType: 'EMPLOYED', startedAt: new Date() },
    })

    await expect(
      trpcCaller.sims.update({ id: sim.id, careerId: 'clnonexistentcareer00000000' })
    ).rejects.toThrow()

    const rows = await db.simCareer.findMany({ where: { simId: sim.id, endedAt: null } })
    expect(rows).toHaveLength(1)
    expect(rows[0].careerId).toBe(career.id)
  })

  test('clears a displaced heir on cascade instead of violating the one-heir-per-generation constraint', async ({ trpcCaller, legacyId }) => {
    const root = await createTestSim(legacyId, { firstName: 'Root', generationNumber: 1 })
    const child = await createTestSim(legacyId, { firstName: 'Child', generationNumber: 2 })
    await db.familyRelationship.create({ data: { parentId: root.id, childId: child.id, type: FamilyRelationshipType.BIOLOGICAL } })
    await db.sim.update({ where: { id: child.id }, data: { isHeir: true } })
    const incumbent = await createTestSim(legacyId, { firstName: 'Incumbent', generationNumber: 3 })
    await db.sim.update({ where: { id: incumbent.id }, data: { isHeir: true } })

    // Editing root 1 -> 2 cascades child 2 -> 3, colliding with the incumbent heir at gen 3.
    await trpcCaller.sims.update({ id: root.id, generationNumber: 2 })

    expect((await db.sim.findUnique({ where: { id: child.id } }))?.generationNumber).toBe(3)
    expect((await db.sim.findUnique({ where: { id: child.id } }))?.isHeir).toBe(false)        // displaced
    expect((await db.sim.findUnique({ where: { id: incumbent.id } }))?.isHeir).toBe(true)      // incumbent kept
  })

  test('moving an heir root into an occupied heir generation clears its heir flag instead of failing', async ({ trpcCaller, legacyId }) => {
    const root = await createTestSim(legacyId, { firstName: 'HeirRoot', generationNumber: 1 })
    await db.sim.update({ where: { id: root.id }, data: { isHeir: true } })
    const incumbent = await createTestSim(legacyId, { firstName: 'Incumbent', generationNumber: 3 })
    await db.sim.update({ where: { id: incumbent.id }, data: { isHeir: true } })

    // The root is an heir; moving it to gen 3 (already held by the incumbent heir)
    // must not violate the one-heir-per-generation index.
    await trpcCaller.sims.update({ id: root.id, generationNumber: 3 })

    const movedRoot = await db.sim.findUnique({ where: { id: root.id } })
    expect(movedRoot?.generationNumber).toBe(3)
    expect(movedRoot?.isHeir).toBe(false)                                                    // displaced
    expect((await db.sim.findUnique({ where: { id: incumbent.id } }))?.isHeir).toBe(true)      // incumbent kept
  })
})

describe('sims.addTrait / sims.removeTrait', () => {
  test('adds a trait', async ({ trpcCaller, legacyId }) => {
    const sim = await createTestSim(legacyId)
    const trait = await getAnyTrait()
    await trpcCaller.sims.addTrait({ simId: sim.id, traitId: trait.id })
    const rows = await db.simPersonalityTrait.findMany({ where: { simId: sim.id } })
    expect(rows).toHaveLength(1)
  })

  test('removes a trait', async ({ trpcCaller, legacyId }) => {
    const sim = await createTestSim(legacyId)
    const trait = await getAnyTrait()
    await db.simPersonalityTrait.create({ data: { simId: sim.id, personalityTraitId: trait.id } })
    await trpcCaller.sims.removeTrait({ simId: sim.id, traitId: trait.id })
    const rows = await db.simPersonalityTrait.findMany({ where: { simId: sim.id } })
    expect(rows).toHaveLength(0)
  })

  test('throws BAD_REQUEST when adding a conflicting trait', async ({ trpcCaller, legacyId }) => {
    const sim = await createTestSim(legacyId)
    const { traitA, traitB } = await getConflictingTraits()
    await db.simPersonalityTrait.create({ data: { simId: sim.id, personalityTraitId: traitA.id } })
    await expect(
      trpcCaller.sims.addTrait({ simId: sim.id, traitId: traitB.id })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  test('throws BAD_REQUEST when already at 6 traits', async ({ trpcCaller, legacyId }) => {
    const sim = await createTestSim(legacyId)
    const traits = await getPersonalityTraits(7)
    for (const t of traits.slice(0, 6)) {
      await db.simPersonalityTrait.create({ data: { simId: sim.id, personalityTraitId: t.id } })
    }
    await expect(
      trpcCaller.sims.addTrait({ simId: sim.id, traitId: traits[6].id })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  test('throws BAD_REQUEST when adding a trait not valid for the sim life stage', async ({ trpcCaller, legacyId }) => {
    const sim = await createTestSim(legacyId)
    const youngAdultTrait = await createTestPersonalityTrait({ minLifeStage: LifeStage.YOUNG_ADULT })
    await db.sim.update({ where: { id: sim.id }, data: { lifeStage: LifeStage.CHILD } })
    try {
      await expect(
        trpcCaller.sims.addTrait({ simId: sim.id, traitId: youngAdultTrait.id })
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    } finally {
      await db.personalityTrait.delete({ where: { id: youngAdultTrait.id } })
    }
  })
})

describe('sims.addSkill / sims.setSkillLevel / sims.removeSkill', () => {
  test('adds a skill at the given level', async ({ trpcCaller, legacyId }) => {
    const sim = await createTestSim(legacyId)
    const skill = await getAnySkill()
    await trpcCaller.sims.addSkill({ simId: sim.id, skillId: skill.id, level: 1 })
    const row = await db.simSkill.findUnique({ where: { simId_skillId: { simId: sim.id, skillId: skill.id } } })
    expect(row?.level).toBe(1)
  })

  test('throws BAD_REQUEST when level exceeds maxLevel', async ({ trpcCaller, legacyId }) => {
    const sim = await createTestSim(legacyId)
    const skill = await getAnySkill()
    await expect(
      trpcCaller.sims.addSkill({ simId: sim.id, skillId: skill.id, level: skill.maxLevel + 1 })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  test('updates skill level', async ({ trpcCaller, legacyId }) => {
    const sim = await createTestSim(legacyId)
    const skill = await getAnySkill()
    await db.simSkill.create({ data: { simId: sim.id, skillId: skill.id, level: 1 } })
    await trpcCaller.sims.setSkillLevel({ simId: sim.id, skillId: skill.id, level: 3 })
    const row = await db.simSkill.findUnique({ where: { simId_skillId: { simId: sim.id, skillId: skill.id } } })
    expect(row?.level).toBe(3)
  })

  test('removes a skill', async ({ trpcCaller, legacyId }) => {
    const sim = await createTestSim(legacyId)
    const skill = await getAnySkill()
    await db.simSkill.create({ data: { simId: sim.id, skillId: skill.id, level: 2 } })
    await trpcCaller.sims.removeSkill({ simId: sim.id, skillId: skill.id })
    const row = await db.simSkill.findUnique({ where: { simId_skillId: { simId: sim.id, skillId: skill.id } } })
    expect(row).toBeNull()
  })

  test("throws NOT_FOUND for another user's sim", async ({ legacyId }) => {
    const sim = await createTestSim(legacyId)
    const other = await createTestUser()
    try {
      const skill = await getAnySkill()
      await expect(
        authedCaller(other.id).sims.addSkill({ simId: sim.id, skillId: skill.id, level: 1 })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    } finally {
      await cleanupUser(other.id)
    }
  })
})

describe('sims.addFamilyRelationship / sims.removeFamilyRelationship', () => {
  test('creates a family relationship', async ({ trpcCaller, legacyId }) => {
    const parent = await createTestSim(legacyId, { firstName: 'Parent' })
    const child = await createTestSim(legacyId, { firstName: 'Child' })
    await trpcCaller.sims.addFamilyRelationship({
      parentId: parent.id,
      childId: child.id,
      type: FamilyRelationshipType.BIOLOGICAL,
    })
    const row = await db.familyRelationship.findUnique({
      where: { parentId_childId: { parentId: parent.id, childId: child.id } },
    })
    expect(row?.type).toBe(FamilyRelationshipType.BIOLOGICAL)
  })

  test('does not persist the relationship when the generation derivation write fails', async ({ userId, legacyId }) => {
    const parent = await createTestSim(legacyId, { firstName: 'Parent' })
    const child = await createTestSim(legacyId, { firstName: 'Child' })
    await db.sim.update({ where: { id: parent.id }, data: { generationNumber: 1 } })

    await expect(
      authedCaller(userId, failingDb('sim', 'update')).sims.addFamilyRelationship({
        parentId: parent.id,
        childId: child.id,
        type: FamilyRelationshipType.BIOLOGICAL,
      })
    ).rejects.toThrow()

    const row = await db.familyRelationship.findUnique({
      where: { parentId_childId: { parentId: parent.id, childId: child.id } },
    })
    expect(row).toBeNull()
  })

  test('keeps the relationship when the generation recompute write fails on removal', async ({ userId, legacyId }) => {
    const parent = await createTestSim(legacyId, { firstName: 'Parent' })
    const child = await createTestSim(legacyId, { firstName: 'Child' })
    const parent2 = await createTestSim(legacyId, { firstName: 'Parent2', generationNumber: 3 })
    await db.sim.update({ where: { id: parent.id }, data: { generationNumber: 2 } })
    await db.sim.update({ where: { id: child.id }, data: { generationNumber: 99 } })
    await db.familyRelationship.createMany({
      data: [
        { parentId: parent.id, childId: child.id, type: FamilyRelationshipType.BIOLOGICAL },
        { parentId: parent2.id, childId: child.id, type: FamilyRelationshipType.BIOLOGICAL },
      ],
    })
    // After removing parentId (gen=2), only parent2 (gen=3) remains.
    // recompute derives child=4 which differs from 99 → sim.update fires → injected failure rolls back.
    await expect(
      authedCaller(userId, failingDb('sim', 'update')).sims.removeFamilyRelationship({ parentId: parent.id, childId: child.id })
    ).rejects.toThrow()

    const row = await db.familyRelationship.findUnique({
      where: { parentId_childId: { parentId: parent.id, childId: child.id } },
    })
    expect(row).not.toBeNull()
    expect((await db.sim.findUnique({ where: { id: child.id } }))?.generationNumber).toBe(99)
  })

  test('removes a family relationship', async ({ trpcCaller, legacyId }) => {
    const parent = await createTestSim(legacyId, { firstName: 'Parent' })
    const child = await createTestSim(legacyId, { firstName: 'Child' })
    await db.familyRelationship.create({ data: { parentId: parent.id, childId: child.id, type: FamilyRelationshipType.BIOLOGICAL } })
    await trpcCaller.sims.removeFamilyRelationship({ parentId: parent.id, childId: child.id })
    const row = await db.familyRelationship.findUnique({
      where: { parentId_childId: { parentId: parent.id, childId: child.id } },
    })
    expect(row).toBeNull()
  })

  test('throws NOT_FOUND when parent belongs to another user', async ({ trpcCaller, legacyId }) => {
    const child = await createTestSim(legacyId, { firstName: 'Child' })
    const other = await createTestUser()
    const otherLegacy = await createTestLegacy(other.id)
    const otherSim = await createTestSim(otherLegacy.id)
    try {
      await expect(
        trpcCaller.sims.addFamilyRelationship({
          parentId: otherSim.id,
          childId: child.id,
          type: FamilyRelationshipType.BIOLOGICAL,
        })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    } finally {
      await cleanupUser(other.id)
    }
  })

  test('throws NOT_FOUND when child belongs to another user', async ({ trpcCaller, legacyId }) => {
    const parent = await createTestSim(legacyId, { firstName: 'Parent' })
    const child = await createTestSim(legacyId, { firstName: 'Child' })
    const other = await createTestUser()
    const otherLegacy = await createTestLegacy(other.id)
    const otherSim = await createTestSim(otherLegacy.id)
    try {
      await db.familyRelationship.create({ data: { parentId: parent.id, childId: child.id, type: FamilyRelationshipType.BIOLOGICAL } })
      await expect(
        trpcCaller.sims.removeFamilyRelationship({
          parentId: parent.id,
          childId: otherSim.id,
        })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    } finally {
      await cleanupUser(other.id)
    }
  })

  test('throws BAD_REQUEST when parentId equals childId', async ({ trpcCaller, legacyId }) => {
    const parent = await createTestSim(legacyId, { firstName: 'Parent' })
    await expect(
      trpcCaller.sims.addFamilyRelationship({
        parentId: parent.id,
        childId: parent.id,
        type: FamilyRelationshipType.BIOLOGICAL,
      })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  test('throws BAD_REQUEST when sims belong to different legacies', async ({ trpcCaller, userId, legacyId }) => {
    const parent = await createTestSim(legacyId, { firstName: 'Parent' })
    const secondLegacy = await createTestLegacy(userId)
    const secondLegacySim = await createTestSim(secondLegacy.id)
    await expect(
      trpcCaller.sims.addFamilyRelationship({
        parentId: parent.id,
        childId: secondLegacySim.id,
        type: FamilyRelationshipType.BIOLOGICAL,
      })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  test('throws NOT_FOUND when parent belongs to another user in removeFamilyRelationship', async ({ trpcCaller, legacyId }) => {
    const child = await createTestSim(legacyId, { firstName: 'Child' })
    const other = await createTestUser()
    const otherLegacy = await createTestLegacy(other.id)
    const otherSim = await createTestSim(otherLegacy.id)
    try {
      await expect(
        trpcCaller.sims.removeFamilyRelationship({
          parentId: otherSim.id,
          childId: child.id,
        })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    } finally {
      await cleanupUser(other.id)
    }
  })

  test('derives child generationNumber from parent when child has no generationNumber', async ({ trpcCaller, legacyId }) => {
    const parent = await createTestSim(legacyId, { firstName: 'Parent' })
    const child = await createTestSim(legacyId, { firstName: 'Child' })
    await db.sim.update({ where: { id: parent.id }, data: { generationNumber: 1 } })
    await trpcCaller.sims.addFamilyRelationship({
      parentId: parent.id,
      childId: child.id,
      type: FamilyRelationshipType.BIOLOGICAL,
    })
    const record = await db.sim.findUnique({ where: { id: child.id } })
    expect(record?.generationNumber).toBe(2)
  })

  test('overrides child generationNumber to max+1 when a parent is added', async ({ trpcCaller, legacyId }) => {
    const parent = await createTestSim(legacyId, { firstName: 'Parent' })
    const child = await createTestSim(legacyId, { firstName: 'Child' })
    await db.sim.update({ where: { id: parent.id }, data: { generationNumber: 1 } })
    await db.sim.update({ where: { id: child.id }, data: { generationNumber: 5 } })
    await trpcCaller.sims.addFamilyRelationship({
      parentId: parent.id, childId: child.id, type: FamilyRelationshipType.BIOLOGICAL,
    })
    const record = await db.sim.findUnique({ where: { id: child.id } })
    expect(record?.generationNumber).toBe(2) // derived: max(1)+1, prior value discarded
  })

  test('uses max parent gen and cascades to descendants when a parent is added', async ({ trpcCaller, legacyId }) => {
    const parent = await createTestSim(legacyId, { firstName: 'Parent' })
    const child = await createTestSim(legacyId, { firstName: 'Child' })
    const existingParent = await createTestSim(legacyId, { firstName: 'OtherParent', generationNumber: 3 })
    await db.sim.update({ where: { id: parent.id }, data: { generationNumber: 2 } })
    const grandchild = await createTestSim(legacyId, { firstName: 'GC', generationNumber: 99 })
    await db.familyRelationship.createMany({
      data: [
        { parentId: existingParent.id, childId: child.id, type: FamilyRelationshipType.BIOLOGICAL },
        { parentId: child.id, childId: grandchild.id, type: FamilyRelationshipType.BIOLOGICAL },
      ],
    })
    await trpcCaller.sims.addFamilyRelationship({
      parentId: parent.id, childId: child.id, type: FamilyRelationshipType.BIOLOGICAL,
    })
    expect((await db.sim.findUnique({ where: { id: child.id } }))?.generationNumber).toBe(4)      // max(2,3)+1
    expect((await db.sim.findUnique({ where: { id: grandchild.id } }))?.generationNumber).toBe(5) // cascaded
  })

  test('updates child generationNumber after removing one parent when another remains', async ({ trpcCaller, legacyId }) => {
    const parent = await createTestSim(legacyId, { firstName: 'Parent' })
    const child = await createTestSim(legacyId, { firstName: 'Child' })
    const parent2 = await createTestSim(legacyId, { firstName: 'Parent2' })
    await db.sim.update({ where: { id: parent.id }, data: { generationNumber: 1 } })
    await db.sim.update({ where: { id: parent2.id }, data: { generationNumber: 3 } })
    await db.sim.update({ where: { id: child.id }, data: { generationNumber: 2 } })
    await db.familyRelationship.createMany({
      data: [
        { parentId: parent.id, childId: child.id, type: FamilyRelationshipType.BIOLOGICAL },
        { parentId: parent2.id, childId: child.id, type: FamilyRelationshipType.BIOLOGICAL },
      ],
    })
    await trpcCaller.sims.removeFamilyRelationship({ parentId: parent.id, childId: child.id })
    const record = await db.sim.findUnique({ where: { id: child.id } })
    expect(record?.generationNumber).toBe(4)
  })

  test('retains the child generation as a root value when the last parent is removed', async ({ trpcCaller, legacyId }) => {
    const parent = await createTestSim(legacyId, { firstName: 'Parent' })
    const child = await createTestSim(legacyId, { firstName: 'Child' })
    await db.sim.update({ where: { id: parent.id }, data: { generationNumber: 1 } })
    await db.sim.update({ where: { id: child.id }, data: { generationNumber: 2 } })
    await db.familyRelationship.create({
      data: { parentId: parent.id, childId: child.id, type: FamilyRelationshipType.BIOLOGICAL },
    })
    await trpcCaller.sims.removeFamilyRelationship({ parentId: parent.id, childId: child.id })
    const record = await db.sim.findUnique({ where: { id: child.id } })
    expect(record?.generationNumber).toBe(2) // kept; child is now a root
  })
})

describe('sims.addSocialRelationship / sims.updateSocialRelationship / sims.removeSocialRelationship', () => {
  /** Two sims in the legacy, returned as the normalised (sorted) [simAId, simBId] pair. */
  async function makePair(legacyId: string): Promise<[string, string]> {
    const simA = await createTestSim(legacyId, { firstName: 'Alpha' })
    const simB = await createTestSim(legacyId, { firstName: 'Beta' })
    return [simA.id, simB.id].sort() as [string, string]
  }

  test('creates a social relationship with normalised IDs', async ({ trpcCaller, legacyId }) => {
    const [simAId, simBId] = await makePair(legacyId)
    await trpcCaller.sims.addSocialRelationship({
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

  test('does not persist the relationship when the partner adoption write fails', async ({ userId, legacyId }) => {
    const [simAId, simBId] = await makePair(legacyId)
    const parent = await createTestSim(legacyId, { firstName: 'ParentOfB', generationNumber: 1 })
    await db.familyRelationship.create({ data: { parentId: parent.id, childId: simBId, type: FamilyRelationshipType.BIOLOGICAL } })
    await db.sim.update({ where: { id: simBId }, data: { generationNumber: 2 } })

    await expect(
      authedCaller(userId, failingDb('sim', 'update')).sims.addSocialRelationship({
        simAId, simBId, romanticStatus: RomanticStatus.DATING,
      })
    ).rejects.toThrow()

    const row = await db.socialRelationship.findUnique({ where: { simAId_simBId: { simAId, simBId } } })
    expect(row).toBeNull()
  })

  test('a root partner adopts a derived partner generation', async ({ trpcCaller, legacyId }) => {
    const [simAId, simBId] = await makePair(legacyId)
    const parent = await createTestSim(legacyId, { firstName: 'ParentOfB2', generationNumber: 4 })
    await db.familyRelationship.create({ data: { parentId: parent.id, childId: simBId, type: FamilyRelationshipType.BIOLOGICAL } })
    await db.sim.update({ where: { id: simBId }, data: { generationNumber: 5 } })

    await trpcCaller.sims.addSocialRelationship({ simAId, simBId, romanticStatus: RomanticStatus.MARRIED })

    expect((await db.sim.findUnique({ where: { id: simAId } }))?.generationNumber).toBe(5)
  })

  test('normalises ID order regardless of input order', async ({ trpcCaller, legacyId }) => {
    const [simAId, simBId] = await makePair(legacyId)
    await trpcCaller.sims.addSocialRelationship({
      simAId: simBId,
      simBId: simAId,
      romanticStatus: RomanticStatus.NONE,
    })
    const row = await db.socialRelationship.findUnique({
      where: { simAId_simBId: { simAId, simBId } },
    })
    expect(row).not.toBeNull()
  })

  test('updates romantic status', async ({ trpcCaller, legacyId }) => {
    const [simAId, simBId] = await makePair(legacyId)
    await db.socialRelationship.create({
      data: { simAId, simBId, romanticStatus: RomanticStatus.NONE, friendshipScore: 0, romanceScore: 0 },
    })
    await trpcCaller.sims.updateSocialRelationship({
      simAId,
      simBId,
      romanticStatus: RomanticStatus.MARRIED,
    })
    const row = await db.socialRelationship.findUnique({
      where: { simAId_simBId: { simAId, simBId } },
    })
    expect(row?.romanticStatus).toBe(RomanticStatus.MARRIED)
  })

  test('addSocialRelationship persists endedAt when provided', async ({ trpcCaller, legacyId }) => {
    const [simAId, simBId] = await makePair(legacyId)
    const when = new Date('2026-02-02T00:00:00Z')
    const rel = await trpcCaller.sims.addSocialRelationship({
      simAId, simBId, romanticStatus: RomanticStatus.MARRIED, endedAt: when,
    })
    expect(rel.endedAt?.toISOString()).toBe(when.toISOString())
  })

  test('updateSocialRelationship can set and clear endedAt', async ({ trpcCaller, legacyId }) => {
    const [simAId, simBId] = await makePair(legacyId)
    await trpcCaller.sims.addSocialRelationship({ simAId, simBId, romanticStatus: RomanticStatus.MARRIED })
    const when = new Date('2026-03-03T00:00:00Z')
    const ended = await trpcCaller.sims.updateSocialRelationship({ simAId, simBId, romanticStatus: RomanticStatus.MARRIED, endedAt: when })
    expect(ended.endedAt?.toISOString()).toBe(when.toISOString())
    const reopened = await trpcCaller.sims.updateSocialRelationship({ simAId, simBId, romanticStatus: RomanticStatus.MARRIED, endedAt: null })
    expect(reopened.endedAt).toBeNull()
  })

  test('updateSocialRelationship coerces an ISO-string endedAt (the over-the-wire shape; no tRPC transformer)', async ({ trpcCaller, legacyId }) => {
    const [simAId, simBId] = await makePair(legacyId)
    await trpcCaller.sims.addSocialRelationship({ simAId, simBId, romanticStatus: RomanticStatus.MARRIED })
    // httpBatchLink JSON-serialises a Date to an ISO string; the input must coerce it back.
    const iso = '2026-03-03T00:00:00.000Z'
    const ended = await trpcCaller.sims.updateSocialRelationship({
      simAId, simBId, romanticStatus: RomanticStatus.MARRIED, endedAt: iso as unknown as Date,
    })
    expect(ended.endedAt?.toISOString()).toBe(iso)
  })

  test('removes the relationship', async ({ trpcCaller, legacyId }) => {
    const [simAId, simBId] = await makePair(legacyId)
    await db.socialRelationship.create({
      data: { simAId, simBId, romanticStatus: RomanticStatus.NONE, friendshipScore: 0, romanceScore: 0 },
    })
    await trpcCaller.sims.removeSocialRelationship({ simAId, simBId })
    const row = await db.socialRelationship.findUnique({
      where: { simAId_simBId: { simAId, simBId } },
    })
    expect(row).toBeNull()
  })

  test("throws NOT_FOUND for another user's sim in addSocialRelationship", async ({ trpcCaller, legacyId }) => {
    const [simAId] = await makePair(legacyId)
    const other = await createTestUser()
    const otherLegacy = await createTestLegacy(other.id)
    const otherSim = await createTestSim(otherLegacy.id)
    try {
      await expect(
        trpcCaller.sims.addSocialRelationship({
          simAId,
          simBId: otherSim.id,
          romanticStatus: RomanticStatus.NONE,
        })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    } finally {
      await cleanupUser(other.id)
    }
  })

  test('throws BAD_REQUEST when both IDs are the same', async ({ trpcCaller, legacyId }) => {
    const [simAId] = await makePair(legacyId)
    await expect(
      trpcCaller.sims.addSocialRelationship({
        simAId,
        simBId: simAId,
        romanticStatus: RomanticStatus.NONE,
      })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  test('root partner adopts the generation of a derived partner', async ({ trpcCaller, legacyId }) => {
    const [simAId, simBId] = await makePair(legacyId)
    const parent = await createTestSim(legacyId, { firstName: 'ParentForAdopt', generationNumber: 1 })
    await db.familyRelationship.create({ data: { parentId: parent.id, childId: simBId, type: FamilyRelationshipType.BIOLOGICAL } })
    await db.sim.update({ where: { id: simBId }, data: { generationNumber: 2 } })
    await trpcCaller.sims.addSocialRelationship({ simAId, simBId, romanticStatus: RomanticStatus.DATING })
    const record = await db.sim.findUnique({ where: { id: simAId } })
    expect(record?.generationNumber).toBe(2)
  })

  test('adoption works regardless of which partner is the derived one', async ({ trpcCaller, legacyId }) => {
    const [simAId, simBId] = await makePair(legacyId)
    const parent = await createTestSim(legacyId, { firstName: 'ParentForAdopt2', generationNumber: 2 })
    await db.familyRelationship.create({ data: { parentId: parent.id, childId: simAId, type: FamilyRelationshipType.BIOLOGICAL } })
    await db.sim.update({ where: { id: simAId }, data: { generationNumber: 3 } })
    await trpcCaller.sims.addSocialRelationship({ simAId, simBId, romanticStatus: RomanticStatus.DATING })
    const record = await db.sim.findUnique({ where: { id: simBId } })
    expect(record?.generationNumber).toBe(3)
  })

  test('does not change either partner generation when both are roots', async ({ trpcCaller, legacyId }) => {
    const [simAId, simBId] = await makePair(legacyId)
    await db.sim.update({ where: { id: simAId }, data: { generationNumber: 2 } })
    await db.sim.update({ where: { id: simBId }, data: { generationNumber: 5 } })
    await trpcCaller.sims.addSocialRelationship({ simAId, simBId, romanticStatus: RomanticStatus.MARRIED })
    expect((await db.sim.findUnique({ where: { id: simAId } }))?.generationNumber).toBe(2) // unchanged
    expect((await db.sim.findUnique({ where: { id: simBId } }))?.generationNumber).toBe(5) // unchanged
  })

  test('does not override partner generationNumber if both are derived', async ({ trpcCaller, legacyId }) => {
    const [simAId, simBId] = await makePair(legacyId)
    const parentA = await createTestSim(legacyId, { firstName: 'ParA', generationNumber: 1 })
    const parentB = await createTestSim(legacyId, { firstName: 'ParB', generationNumber: 4 })
    await db.familyRelationship.createMany({ data: [
      { parentId: parentA.id, childId: simAId, type: FamilyRelationshipType.BIOLOGICAL },
      { parentId: parentB.id, childId: simBId, type: FamilyRelationshipType.BIOLOGICAL },
    ] })
    await db.sim.update({ where: { id: simAId }, data: { generationNumber: 2 } })
    await db.sim.update({ where: { id: simBId }, data: { generationNumber: 5 } })
    await trpcCaller.sims.addSocialRelationship({ simAId, simBId, romanticStatus: RomanticStatus.DATING })
    expect((await db.sim.findUnique({ where: { id: simAId } }))?.generationNumber).toBe(2)
    expect((await db.sim.findUnique({ where: { id: simBId } }))?.generationNumber).toBe(5)
  })
})

describe('sims — generationNumber population', () => {
  test('sets generationNumber from input when provided', async ({ trpcCaller, legacyId }) => {
    const result = await trpcCaller.sims.create({
      legacyId,
      firstName: 'Alice',
      lastName: 'Smith',
      gender: Gender.FEMALE,
      generationNumber: 1,
    })
    const record = await db.sim.findUnique({ where: { id: result.id } })
    expect(record?.generationNumber).toBe(1)
  })

  test('derives generationNumber from parent when parentIds provided', async ({ trpcCaller, legacyId }) => {
    const parent = await createTestSim(legacyId, { firstName: 'Parent' })
    await db.sim.update({ where: { id: parent.id }, data: { generationNumber: 1 } })
    const result = await trpcCaller.sims.create({
      legacyId,
      firstName: 'Child',
      lastName: 'Smith',
      gender: Gender.FEMALE,
      parentIds: [parent.id],
    })
    const record = await db.sim.findUnique({ where: { id: result.id } })
    expect(record?.generationNumber).toBe(2)
  })

  test('uses max parent generationNumber when multiple parents', async ({ trpcCaller, legacyId }) => {
    const parent1 = await createTestSim(legacyId, { firstName: 'P1' })
    const parent2 = await createTestSim(legacyId, { firstName: 'P2' })
    await db.sim.update({ where: { id: parent1.id }, data: { generationNumber: 2 } })
    await db.sim.update({ where: { id: parent2.id }, data: { generationNumber: 3 } })
    const result = await trpcCaller.sims.create({
      legacyId, firstName: 'Child', lastName: 'Smith', gender: Gender.FEMALE,
      parentIds: [parent1.id, parent2.id],
    })
    const record = await db.sim.findUnique({ where: { id: result.id } })
    expect(record?.generationNumber).toBe(4) // max(2,3)+1
  })

  test('a later parentless sim defaults to the legacy latest generation', async ({ trpcCaller, legacyId }) => {
    await trpcCaller.sims.create({ legacyId, firstName: 'Founder', lastName: 'X', gender: Gender.FEMALE }) // gen 1
    await createTestSim(legacyId, { firstName: 'Heir', generationNumber: 3 })
    const newcomer = await trpcCaller.sims.create({ legacyId, firstName: 'Townie', lastName: 'Y', gender: Gender.MALE })
    const record = await db.sim.findUnique({ where: { id: newcomer.id } })
    expect(record?.generationNumber).toBe(3) // legacy latest
  })

  test('sims.update accepts generationNumber override', async ({ trpcCaller, legacyId }) => {
    const sim = await createTestSim(legacyId)
    await trpcCaller.sims.update({ id: sim.id, generationNumber: 5 })
    const record = await db.sim.findUnique({ where: { id: sim.id } })
    expect(record?.generationNumber).toBe(5)
  })

  test('sims.update rejects a generation edit on a sim with parents', async ({ trpcCaller, legacyId }) => {
    const parent = await createTestSim(legacyId, { firstName: 'P', generationNumber: 1 })
    const child = await createTestSim(legacyId, { firstName: 'C', generationNumber: 2 })
    await db.familyRelationship.create({ data: { parentId: parent.id, childId: child.id, type: FamilyRelationshipType.BIOLOGICAL } })
    await expect(
      trpcCaller.sims.update({ id: child.id, generationNumber: 7 }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  test('editing a root generation cascades to descendants', async ({ trpcCaller, legacyId }) => {
    const root = await createTestSim(legacyId, { firstName: 'Root', generationNumber: 1 })
    const child = await createTestSim(legacyId, { firstName: 'Child', generationNumber: 2 })
    await db.familyRelationship.create({ data: { parentId: root.id, childId: child.id, type: FamilyRelationshipType.BIOLOGICAL } })
    await trpcCaller.sims.update({ id: root.id, generationNumber: 4 })
    expect((await db.sim.findUnique({ where: { id: root.id } }))?.generationNumber).toBe(4)
    expect((await db.sim.findUnique({ where: { id: child.id } }))?.generationNumber).toBe(5)
  })

  test('sims.update accepts isHeir flag', async ({ trpcCaller, legacyId }) => {
    const sim = await createTestSim(legacyId)
    await trpcCaller.sims.update({ id: sim.id, isHeir: true })
    const record = await db.sim.findUnique({ where: { id: sim.id } })
    expect(record?.isHeir).toBe(true)
  })

  test('setting isHeir clears the previous heir in the same generation', async ({ trpcCaller, legacyId }) => {
    const simA = await db.sim.create({
      data: { legacyId, firstName: 'A', lastName: 'X', gender: 'FEMALE', lifeStage: 'YOUNG_ADULT', generationNumber: 2, isHeir: true },
    })
    const simB = await db.sim.create({
      data: { legacyId, firstName: 'B', lastName: 'X', gender: 'MALE', lifeStage: 'YOUNG_ADULT', generationNumber: 2 },
    })
    await trpcCaller.sims.update({ id: simB.id, isHeir: true })
    const recordA = await db.sim.findUnique({ where: { id: simA.id } })
    const recordB = await db.sim.findUnique({ where: { id: simB.id } })
    expect(recordA?.isHeir).toBe(false)
    expect(recordB?.isHeir).toBe(true)
  })

  test('setting isHeir does not clear heir in a different generation', async ({ trpcCaller, legacyId }) => {
    const simA = await db.sim.create({
      data: { legacyId, firstName: 'A', lastName: 'X', gender: 'FEMALE', lifeStage: 'YOUNG_ADULT', generationNumber: 1, isHeir: true },
    })
    const simB = await db.sim.create({
      data: { legacyId, firstName: 'B', lastName: 'X', gender: 'MALE', lifeStage: 'YOUNG_ADULT', generationNumber: 2 },
    })
    await trpcCaller.sims.update({ id: simB.id, isHeir: true })
    const recordA = await db.sim.findUnique({ where: { id: simA.id } })
    expect(recordA?.isHeir).toBe(true)
  })

  test('exactly one heir exists in the generation after setting isHeir on a new sim', async ({ trpcCaller, legacyId }) => {
    const simA = await db.sim.create({
      data: { legacyId, firstName: 'A', lastName: 'X', gender: 'FEMALE', lifeStage: 'YOUNG_ADULT', generationNumber: 3, isHeir: true },
    })
    const simB = await db.sim.create({
      data: { legacyId, firstName: 'B', lastName: 'X', gender: 'MALE', lifeStage: 'YOUNG_ADULT', generationNumber: 3 },
    })
    await trpcCaller.sims.update({ id: simB.id, isHeir: true })
    const heirs = await db.sim.findMany({
      where: { legacyId, generationNumber: 3, isHeir: true },
    })
    expect(heirs).toHaveLength(1)
    expect(heirs[0].id).toBe(simB.id)
    const recordA = await db.sim.findUnique({ where: { id: simA.id } })
    expect(recordA?.isHeir).toBe(false)
  })

})

describe('sims.update — heir cohort', () => {
  test('clears heirs in the generation the sim moves into, not the one it left', async ({ trpcCaller, legacyId }) => {
    const oldGenHeir = await db.sim.create({
      data: { legacyId, firstName: 'OldHeir', lastName: 'X', gender: 'FEMALE', lifeStage: 'YOUNG_ADULT', generationNumber: 2, isHeir: true },
    })
    const newGenHeir = await db.sim.create({
      data: { legacyId, firstName: 'NewHeir', lastName: 'X', gender: 'MALE', lifeStage: 'YOUNG_ADULT', generationNumber: 3, isHeir: true },
    })
    const mover = await db.sim.create({
      data: { legacyId, firstName: 'Mover', lastName: 'X', gender: 'FEMALE', lifeStage: 'YOUNG_ADULT', generationNumber: 2 },
    })

    await trpcCaller.sims.update({ id: mover.id, generationNumber: 3, isHeir: true })

    const [oldHeir, newHeir, moved] = await Promise.all([
      db.sim.findUnique({ where: { id: oldGenHeir.id } }),
      db.sim.findUnique({ where: { id: newGenHeir.id } }),
      db.sim.findUnique({ where: { id: mover.id } }),
    ])
    expect(oldHeir?.isHeir).toBe(true)
    expect(newHeir?.isHeir).toBe(false)
    expect(moved?.isHeir).toBe(true)
    expect(moved?.generationNumber).toBe(3)
  })

  test("clears heirs in the sim's current generation even when it changed concurrently", async ({ userId, legacyId }) => {
    const gen3Heir = await db.sim.create({
      data: { legacyId, firstName: 'Gen3Heir', lastName: 'X', gender: 'MALE', lifeStage: 'YOUNG_ADULT', generationNumber: 3, isHeir: true },
    })
    const target = await db.sim.create({
      data: { legacyId, firstName: 'Target', lastName: 'X', gender: 'FEMALE', lifeStage: 'YOUNG_ADULT', generationNumber: 2 },
    })
    const aspiration = await getAnyAspiration()
    // Simulate the race: a concurrent request moves the sim to generation 3
    // (separate connection) after the mutation's pre-transaction read.
    const racingDb = db.$extends({
      query: {
        simAspiration: {
          async deleteMany({ args, query }) {
            await db.sim.update({ where: { id: target.id }, data: { generationNumber: 3 } })
            return query(args)
          },
        },
      },
    }) as unknown as typeof db

    await authedCaller(userId, racingDb).sims.update({ id: target.id, aspirationId: aspiration.id, isHeir: true })

    const heirs = await db.sim.findMany({ where: { legacyId, generationNumber: 3, isHeir: true } })
    expect(heirs.map((h) => h.id)).toEqual([target.id])
    expect((await db.sim.findUnique({ where: { id: gen3Heir.id } }))?.isHeir).toBe(false)
  })
})

describe('one heir per generation — database constraint', () => {
  test('rejects a second heir in the same legacy and generation even on direct writes', async ({ legacyId }) => {
    await db.sim.create({
      data: { legacyId, firstName: 'First', lastName: 'X', gender: 'FEMALE', lifeStage: 'YOUNG_ADULT', generationNumber: 2, isHeir: true },
    })
    await expect(
      db.sim.create({
        data: { legacyId, firstName: 'Second', lastName: 'X', gender: 'MALE', lifeStage: 'YOUNG_ADULT', generationNumber: 2, isHeir: true },
      })
    ).rejects.toMatchObject({ code: 'P2002' })
  })

  test('allows non-heir sims to share a generation', async ({ legacyId }) => {
    await db.sim.create({
      data: { legacyId, firstName: 'A', lastName: 'X', gender: 'FEMALE', lifeStage: 'YOUNG_ADULT', generationNumber: 2, isHeir: true },
    })
    await db.sim.create({
      data: { legacyId, firstName: 'B', lastName: 'X', gender: 'MALE', lifeStage: 'YOUNG_ADULT', generationNumber: 2 },
    })
    expect(await db.sim.count({ where: { legacyId, generationNumber: 2 } })).toBe(2)
  })
})

describe('recomputeLegacyTrackers — triggered by sim mutations', () => {
  test('stamps completedAt on Skill Maxed tracker when skill is maxed via addSkill', async ({ trpcCaller, userId, legacyId }) => {
    const skill = await getAnySkill()
    const trackerType = await getTrackerTypeByName('Skill Maxed')

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

    await trpcCaller.sims.addSkill({ simId: sim.id, skillId: skill.id, level: skill.maxLevel })

    const progress = await db.trackerProgress.findUnique({ where: { challengeRunTrackerId: runTracker.id } })
    expect(progress?.completedAt).not.toBeNull()
  })
})

describe('sims.create — parentIds validation', () => {
  test('throws BAD_REQUEST when a parentId does not belong to this legacy', async ({ trpcCaller, legacyId }) => {
    const other = await createTestUser()
    const otherLegacy = await createTestLegacy(other.id)
    const foreignSim = await createTestSim(otherLegacy.id)
    await db.sim.update({ where: { id: foreignSim.id }, data: { generationNumber: 1 } })
    try {
      await expect(
        trpcCaller.sims.create({
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

  test('persists FamilyRelationship rows with type BIOLOGICAL when parentIds are provided', async ({ trpcCaller, legacyId }) => {
    const parent = await createTestSim(legacyId, { firstName: 'Parent' })
    await db.sim.update({ where: { id: parent.id }, data: { generationNumber: 1 } })
    const result = await trpcCaller.sims.create({
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

  test('persists FamilyRelationship rows for multiple parents', async ({ trpcCaller, legacyId }) => {
    const parent1 = await createTestSim(legacyId, { firstName: 'Parent1' })
    const parent2 = await createTestSim(legacyId, { firstName: 'Parent2' })
    await db.sim.update({ where: { id: parent1.id }, data: { generationNumber: 1 } })
    await db.sim.update({ where: { id: parent2.id }, data: { generationNumber: 1 } })
    const result = await trpcCaller.sims.create({
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
  test('sets completedAt on the SimAspiration record', async ({ trpcCaller, legacyId }) => {
    const sim = await createTestSim(legacyId)
    const simId = sim.id
    const aspiration = await getAnyAspiration()
    await db.simAspiration.create({ data: { simId, aspirationId: aspiration.id } })

    await trpcCaller.sims.completeAspiration({ simId, aspirationId: aspiration.id })

    const record = await db.simAspiration.findUnique({
      where: { simId_aspirationId: { simId, aspirationId: aspiration.id } },
    })
    expect(record?.completedAt).not.toBeNull()
  })

  test('returns NOT_FOUND when sim does not belong to the user', async ({ trpcCaller }) => {
    const other = await createTestUser()
    const otherLegacy = await createTestLegacy(other.id)
    const otherSim = await createTestSim(otherLegacy.id)
    const aspiration = await getAnyAspiration()
    await db.simAspiration.create({ data: { simId: otherSim.id, aspirationId: aspiration.id } })
    try {
      await expect(
        trpcCaller.sims.completeAspiration({ simId: otherSim.id, aspirationId: aspiration.id })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    } finally {
      await cleanupUser(other.id)
    }
  })

  test('returns NOT_FOUND when aspiration is not on the sim', async ({ trpcCaller, legacyId }) => {
    const sim = await createTestSim(legacyId)
    const aspiration = await getAnyAspiration()
    // no SimAspiration row created — aspiration not on sim
    await expect(
      trpcCaller.sims.completeAspiration({ simId: sim.id, aspirationId: aspiration.id })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  test('returns BAD_REQUEST when aspiration is already completed', async ({ trpcCaller, legacyId }) => {
    const sim = await createTestSim(legacyId)
    const aspiration = await getAnyAspiration()
    await db.simAspiration.create({ data: { simId: sim.id, aspirationId: aspiration.id, completedAt: new Date() } })

    await expect(
      trpcCaller.sims.completeAspiration({ simId: sim.id, aspirationId: aspiration.id })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })
})

describe('sims.endCareer', () => {
  test('sets endedAt on the active SimCareer record', async ({ trpcCaller, legacyId }) => {
    const sim = await createTestSim(legacyId)
    const simId = sim.id
    const career = await getAnyCareer()
    await db.simCareer.create({
      data: { simId, careerId: career.id, employmentType: 'EMPLOYED', startedAt: new Date() },
    })

    await trpcCaller.sims.endCareer({ simId })

    const record = await db.simCareer.findFirst({ where: { simId } })
    expect(record?.endedAt).not.toBeNull()
  })

  test('returns NOT_FOUND when sim does not belong to the user', async ({ trpcCaller }) => {
    const other = await createTestUser()
    const otherLegacy = await createTestLegacy(other.id)
    const otherSim = await createTestSim(otherLegacy.id)
    try {
      await expect(
        trpcCaller.sims.endCareer({ simId: otherSim.id })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    } finally {
      await cleanupUser(other.id)
    }
  })

  test('returns NOT_FOUND when there is no active career', async ({ trpcCaller, legacyId }) => {
    const sim = await createTestSim(legacyId)
    // No SimCareer row created — no active career to end
    await expect(
      trpcCaller.sims.endCareer({ simId: sim.id })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})

describe('RomanticStatus narrowing — migrated rows derive correctly', () => {
  // The narrow_romantic_status migration remaps the two dropped values:
  //   former ex-partner rows -> DATING + endedAt (a generic break-up)
  //   former widowed rows    -> MARRIED (widowhood now derives from the partner's death)
  // These pin the display contract the backfill targets.
  test('migrated ex-partners read as an ended (broke-up) dating bond', () => {
    expect(deriveRomanticState('DATING', new Date('2026-01-01'), false)).toEqual({ kind: 'ended', bond: 'DATING' })
  })
  test('migrated widows read as a current marriage that derives widowed once the partner is deceased', () => {
    expect(deriveRomanticState('MARRIED', null, false)).toEqual({ kind: 'active', bond: 'MARRIED' })
    expect(deriveRomanticState('MARRIED', null, true)).toEqual({ kind: 'widowed', bond: 'MARRIED' })
  })
})

describe('sims.getTreeData', () => {
  // Every test here needs the legacy's slug (the procedure's input) alongside its
  // id — identical derived setup with no per-test data — so a local fixture fits.
  const test = base.extend<{ legacySlug: string }>({
    legacySlug: async ({ legacyId }, provide) => {
      const { slug } = await db.legacy.findUniqueOrThrow({ where: { id: legacyId }, select: { slug: true } })
      await provide(slug)
    },
  })

  test('returns all sims in the legacy', async ({ trpcCaller, legacyId, legacySlug }) => {
    const s1 = await createTestSim(legacyId, { firstName: 'Mortimer' })
    const s2 = await createTestSim(legacyId, { firstName: 'Bella' })
    const result = await trpcCaller.sims.getTreeData({ legacySlug })
    expect(result.sims.map((s) => s.id)).toEqual(expect.arrayContaining([s1.id, s2.id]))
  })

  test('returns biological and adoptive family edges', async ({ trpcCaller, legacyId, legacySlug }) => {
    const parent = await createTestSim(legacyId, { firstName: 'Parent' })
    const bioChild = await createTestSim(legacyId, { firstName: 'BioChild' })
    const adoptedChild = await createTestSim(legacyId, { firstName: 'AdoptedChild' })
    await db.familyRelationship.create({
      data: { parentId: parent.id, childId: bioChild.id, type: FamilyRelationshipType.BIOLOGICAL },
    })
    await db.familyRelationship.create({
      data: { parentId: parent.id, childId: adoptedChild.id, type: FamilyRelationshipType.ADOPTIVE },
    })
    const result = await trpcCaller.sims.getTreeData({ legacySlug })
    expect(result.familyEdges).toContainEqual({ parentId: parent.id, childId: bioChild.id })
    expect(result.familyEdges).toContainEqual({ parentId: parent.id, childId: adoptedChild.id })
  })

  test('exposes the data to derive a step label from a recorded parent marriage', async ({ trpcCaller, legacyId, legacySlug }) => {
    const mum = await createTestSim(legacyId, { firstName: 'Mum', gender: Gender.FEMALE })
    const focus = await createTestSim(legacyId, { firstName: 'Focus', gender: Gender.FEMALE })
    const stepdad = await createTestSim(legacyId, { firstName: 'Stepdad', gender: Gender.MALE })
    await db.familyRelationship.create({
      data: { parentId: mum.id, childId: focus.id, type: FamilyRelationshipType.BIOLOGICAL },
    })
    const [aId, bId] = [mum.id, stepdad.id].sort()
    await db.socialRelationship.create({
      data: { simAId: aId, simBId: bId, romanticStatus: RomanticStatus.MARRIED, friendshipScore: 0, romanceScore: 0 },
    })
    const tree = await trpcCaller.sims.getTreeData({ legacySlug })
    const labels = computeKinshipLabels(focus.id, tree.sims, tree.familyEdges, tree.partnerEdges)
    expect(labels.get(stepdad.id)).toBe('Stepfather')
  })

  test('returns partner edges for non-NONE romantic relationships', async ({ trpcCaller, legacyId, legacySlug }) => {
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
    const result = await trpcCaller.sims.getTreeData({ legacySlug })
    expect(result.partnerEdges).toContainEqual({ simAId: idA, simBId: idB, romanticStatus: RomanticStatus.MARRIED, endedAt: null })
    expect(result.partnerEdges.map((e) => [e.simAId, e.simBId])).not.toContainEqual([idA2, idC])
  })

  test('returns endedAt on partner edges and isDeceased on sims', async ({ trpcCaller, legacyId, legacySlug }) => {
    const simA = await createTestSim(legacyId, { firstName: 'Alive' })
    const simB = await createTestSim(legacyId, { firstName: 'Gone' })
    await db.sim.update({ where: { id: simB.id }, data: { causeOfDeath: 'OLD_AGE' } })
    const [idA, idB] = [simA.id, simB.id].sort()
    const when = new Date('2026-04-04T00:00:00Z')
    await db.socialRelationship.create({
      data: { simAId: idA, simBId: idB, romanticStatus: RomanticStatus.MARRIED, endedAt: when, friendshipScore: 0, romanceScore: 0 },
    })

    const result = await trpcCaller.sims.getTreeData({ legacySlug })

    const edge = result.partnerEdges.find((e) => e.simAId === idA && e.simBId === idB)
    expect(edge?.endedAt?.toISOString()).toBe(when.toISOString())
    expect(result.sims.find((s) => s.id === simB.id)?.isDeceased).toBe(true)
    expect(result.sims.find((s) => s.id === simA.id)?.isDeceased).toBe(false)
  })

  test('includes romanticStatus on every partner edge', async ({ trpcCaller, legacyId, legacySlug }) => {
    const simA = await createTestSim(legacyId, { firstName: 'SimA' })
    const simB = await createTestSim(legacyId, { firstName: 'SimB' })
    const [idA, idB] = [simA.id, simB.id].sort()
    await db.socialRelationship.create({
      data: {
        simAId: idA,
        simBId: idB,
        romanticStatus: RomanticStatus.MARRIED,
        friendshipScore: 0,
        romanceScore: 0,
      },
    })
    const result = await trpcCaller.sims.getTreeData({ legacySlug })
    expect(result.partnerEdges.length).toBeGreaterThan(0)
    for (const edge of result.partnerEdges) {
      expect(edge).toHaveProperty('romanticStatus')
      expect(edge.romanticStatus).not.toBe(RomanticStatus.NONE)
    }
    expect(result.partnerEdges).toContainEqual({
      simAId: idA,
      simBId: idB,
      romanticStatus: RomanticStatus.MARRIED,
      endedAt: null,
    })
  })

  test('throws NOT_FOUND for a legacy that does not belong to the user', async ({ trpcCaller }) => {
    const otherUser = await createTestUser()
    const otherLegacy = await createTestLegacy(otherUser.id)
    await expect(
      trpcCaller.sims.getTreeData({ legacySlug: otherLegacy.slug }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await cleanupUser(otherUser.id)
  })

  test('throws UNAUTHORIZED without a session', async ({ legacySlug }) => {
    const caller = unauthCaller()
    await expect(
      caller.sims.getTreeData({ legacySlug }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  test('returns empty arrays for a legacy with no sims', async ({ trpcCaller, legacySlug }) => {
    const result = await trpcCaller.sims.getTreeData({ legacySlug })
    expect(result).toEqual({ sims: [], familyEdges: [], partnerEdges: [] })
  })

  test('getTreeData includes gender on each sim', async ({ trpcCaller, legacyId, legacySlug }) => {
    await createTestSim(legacyId, { firstName: 'Bella', gender: Gender.FEMALE })
    const data = await trpcCaller.sims.getTreeData({ legacySlug })
    expect(data.sims[0]).toHaveProperty('gender', 'FEMALE')
  })

  test('does not return partner edges that cross legacy boundaries', async () => {
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
  test('includes the focused sim, their parents, and grandparents', async ({ trpcCaller, legacyId }) => {
    const grandparent = await createTestSim(legacyId, { firstName: 'Grandparent' })
    const parent = await createTestSim(legacyId, { firstName: 'Parent' })
    const child = await createTestSim(legacyId, { firstName: 'Child' })
    await db.familyRelationship.createMany({
      data: [
        { parentId: grandparent.id, childId: parent.id, type: FamilyRelationshipType.BIOLOGICAL },
        { parentId: parent.id, childId: child.id, type: FamilyRelationshipType.BIOLOGICAL },
      ],
    })
    const result = await trpcCaller.sims.getMiniTreeData({ simId: child.id })
    const ids = result.sims.map((s) => s.id)
    expect(ids).toContain(child.id)
    expect(ids).toContain(parent.id)
    expect(ids).toContain(grandparent.id)
    const returnedChild = result.sims.find((s) => s.id === child.id)
    expect(returnedChild).toMatchObject({ lifeStage: expect.any(String), isHeir: expect.any(Boolean) })
  })

  test("includes the focused sim's children", async ({ trpcCaller, legacyId }) => {
    const parent = await createTestSim(legacyId, { firstName: 'Parent' })
    const child = await createTestSim(legacyId, { firstName: 'Child' })
    await db.familyRelationship.create({
      data: { parentId: parent.id, childId: child.id, type: FamilyRelationshipType.BIOLOGICAL },
    })
    const result = await trpcCaller.sims.getMiniTreeData({ simId: parent.id })
    expect(result.sims.map((s) => s.id)).toContain(child.id)
  })

  test("includes the focused sim's partner in sims and partnerEdges", async ({ trpcCaller, legacyId }) => {
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
    const result = await trpcCaller.sims.getMiniTreeData({ simId: focused.id })
    const ids = result.sims.map((s) => s.id)
    expect(ids).toContain(focused.id)
    expect(ids).toContain(partner.id)
    expect(result.partnerEdges).toContainEqual({ simAId: idA, simBId: idB, romanticStatus: RomanticStatus.MARRIED, endedAt: null })
  })

  test('includes romanticStatus on every partner edge', async ({ trpcCaller, legacyId }) => {
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
    const result = await trpcCaller.sims.getMiniTreeData({ simId: focused.id })
    expect(result.partnerEdges.length).toBeGreaterThan(0)
    for (const edge of result.partnerEdges) {
      expect(edge).toHaveProperty('romanticStatus')
    }
    expect(result.partnerEdges).toContainEqual({
      simAId: idA,
      simBId: idB,
      romanticStatus: RomanticStatus.MARRIED,
      endedAt: null,
    })
  })

  test('throws NOT_FOUND for a sim that does not belong to the user', async ({ trpcCaller }) => {
    const otherUser = await createTestUser()
    const otherLegacy = await createTestLegacy(otherUser.id)
    const otherSim = await createTestSim(otherLegacy.id)
    await expect(trpcCaller.sims.getMiniTreeData({ simId: otherSim.id })).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await cleanupUser(otherUser.id)
  })

  test('throws UNAUTHORIZED without a session', async ({ legacyId }) => {
    const sim = await createTestSim(legacyId, { firstName: 'Focused' })
    const caller = unauthCaller()
    await expect(caller.sims.getMiniTreeData({ simId: sim.id })).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  test('includes an ADOPTIVE parent in sims and familyEdges', async ({ trpcCaller, legacyId }) => {
    const parent = await createTestSim(legacyId, { firstName: 'AdoptiveParent' })
    const child = await createTestSim(legacyId, { firstName: 'AdoptedChild' })
    await db.familyRelationship.create({
      data: { parentId: parent.id, childId: child.id, type: FamilyRelationshipType.ADOPTIVE },
    })
    const result = await trpcCaller.sims.getMiniTreeData({ simId: child.id })
    expect(result.sims.map((s) => s.id)).toContain(parent.id)
    expect(result.familyEdges).toContainEqual({ parentId: parent.id, childId: child.id })
  })

  test('does not include the great-grandparent (4-generation chain)', async ({ trpcCaller, legacyId }) => {
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
    const result = await trpcCaller.sims.getMiniTreeData({ simId: child.id })
    const ids = result.sims.map((s) => s.id)
    expect(ids).toContain(child.id)
    expect(ids).toContain(parent.id)
    expect(ids).toContain(grandparent.id)
    expect(ids).not.toContain(greatGrandparent.id)
  })

  test('includes ended (ex) relationships in partnerEdges, carrying endedAt', async ({ trpcCaller, legacyId }) => {
    const focused = await createTestSim(legacyId, { firstName: 'Focused' })
    const exPartner = await createTestSim(legacyId, { firstName: 'ExPartner' })
    const [idA, idB] = [focused.id, exPartner.id].sort()
    const when = new Date('2026-01-01T00:00:00Z')
    await db.socialRelationship.create({
      data: {
        simAId: idA,
        simBId: idB,
        romanticStatus: RomanticStatus.MARRIED,
        endedAt: when,
        friendshipScore: 0,
        romanceScore: 0,
      },
    })
    const result = await trpcCaller.sims.getMiniTreeData({ simId: focused.id })
    const edge = result.partnerEdges.find((e) => e.simAId === idA && e.simBId === idB)
    expect(edge?.romanticStatus).toBe(RomanticStatus.MARRIED)
    expect(edge?.endedAt?.toISOString()).toBe(when.toISOString())
    expect(result.sims.map((s) => s.id)).toContain(exPartner.id)
  })

  test('does not include a partner sim from another legacy in the backfill', async ({ trpcCaller, legacyId }) => {
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

      const result = await trpcCaller.sims.getMiniTreeData({ simId: ourSim.id })
      expect(result.sims.map((s) => s.id)).not.toContain(theirSim.id)
    } finally {
      await cleanupUser(otherUser.id)
    }
  })
})

describe('social relationship cross-tenant ownership', () => {
  /** Force a relationship row between the two sims, bypassing the tRPC guard
   *  (the procedures normalize the pair sorted, so the row must be too). */
  async function forceCrossTenantRelationship(mySimId: string, theirSimId: string) {
    const [simAId, simBId] = [mySimId, theirSimId].sort()
    await db.socialRelationship.create({
      data: { simAId, simBId, romanticStatus: 'DATING', friendshipScore: 0, romanceScore: 0 },
    })
  }

  test('updateSocialRelationship throws NOT_FOUND when simB belongs to another user, even if the row exists', async ({ trpcCaller, legacyId }) => {
    const mySimId = (await createTestSim(legacyId)).id
    const otherUser = await createTestUser()
    try {
      const theirLegacy = await createTestLegacy(otherUser.id)
      const theirSimId = (await createTestSim(theirLegacy.id)).id
      await forceCrossTenantRelationship(mySimId, theirSimId)
      await expect(
        trpcCaller.sims.updateSocialRelationship({
          simAId: mySimId,
          simBId: theirSimId,
          romanticStatus: 'MARRIED',
        }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    } finally {
      await cleanupUser(otherUser.id)
    }
  })

  test('removeSocialRelationship throws NOT_FOUND when simB belongs to another user, even if the row exists', async ({ trpcCaller, legacyId }) => {
    const mySimId = (await createTestSim(legacyId)).id
    const otherUser = await createTestUser()
    try {
      const theirLegacy = await createTestLegacy(otherUser.id)
      const theirSimId = (await createTestSim(theirLegacy.id)).id
      await forceCrossTenantRelationship(mySimId, theirSimId)
      await expect(
        trpcCaller.sims.removeSocialRelationship({ simAId: mySimId, simBId: theirSimId }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })

      // The cross-tenant row must be untouched.
      const [simAId, simBId] = [mySimId, theirSimId].sort()
      expect(
        await db.socialRelationship.findUnique({ where: { simAId_simBId: { simAId, simBId } } }),
      ).not.toBeNull()
    } finally {
      await cleanupUser(otherUser.id)
    }
  })
})
