import { TRPCError } from '@trpc/server'
import type { FamilyRelationshipType, PrismaClient, Sim } from '@prisma/client'
import { recomputeGenerations } from '../legacies/generation'
import { recomputeLegacyTrackers } from '../challenges/trackerComputation'

/** Create a parent-child edge between same-legacy sims; recompute generations and trackers. */
export async function addFamilyRelationship(
  db: PrismaClient,
  parent: Sim,
  child: Sim,
  type: FamilyRelationshipType,
) {
  if (parent.legacyId !== child.legacyId) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Sims must belong to the same legacy' })
  }
  const created = await db.$transaction(async (tx) => {
    const rel = await tx.familyRelationship.create({
      data: { parentId: parent.id, childId: child.id, type },
    })
    await recomputeGenerations(tx, child.legacyId)
    return rel
  })
  void recomputeLegacyTrackers(db, child.legacyId)
  return created
}

/** Delete a parent-child edge; recompute generations and trackers. */
export async function removeFamilyRelationship(db: PrismaClient, parentId: string, child: Sim) {
  await db.$transaction(async (tx) => {
    await tx.familyRelationship.delete({
      where: { parentId_childId: { parentId, childId: child.id } },
    })
    await recomputeGenerations(tx, child.legacyId)
  })
  void recomputeLegacyTrackers(db, child.legacyId)
  return { parentId, childId: child.id }
}
