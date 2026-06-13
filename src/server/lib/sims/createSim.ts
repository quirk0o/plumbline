import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import {
  EmploymentType,
  FamilyRelationshipType,
  Gender,
  LifeStage,
  OccultType,
  type Prisma,
  type PrismaClient,
} from '@prisma/client'
import { assertNoTraitConflicts } from '../traits/validate-traits'
import { deriveGeneration } from '../legacies/generation'
import { imageUrlSchema } from '../media/image-url-schema'

export const createSimInput = z.object({
  legacyId: z.string(),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  gender: z.nativeEnum(Gender),
  lifeStage: z.nativeEnum(LifeStage).default('YOUNG_ADULT'),
  pronounSubject: z.string().max(20).optional(),
  pronounObject: z.string().max(20).optional(),
  pronounPossessive: z.string().max(20).optional(),
  imageUrl: imageUrlSchema,
  personalityTraitIds: z.array(z.string()).max(6).optional(),
  aspirationId: z.string().optional(),
  careerId: z.string().optional(),
  occultType: z.nativeEnum(OccultType).optional(),
  generationNumber: z.number().int().min(1).optional(),
  parentIds: z.array(z.string()).optional(),
  householdId: z.string().optional(),
})

export type CreateSimInput = z.infer<typeof createSimInput>

type LegacyForCreate = { id: string; founderSimId: string | null }
type ParentRow = { id: string; generationNumber: number | null }

/**
 * Create a sim in an owned legacy: validate trait/household invariants, derive
 * the generation from parents (or default to the legacy's latest), and
 * atomically insert the sim, its parent edges, and any founder claim.
 */
export async function createSim(db: PrismaClient, legacy: LegacyForCreate, input: CreateSimInput) {
  await assertNoTraitConflicts(db, input.personalityTraitIds ?? [])
  await assertHouseholdInLegacy(db, input)

  const parents = await loadParents(db, input)
  const generationNumber = await resolveGeneration(db, input, parents)

  // A legacy with no founder adopts its first parentless sim as the founder.
  const willBeFounder = !legacy.founderSimId && parents.length === 0

  return db.$transaction(async (tx) => {
    const newSim = await insertSim(tx, input, generationNumber)
    await linkParents(tx, newSim.id, parents)
    if (willBeFounder) await claimFounderSlot(tx, legacy.id, newSim.id)
    return newSim
  })
}

async function assertHouseholdInLegacy(db: PrismaClient, input: CreateSimInput) {
  if (!input.householdId) return
  const household = await db.household.findFirst({
    where: { id: input.householdId, legacyId: input.legacyId },
    select: { id: true },
  })
  if (!household) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Household must belong to this legacy' })
  }
}

async function loadParents(db: PrismaClient, input: CreateSimInput): Promise<ParentRow[]> {
  if (!input.parentIds?.length) return []
  const parents = await db.sim.findMany({
    where: { id: { in: input.parentIds }, legacyId: input.legacyId },
    select: { id: true, generationNumber: true },
  })
  if (parents.length !== input.parentIds.length) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'One or more parentIds do not belong to this legacy' })
  }
  return parents
}

async function resolveGeneration(
  db: PrismaClient,
  input: CreateSimInput,
  parents: ParentRow[],
): Promise<number> {
  if (parents.length > 0) {
    // A sim with parents is derived; derivation always wins over input.
    const parentGens = parents.map((p) => p.generationNumber).filter((g): g is number => g !== null)
    if (parentGens.length > 0) return deriveGeneration(parentGens)
  } else if (input.generationNumber !== undefined) {
    return input.generationNumber
  }
  // Parentless sims (founders, partners, separate subtree roots) are roots:
  // default to the legacy's current latest generation, or 1 when empty.
  const agg = await db.sim.aggregate({
    where: { legacyId: input.legacyId },
    _max: { generationNumber: true },
  })
  return agg._max.generationNumber ?? 1
}

async function insertSim(tx: Prisma.TransactionClient, input: CreateSimInput, generationNumber: number) {
  return tx.sim.create({
    data: {
      legacyId: input.legacyId,
      firstName: input.firstName,
      lastName: input.lastName,
      gender: input.gender,
      lifeStage: input.lifeStage,
      pronounSubject: input.pronounSubject ?? null,
      pronounObject: input.pronounObject ?? null,
      pronounPossessive: input.pronounPossessive ?? null,
      imageUrl: input.imageUrl ?? null,
      occultType: input.occultType ?? null,
      generationNumber,
      householdId: input.householdId ?? null,
      ...(input.personalityTraitIds?.length
        ? { personalityTraits: { create: input.personalityTraitIds.map((id) => ({ personalityTraitId: id })) } }
        : {}),
      ...(input.aspirationId ? { aspirations: { create: { aspirationId: input.aspirationId } } } : {}),
      ...(input.careerId
        ? { careers: { create: { careerId: input.careerId, employmentType: EmploymentType.EMPLOYED, startedAt: new Date() } } }
        : {}),
    },
  })
}

async function linkParents(tx: Prisma.TransactionClient, childId: string, parents: ParentRow[]) {
  if (parents.length === 0) return
  await tx.familyRelationship.createMany({
    data: parents.map((parent) => ({
      parentId: parent.id,
      childId,
      type: FamilyRelationshipType.BIOLOGICAL,
    })),
    skipDuplicates: true,
  })
}

async function claimFounderSlot(tx: Prisma.TransactionClient, legacyId: string, simId: string) {
  // willBeFounder came from a pre-transaction read, so only claim the founder
  // slot if it is still empty; failing here rolls back the whole create
  // instead of silently overwriting a concurrently designated founder.
  const claimed = await tx.legacy.updateMany({
    where: { id: legacyId, founderSimId: null },
    data: { founderSimId: simId },
  })
  if (claimed.count === 0) {
    throw new TRPCError({ code: 'CONFLICT', message: 'Legacy already has a founder' })
  }
}
