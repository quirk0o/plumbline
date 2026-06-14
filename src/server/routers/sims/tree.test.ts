import { describe, expect } from 'vitest'
import { Gender, FamilyRelationshipType, RomanticStatus } from '@prisma/client'
import { authedCaller, unauthCaller } from '@/test/caller'
import { computeKinshipLabels } from '@/components/lineage-tree/kinship'
import {
  createTestUser,
  cleanupUser,
  createTestLegacy,
  createTestSim,
} from '@/test/helpers'
import { test, test as base } from '@/test/test'
import { db } from '@/server/db'

describe('sims.getTreeData', () => {
  // Every test here needs the legacy's slug (the procedure's input) alongside its
  // id — identical derived setup with no per-test data — so a local fixture fits.
  const test = base.extend<{ legacySlug: string }>({
    legacySlug: async ({ legacyId }, provide) => {
      const { slug } = await db.legacy.findUniqueOrThrow({ where: { id: legacyId }, select: { slug: true } })
      await provide(slug)
    },
  })

  test('returns all sims in the legacy', async ({ trpcCaller, legacyId, legacySlug }) => {
    const s1 = await createTestSim(legacyId, { firstName: 'Mortimer' })
    const s2 = await createTestSim(legacyId, { firstName: 'Bella' })
    const result = await trpcCaller.sims.getTreeData({ legacySlug })
    expect(result.sims.map((s) => s.id)).toEqual(expect.arrayContaining([s1.id, s2.id]))
  })

  test('returns biological and adoptive family edges', async ({ trpcCaller, legacyId, legacySlug }) => {
    const parent = await createTestSim(legacyId, { firstName: 'Parent' })
    const bioChild = await createTestSim(legacyId, { firstName: 'BioChild' })
    const adoptedChild = await createTestSim(legacyId, { firstName: 'AdoptedChild' })
    await db.familyRelationship.create({
      data: { parentId: parent.id, childId: bioChild.id, type: FamilyRelationshipType.BIOLOGICAL },
    })
    await db.familyRelationship.create({
      data: { parentId: parent.id, childId: adoptedChild.id, type: FamilyRelationshipType.ADOPTIVE },
    })
    const result = await trpcCaller.sims.getTreeData({ legacySlug })
    expect(result.familyEdges).toContainEqual({ parentId: parent.id, childId: bioChild.id })
    expect(result.familyEdges).toContainEqual({ parentId: parent.id, childId: adoptedChild.id })
  })

  test('exposes the data to derive a step label from a recorded parent marriage', async ({ trpcCaller, legacyId, legacySlug }) => {
    const mum = await createTestSim(legacyId, { firstName: 'Mum', gender: Gender.FEMALE })
    const focus = await createTestSim(legacyId, { firstName: 'Focus', gender: Gender.FEMALE })
    const stepdad = await createTestSim(legacyId, { firstName: 'Stepdad', gender: Gender.MALE })
    await db.familyRelationship.create({
      data: { parentId: mum.id, childId: focus.id, type: FamilyRelationshipType.BIOLOGICAL },
    })
    const [aId, bId] = [mum.id, stepdad.id].sort()
    await db.socialRelationship.create({
      data: { simAId: aId, simBId: bId, romanticStatus: RomanticStatus.MARRIED, friendshipScore: 0, romanceScore: 0 },
    })
    const tree = await trpcCaller.sims.getTreeData({ legacySlug })
    const labels = computeKinshipLabels(focus.id, tree.sims, tree.familyEdges, tree.partnerEdges)
    expect(labels.get(stepdad.id)).toBe('Stepfather')
  })

  test('returns partner edges for non-NONE romantic relationships', async ({ trpcCaller, legacyId, legacySlug }) => {
    const simA = await createTestSim(legacyId, { firstName: 'SimA' })
    const simB = await createTestSim(legacyId, { firstName: 'SimB' })
    const simC = await createTestSim(legacyId, { firstName: 'SimC' })
    const [idA, idB] = [simA.id, simB.id].sort()
    const [idA2, idC] = [simA.id, simC.id].sort()
    await db.socialRelationship.create({
      data: {
        simAId: idA,
        simBId: idB,
        romanticStatus: RomanticStatus.MARRIED,
        friendshipScore: 0,
        romanceScore: 0,
      },
    })
    await db.socialRelationship.create({
      data: {
        simAId: idA2,
        simBId: idC,
        romanticStatus: RomanticStatus.NONE,
        friendshipScore: 50,
        romanceScore: 0,
      },
    })
    const result = await trpcCaller.sims.getTreeData({ legacySlug })
    expect(result.partnerEdges).toContainEqual({ simAId: idA, simBId: idB, romanticStatus: RomanticStatus.MARRIED, endedAt: null })
    expect(result.partnerEdges.map((e) => [e.simAId, e.simBId])).not.toContainEqual([idA2, idC])
  })

  test('returns endedAt on partner edges and isDeceased on sims', async ({ trpcCaller, legacyId, legacySlug }) => {
    const simA = await createTestSim(legacyId, { firstName: 'Alive' })
    const simB = await createTestSim(legacyId, { firstName: 'Gone' })
    await db.sim.update({ where: { id: simB.id }, data: { causeOfDeath: 'OLD_AGE' } })
    const [idA, idB] = [simA.id, simB.id].sort()
    const when = new Date('2026-04-04T00:00:00Z')
    await db.socialRelationship.create({
      data: { simAId: idA, simBId: idB, romanticStatus: RomanticStatus.MARRIED, endedAt: when, friendshipScore: 0, romanceScore: 0 },
    })

    const result = await trpcCaller.sims.getTreeData({ legacySlug })

    const edge = result.partnerEdges.find((e) => e.simAId === idA && e.simBId === idB)
    expect(edge?.endedAt?.toISOString()).toBe(when.toISOString())
    expect(result.sims.find((s) => s.id === simB.id)?.isDeceased).toBe(true)
    expect(result.sims.find((s) => s.id === simA.id)?.isDeceased).toBe(false)
  })

  test('includes romanticStatus on every partner edge', async ({ trpcCaller, legacyId, legacySlug }) => {
    const simA = await createTestSim(legacyId, { firstName: 'SimA' })
    const simB = await createTestSim(legacyId, { firstName: 'SimB' })
    const [idA, idB] = [simA.id, simB.id].sort()
    await db.socialRelationship.create({
      data: {
        simAId: idA,
        simBId: idB,
        romanticStatus: RomanticStatus.MARRIED,
        friendshipScore: 0,
        romanceScore: 0,
      },
    })
    const result = await trpcCaller.sims.getTreeData({ legacySlug })
    expect(result.partnerEdges.length).toBeGreaterThan(0)
    for (const edge of result.partnerEdges) {
      expect(edge).toHaveProperty('romanticStatus')
      expect(edge.romanticStatus).not.toBe(RomanticStatus.NONE)
    }
    expect(result.partnerEdges).toContainEqual({
      simAId: idA,
      simBId: idB,
      romanticStatus: RomanticStatus.MARRIED,
      endedAt: null,
    })
  })

  test('throws NOT_FOUND for a legacy that does not belong to the user', async ({ trpcCaller }) => {
    const otherUser = await createTestUser()
    const otherLegacy = await createTestLegacy(otherUser.id)
    await expect(
      trpcCaller.sims.getTreeData({ legacySlug: otherLegacy.slug }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await cleanupUser(otherUser.id)
  })

  test('throws UNAUTHORIZED without a session', async ({ legacySlug }) => {
    const caller = unauthCaller()
    await expect(
      caller.sims.getTreeData({ legacySlug }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  test('returns empty arrays for a legacy with no sims', async ({ trpcCaller, legacySlug }) => {
    const result = await trpcCaller.sims.getTreeData({ legacySlug })
    expect(result).toEqual({ sims: [], familyEdges: [], partnerEdges: [] })
  })

  test('getTreeData includes gender on each sim', async ({ trpcCaller, legacyId, legacySlug }) => {
    await createTestSim(legacyId, { firstName: 'Bella', gender: Gender.FEMALE })
    const data = await trpcCaller.sims.getTreeData({ legacySlug })
    expect(data.sims[0]).toHaveProperty('gender', 'FEMALE')
  })

  test('does not return partner edges that cross legacy boundaries', async () => {
    // Two users, each with their own legacy and a MARRIED pair
    const userA = await createTestUser()
    const userB = await createTestUser()
    try {
      const legacyA = await createTestLegacy(userA.id)
      const legacyB = await createTestLegacy(userB.id)
      const simA1 = await createTestSim(legacyA.id, { firstName: 'A1' })
      const simA2 = await createTestSim(legacyA.id, { firstName: 'A2' })
      const simB1 = await createTestSim(legacyB.id, { firstName: 'B1' })
      const simB2 = await createTestSim(legacyB.id, { firstName: 'B2' })

      // Legitimate edges within each legacy
      const [a1, a2] = [simA1.id, simA2.id].sort()
      await db.socialRelationship.create({
        data: { simAId: a1, simBId: a2, romanticStatus: RomanticStatus.MARRIED, friendshipScore: 0, romanceScore: 0 },
      })
      const [b1, b2] = [simB1.id, simB2.id].sort()
      await db.socialRelationship.create({
        data: { simAId: b1, simBId: b2, romanticStatus: RomanticStatus.MARRIED, friendshipScore: 0, romanceScore: 0 },
      })

      const callerA = authedCaller(userA.id)
      const result = await callerA.sims.getTreeData({ legacySlug: legacyA.slug })
      const edgeIds = result.partnerEdges.flatMap((e) => [e.simAId, e.simBId])
      expect(edgeIds).not.toContain(simB1.id)
      expect(edgeIds).not.toContain(simB2.id)
    } finally {
      await cleanupUser(userA.id)
      await cleanupUser(userB.id)
    }
  })
})

describe('sims.getMiniTreeData', () => {
  test('includes the focused sim, their parents, and grandparents', async ({ trpcCaller, legacyId }) => {
    const grandparent = await createTestSim(legacyId, { firstName: 'Grandparent' })
    const parent = await createTestSim(legacyId, { firstName: 'Parent' })
    const child = await createTestSim(legacyId, { firstName: 'Child' })
    await db.familyRelationship.createMany({
      data: [
        { parentId: grandparent.id, childId: parent.id, type: FamilyRelationshipType.BIOLOGICAL },
        { parentId: parent.id, childId: child.id, type: FamilyRelationshipType.BIOLOGICAL },
      ],
    })
    const result = await trpcCaller.sims.getMiniTreeData({ simId: child.id })
    const ids = result.sims.map((s) => s.id)
    expect(ids).toContain(child.id)
    expect(ids).toContain(parent.id)
    expect(ids).toContain(grandparent.id)
    const returnedChild = result.sims.find((s) => s.id === child.id)
    expect(returnedChild).toMatchObject({ lifeStage: expect.any(String), isHeir: expect.any(Boolean) })
  })

  test("includes the focused sim's children", async ({ trpcCaller, legacyId }) => {
    const parent = await createTestSim(legacyId, { firstName: 'Parent' })
    const child = await createTestSim(legacyId, { firstName: 'Child' })
    await db.familyRelationship.create({
      data: { parentId: parent.id, childId: child.id, type: FamilyRelationshipType.BIOLOGICAL },
    })
    const result = await trpcCaller.sims.getMiniTreeData({ simId: parent.id })
    expect(result.sims.map((s) => s.id)).toContain(child.id)
  })

  test("includes the focused sim's partner in sims and partnerEdges", async ({ trpcCaller, legacyId }) => {
    const focused = await createTestSim(legacyId, { firstName: 'Focused' })
    const partner = await createTestSim(legacyId, { firstName: 'Partner' })
    const [idA, idB] = [focused.id, partner.id].sort()
    await db.socialRelationship.create({
      data: {
        simAId: idA,
        simBId: idB,
        romanticStatus: RomanticStatus.MARRIED,
        friendshipScore: 0,
        romanceScore: 0,
      },
    })
    const result = await trpcCaller.sims.getMiniTreeData({ simId: focused.id })
    const ids = result.sims.map((s) => s.id)
    expect(ids).toContain(focused.id)
    expect(ids).toContain(partner.id)
    expect(result.partnerEdges).toContainEqual({ simAId: idA, simBId: idB, romanticStatus: RomanticStatus.MARRIED, endedAt: null })
  })

  test('includes romanticStatus on every partner edge', async ({ trpcCaller, legacyId }) => {
    const focused = await createTestSim(legacyId, { firstName: 'Focused' })
    const partner = await createTestSim(legacyId, { firstName: 'Partner' })
    const [idA, idB] = [focused.id, partner.id].sort()
    await db.socialRelationship.create({
      data: {
        simAId: idA,
        simBId: idB,
        romanticStatus: RomanticStatus.MARRIED,
        friendshipScore: 0,
        romanceScore: 0,
      },
    })
    const result = await trpcCaller.sims.getMiniTreeData({ simId: focused.id })
    expect(result.partnerEdges.length).toBeGreaterThan(0)
    for (const edge of result.partnerEdges) {
      expect(edge).toHaveProperty('romanticStatus')
    }
    expect(result.partnerEdges).toContainEqual({
      simAId: idA,
      simBId: idB,
      romanticStatus: RomanticStatus.MARRIED,
      endedAt: null,
    })
  })

  test('throws NOT_FOUND for a sim that does not belong to the user', async ({ trpcCaller }) => {
    const otherUser = await createTestUser()
    const otherLegacy = await createTestLegacy(otherUser.id)
    const otherSim = await createTestSim(otherLegacy.id)
    await expect(trpcCaller.sims.getMiniTreeData({ simId: otherSim.id })).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await cleanupUser(otherUser.id)
  })

  test('throws UNAUTHORIZED without a session', async ({ legacyId }) => {
    const sim = await createTestSim(legacyId, { firstName: 'Focused' })
    const caller = unauthCaller()
    await expect(caller.sims.getMiniTreeData({ simId: sim.id })).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  test('includes an ADOPTIVE parent in sims and familyEdges', async ({ trpcCaller, legacyId }) => {
    const parent = await createTestSim(legacyId, { firstName: 'AdoptiveParent' })
    const child = await createTestSim(legacyId, { firstName: 'AdoptedChild' })
    await db.familyRelationship.create({
      data: { parentId: parent.id, childId: child.id, type: FamilyRelationshipType.ADOPTIVE },
    })
    const result = await trpcCaller.sims.getMiniTreeData({ simId: child.id })
    expect(result.sims.map((s) => s.id)).toContain(parent.id)
    expect(result.familyEdges).toContainEqual({ parentId: parent.id, childId: child.id })
  })

  test('does not include the great-grandparent (4-generation chain)', async ({ trpcCaller, legacyId }) => {
    const greatGrandparent = await createTestSim(legacyId, { firstName: 'GreatGrandparent' })
    const grandparent = await createTestSim(legacyId, { firstName: 'Grandparent' })
    const parent = await createTestSim(legacyId, { firstName: 'Parent' })
    const child = await createTestSim(legacyId, { firstName: 'Child' })
    await db.familyRelationship.createMany({
      data: [
        { parentId: greatGrandparent.id, childId: grandparent.id, type: FamilyRelationshipType.BIOLOGICAL },
        { parentId: grandparent.id, childId: parent.id, type: FamilyRelationshipType.BIOLOGICAL },
        { parentId: parent.id, childId: child.id, type: FamilyRelationshipType.BIOLOGICAL },
      ],
    })
    const result = await trpcCaller.sims.getMiniTreeData({ simId: child.id })
    const ids = result.sims.map((s) => s.id)
    expect(ids).toContain(child.id)
    expect(ids).toContain(parent.id)
    expect(ids).toContain(grandparent.id)
    expect(ids).not.toContain(greatGrandparent.id)
  })

  test('includes ended (ex) relationships in partnerEdges, carrying endedAt', async ({ trpcCaller, legacyId }) => {
    const focused = await createTestSim(legacyId, { firstName: 'Focused' })
    const exPartner = await createTestSim(legacyId, { firstName: 'ExPartner' })
    const [idA, idB] = [focused.id, exPartner.id].sort()
    const when = new Date('2026-01-01T00:00:00Z')
    await db.socialRelationship.create({
      data: {
        simAId: idA,
        simBId: idB,
        romanticStatus: RomanticStatus.MARRIED,
        endedAt: when,
        friendshipScore: 0,
        romanceScore: 0,
      },
    })
    const result = await trpcCaller.sims.getMiniTreeData({ simId: focused.id })
    const edge = result.partnerEdges.find((e) => e.simAId === idA && e.simBId === idB)
    expect(edge?.romanticStatus).toBe(RomanticStatus.MARRIED)
    expect(edge?.endedAt?.toISOString()).toBe(when.toISOString())
    expect(result.sims.map((s) => s.id)).toContain(exPartner.id)
  })

  test('does not include a partner sim from another legacy in the backfill', async ({ trpcCaller, legacyId }) => {
    // After the backfill fix, missingPartnerIds are scoped to the user's own legacies only.
    // We manufacture the scenario by directly creating a cross-legacy social relationship
    // between a sim in our legacy (simA) and a sim in another user's legacy (simB).
    // The backfill query must not return simB.
    const otherUser = await createTestUser()
    try {
      const otherLegacy = await createTestLegacy(otherUser.id)
      const ourSim = await createTestSim(legacyId, { firstName: 'OurSim' })
      const theirSim = await createTestSim(otherLegacy.id, { firstName: 'TheirSim' })

      // Force-insert a cross-legacy social relationship directly (bypassing the tRPC guard)
      const [idA, idB] = [ourSim.id, theirSim.id].sort()
      await db.socialRelationship.create({
        data: {
          simAId: idA,
          simBId: idB,
          romanticStatus: RomanticStatus.MARRIED,
          friendshipScore: 0,
          romanceScore: 0,
        },
      })

      const result = await trpcCaller.sims.getMiniTreeData({ simId: ourSim.id })
      expect(result.sims.map((s) => s.id)).not.toContain(theirSim.id)
    } finally {
      await cleanupUser(otherUser.id)
    }
  })
})

