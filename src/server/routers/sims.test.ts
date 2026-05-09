import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Gender } from '@prisma/client'
import { authedCaller, unauthCaller } from '@/test/caller'
import {
  createTestUser,
  cleanupUser,
  createTestLegacy,
  getAnyTrait,
  getConflictingTraits,
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
