import { db } from '@/server/db'

/** The sim detail row with all relations the detail page renders, scoped to the owning user + legacy slug. Null when not found/owned. */
export async function getSimDetail(slug: string, simId: string, userId: string) {
  return db.sim.findFirst({
    where: { id: simId, legacy: { slug, userId } },
    include: {
      personalityTraits: { include: { personalityTrait: true } },
      aspirations: { include: { aspiration: true } },
      careers: { include: { career: true } },
      skills: { include: { skill: true } },
      parentsOf: {
        include: { child: { select: { id: true, firstName: true, lastName: true, imageUrl: true } } },
      },
      childOf: {
        include: { parent: { select: { id: true, firstName: true, lastName: true, imageUrl: true, generationNumber: true } } },
      },
      socialRelationshipsA: {
        select: {
          simAId: true, simBId: true, romanticStatus: true, endedAt: true,
          simB: { select: { id: true, firstName: true, lastName: true, imageUrl: true, causeOfDeath: true } },
        },
      },
      socialRelationshipsB: {
        select: {
          simAId: true, simBId: true, romanticStatus: true, endedAt: true,
          simA: { select: { id: true, firstName: true, lastName: true, imageUrl: true, causeOfDeath: true } },
        },
      },
    },
  })
}

/** Minimal {id,firstName,lastName,imageUrl} list of every sim in the legacy, for relationship pickers. */
export async function listLegacySimsBySlug(slug: string, userId: string) {
  return db.sim.findMany({
    where: { legacy: { slug, userId } },
    select: { id: true, firstName: true, lastName: true, imageUrl: true },
    orderBy: { firstName: 'asc' },
  })
}
