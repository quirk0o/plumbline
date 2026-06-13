import { TRPCError } from '@trpc/server'
import type { PrismaClient, Sim } from '@prisma/client'
import { recomputeLegacyTrackers } from '../challenges/trackerComputation'

/** Mark a sim's aspiration as completed, then recompute trackers. */
export async function completeAspiration(db: PrismaClient, sim: Sim, aspirationId: string) {
  const record = await db.simAspiration.findUnique({
    where: { simId_aspirationId: { simId: sim.id, aspirationId } },
  })
  if (!record) throw new TRPCError({ code: 'NOT_FOUND', message: 'Aspiration not found on this sim' })
  if (record.completedAt) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Aspiration already completed' })

  await db.simAspiration.update({
    where: { simId_aspirationId: { simId: sim.id, aspirationId } },
    data: { completedAt: new Date() },
  })
  void recomputeLegacyTrackers(db, sim.legacyId)
}

/** End a sim's active career, then recompute trackers. */
export async function endCareer(db: PrismaClient, sim: Sim) {
  const activeCareer = await db.simCareer.findFirst({
    where: { simId: sim.id, endedAt: null },
  })
  if (!activeCareer) throw new TRPCError({ code: 'NOT_FOUND', message: 'No active career to end' })

  await db.simCareer.update({
    where: { id: activeCareer.id },
    data: { endedAt: new Date() },
  })
  void recomputeLegacyTrackers(db, sim.legacyId)
}
