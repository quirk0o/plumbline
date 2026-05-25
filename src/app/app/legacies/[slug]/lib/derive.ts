/**
 * Pure derivation functions for the Legacy Chronicle page.
 *
 * All functions are deterministic and I/O-free — no Date.now(), no fetch,
 * no React imports. They transform FetchedLegacy data into the view types
 * defined in ./types.ts.
 */

import { roman } from '@/lib/legacy-format'
import type {
  AvatarRing,
  ChronicleSim,
  FetchedLegacy,
  FetchedSim,
  FetchedSimAspiration,
  LegacyStats,
  Milestone,
  RosterGroup,
  SuccessionStep,
} from './types'

// ---------------------------------------------------------------------------
// Aspiration-pick helper
// ---------------------------------------------------------------------------

/**
 * Choose the most relevant aspiration name for a sim.
 *
 * Priority (documented in ChronicleSim.aspirationName):
 *   1. An aspiration with completedAt === null (in-progress / current).
 *      If multiple, the one created most recently (latest createdAt).
 *   2. Else the most recently completed aspiration (latest completedAt).
 *   3. Else the first aspiration by createdAt.
 *   4. Else null.
 *
 * Rationale: the schema has no explicit `isCurrent` flag on SimAspiration.
 * A null completedAt is the clearest proxy for "this is the active goal."
 */
function pickAspirationName(
  aspirations: FetchedSimAspiration[],
): string | null {
  if (aspirations.length === 0) return null

  // Step 1 — in-progress (completedAt === null), latest created first
  const inProgress = aspirations
    .filter((a) => a.completedAt === null)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

  if (inProgress.length > 0) return inProgress[0].aspiration.name

  // Step 2 — most recently completed
  const completed = aspirations
    .filter((a) => a.completedAt !== null)
    .sort(
      (a, b) =>
        // completedAt is non-null here due to the filter above
        b.completedAt!.getTime() - a.completedAt!.getTime(),
    )

  if (completed.length > 0) return completed[0].aspiration.name

  // A non-empty list is always covered by step 1 or step 2, so reaching
  // here means no aspirations.
  return null
}

// ---------------------------------------------------------------------------
// 1. toChronicleSim
// ---------------------------------------------------------------------------

/**
 * Normalise one raw Prisma sim row into a ChronicleSim view object.
 *
 * @param rawSim - The fetched Prisma sim row.
 * @param founderSimId - The legacy's founderSimId (may be null).
 */
export function toChronicleSim(
  rawSim: FetchedSim,
  founderSimId: string | null,
): ChronicleSim {
  return {
    id: rawSim.id,
    firstName: rawSim.firstName,
    lastName: rawSim.lastName,
    imageUrl: rawSim.imageUrl,
    generationNumber: rawSim.generationNumber,
    lifeStage: rawSim.lifeStage,
    isHeir: rawSim.isHeir,
    isFounder: rawSim.id === founderSimId,
    aspirationName: pickAspirationName(rawSim.aspirations),
  }
}

// ---------------------------------------------------------------------------
// 2. ringFor
// ---------------------------------------------------------------------------

/**
 * Return the PortraitAvatar ring variant for a sim.
 *
 * Precedence matches the mock's RosterCard/SuccessionStep order:
 *   heir → founder → green
 *
 * Heir is checked first so that a founding heir (who is both founder
 * and heir) displays the heir ring — matching the mock's visual intent
 * that heir status is the more specific/earned distinction.
 */
export function ringFor(
  sim: Pick<ChronicleSim, 'isFounder' | 'isHeir'>,
): AvatarRing {
  if (sim.isHeir) return 'heir'
  if (sim.isFounder) return 'founder'
  return 'green'
}

// ---------------------------------------------------------------------------
// 3. computeStats
// ---------------------------------------------------------------------------

/**
 * Compute the aggregate stats shown in the chronicle hero area.
 *
 * - sims: total number of sims in the legacy.
 * - generations: count of DISTINCT non-null generationNumber values.
 * - households: count of households in the legacy.
 * - milestones: length of the derived milestone list (live count).
 */
export function computeStats(
  legacy: FetchedLegacy,
  milestones: Milestone[],
): LegacyStats {
  const distinctGens = new Set(
    legacy.sims
      .map((s) => s.generationNumber)
      .filter((g): g is number => g !== null),
  )

  return {
    sims: legacy.sims.length,
    generations: distinctGens.size,
    households: legacy.households.length,
    milestones: milestones.length,
  }
}

// ---------------------------------------------------------------------------
// 4. deriveSuccession
// ---------------------------------------------------------------------------

/**
 * Build the ordered succession line from a list of ChronicleSims.
 *
 * Order:
 *   1. The founder (role: "Founder"), if present.
 *   2. All heirs (isHeir), sorted by generationNumber ASC (nulls last),
 *      then by id for determinism. Each gets role "Heir · Gen {roman(gen)}"
 *      except the one with the highest gen (or last by id if tied), who
 *      gets "Heir designate".
 *
 * If the founder is also an heir, they appear only once as "Founder".
 */
export function deriveSuccession(
  sims: ChronicleSim[],
  founderSimId: string | null,
): SuccessionStep[] {
  const founder = founderSimId
    ? sims.find((s) => s.id === founderSimId)
    : null

  const steps: SuccessionStep[] = []

  if (founder) {
    steps.push({
      sim: founder,
      role: 'Founder',
      isHeir: founder.isHeir,
      isFounder: true,
    })
  }

  // Heirs, excluding the founder to avoid duplication
  const heirs = sims
    .filter((s) => s.isHeir && s.id !== founderSimId)
    .sort((a, b) => {
      // Sort by generationNumber ASC; nulls go last
      if (a.generationNumber === null && b.generationNumber === null) {
        return a.id.localeCompare(b.id)
      }
      if (a.generationNumber === null) return 1
      if (b.generationNumber === null) return -1
      if (a.generationNumber !== b.generationNumber) {
        return a.generationNumber - b.generationNumber
      }
      return a.id.localeCompare(b.id)
    })

  heirs.forEach((sim, index) => {
    const isLast = index === heirs.length - 1
    let role: string

    if (isLast) {
      role = 'Heir designate'
    } else if (sim.generationNumber !== null) {
      role = `Heir · Gen ${roman(sim.generationNumber)}`
    } else {
      role = 'Heir'
    }

    steps.push({ sim, role, isHeir: true, isFounder: false })
  })

  return steps
}

// ---------------------------------------------------------------------------
// 5. deriveMilestones
// ---------------------------------------------------------------------------

/**
 * Derive the auto-captured milestone timeline from the fetched legacy.
 *
 * Returns entries NEWEST-FIRST (by sortKey descending), tie-broken by id
 * for determinism.
 *
 * Births: one per sim. The founder's row uses kind 'Founding'; all others
 * use kind 'Birth'. Sort key = sim.createdAt.
 *
 * Marriages: one per unique unordered pair (simAId, simBId) where
 * romanticStatus === 'MARRIED'. De-duplicated by canonical pair
 * (lower id first) to handle any accidental reciprocal rows.
 * Sort key = relationship.createdAt.
 *
 * Marriage gen: the minimum non-null generationNumber of the two partners.
 * Rationale: a marriage event "belongs to" the earlier generation involved,
 * which is typically the heir who initiates the relationship. If neither
 * partner has a generation number, gen is null.
 */
export function deriveMilestones(legacy: FetchedLegacy): Milestone[] {
  const simMap = new Map<string, FetchedSim>(legacy.sims.map((s) => [s.id, s]))

  // --- Births ---
  const birthEntries = legacy.sims.map((sim) => {
    const isFounder = sim.id === legacy.founderSimId
    const kind: 'Founding' | 'Birth' = isFounder ? 'Founding' : 'Birth'
    const title = isFounder
      ? `${sim.firstName} ${sim.lastName} founds the legacy`
      : `${sim.firstName} ${sim.lastName} is born`

    return {
      milestone: {
        id: `birth-${sim.id}`,
        kind,
        gen: sim.generationNumber,
        simIds: [sim.id],
        title,
        // No derived blurb: we never fabricate places, dates, or events.
        blurb: null,
        userAuthored: false as const,
      },
      sortKey: sim.createdAt.getTime(),
    }
  })

  // --- Marriages ---
  // De-duplicate by canonical pair (lexicographically sorted ids)
  const seenPairs = new Set<string>()
  const marriageEntries: Array<{ milestone: Milestone; sortKey: number }> = []

  for (const rel of legacy.socialRelationships) {
    if (rel.romanticStatus !== 'MARRIED') continue

    const [idA, idB] = [rel.simAId, rel.simBId].sort()
    const pairKey = `${idA}:${idB}`
    if (seenPairs.has(pairKey)) continue
    seenPairs.add(pairKey)

    // Resolve partners by the canonical (sorted) ids so the title, simIds,
    // and id are all deterministic regardless of which row order won de-dup.
    const simA = simMap.get(idA)
    const simB = simMap.get(idB)

    // Names for the title; fall back gracefully if a partner is missing, and
    // drop empty segments so an empty lastName never produces a double space.
    const aName = [simA?.firstName ?? 'Unknown', simA?.lastName ?? '']
      .filter(Boolean)
      .join(' ')
    const bName = [simB?.firstName ?? 'Unknown', simB?.lastName ?? '']
      .filter(Boolean)
      .join(' ')

    // Marriage gen = min of non-null generation numbers of the two partners
    const gens = [simA?.generationNumber, simB?.generationNumber].filter(
      (g): g is number => g !== null && g !== undefined,
    )
    const gen: number | null = gens.length > 0 ? Math.min(...gens) : null

    // Sort key = relationship.createdAt (field exists on SocialRelationship)
    const sortKey = rel.createdAt.getTime()

    marriageEntries.push({
      milestone: {
        id: `marriage-${idA}-${idB}`,
        kind: 'Marriage',
        gen,
        simIds: [idA, idB],
        title: `${aName} marries ${bName}`,
        blurb: null,
        userAuthored: false as const,
      },
      sortKey,
    })
  }

  // --- Merge and sort ---
  const all = [...birthEntries, ...marriageEntries]

  all.sort((a, b) => {
    if (b.sortKey !== a.sortKey) return b.sortKey - a.sortKey
    // Tie-break by id for determinism
    return a.milestone.id.localeCompare(b.milestone.id)
  })

  return all.map((entry) => entry.milestone)
}

// ---------------------------------------------------------------------------
// 6. groupByGeneration
// ---------------------------------------------------------------------------

/**
 * Group ChronicleSims by generationNumber for the Roster section.
 *
 * Groups are sorted by generationNumber ASC; the null-gen group (if any)
 * is always last.
 *
 * Within each group, sims are ordered by id for stable determinism.
 * ChronicleSim does not carry createdAt (it was not included to keep the
 * view type lean), so id is the stable fallback ordering key. The page
 * can override display order if needed.
 */
export function groupByGeneration(sims: ChronicleSim[]): RosterGroup[] {
  const genMap = new Map<number | null, ChronicleSim[]>()

  for (const sim of sims) {
    const key = sim.generationNumber
    const group = genMap.get(key) ?? []
    group.push(sim)
    genMap.set(key, group)
  }

  // Sort each group's sims by id for stability
  for (const group of genMap.values()) {
    group.sort((a, b) => a.id.localeCompare(b.id))
  }

  // Collect numeric keys sorted ASC, then null last
  const numericKeys = [...genMap.keys()]
    .filter((k): k is number => k !== null)
    .sort((a, b) => a - b)

  const result: RosterGroup[] = numericKeys.map((gen) => ({
    gen,
    sims: genMap.get(gen) ?? [],
  }))

  if (genMap.has(null)) {
    result.push({ gen: null, sims: genMap.get(null) ?? [] })
  }

  return result
}
