import { TRPCError } from '@trpc/server'
import type { Prisma, PrismaClient } from '@prisma/client'

type Db = PrismaClient | Prisma.TransactionClient

/**
 * Throw BAD_REQUEST unless every id in `simIds` belongs to `legacyId`. This is a
 * referential-integrity/membership check, NOT an ownership guard (no userId), so
 * it lives in the sims domain rather than lib/auth. Pass an already-deduplicated
 * list; an empty list is a no-op. The message is caller-supplied because the
 * wording is context-specific (e.g. "tagged sims" for milestones).
 */
export async function assertSimsInLegacy(
  db: Db,
  simIds: string[],
  legacyId: string,
  message = 'All sims must belong to this legacy',
) {
  if (simIds.length === 0) return
  const count = await db.sim.count({ where: { id: { in: simIds }, legacyId } })
  if (count !== simIds.length) {
    throw new TRPCError({ code: 'BAD_REQUEST', message })
  }
}
