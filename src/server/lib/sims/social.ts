import type { Prisma, PrismaClient, RomanticStatus, Sim } from '@prisma/client'
import { recomputeGenerations } from '../legacies/generation'
import { recomputeLegacyTrackers } from '../challenges/trackerComputation'

interface AddSocialRelationshipArgs {
  romanticStatus: RomanticStatus
  endedAt: Date | null
}

/**
 * Create a social relationship between two owned sims. When exactly one sim
 * is a root (no parents) and the other is derived, the root adopts the
 * derived sim's generation ("partner adoption").
 */
export async function addSocialRelationship(
  db: PrismaClient,
  simA: Sim,
  simB: Sim,
  args: AddSocialRelationshipArgs,
) {
  const [normalA, normalB] = [simA.id, simB.id].sort()
  const result = await db.$transaction(async (tx) => {
    const created = await tx.socialRelationship.create({
      data: {
        simAId: normalA,
        simBId: normalB,
        romanticStatus: args.romanticStatus,
        endedAt: args.endedAt,
        friendshipScore: 0,
        romanceScore: 0,
      },
    })
    const adopted = await adoptPartnerGeneration(tx, simA, simB)
    return { created, adopted }
  })
  if (result.adopted) void recomputeLegacyTrackers(db, simA.legacyId)
  return result.created
}

// Counting inside the transaction closes the TOCTOU window against a
// concurrent family-edge change. Overridable later via the detail page.
async function adoptPartnerGeneration(tx: Prisma.TransactionClient, simA: Sim, simB: Sim): Promise<boolean> {
  const [aParents, bParents] = await Promise.all([
    tx.familyRelationship.count({ where: { childId: simA.id } }),
    tx.familyRelationship.count({ where: { childId: simB.id } }),
  ])
  let adopt: { id: string; generationNumber: number } | null = null
  if (aParents === 0 && bParents > 0) adopt = { id: simA.id, generationNumber: simB.generationNumber }
  else if (bParents === 0 && aParents > 0) adopt = { id: simB.id, generationNumber: simA.generationNumber }
  if (!adopt) return false
  await tx.sim.update({ where: { id: adopt.id }, data: { generationNumber: adopt.generationNumber } })
  await recomputeGenerations(tx, simA.legacyId)
  return true
}
