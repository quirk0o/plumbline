import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Gender } from '@prisma/client'
import { authedCaller, unauthCaller } from '@/test/caller'
import {
  createTestUser,
  cleanupUser,
  createTestLegacy,
  getConflictingTraits,
} from '@/test/helpers'
import { db } from '@/server/db'

describe('legacies.create', () => {
  let userId: string

  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
  })

  afterEach(async () => {
    await cleanupUser(userId)
  })

  it('creates a legacy and persists it to the database', async () => {
    const caller = authedCaller(userId)
    const result = await caller.legacies.create({ name: 'The Goth Legacy' })
    expect(result.legacy.name).toBe('The Goth Legacy')
    const record = await db.legacy.findUnique({ where: { id: result.legacy.id } })
    expect(record).not.toBeNull()
    expect(record?.name).toBe('The Goth Legacy')
  })

  it('derives the slug from the legacy name', async () => {
    const caller = authedCaller(userId)
    const result = await caller.legacies.create({ name: 'The Caliente Legacy' })
    expect(result.legacy.slug).toBe('the-caliente-legacy')
  })

  it('appends -2 suffix when the base slug already exists for this user', async () => {
    await createTestLegacy(userId, { slug: 'my-legacy' })
    const caller = authedCaller(userId)
    const result = await caller.legacies.create({ name: 'My Legacy' })
    expect(result.legacy.slug).toBe('my-legacy-2')
  })

  it('creates a founder Sim and sets founderSimId on the legacy', async () => {
    const caller = authedCaller(userId)
    const result = await caller.legacies.create({
      name: 'Caliente Legacy',
      founder: { firstName: 'Nina', lastName: 'Caliente', gender: Gender.FEMALE },
    })
    const legacy = await db.legacy.findUnique({ where: { id: result.legacy.id } })
    expect(legacy?.founderSimId).not.toBeNull()
    const sim = await db.sim.findUnique({ where: { id: legacy!.founderSimId! } })
    expect(sim?.firstName).toBe('Nina')
    expect(sim?.lastName).toBe('Caliente')
  })

  it('founder sim gets generationNumber 1', async () => {
    const caller = authedCaller(userId)
    const result = await caller.legacies.create({
      name: 'Goth Legacy',
      founder: { firstName: 'Mortimer', lastName: 'Goth', gender: Gender.MALE },
    })
    const legacy = await db.legacy.findUnique({ where: { id: result.legacy.id } })
    const sim = await db.sim.findUnique({ where: { id: legacy!.founderSimId! } })
    expect(sim?.generationNumber).toBe(1)
  })

  it('throws BAD_REQUEST when the founder has conflicting personality traits', async () => {
    const { traitA, traitB } = await getConflictingTraits()
    const caller = authedCaller(userId)
    await expect(
      caller.legacies.create({
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

  it('throws UNAUTHORIZED without a session', async () => {
    const caller = unauthCaller()
    await expect(caller.legacies.create({ name: 'Should Fail' })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    })
  })
})

describe('legacies.getAll', () => {
  let userId: string
  let otherUserId: string

  beforeEach(async () => {
    const user = await createTestUser()
    const otherUser = await createTestUser()
    userId = user.id
    otherUserId = otherUser.id
  })

  afterEach(async () => {
    await cleanupUser(userId)
    await cleanupUser(otherUserId)
  })

  it('returns only the current user\'s legacies', async () => {
    await createTestLegacy(userId, { name: 'My Legacy', slug: 'my-legacy' })
    await createTestLegacy(otherUserId, { name: 'Other Legacy', slug: 'other-legacy' })
    const caller = authedCaller(userId)
    const result = await caller.legacies.getAll()
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('My Legacy')
  })

  it('includes founderSim fields when a founder is set', async () => {
    const caller = authedCaller(userId)
    await caller.legacies.create({
      name: 'Goth Legacy',
      founder: { firstName: 'Mortimer', lastName: 'Goth', gender: Gender.MALE },
    })
    const result = await caller.legacies.getAll()
    expect(result[0].founderSim).not.toBeNull()
    expect(result[0].founderSim?.firstName).toBe('Mortimer')
    expect(result[0].founderSim?.lastName).toBe('Goth')
  })

  it('returns an empty array when the user has no legacies', async () => {
    const caller = authedCaller(userId)
    const result = await caller.legacies.getAll()
    expect(result).toEqual([])
  })

  it('throws UNAUTHORIZED without a session', async () => {
    const caller = unauthCaller()
    await expect(caller.legacies.getAll()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })
})
