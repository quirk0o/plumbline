import { describe, expect } from 'vitest'
import { FamilyRelationshipType } from '@prisma/client'
import { authedCaller } from '@/test/caller'
import {
  createTestUser,
  cleanupUser,
  createTestLegacy,
  createTestSim,
} from '@/test/helpers'
import { test } from '@/test/test'
import { db } from '@/server/db'
import { failingDb } from './test-helpers'

describe('sims.family.add / sims.family.remove', () => {
  test('creates a family relationship', async ({ trpcCaller, legacyId }) => {
    const parent = await createTestSim(legacyId, { firstName: 'Parent' })
    const child = await createTestSim(legacyId, { firstName: 'Child' })
    await trpcCaller.sims.family.add({
      parentId: parent.id,
      childId: child.id,
      type: FamilyRelationshipType.BIOLOGICAL,
    })
    const row = await db.familyRelationship.findUnique({
      where: { parentId_childId: { parentId: parent.id, childId: child.id } },
    })
    expect(row?.type).toBe(FamilyRelationshipType.BIOLOGICAL)
  })

  test('does not persist the relationship when the generation derivation write fails', async ({ userId, legacyId }) => {
    const parent = await createTestSim(legacyId, { firstName: 'Parent' })
    const child = await createTestSim(legacyId, { firstName: 'Child' })
    await db.sim.update({ where: { id: parent.id }, data: { generationNumber: 1 } })

    await expect(
      authedCaller(userId, failingDb('sim', 'update')).sims.family.add({
        parentId: parent.id,
        childId: child.id,
        type: FamilyRelationshipType.BIOLOGICAL,
      })
    ).rejects.toThrow()

    const row = await db.familyRelationship.findUnique({
      where: { parentId_childId: { parentId: parent.id, childId: child.id } },
    })
    expect(row).toBeNull()
  })

  test('keeps the relationship when the generation recompute write fails on removal', async ({ userId, legacyId }) => {
    const parent = await createTestSim(legacyId, { firstName: 'Parent' })
    const child = await createTestSim(legacyId, { firstName: 'Child' })
    const parent2 = await createTestSim(legacyId, { firstName: 'Parent2', generationNumber: 3 })
    await db.sim.update({ where: { id: parent.id }, data: { generationNumber: 2 } })
    await db.sim.update({ where: { id: child.id }, data: { generationNumber: 99 } })
    await db.familyRelationship.createMany({
      data: [
        { parentId: parent.id, childId: child.id, type: FamilyRelationshipType.BIOLOGICAL },
        { parentId: parent2.id, childId: child.id, type: FamilyRelationshipType.BIOLOGICAL },
      ],
    })
    // After removing parentId (gen=2), only parent2 (gen=3) remains.
    // recompute derives child=4 which differs from 99 → sim.update fires → injected failure rolls back.
    await expect(
      authedCaller(userId, failingDb('sim', 'update')).sims.family.remove({ parentId: parent.id, childId: child.id })
    ).rejects.toThrow()

    const row = await db.familyRelationship.findUnique({
      where: { parentId_childId: { parentId: parent.id, childId: child.id } },
    })
    expect(row).not.toBeNull()
    expect((await db.sim.findUnique({ where: { id: child.id } }))?.generationNumber).toBe(99)
  })

  test('removes a family relationship', async ({ trpcCaller, legacyId }) => {
    const parent = await createTestSim(legacyId, { firstName: 'Parent' })
    const child = await createTestSim(legacyId, { firstName: 'Child' })
    await db.familyRelationship.create({ data: { parentId: parent.id, childId: child.id, type: FamilyRelationshipType.BIOLOGICAL } })
    await trpcCaller.sims.family.remove({ parentId: parent.id, childId: child.id })
    const row = await db.familyRelationship.findUnique({
      where: { parentId_childId: { parentId: parent.id, childId: child.id } },
    })
    expect(row).toBeNull()
  })

  test('throws NOT_FOUND when parent belongs to another user', async ({ trpcCaller, legacyId }) => {
    const child = await createTestSim(legacyId, { firstName: 'Child' })
    const other = await createTestUser()
    const otherLegacy = await createTestLegacy(other.id)
    const otherSim = await createTestSim(otherLegacy.id)
    try {
      await expect(
        trpcCaller.sims.family.add({
          parentId: otherSim.id,
          childId: child.id,
          type: FamilyRelationshipType.BIOLOGICAL,
        })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    } finally {
      await cleanupUser(other.id)
    }
  })

  test('throws NOT_FOUND when child belongs to another user', async ({ trpcCaller, legacyId }) => {
    const parent = await createTestSim(legacyId, { firstName: 'Parent' })
    const child = await createTestSim(legacyId, { firstName: 'Child' })
    const other = await createTestUser()
    const otherLegacy = await createTestLegacy(other.id)
    const otherSim = await createTestSim(otherLegacy.id)
    try {
      await db.familyRelationship.create({ data: { parentId: parent.id, childId: child.id, type: FamilyRelationshipType.BIOLOGICAL } })
      await expect(
        trpcCaller.sims.family.remove({
          parentId: parent.id,
          childId: otherSim.id,
        })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    } finally {
      await cleanupUser(other.id)
    }
  })

  test('throws BAD_REQUEST when parentId equals childId', async ({ trpcCaller, legacyId }) => {
    const parent = await createTestSim(legacyId, { firstName: 'Parent' })
    await expect(
      trpcCaller.sims.family.add({
        parentId: parent.id,
        childId: parent.id,
        type: FamilyRelationshipType.BIOLOGICAL,
      })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  test('throws BAD_REQUEST when sims belong to different legacies', async ({ trpcCaller, userId, legacyId }) => {
    const parent = await createTestSim(legacyId, { firstName: 'Parent' })
    const secondLegacy = await createTestLegacy(userId)
    const secondLegacySim = await createTestSim(secondLegacy.id)
    await expect(
      trpcCaller.sims.family.add({
        parentId: parent.id,
        childId: secondLegacySim.id,
        type: FamilyRelationshipType.BIOLOGICAL,
      })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  test('throws NOT_FOUND when parent belongs to another user in removeFamilyRelationship', async ({ trpcCaller, legacyId }) => {
    const child = await createTestSim(legacyId, { firstName: 'Child' })
    const other = await createTestUser()
    const otherLegacy = await createTestLegacy(other.id)
    const otherSim = await createTestSim(otherLegacy.id)
    try {
      await expect(
        trpcCaller.sims.family.remove({
          parentId: otherSim.id,
          childId: child.id,
        })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    } finally {
      await cleanupUser(other.id)
    }
  })

  test('derives child generationNumber from parent when child has no generationNumber', async ({ trpcCaller, legacyId }) => {
    const parent = await createTestSim(legacyId, { firstName: 'Parent' })
    const child = await createTestSim(legacyId, { firstName: 'Child' })
    await db.sim.update({ where: { id: parent.id }, data: { generationNumber: 1 } })
    await trpcCaller.sims.family.add({
      parentId: parent.id,
      childId: child.id,
      type: FamilyRelationshipType.BIOLOGICAL,
    })
    const record = await db.sim.findUnique({ where: { id: child.id } })
    expect(record?.generationNumber).toBe(2)
  })

  test('overrides child generationNumber to max+1 when a parent is added', async ({ trpcCaller, legacyId }) => {
    const parent = await createTestSim(legacyId, { firstName: 'Parent' })
    const child = await createTestSim(legacyId, { firstName: 'Child' })
    await db.sim.update({ where: { id: parent.id }, data: { generationNumber: 1 } })
    await db.sim.update({ where: { id: child.id }, data: { generationNumber: 5 } })
    await trpcCaller.sims.family.add({
      parentId: parent.id, childId: child.id, type: FamilyRelationshipType.BIOLOGICAL,
    })
    const record = await db.sim.findUnique({ where: { id: child.id } })
    expect(record?.generationNumber).toBe(2) // derived: max(1)+1, prior value discarded
  })

  test('uses max parent gen and cascades to descendants when a parent is added', async ({ trpcCaller, legacyId }) => {
    const parent = await createTestSim(legacyId, { firstName: 'Parent' })
    const child = await createTestSim(legacyId, { firstName: 'Child' })
    const existingParent = await createTestSim(legacyId, { firstName: 'OtherParent', generationNumber: 3 })
    await db.sim.update({ where: { id: parent.id }, data: { generationNumber: 2 } })
    const grandchild = await createTestSim(legacyId, { firstName: 'GC', generationNumber: 99 })
    await db.familyRelationship.createMany({
      data: [
        { parentId: existingParent.id, childId: child.id, type: FamilyRelationshipType.BIOLOGICAL },
        { parentId: child.id, childId: grandchild.id, type: FamilyRelationshipType.BIOLOGICAL },
      ],
    })
    await trpcCaller.sims.family.add({
      parentId: parent.id, childId: child.id, type: FamilyRelationshipType.BIOLOGICAL,
    })
    expect((await db.sim.findUnique({ where: { id: child.id } }))?.generationNumber).toBe(4)      // max(2,3)+1
    expect((await db.sim.findUnique({ where: { id: grandchild.id } }))?.generationNumber).toBe(5) // cascaded
  })

  test('updates child generationNumber after removing one parent when another remains', async ({ trpcCaller, legacyId }) => {
    const parent = await createTestSim(legacyId, { firstName: 'Parent' })
    const child = await createTestSim(legacyId, { firstName: 'Child' })
    const parent2 = await createTestSim(legacyId, { firstName: 'Parent2' })
    await db.sim.update({ where: { id: parent.id }, data: { generationNumber: 1 } })
    await db.sim.update({ where: { id: parent2.id }, data: { generationNumber: 3 } })
    await db.sim.update({ where: { id: child.id }, data: { generationNumber: 2 } })
    await db.familyRelationship.createMany({
      data: [
        { parentId: parent.id, childId: child.id, type: FamilyRelationshipType.BIOLOGICAL },
        { parentId: parent2.id, childId: child.id, type: FamilyRelationshipType.BIOLOGICAL },
      ],
    })
    await trpcCaller.sims.family.remove({ parentId: parent.id, childId: child.id })
    const record = await db.sim.findUnique({ where: { id: child.id } })
    expect(record?.generationNumber).toBe(4)
  })

  test('retains the child generation as a root value when the last parent is removed', async ({ trpcCaller, legacyId }) => {
    const parent = await createTestSim(legacyId, { firstName: 'Parent' })
    const child = await createTestSim(legacyId, { firstName: 'Child' })
    await db.sim.update({ where: { id: parent.id }, data: { generationNumber: 1 } })
    await db.sim.update({ where: { id: child.id }, data: { generationNumber: 2 } })
    await db.familyRelationship.create({
      data: { parentId: parent.id, childId: child.id, type: FamilyRelationshipType.BIOLOGICAL },
    })
    await trpcCaller.sims.family.remove({ parentId: parent.id, childId: child.id })
    const record = await db.sim.findUnique({ where: { id: child.id } })
    expect(record?.generationNumber).toBe(2) // kept; child is now a root
  })
})

