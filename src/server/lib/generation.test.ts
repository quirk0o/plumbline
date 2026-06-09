import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createTestUser, cleanupUser, createTestLegacy, createTestSim } from '@/test/helpers'
import { db } from '@/server/db'
import { FamilyRelationshipType } from '@prisma/client'
import { deriveGeneration, recomputeGenerations } from './generation'

describe('deriveGeneration', () => {
  it('is one greater than the highest parent generation', () => {
    expect(deriveGeneration([1])).toBe(2)
    expect(deriveGeneration([2, 4, 3])).toBe(5)
  })

  it('throws when given no parent generations', () => {
    expect(() => deriveGeneration([])).toThrow()
  })
})

describe('recomputeGenerations', () => {
  let userId: string
  let legacyId: string

  beforeEach(async () => {
    ;({ id: userId } = await createTestUser())
    const legacy = await createTestLegacy(userId)
    legacyId = legacy.id
  })
  afterEach(async () => { await cleanupUser(userId) })

  it('backfills a null root to the legacy latest and derives the chain to max+1', async () => {
    // grandparent (root, gen 3) -> parent (derived) -> child (derived)
    const gp = await createTestSim(legacyId, { firstName: 'GP', generationNumber: 3 })
    const partner = await createTestSim(legacyId, { firstName: 'Partner', generationNumber: 1 })
    const parent = await createTestSim(legacyId, { firstName: 'Parent', generationNumber: 1 })
    const child = await createTestSim(legacyId, { firstName: 'Child', generationNumber: 1 })
    await db.familyRelationship.createMany({
      data: [
        { parentId: gp.id, childId: parent.id, type: FamilyRelationshipType.BIOLOGICAL },
        { parentId: parent.id, childId: child.id, type: FamilyRelationshipType.BIOLOGICAL },
      ],
    })

    await db.$transaction((tx) => recomputeGenerations(tx, legacyId))

    const rows = await db.sim.findMany({ where: { legacyId }, select: { id: true, generationNumber: true } })
    const gen = new Map(rows.map((r) => [r.id, r.generationNumber]))
    expect(gen.get(gp.id)).toBe(3)         // root kept
    expect(gen.get(partner.id)).toBe(1)    // root: seeded at 1, no parents; recompute leaves roots fixed
    expect(gen.get(parent.id)).toBe(4)     // derived: max(3)+1
    expect(gen.get(child.id)).toBe(5)      // derived: max(4)+1
  })

  it('normalizes a min-based value to max+1 (migration parity)', async () => {
    const p1 = await createTestSim(legacyId, { firstName: 'P1', generationNumber: 1 })
    const p2 = await createTestSim(legacyId, { firstName: 'P2', generationNumber: 3 })
    // Simulate legacy min-based data: child stored as min(1,3)+1 = 2.
    const child = await createTestSim(legacyId, { firstName: 'C', generationNumber: 2 })
    await db.familyRelationship.createMany({
      data: [
        { parentId: p1.id, childId: child.id, type: FamilyRelationshipType.BIOLOGICAL },
        { parentId: p2.id, childId: child.id, type: FamilyRelationshipType.BIOLOGICAL },
      ],
    })
    await db.$transaction((tx) => recomputeGenerations(tx, legacyId))
    expect((await db.sim.findUnique({ where: { id: child.id } }))?.generationNumber).toBe(4)
  })

  it('uses the highest parent when parents differ', async () => {
    const p1 = await createTestSim(legacyId, { firstName: 'P1', generationNumber: 2 })
    const p2 = await createTestSim(legacyId, { firstName: 'P2', generationNumber: 4 })
    const child = await createTestSim(legacyId, { firstName: 'C', generationNumber: 99 })
    await db.familyRelationship.createMany({
      data: [
        { parentId: p1.id, childId: child.id, type: FamilyRelationshipType.BIOLOGICAL },
        { parentId: p2.id, childId: child.id, type: FamilyRelationshipType.BIOLOGICAL },
      ],
    })

    await db.$transaction((tx) => recomputeGenerations(tx, legacyId))

    const c = await db.sim.findUnique({ where: { id: child.id } })
    expect(c?.generationNumber).toBe(5) // max(2,4)+1
  })
})
