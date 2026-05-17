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

export function resolveThresholds(goalConfig: unknown): number[] | null {
  if (!goalConfig || typeof goalConfig !== 'object' || Array.isArray(goalConfig)) return null
  const cfg = goalConfig as Record<string, unknown>
  if (Array.isArray(cfg.thresholds) && cfg.thresholds.every((t) => typeof t === 'number')) {
    return cfg.thresholds as number[]
  }
  const { start, step, count } = cfg
  if (typeof start === 'number' && typeof step === 'number' && typeof count === 'number' && count > 0) {
    return Array.from({ length: count }, (_, i) => start + i * step)
  }
  return null
}

export function countThresholdsCrossed(rawValue: number, thresholds: number[]): number {
  return thresholds.filter((t) => rawValue >= t).length
}

function resolveValue(val: unknown, config: Record<string, unknown>): unknown {
  if (typeof val === 'string' && val.startsWith('$config.')) {
    return config[val.slice('$config.'.length)]
  }
  return val
}

// Returns null when the filter contains a $phase.generationNumber reference but the
// phase generation number is null — meaning the filter is unevaluable and should
// short-circuit the entire evaluateSpec call (no matches).
function resolveFilter(
  filter: Record<string, unknown>,
  config: Record<string, unknown>,
  phaseGenerationNumber?: number | null,
): Record<string, unknown> | null {
  const resolved: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(filter)) {
    if (typeof val === 'string' && val === '$phase.generationNumber') {
      if (phaseGenerationNumber == null) return null
      resolved[key] = phaseGenerationNumber
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
  const knownKeys = new Set(['generationNumber', 'isHeir'])
  const unknown = Object.keys(simFilter).filter((k) => !knownKeys.has(k))
  if (unknown.length) throw new Error(`Unknown simFilter keys: ${unknown.join(', ')}`)

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

// Returns the set of simIds (from the provided candidates) that satisfy the condition.
async function simIdsSatisfyingCondition(
  db: PrismaClient,
  simIds: string[],
  legacyId: string,
  condition: Condition,
  dataFilter: Record<string, unknown>,
): Promise<Set<string>> {
  if (condition.source === 'sims') {
    const where: Prisma.SimWhereInput = { id: { in: simIds }, legacyId }
    if (dataFilter.causeOfDeath !== undefined) {
      where.causeOfDeath = dataFilter.causeOfDeath as Prisma.EnumCauseOfDeathNullableFilter
    }
    const matching = await db.sim.findMany({ where, select: { id: true } })
    return new Set(matching.map((s) => s.id))
  }

  if (condition.source === 'skills') {
    const where: Prisma.SimSkillWhereInput = { simId: { in: simIds } }
    if (dataFilter.skillId) {
      where.skillId = dataFilter.skillId as string
    }
    if (dataFilter.maxed === true && dataFilter.skillId) {
      const skill = await db.skill.findUnique({ where: { id: dataFilter.skillId as string } })
      if (!skill) return new Set()
      where.level = { gte: skill.maxLevel }
    } else if (dataFilter.minLevel !== undefined) {
      where.level = { gte: dataFilter.minLevel as number }
    }
    const matching = await db.simSkill.findMany({ where, select: { simId: true } })
    return new Set(matching.map((s) => s.simId))
  }

  if (condition.source === 'aspirations') {
    const where: Prisma.SimAspirationWhereInput = { simId: { in: simIds } }
    if (dataFilter.aspirationId) {
      where.aspirationId = dataFilter.aspirationId as string
    }
    if (dataFilter.completed === true) {
      where.completedAt = { not: null }
    }
    const matching = await db.simAspiration.findMany({ where, select: { simId: true } })
    return new Set(matching.map((s) => s.simId))
  }

  if (condition.source === 'careers') {
    const where: Prisma.SimCareerWhereInput = { simId: { in: simIds } }
    if (dataFilter.careerId) {
      where.careerId = dataFilter.careerId as string
    }
    if (dataFilter.completed === true) {
      where.endedAt = { not: null }
    }
    const matching = await db.simCareer.findMany({ where, select: { simId: true } })
    return new Set(matching.map((s) => s.simId))
  }

  if (condition.source === 'personalityTraits') {
    const where: Prisma.SimPersonalityTraitWhereInput = { simId: { in: simIds } }
    if (dataFilter.category) {
      where.personalityTrait = { category: dataFilter.category as Prisma.PersonalityTraitWhereInput['category'] }
    }
    const matching = await db.simPersonalityTrait.findMany({ where, select: { simId: true } })
    return new Set(matching.map((s) => s.simId))
  }

  if (condition.source === 'traits') {
    const where: Prisma.SimTraitWhereInput = { simId: { in: simIds } }
    if (dataFilter.traitId) {
      where.traitId = dataFilter.traitId as string
    }
    const matching = await db.simTrait.findMany({ where, select: { simId: true } })
    return new Set(matching.map((s) => s.simId))
  }

  return new Set()
}

export async function evaluateSpec(
  db: PrismaClient,
  legacyId: string,
  spec: ComputationSpec,
  config: Record<string, unknown>,
  phaseGenerationNumber?: number | null,
): Promise<boolean | number> {
  const resolvedSimFilter = resolveFilter(spec.simFilter, config, phaseGenerationNumber)
  if (resolvedSimFilter === null) {
    return spec.aggregation.op === 'any' || spec.aggregation.op === 'all' ? false : 0
  }

  const allSimIds = await getSimIds(db, legacyId, resolvedSimFilter)
  if (allSimIds.length === 0) {
    return spec.aggregation.op === 'any' || spec.aggregation.op === 'all' ? false : 0
  }

  // Batch approach: for each condition, get the set of simIds that satisfy it,
  // then intersect across all conditions — O(conditions) queries instead of
  // O(sims × conditions).
  let matchingSet = new Set(allSimIds)
  for (const condition of spec.conditions) {
    const dataFilter = resolveFilter(condition.dataFilter, config, phaseGenerationNumber)
    if (dataFilter === null) {
      return spec.aggregation.op === 'any' || spec.aggregation.op === 'all' ? false : 0
    }
    const satisfying = await simIdsSatisfyingCondition(
      db,
      [...matchingSet],
      legacyId,
      condition,
      dataFilter,
    )
    matchingSet = new Set([...matchingSet].filter((id) => satisfying.has(id)))
    if (matchingSet.size === 0) break
  }

  const matchingSimIds = [...matchingSet]

  if (spec.aggregation.op === 'any') return matchingSimIds.length > 0
  if (spec.aggregation.op === 'all') return matchingSimIds.length === allSimIds.length && allSimIds.length > 0
  if (spec.aggregation.op === 'count') return matchingSimIds.length

  if (spec.aggregation.op === 'countUnique' && spec.aggregation.field && spec.conditions[0]) {
    const condition = spec.conditions[0]
    const dataFilter = resolveFilter(condition.dataFilter, config, phaseGenerationNumber)
    if (dataFilter === null) return 0
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

  if (spec.aggregation.op === 'sum') {
    throw new Error('sum aggregation not yet implemented')
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

        const goalConfig = tracker.goalConfig

        let storedValue: unknown = rawValue
        if (tracker.trackerType.valueKind === 'THRESHOLD' && typeof rawValue === 'number') {
          const thresholds = resolveThresholds(goalConfig)
          storedValue = thresholds !== null ? countThresholdsCrossed(rawValue, thresholds) : null
        }

        const isNowComplete = (() => {
          if (tracker.trackerType.valueKind === 'BOOLEAN') return storedValue === true
          if (tracker.trackerType.valueKind === 'THRESHOLD') {
            const thresholds = resolveThresholds(goalConfig)
            return thresholds !== null && typeof storedValue === 'number' && storedValue >= thresholds.length
          }
          return typeof storedValue === 'number' && storedValue > 0
        })()

        const wasComplete = tracker.progress.completedAt !== null

        await db.trackerProgress.update({
          where: { challengeRunTrackerId: tracker.id },
          data: {
            value: storedValue as Prisma.InputJsonValue,
            evaluatedAt: now,
            ...(!wasComplete && isNowComplete ? { completedAt: now } : {}),
          },
        })
      }
    }
  }
}
