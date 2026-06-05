import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { db } from '@/server/db'
import { createTestUser, cleanupUser, createTestLegacy, createTestSim } from '@/test/helpers'
import { assertLegacyOwned, assertLegacyOwnedBySlug, assertSimOwned, assertSimsOwned } from './ownership'

describe('assertLegacyOwned', () => {
  let userId: string
  let otherUserId: string
  beforeEach(async () => {
    ;({ id: userId } = await createTestUser())
    ;({ id: otherUserId } = await createTestUser())
  })
  afterEach(async () => {
    await cleanupUser(userId)
    await cleanupUser(otherUserId)
  })

  it('returns the legacy when the user owns it', async () => {
    const legacy = await createTestLegacy(userId)
    const result = await assertLegacyOwned(db, legacy.id, userId)
    expect(result.id).toBe(legacy.id)
    expect(result.userId).toBe(userId)
  })

  it("throws NOT_FOUND for another user's legacy", async () => {
    const legacy = await createTestLegacy(otherUserId)
    await expect(assertLegacyOwned(db, legacy.id, userId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('throws NOT_FOUND for a nonexistent legacy', async () => {
    await expect(assertLegacyOwned(db, 'nonexistent-id', userId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })
})

describe('assertLegacyOwnedBySlug', () => {
  let userId: string
  let otherUserId: string
  beforeEach(async () => {
    ;({ id: userId } = await createTestUser())
    ;({ id: otherUserId } = await createTestUser())
  })
  afterEach(async () => {
    await cleanupUser(userId)
    await cleanupUser(otherUserId)
  })

  it('returns the legacy when the user owns it', async () => {
    const legacy = await createTestLegacy(userId)
    const result = await assertLegacyOwnedBySlug(db, legacy.slug, userId)
    expect(result.id).toBe(legacy.id)
  })

  it("throws NOT_FOUND for another user's legacy slug", async () => {
    const legacy = await createTestLegacy(otherUserId)
    await expect(assertLegacyOwnedBySlug(db, legacy.slug, userId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })
})

describe('assertSimOwned', () => {
  let userId: string
  let otherUserId: string
  beforeEach(async () => {
    ;({ id: userId } = await createTestUser())
    ;({ id: otherUserId } = await createTestUser())
  })
  afterEach(async () => {
    await cleanupUser(userId)
    await cleanupUser(otherUserId)
  })

  it("returns the sim when it belongs to the user's legacy", async () => {
    const legacy = await createTestLegacy(userId)
    const sim = await createTestSim(legacy.id)
    const result = await assertSimOwned(db, sim.id, userId)
    expect(result.id).toBe(sim.id)
    expect(result.legacyId).toBe(legacy.id)
  })

  it("throws NOT_FOUND for a sim in another user's legacy", async () => {
    const otherLegacy = await createTestLegacy(otherUserId)
    const sim = await createTestSim(otherLegacy.id)
    await expect(assertSimOwned(db, sim.id, userId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('throws NOT_FOUND for a nonexistent sim', async () => {
    await expect(assertSimOwned(db, 'nonexistent-id', userId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })
})

describe('assertSimsOwned', () => {
  let userId: string
  let otherUserId: string
  beforeEach(async () => {
    ;({ id: userId } = await createTestUser())
    ;({ id: otherUserId } = await createTestUser())
  })
  afterEach(async () => {
    await cleanupUser(userId)
    await cleanupUser(otherUserId)
  })

  it('returns the sims in input order when all are owned', async () => {
    const legacy = await createTestLegacy(userId)
    const simA = await createTestSim(legacy.id, { firstName: 'A' })
    const simB = await createTestSim(legacy.id, { firstName: 'B' })
    const result = await assertSimsOwned(db, [simB.id, simA.id], userId)
    expect(result.map((s) => s.id)).toEqual([simB.id, simA.id])
  })

  it('handles duplicate ids without throwing', async () => {
    const legacy = await createTestLegacy(userId)
    const sim = await createTestSim(legacy.id)
    const result = await assertSimsOwned(db, [sim.id, sim.id], userId)
    expect(result.map((s) => s.id)).toEqual([sim.id, sim.id])
  })

  it('throws NOT_FOUND when any sim belongs to another user', async () => {
    const legacy = await createTestLegacy(userId)
    const mine = await createTestSim(legacy.id)
    const otherLegacy = await createTestLegacy(otherUserId)
    const theirs = await createTestSim(otherLegacy.id)
    await expect(assertSimsOwned(db, [mine.id, theirs.id], userId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('throws NOT_FOUND when any sim does not exist', async () => {
    const legacy = await createTestLegacy(userId)
    const mine = await createTestSim(legacy.id)
    await expect(assertSimsOwned(db, [mine.id, 'nonexistent-id'], userId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })
})
