import { describe, expect } from 'vitest'
import { Gender, FamilyRelationshipType, LifeStage } from '@prisma/client'
import { authedCaller, unauthCaller } from '@/test/caller'
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
  createTestChallenge,
  createTestChallengePhase,
  createTestChallengeRun,
} from '@/test/helpers'
import { test } from '@/test/test'
import { db } from '@/server/db'
import { failingDb } from './test-helpers'

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
  test('stamps completedAt on Skill Maxed tracker when skill is maxed via skills.add', async ({ trpcCaller, userId, legacyId }) => {
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

    await trpcCaller.sims.skills.add({ simId: sim.id, skillId: skill.id, level: skill.maxLevel })

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
