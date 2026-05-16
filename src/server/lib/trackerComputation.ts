import type { PrismaClient } from '@prisma/client'
import { Prisma } from '@prisma/client'

type AggregationOp = 'any' | 'all' | 'count' | 'countUnique' | 'sum'

export interface Condition {
  source: 'skills' | 'aspirations' | 'personalityTraits' | 'careers' | 'traits' | 'sims'
  dataFilter: Record<string, unknown>
}

export interface ComputationSpec {
  simFilter: Record<string, unknown>
  conditions: Condition[]
  aggregation: { op: AggregationOp; field?: string }
  valueKind: 'BOOLEAN' | 'NUMERICAL' | 'THRESHOLD'
}

function resolveValue(val: unknown, config: Record<string, unknown>): unknown {
  if (typeof val === 'string' && val.startsWith('$config.')) {
    return config[val.slice('$config.'.length)]
  }
  return val
}

function resolveFilter(
  filter: Record<string, unknown>,
  config: Record<string, unknown>,
  phaseGenerationNumber?: number | null,
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(filter)) {
    if (typeof val === 'string' && val === '$phase.generationNumber') {
      resolved[key] = phaseGenerationNumber ?? undefined
    } else {
      resolved[key] = resolveValue(val, config)
    }
  }
  return resolved
}

async function getSimIds(
  db: PrismaClient,
  legacyId: string,
  simFilter: Record<string, unknown>,
): Promise<string[]> {
  const where: Prisma.SimWhereInput = { legacyId }
  if (simFilter.generationNumber !== undefined) {
    where.generationNumber = simFilter.generationNumber as number
  }
  if (simFilter.isHeir !== undefined) {
    where.isHeir = simFilter.isHeir as boolean
  }
  const sims = await db.sim.findMany({ where, select: { id: true } })
  return sims.map((s) => s.id)
}

async function simSatisfiesCondition(
  db: PrismaClient,
  simId: string,
  legacyId: string,
  condition: Condition,
  dataFilter: Record<string, unknown>,
): Promise<boolean> {
  if (condition.source === 'sims') {
    const where: Prisma.SimWhereInput = { id: simId, legacyId }
    if (dataFilter.causeOfDeath !== undefined) {
      where.causeOfDeath = dataFilter.causeOfDeath as Prisma.EnumCauseOfDeathNullableFilter
    }
    return (await db.sim.findFirst({ where })) !== null
  }

  if (condition.source === 'skills') {
    const where: Prisma.SimSkillWhereInput = { simId }
    if (dataFilter.skillId) {
      where.skillId = dataFilter.skillId as string
    }
    if (dataFilter.maxed === true && dataFilter.skillId) {
      const skill = await db.skill.findUnique({ where: { id: dataFilter.skillId as string } })
      if (!skill) return false
      where.level = { gte: skill.maxLevel }
    } else if (dataFilter.minLevel !== undefined) {
      where.level = { gte: dataFilter.minLevel as number }
    }
    return (await db.simSkill.findFirst({ where })) !== null
  }

  if (condition.source === 'aspirations') {
    const where: Prisma.SimAspirationWhereInput = { simId }
    if (dataFilter.aspirationId) {
      where.aspirationId = dataFilter.aspirationId as string
    }
    if (dataFilter.completed === true) {
      where.completedAt = { not: null }
    }
    return (await db.simAspiration.findFirst({ where })) !== null
  }

  if (condition.source === 'careers') {
    const where: Prisma.SimCareerWhereInput = { simId }
    if (dataFilter.careerId) {
      where.careerId = dataFilter.careerId as string
    }
    if (dataFilter.completed === true) {
      where.endedAt = { not: null }
    }
    return (await db.simCareer.findFirst({ where })) !== null
  }

  if (condition.source === 'personalityTraits') {
    const where: Prisma.SimPersonalityTraitWhereInput = { simId }
    if (dataFilter.category) {
      where.personalityTrait = { category: dataFilter.category as Prisma.PersonalityTraitWhereInput['category'] }
    }
    return (await db.simPersonalityTrait.findFirst({ where })) !== null
  }

  if (condition.source === 'traits') {
    return (await db.simTrait.findFirst({ where: { simId } })) !== null
  }

  return false
}

export async function evaluateSpec(
  db: PrismaClient,
  legacyId: string,
  spec: ComputationSpec,
  config: Record<string, unknown>,
  phaseGenerationNumber?: number | null,
): Promise<boolean | number> {
  const resolvedSimFilter = resolveFilter(spec.simFilter, config, phaseGenerationNumber)
  const allSimIds = await getSimIds(db, legacyId, resolvedSimFilter)
  if (allSimIds.length === 0) {
    return spec.aggregation.op === 'any' || spec.aggregation.op === 'all' ? false : 0
  }

  const matchingSimIds: string[] = []
  for (const simId of allSimIds) {
    let allSatisfied = true
    for (const condition of spec.conditions) {
      const dataFilter = resolveFilter(condition.dataFilter, config, phaseGenerationNumber)
      const satisfied = await simSatisfiesCondition(db, simId, legacyId, condition, dataFilter)
      if (!satisfied) {
        allSatisfied = false
        break
      }
    }
    if (allSatisfied) matchingSimIds.push(simId)
  }

  if (spec.aggregation.op === 'any') return matchingSimIds.length > 0
  if (spec.aggregation.op === 'all') return matchingSimIds.length === allSimIds.length && allSimIds.length > 0
  if (spec.aggregation.op === 'count') return matchingSimIds.length

  if (spec.aggregation.op === 'countUnique' && spec.aggregation.field && spec.conditions[0]) {
    const condition = spec.conditions[0]
    const dataFilter = resolveFilter(condition.dataFilter, config, phaseGenerationNumber)
    if (condition.source === 'personalityTraits') {
      const where: Prisma.SimPersonalityTraitWhereInput = { simId: { in: allSimIds } }
      if (dataFilter.category) {
        where.personalityTrait = { category: dataFilter.category as Prisma.PersonalityTraitWhereInput['category'] }
      }
      const groups = await db.simPersonalityTrait.groupBy({
        by: ['personalityTraitId'],
        where,
      })
      return groups.length
    }
  }

  return matchingSimIds.length
}

export async function recomputeLegacyTrackers(db: PrismaClient, legacyId: string): Promise<void> {
  const runs = await db.challengeRun.findMany({
    where: { legacyId, completedAt: null },
    include: {
      phases: {
        include: {
          trackers: {
            include: {
              trackerType: true,
              progress: true,
            },
          },
        },
      },
    },
  })

  for (const run of runs) {
    for (const phase of run.phases) {
      for (const tracker of phase.trackers) {
        if (!tracker.progress || tracker.progress.isManual) continue
        const spec = tracker.trackerType.computationSpec as ComputationSpec | null
        if (!spec) continue

        const config = tracker.config as Record<string, unknown>
        const rawValue = await evaluateSpec(db, legacyId, spec, config, phase.generationNumber)
        const now = new Date()

        const wasComplete = tracker.progress.completedAt !== null
        const isNowComplete =
          tracker.trackerType.valueKind === 'BOOLEAN'
            ? rawValue === true
            : typeof rawValue === 'number' && rawValue > 0

        await db.trackerProgress.update({
          where: { challengeRunTrackerId: tracker.id },
          data: {
            value: rawValue as Prisma.InputJsonValue,
            evaluatedAt: now,
            completedAt: !wasComplete && isNowComplete ? now : tracker.progress.completedAt,
          },
        })
      }
    }
  }
}
