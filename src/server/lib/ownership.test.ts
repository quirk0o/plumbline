import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { db } from '@/server/db'
import { createTestUser, cleanupUser, createTestLegacy } from '@/test/helpers'
import { assertLegacyOwned, assertLegacyOwnedBySlug } from './ownership'

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
