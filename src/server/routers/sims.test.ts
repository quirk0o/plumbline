import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Gender } from '@prisma/client'
import { authedCaller, unauthCaller } from '@/test/caller'
import {
  createTestUser,
  cleanupUser,
  createTestLegacy,
  createTestSim,
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
