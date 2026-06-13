import { TRPCError } from '@trpc/server'
import type { PrismaClient, Sim } from '@prisma/client'
import { recomputeLegacyTrackers } from '../challenges/trackerComputation'

/** Create or update a sim's skill at the given level, then recompute trackers. */
export async function upsertSimSkill(db: PrismaClient, sim: Sim, skillId: string, level: number) {
  await assertLevelWithinCap(db, skillId, level)
  const result = await db.simSkill.upsert({
    where: { simId_skillId: { simId: sim.id, skillId } },
    create: { simId: sim.id, skillId, level },
    update: { level },
  })
  await recomputeLegacyTrackers(db, sim.legacyId)
  return result
}

/** Set the level of an existing sim skill, then recompute trackers. */
export async function setSimSkillLevel(db: PrismaClient, sim: Sim, skillId: string, level: number) {
  await assertLevelWithinCap(db, skillId, level)
  const result = await db.simSkill.update({
    where: { simId_skillId: { simId: sim.id, skillId } },
    data: { level },
  })
  await recomputeLegacyTrackers(db, sim.legacyId)
  return result
}

async function assertLevelWithinCap(db: PrismaClient, skillId: string, level: number) {
  const skill = await db.skill.findUnique({ where: { id: skillId } })
  if (!skill) throw new TRPCError({ code: 'NOT_FOUND', message: 'Skill not found' })
  if (level > skill.maxLevel)
    throw new TRPCError({ code: 'BAD_REQUEST', message: `Level cannot exceed ${skill.maxLevel}` })
}
