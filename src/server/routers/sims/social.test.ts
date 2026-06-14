import { describe, expect } from 'vitest'
import { FamilyRelationshipType, RomanticStatus } from '@prisma/client'
import { authedCaller } from '@/test/caller'
import { deriveRomanticState } from '@/lib/romantic-status'
import {
  createTestUser,
  cleanupUser,
  createTestLegacy,
  createTestSim,
} from '@/test/helpers'
import { test } from '@/test/test'
import { db } from '@/server/db'
import { failingDb } from './test-helpers'

describe('sims.social.add / sims.social.update / sims.social.remove', () => {
  /** Two sims in the legacy, returned as the normalised (sorted) [simAId, simBId] pair. */
  async function makePair(legacyId: string): Promise<[string, string]> {
    const simA = await createTestSim(legacyId, { firstName: 'Alpha' })
    const simB = await createTestSim(legacyId, { firstName: 'Beta' })
    return [simA.id, simB.id].sort() as [string, string]
  }

  test('creates a social relationship with normalised IDs', async ({ trpcCaller, legacyId }) => {
    const [simAId, simBId] = await makePair(legacyId)
    await trpcCaller.sims.social.add({
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
      authedCaller(userId, failingDb('sim', 'update')).sims.social.add({
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

    await trpcCaller.sims.social.add({ simAId, simBId, romanticStatus: RomanticStatus.MARRIED })

    expect((await db.sim.findUnique({ where: { id: simAId } }))?.generationNumber).toBe(5)
  })

  test('normalises ID order regardless of input order', async ({ trpcCaller, legacyId }) => {
    const [simAId, simBId] = await makePair(legacyId)
    await trpcCaller.sims.social.add({
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
    await trpcCaller.sims.social.update({
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
    const rel = await trpcCaller.sims.social.add({
      simAId, simBId, romanticStatus: RomanticStatus.MARRIED, endedAt: when,
    })
    expect(rel.endedAt?.toISOString()).toBe(when.toISOString())
  })

  test('updateSocialRelationship can set and clear endedAt', async ({ trpcCaller, legacyId }) => {
    const [simAId, simBId] = await makePair(legacyId)
    await trpcCaller.sims.social.add({ simAId, simBId, romanticStatus: RomanticStatus.MARRIED })
    const when = new Date('2026-03-03T00:00:00Z')
    const ended = await trpcCaller.sims.social.update({ simAId, simBId, romanticStatus: RomanticStatus.MARRIED, endedAt: when })
    expect(ended.endedAt?.toISOString()).toBe(when.toISOString())
    const reopened = await trpcCaller.sims.social.update({ simAId, simBId, romanticStatus: RomanticStatus.MARRIED, endedAt: null })
    expect(reopened.endedAt).toBeNull()
  })

  test('updateSocialRelationship coerces an ISO-string endedAt (the over-the-wire shape; no tRPC transformer)', async ({ trpcCaller, legacyId }) => {
    const [simAId, simBId] = await makePair(legacyId)
    await trpcCaller.sims.social.add({ simAId, simBId, romanticStatus: RomanticStatus.MARRIED })
    // httpBatchLink JSON-serialises a Date to an ISO string; the input must coerce it back.
    const iso = '2026-03-03T00:00:00.000Z'
    const ended = await trpcCaller.sims.social.update({
      simAId, simBId, romanticStatus: RomanticStatus.MARRIED, endedAt: iso as unknown as Date,
    })
    expect(ended.endedAt?.toISOString()).toBe(iso)
  })

  test('removes the relationship', async ({ trpcCaller, legacyId }) => {
    const [simAId, simBId] = await makePair(legacyId)
    await db.socialRelationship.create({
      data: { simAId, simBId, romanticStatus: RomanticStatus.NONE, friendshipScore: 0, romanceScore: 0 },
    })
    await trpcCaller.sims.social.remove({ simAId, simBId })
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
        trpcCaller.sims.social.add({
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
      trpcCaller.sims.social.add({
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
    await trpcCaller.sims.social.add({ simAId, simBId, romanticStatus: RomanticStatus.DATING })
    const record = await db.sim.findUnique({ where: { id: simAId } })
    expect(record?.generationNumber).toBe(2)
  })

  test('adoption works regardless of which partner is the derived one', async ({ trpcCaller, legacyId }) => {
    const [simAId, simBId] = await makePair(legacyId)
    const parent = await createTestSim(legacyId, { firstName: 'ParentForAdopt2', generationNumber: 2 })
    await db.familyRelationship.create({ data: { parentId: parent.id, childId: simAId, type: FamilyRelationshipType.BIOLOGICAL } })
    await db.sim.update({ where: { id: simAId }, data: { generationNumber: 3 } })
    await trpcCaller.sims.social.add({ simAId, simBId, romanticStatus: RomanticStatus.DATING })
    const record = await db.sim.findUnique({ where: { id: simBId } })
    expect(record?.generationNumber).toBe(3)
  })

  test('does not change either partner generation when both are roots', async ({ trpcCaller, legacyId }) => {
    const [simAId, simBId] = await makePair(legacyId)
    await db.sim.update({ where: { id: simAId }, data: { generationNumber: 2 } })
    await db.sim.update({ where: { id: simBId }, data: { generationNumber: 5 } })
    await trpcCaller.sims.social.add({ simAId, simBId, romanticStatus: RomanticStatus.MARRIED })
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
    await trpcCaller.sims.social.add({ simAId, simBId, romanticStatus: RomanticStatus.DATING })
    expect((await db.sim.findUnique({ where: { id: simAId } }))?.generationNumber).toBe(2)
    expect((await db.sim.findUnique({ where: { id: simBId } }))?.generationNumber).toBe(5)
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
        trpcCaller.sims.social.update({
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
        trpcCaller.sims.social.remove({ simAId: mySimId, simBId: theirSimId }),
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
