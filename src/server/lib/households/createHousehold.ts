import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import type { Prisma, PrismaClient } from '@prisma/client'
import { assertWorldExists } from './world-options'

export const createHouseholdInput = z.object({
  legacyId: z.string(),
  name: z.string().trim().min(1).max(100),
  worldId: z.string().optional(),
  lot: z.string().max(120).optional(),
  funds: z.number().int().min(0).default(0),
  description: z.string().max(1000).optional(),
  simIds: z.array(z.string()).default([]),
})

export type CreateHouseholdInput = z.infer<typeof createHouseholdInput>

type LegacyForCreate = { id: string; activeHouseholdId: string | null }

/**
 * Create a household in an owned legacy: validate the world and that every
 * named sim belongs to the legacy, derive the founded generation from the
 * legacy's latest generation, then atomically create the household, move the
 * sims into it, and claim the legacy's active household slot if it's empty.
 */
export async function createHousehold(db: PrismaClient, legacy: LegacyForCreate, input: CreateHouseholdInput) {
  const simIds = [...new Set(input.simIds)]
  if (input.worldId) await assertWorldExists(db, input.worldId)
  await assertSimsInLegacy(db, simIds, input.legacyId)

  const foundedGeneration = await deriveFoundedGeneration(db, input.legacyId)

  return db.$transaction(async (tx) => {
    const household = await tx.household.create({
      data: {
        legacyId: input.legacyId,
        name: input.name,
        worldId: input.worldId ?? null,
        lot: input.lot ?? null,
        funds: input.funds,
        description: input.description ?? null,
        foundedGeneration,
      },
    })
    await moveSimsIntoHousehold(tx, simIds, input.legacyId, household.id)
    if (!legacy.activeHouseholdId) {
      await tx.legacy.update({ where: { id: input.legacyId }, data: { activeHouseholdId: household.id } })
    }
    return { id: household.id }
  })
}

async function assertSimsInLegacy(db: PrismaClient, simIds: string[], legacyId: string) {
  if (simIds.length === 0) return
  const count = await db.sim.count({ where: { id: { in: simIds }, legacyId } })
  if (count !== simIds.length) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'All sims must belong to this legacy' })
  }
}

async function deriveFoundedGeneration(db: PrismaClient, legacyId: string): Promise<number> {
  const maxGen = await db.sim.aggregate({ where: { legacyId }, _max: { generationNumber: true } })
  return maxGen._max.generationNumber ?? 1
}

// Re-checks inside the transaction so a sim concurrently moved out of the legacy
// rolls the whole create back instead of silently moving fewer sims.
async function moveSimsIntoHousehold(
  tx: Prisma.TransactionClient,
  simIds: string[],
  legacyId: string,
  householdId: string,
) {
  if (simIds.length === 0) return
  const moved = await tx.sim.updateMany({
    where: { id: { in: simIds }, legacyId },
    data: { householdId },
  })
  if (moved.count !== simIds.length) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'All sims must belong to this legacy' })
  }
}
