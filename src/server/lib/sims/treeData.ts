import { FamilyRelationshipType, RomanticStatus, type PrismaClient } from '@prisma/client'

/** Fetch a legacy's full tree: sims, parent-child edges, and romantic partner edges. */
export async function getTreeData(db: PrismaClient, legacyId: string, legacySlug: string) {
  const [sims, familyEdges, partnerEdges] = await Promise.all([
    db.sim.findMany({
      where: { legacyId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        imageUrl: true,
        generationNumber: true,
        lifeStage: true,
        isHeir: true,
        gender: true,
        causeOfDeath: true,
      },
      orderBy: { id: 'asc' },
    }),
    db.familyRelationship.findMany({
      where: {
        parent: { legacyId },
        child: { legacyId },
        type: { in: [FamilyRelationshipType.BIOLOGICAL, FamilyRelationshipType.ADOPTIVE] },
      },
      select: { parentId: true, childId: true },
      orderBy: { parentId: 'asc' },
    }),
    db.socialRelationship.findMany({
      where: {
        AND: [{ simA: { legacyId } }, { simB: { legacyId } }],
        romanticStatus: { not: RomanticStatus.NONE },
      },
      select: { simAId: true, simBId: true, romanticStatus: true, endedAt: true },
      orderBy: { simAId: 'asc' },
    }),
  ])

  return {
    sims: sims.map(({ causeOfDeath, ...s }) => ({
      ...s,
      isDeceased: causeOfDeath !== null,
      href: `/app/legacies/${legacySlug}/sims/${s.id}`,
    })),
    familyEdges: familyEdges.map((e) => ({ parentId: e.parentId, childId: e.childId })),
    partnerEdges: partnerEdges.map((e) => ({
      simAId: e.simAId,
      simBId: e.simBId,
      romanticStatus: e.romanticStatus,
      endedAt: e.endedAt,
    })),
  }
}
