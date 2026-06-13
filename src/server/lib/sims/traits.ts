import { TRPCError } from '@trpc/server'
import type { PrismaClient, Sim } from '@prisma/client'
import { assertNoTraitConflicts } from '../traits/validate-traits'
import { isLifeStageInRange } from '@/lib/life-stage'

const MAX_PERSONALITY_TRAITS = 6

/** Add a personality trait to a sim, enforcing life-stage range, the slot cap, and conflict rules. */
export async function addSimTrait(db: PrismaClient, sim: Sim, traitId: string) {
  const [trait, currentTraits] = await Promise.all([
    db.personalityTrait.findUnique({
      where: { id: traitId },
      select: { minLifeStage: true, maxLifeStage: true },
    }),
    db.simPersonalityTrait.findMany({
      where: { simId: sim.id },
      select: { personalityTraitId: true },
    }),
  ])
  if (!trait) throw new TRPCError({ code: 'NOT_FOUND', message: 'Trait not found' })
  if (!isLifeStageInRange(sim.lifeStage, trait.minLifeStage, trait.maxLifeStage))
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Trait not available for this life stage' })
  if (currentTraits.length >= MAX_PERSONALITY_TRAITS)
    throw new TRPCError({ code: 'BAD_REQUEST', message: `Maximum ${MAX_PERSONALITY_TRAITS} traits allowed` })
  await assertNoTraitConflicts(db, [...currentTraits.map((t) => t.personalityTraitId), traitId])
  return db.simPersonalityTrait.create({
    data: { simId: sim.id, personalityTraitId: traitId },
  })
}
