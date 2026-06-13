import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import {
  CauseOfDeath,
  EmploymentType,
  Gender,
  LifeStage,
  OccultType,
  type Prisma,
  type PrismaClient,
  type Sim,
} from '@prisma/client'
import { recomputeGenerations } from '../legacies/generation'
import { recomputeLegacyTrackers } from '../challenges/trackerComputation'
import { imageUrlSchema } from '../media/image-url-schema'

export const updateSimInput = z.object({
  id: z.string(),
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  gender: z.nativeEnum(Gender).optional(),
  lifeStage: z.nativeEnum(LifeStage).optional(),
  pronounSubject: z.string().max(20).nullable().optional(),
  pronounObject: z.string().max(20).nullable().optional(),
  pronounPossessive: z.string().max(20).nullable().optional(),
  imageUrl: imageUrlSchema.nullable().optional(),
  occultType: z.nativeEnum(OccultType).nullable().optional(),
  causeOfDeath: z.nativeEnum(CauseOfDeath).nullable().optional(),
  aspirationId: z.string().nullable().optional(),
  careerId: z.string().nullable().optional(),
  generationNumber: z.number().int().min(1).optional(),
  isHeir: z.boolean().optional(),
})

export type UpdateSimInput = z.infer<typeof updateSimInput>

const TRACKER_RECOMPUTE_FIELDS = ['generationNumber', 'lifeStage', 'isHeir', 'causeOfDeath', 'occultType'] as const

/**
 * Update a sim: swap the active aspiration/career, keep one heir per
 * generation, and recompute generations/trackers when lineage-relevant
 * fields change.
 */
export async function updateSim(db: PrismaClient, sim: Sim, input: UpdateSimInput) {
  await assertGenerationEditable(db, input)

  const { id, aspirationId, careerId, ...fields } = input
  const result = await db.$transaction(async (tx) => {
    if (aspirationId !== undefined) await replaceActiveAspiration(tx, id, aspirationId)
    if (careerId !== undefined) await replaceActiveCareer(tx, id, careerId)
    if (input.isHeir === true) await clearHeirCohort(tx, sim.legacyId, input)
    if (await shouldDropHeirFlag(tx, sim.legacyId, id, input)) fields.isHeir = false
    const updated = await tx.sim.update({ where: { id }, data: fields })
    if (input.generationNumber !== undefined) await recomputeGenerations(tx, sim.legacyId)
    return updated
  })

  if (TRACKER_RECOMPUTE_FIELDS.some((f) => input[f] !== undefined)) {
    void recomputeLegacyTrackers(db, result.legacyId)
  }
  return result
}

async function assertGenerationEditable(db: PrismaClient, input: UpdateSimInput) {
  if (input.generationNumber === undefined) return
  const parentCount = await db.familyRelationship.count({ where: { childId: input.id } })
  if (parentCount > 0) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Generation is derived from parents and cannot be set directly',
    })
  }
}

async function replaceActiveAspiration(tx: Prisma.TransactionClient, simId: string, aspirationId: string | null) {
  await tx.simAspiration.deleteMany({ where: { simId, completedAt: null } })
  if (aspirationId) await tx.simAspiration.create({ data: { simId, aspirationId } })
}

async function replaceActiveCareer(tx: Prisma.TransactionClient, simId: string, careerId: string | null) {
  await tx.simCareer.deleteMany({ where: { simId, endedAt: null } })
  if (careerId) {
    await tx.simCareer.create({
      data: { simId, careerId, employmentType: EmploymentType.EMPLOYED, startedAt: new Date() },
    })
  }
}

async function clearHeirCohort(tx: Prisma.TransactionClient, legacyId: string, input: UpdateSimInput) {
  // Clear heirs in the generation the sim ends up in: an explicit
  // generationNumber in this update wins; otherwise re-read the current value
  // inside the transaction so a concurrent generation change cannot make us
  // clear a stale cohort.
  const targetGeneration =
    input.generationNumber !== undefined
      ? input.generationNumber
      : (
          await tx.sim.findUniqueOrThrow({
            where: { id: input.id },
            select: { generationNumber: true },
          })
        ).generationNumber
  await tx.sim.updateMany({
    where: { legacyId, generationNumber: targetGeneration, isHeir: true, NOT: { id: input.id } },
    data: { isHeir: false },
  })
}

async function shouldDropHeirFlag(
  tx: Prisma.TransactionClient,
  legacyId: string,
  id: string,
  input: UpdateSimInput,
): Promise<boolean> {
  // A root sim moving into a generation already held by another heir would
  // trip the one-heir-per-generation index. When the caller isn't explicitly
  // (re)designating heir status, drop the moved sim's heir flag — it has left
  // its cohort. (Derived sims can't reach here: the guard above rejects
  // generation edits on sims with parents.)
  if (input.generationNumber === undefined || input.isHeir === true) return false
  const moving = await tx.sim.findUniqueOrThrow({ where: { id }, select: { isHeir: true } })
  if (!moving.isHeir) return false
  const conflictingHeir = await tx.sim.findFirst({
    where: { legacyId, generationNumber: input.generationNumber, isHeir: true, NOT: { id } },
    select: { id: true },
  })
  return conflictingHeir !== null
}
