import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { db } from '@/server/db'
import {
  createTestUser,
  cleanupUser,
  createTestLegacy,
  createTestSim,
  createTestHousehold,
  createTestChallengeRun,
} from '@/test/helpers'
import { withTestUser } from '@/test/fixtures'
import {
  assertLegacyOwned,
  assertLegacyOwnedBySlug,
  assertSimOwned,
  assertSimsOwned,
  assertHouseholdOwned,
  assertMilestoneOwned,
  assertChallengeRunOwned,
} from './ownership'

describe('assertLegacyOwned', () => {
  const ctx = withTestUser()
  let otherUserId: string
  beforeEach(async () => {
    ;({ id: otherUserId } = await createTestUser())
  })
  afterEach(async () => {
    await cleanupUser(otherUserId)
  })

  it('returns the legacy when the user owns it', async () => {
    const legacy = await createTestLegacy(ctx.userId)
    const result = await assertLegacyOwned(db, legacy.id, ctx.userId)
    expect(result.id).toBe(legacy.id)
    expect(result.userId).toBe(ctx.userId)
  })

  it("throws NOT_FOUND for another user's legacy", async () => {
    const legacy = await createTestLegacy(otherUserId)
    await expect(assertLegacyOwned(db, legacy.id, ctx.userId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('throws NOT_FOUND for a nonexistent legacy', async () => {
    await expect(assertLegacyOwned(db, 'nonexistent-id', ctx.userId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })
})

describe('assertLegacyOwnedBySlug', () => {
  const ctx = withTestUser()
  let otherUserId: string
  beforeEach(async () => {
    ;({ id: otherUserId } = await createTestUser())
  })
  afterEach(async () => {
    await cleanupUser(otherUserId)
  })

  it('returns the legacy when the user owns it', async () => {
    const legacy = await createTestLegacy(ctx.userId)
    const result = await assertLegacyOwnedBySlug(db, legacy.slug, ctx.userId)
    expect(result.id).toBe(legacy.id)
  })

  it("throws NOT_FOUND for another user's legacy slug", async () => {
    const legacy = await createTestLegacy(otherUserId)
    await expect(assertLegacyOwnedBySlug(db, legacy.slug, ctx.userId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })
})

describe('assertSimOwned', () => {
  const ctx = withTestUser()
  let otherUserId: string
  beforeEach(async () => {
    ;({ id: otherUserId } = await createTestUser())
  })
  afterEach(async () => {
    await cleanupUser(otherUserId)
  })

  it("returns the sim when it belongs to the user's legacy", async () => {
    const legacy = await createTestLegacy(ctx.userId)
    const sim = await createTestSim(legacy.id)
    const result = await assertSimOwned(db, sim.id, ctx.userId)
    expect(result.id).toBe(sim.id)
    expect(result.legacyId).toBe(legacy.id)
  })

  it("throws NOT_FOUND for a sim in another user's legacy", async () => {
    const otherLegacy = await createTestLegacy(otherUserId)
    const sim = await createTestSim(otherLegacy.id)
    await expect(assertSimOwned(db, sim.id, ctx.userId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('throws NOT_FOUND for a nonexistent sim', async () => {
    await expect(assertSimOwned(db, 'nonexistent-id', ctx.userId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })
})

describe('assertSimsOwned', () => {
  const ctx = withTestUser()
  let otherUserId: string
  beforeEach(async () => {
    ;({ id: otherUserId } = await createTestUser())
  })
  afterEach(async () => {
    await cleanupUser(otherUserId)
  })

  it('returns the sims in input order when all are owned', async () => {
    const legacy = await createTestLegacy(ctx.userId)
    const simA = await createTestSim(legacy.id, { firstName: 'A' })
    const simB = await createTestSim(legacy.id, { firstName: 'B' })
    const result = await assertSimsOwned(db, [simB.id, simA.id], ctx.userId)
    expect(result.map((s) => s.id)).toEqual([simB.id, simA.id])
  })

  it('handles duplicate ids without throwing', async () => {
    const legacy = await createTestLegacy(ctx.userId)
    const sim = await createTestSim(legacy.id)
    const result = await assertSimsOwned(db, [sim.id, sim.id], ctx.userId)
    expect(result.map((s) => s.id)).toEqual([sim.id, sim.id])
  })

  it('returns an empty array for an empty input without throwing', async () => {
    expect(await assertSimsOwned(db, [], ctx.userId)).toEqual([])
  })

  it('throws NOT_FOUND when any sim belongs to another user', async () => {
    const legacy = await createTestLegacy(ctx.userId)
    const mine = await createTestSim(legacy.id)
    const otherLegacy = await createTestLegacy(otherUserId)
    const theirs = await createTestSim(otherLegacy.id)
    await expect(assertSimsOwned(db, [mine.id, theirs.id], ctx.userId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('throws NOT_FOUND when any sim does not exist', async () => {
    const legacy = await createTestLegacy(ctx.userId)
    const mine = await createTestSim(legacy.id)
    await expect(assertSimsOwned(db, [mine.id, 'nonexistent-id'], ctx.userId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })
})

describe('entity ownership helpers (household, milestone, challenge run)', () => {
  const ctx = withTestUser()
  let otherUserId: string
  let myLegacyId: string
  let theirLegacyId: string
  beforeEach(async () => {
    ;({ id: otherUserId } = await createTestUser())
    myLegacyId = (await createTestLegacy(ctx.userId)).id
    theirLegacyId = (await createTestLegacy(otherUserId)).id
  })
  afterEach(async () => {
    await cleanupUser(otherUserId)
  })

  it('assertHouseholdOwned returns the owned household and rejects a foreign one', async () => {
    const mine = await createTestHousehold(myLegacyId)
    const theirs = await createTestHousehold(theirLegacyId)
    const result = await assertHouseholdOwned(db, mine.id, ctx.userId)
    expect(result.id).toBe(mine.id)
    expect(result.legacyId).toBe(myLegacyId)
    await expect(assertHouseholdOwned(db, theirs.id, ctx.userId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('assertMilestoneOwned returns the owned milestone and rejects a foreign one', async () => {
    const mine = await db.milestone.create({
      data: { legacyId: myLegacyId, title: 'Mine', sortOrder: 0 },
    })
    const theirs = await db.milestone.create({
      data: { legacyId: theirLegacyId, title: 'Theirs', sortOrder: 0 },
    })
    const result = await assertMilestoneOwned(db, mine.id, ctx.userId)
    expect(result.id).toBe(mine.id)
    expect(result.legacyId).toBe(myLegacyId)
    await expect(assertMilestoneOwned(db, theirs.id, ctx.userId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('assertChallengeRunOwned returns the owned run and rejects a foreign one', async () => {
    const mine = await createTestChallengeRun(myLegacyId)
    const theirs = await createTestChallengeRun(theirLegacyId)
    const result = await assertChallengeRunOwned(db, mine.id, ctx.userId)
    expect(result.id).toBe(mine.id)
    expect(result.legacyId).toBe(myLegacyId)
    await expect(assertChallengeRunOwned(db, theirs.id, ctx.userId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })
})
