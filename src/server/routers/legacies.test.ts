import { describe, expect } from 'vitest'
import { Gender } from '@prisma/client'
import { unauthCaller } from '@/test/caller'
import {
  createTestUser,
  cleanupUser,
  createTestLegacy,
  getConflictingTraits,
} from '@/test/helpers'
import { test } from '@/test/fixtures'
import { db } from '@/server/db'

describe('legacies.create', () => {
  test('creates a legacy and persists it to the database', async ({ trpcCaller }) => {
    const result = await trpcCaller.legacies.create({ name: 'The Goth Legacy' })
    expect(result.legacy.name).toBe('The Goth Legacy')
    const record = await db.legacy.findUnique({ where: { id: result.legacy.id } })
    expect(record).not.toBeNull()
    expect(record?.name).toBe('The Goth Legacy')
  })

  test('derives the slug from the legacy name', async ({ trpcCaller }) => {
    const result = await trpcCaller.legacies.create({ name: 'The Caliente Legacy' })
    expect(result.legacy.slug).toBe('the-caliente-legacy')
  })

  test('appends -2 suffix when the base slug already exists for this user', async ({ trpcCaller, userId }) => {
    await createTestLegacy(userId, { slug: 'my-legacy' })
    const result = await trpcCaller.legacies.create({ name: 'My Legacy' })
    expect(result.legacy.slug).toBe('my-legacy-2')
  })

  test('creates a founder Sim and sets founderSimId on the legacy', async ({ trpcCaller }) => {
    const result = await trpcCaller.legacies.create({
      name: 'Caliente Legacy',
      founder: { firstName: 'Nina', lastName: 'Caliente', gender: Gender.FEMALE },
    })
    const legacy = await db.legacy.findUnique({ where: { id: result.legacy.id } })
    expect(legacy?.founderSimId).not.toBeNull()
    const sim = await db.sim.findUnique({ where: { id: legacy!.founderSimId! } })
    expect(sim?.firstName).toBe('Nina')
    expect(sim?.lastName).toBe('Caliente')
  })

  test('founder sim gets generationNumber 1', async ({ trpcCaller }) => {
    const result = await trpcCaller.legacies.create({
      name: 'Goth Legacy',
      founder: { firstName: 'Mortimer', lastName: 'Goth', gender: Gender.MALE },
    })
    const legacy = await db.legacy.findUnique({ where: { id: result.legacy.id } })
    const sim = await db.sim.findUnique({ where: { id: legacy!.founderSimId! } })
    expect(sim?.generationNumber).toBe(1)
  })

  test('throws BAD_REQUEST when the founder has conflicting personality traits', async ({ trpcCaller }) => {
    const { traitA, traitB } = await getConflictingTraits()
    await expect(
      trpcCaller.legacies.create({
        name: 'Bad Legacy',
        founder: {
          firstName: 'A',
          lastName: 'B',
          gender: Gender.MALE,
          personalityTraitIds: [traitA.id, traitB.id],
        },
      })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  test('founds "The <LastName> Household" when foundHousehold is set', async ({ trpcCaller }) => {
    const result = await trpcCaller.legacies.create({
      name: `Founder House Test ${Date.now()}`,
      founder: {
        firstName: 'Dina',
        lastName: 'Caliente',
        gender: Gender.FEMALE,
        foundHousehold: true,
      },
    })
    const legacy = await db.legacy.findUnique({
      where: { id: result.legacy.id },
      include: { households: true, sims: true },
    })
    expect(legacy!.households).toHaveLength(1)
    expect(legacy!.households[0].name).toBe('The Caliente Household')
    expect(legacy!.households[0].foundedGeneration).toBe(1)
    expect(legacy!.activeHouseholdId).toBe(legacy!.households[0].id)
    expect(legacy!.sims[0].householdId).toBe(legacy!.households[0].id)
  })

  test('leaves the founder unhoused when foundHousehold is not set', async ({ trpcCaller }) => {
    const result = await trpcCaller.legacies.create({
      name: `Unhoused Founder Test ${Date.now()}`,
      founder: { firstName: 'Nina', lastName: 'Caliente', gender: Gender.FEMALE },
    })
    const legacy = await db.legacy.findUnique({
      where: { id: result.legacy.id },
      include: { households: true, sims: true },
    })
    expect(legacy!.households).toHaveLength(0)
    expect(legacy!.sims[0].householdId).toBeNull()
    expect(legacy!.activeHouseholdId).toBeNull()
  })

  test('throws UNAUTHORIZED without a session', async () => {
    const caller = unauthCaller()
    await expect(caller.legacies.create({ name: 'Should Fail' })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    })
  })
})

describe('legacies.getAll', () => {
  test('returns only the current user\'s legacies', async ({ trpcCaller, userId }) => {
    const otherUser = await createTestUser()
    try {
      await createTestLegacy(userId, { name: 'My Legacy', slug: 'my-legacy' })
      await createTestLegacy(otherUser.id, { name: 'Other Legacy', slug: 'other-legacy' })
      const result = await trpcCaller.legacies.getAll()
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('My Legacy')
    } finally {
      await cleanupUser(otherUser.id)
    }
  })

  test('includes founderSim fields when a founder is set', async ({ trpcCaller }) => {
    await trpcCaller.legacies.create({
      name: 'Goth Legacy',
      founder: { firstName: 'Mortimer', lastName: 'Goth', gender: Gender.MALE },
    })
    const result = await trpcCaller.legacies.getAll()
    expect(result[0].founderSim).not.toBeNull()
    expect(result[0].founderSim?.firstName).toBe('Mortimer')
    expect(result[0].founderSim?.lastName).toBe('Goth')
  })

  test('returns an empty array when the user has no legacies', async ({ trpcCaller }) => {
    const result = await trpcCaller.legacies.getAll()
    expect(result).toEqual([])
  })

  test('throws UNAUTHORIZED without a session', async () => {
    const caller = unauthCaller()
    await expect(caller.legacies.getAll()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })
})
