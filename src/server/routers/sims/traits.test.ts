import { describe, expect } from 'vitest'
import { LifeStage } from '@prisma/client'
import {
  createTestSim,
  getAnyTrait,
  getConflictingTraits,
  getPersonalityTraits,
  createTestPersonalityTrait,
} from '@/test/helpers'
import { test } from '@/test/test'
import { db } from '@/server/db'

describe('sims.traits.add / sims.traits.remove', () => {
  test('adds a trait', async ({ trpcCaller, legacyId }) => {
    const sim = await createTestSim(legacyId)
    const trait = await getAnyTrait()
    await trpcCaller.sims.traits.add({ simId: sim.id, traitId: trait.id })
    const rows = await db.simPersonalityTrait.findMany({ where: { simId: sim.id } })
    expect(rows).toHaveLength(1)
  })

  test('removes a trait', async ({ trpcCaller, legacyId }) => {
    const sim = await createTestSim(legacyId)
    const trait = await getAnyTrait()
    await db.simPersonalityTrait.create({ data: { simId: sim.id, personalityTraitId: trait.id } })
    await trpcCaller.sims.traits.remove({ simId: sim.id, traitId: trait.id })
    const rows = await db.simPersonalityTrait.findMany({ where: { simId: sim.id } })
    expect(rows).toHaveLength(0)
  })

  test('throws BAD_REQUEST when adding a conflicting trait', async ({ trpcCaller, legacyId }) => {
    const sim = await createTestSim(legacyId)
    const { traitA, traitB } = await getConflictingTraits()
    await db.simPersonalityTrait.create({ data: { simId: sim.id, personalityTraitId: traitA.id } })
    await expect(
      trpcCaller.sims.traits.add({ simId: sim.id, traitId: traitB.id })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  test('throws BAD_REQUEST when already at 6 traits', async ({ trpcCaller, legacyId }) => {
    const sim = await createTestSim(legacyId)
    const traits = await getPersonalityTraits(7)
    for (const t of traits.slice(0, 6)) {
      await db.simPersonalityTrait.create({ data: { simId: sim.id, personalityTraitId: t.id } })
    }
    await expect(
      trpcCaller.sims.traits.add({ simId: sim.id, traitId: traits[6].id })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  test('throws BAD_REQUEST when adding a trait not valid for the sim life stage', async ({ trpcCaller, legacyId }) => {
    const sim = await createTestSim(legacyId)
    const youngAdultTrait = await createTestPersonalityTrait({ minLifeStage: LifeStage.YOUNG_ADULT })
    await db.sim.update({ where: { id: sim.id }, data: { lifeStage: LifeStage.CHILD } })
    try {
      await expect(
        trpcCaller.sims.traits.add({ simId: sim.id, traitId: youngAdultTrait.id })
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    } finally {
      await db.personalityTrait.delete({ where: { id: youngAdultTrait.id } })
    }
  })
})

