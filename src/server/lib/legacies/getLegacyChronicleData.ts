import { db } from '@/server/db'
import { fetchWorldOptions } from '../households/world-options'

/**
 * All the data the legacy chronicle page renders: the legacy with its sims and
 * households, the social and family edges plus user milestones that milestone
 * derivation consumes, and the world options for the household selects. Returns
 * null when the legacy isn't found or isn't owned by the user.
 */
export async function getLegacyChronicleData(slug: string, userId: string) {
  const legacy = await db.legacy.findFirst({
    where: { slug, userId },
    select: {
      id: true,
      name: true,
      description: true,
      founderSimId: true,
      activeHouseholdId: true,
      households: {
        select: {
          id: true,
          name: true,
          worldId: true,
          lot: true,
          description: true,
          funds: true,
          lotValue: true,
          foundedGeneration: true,
          world: { select: { name: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
      sims: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          imageUrl: true,
          generationNumber: true,
          isHeir: true,
          lifeStage: true,
          createdAt: true,
          updatedAt: true,
          causeOfDeath: true,
          householdId: true,
          aspirations: {
            select: {
              id: true,
              completedAt: true,
              createdAt: true,
              aspiration: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!legacy) return null

  // Independent of each other; fetched in parallel after the legacy is known.
  const [socialRelationships, familyRelationships, userMilestones, worlds] = await Promise.all([
    // Social relationships for sims in this legacy — only MARRIED rows are used
    // by milestone derivation, but we fetch all and let derive.ts filter so the
    // fetched shape stays a faithful FetchedSocialRelationship[].
    db.socialRelationship.findMany({
      where: { OR: [{ simA: { legacyId: legacy.id } }, { simB: { legacyId: legacy.id } }] },
      select: {
        id: true,
        simAId: true,
        simBId: true,
        romanticStatus: true,
        endedAt: true,
        createdAt: true,
      },
    }),
    // Parent→child links for sims in this legacy — used to decide whether a sim
    // was born into the legacy (has an in-legacy parent) vs. married/moved in.
    db.familyRelationship.findMany({
      where: { child: { legacyId: legacy.id } },
      select: { parentId: true, childId: true },
    }),
    // Persisted, user-authored milestones for this legacy.
    db.milestone.findMany({
      where: { legacyId: legacy.id },
      select: {
        id: true,
        title: true,
        blurb: true,
        sortOrder: true,
        sims: { select: { simId: true } },
      },
    }),
    fetchWorldOptions(db, userId),
  ])

  return { legacy, socialRelationships, familyRelationships, userMilestones, worlds }
}
