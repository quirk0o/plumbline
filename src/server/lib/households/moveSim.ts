import { TRPCError } from '@trpc/server'
import type { PrismaClient, Sim } from '@prisma/client'

/**
 * Move a sim into another household of its legacy, or out of any household when
 * `toHouseholdId` is null. Validates the target household belongs to the sim's
 * legacy; moving to the household the sim is already in is a no-op.
 */
export async function moveSimToHousehold(db: PrismaClient, sim: Sim, toHouseholdId: string | null) {
  if (toHouseholdId) {
    const target = await db.household.findFirst({
      where: { id: toHouseholdId, legacyId: sim.legacyId },
      select: { id: true },
    })
    if (!target) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Household must belong to this legacy' })
    }
  }

  // Moving to the current household is a no-op, not an error.
  if (sim.householdId === toHouseholdId) return { id: sim.id }

  await db.sim.update({
    where: { id: sim.id, legacyId: sim.legacyId },
    data: { householdId: toHouseholdId },
  })
  return { id: sim.id }
}
