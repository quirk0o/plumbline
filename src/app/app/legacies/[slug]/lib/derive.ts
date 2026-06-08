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
 * The reigning heir — shown as "Heir designate" in the succession line and as
 * the Hero's current heir. Chosen from heirs EXCLUDING the founder (the founder
 * is shown separately as "Founder").
 *
 * Rule: the highest non-null `generationNumber` wins. A null-generation heir is
 * never the designate unless EVERY heir is null-generation, in which case the
 * last by id is chosen (deterministic). Returns null when there are no
 * non-founder heirs.
 *
 * Both deriveSuccession and the page's currentHeir use this single selector so
 * the two never disagree about who the heir is.
 */
export function selectDesignateHeir(
  sims: ChronicleSim[],
  founderSimId: string | null,
): ChronicleSim | null {
  const heirs = sims.filter((s) => s.isHeir && s.id !== founderSimId)
  if (heirs.length === 0) return null
  return heirs.reduce((best, sim) => {
    const bestGen = best.generationNumber
    const simGen = sim.generationNumber
    if (simGen === null) {
      // No generation: only wins if best is also null-gen and sim sorts later.
      return bestGen === null && sim.id > best.id ? sim : best
    }
    if (bestGen === null) return sim // any numbered heir beats a null-gen one
    if (simGen !== bestGen) return simGen > bestGen ? sim : best
    return sim.id > best.id ? sim : best // tie → last by id
  })
}

/**
 * Build the ordered succession line from a list of ChronicleSims.
 *
 * Order:
 *   1. The founder (role: "Founder"), if present.
 *   2. All heirs (isHeir), sorted by generationNumber ASC (nulls last),
 *      then by id for determinism. Each gets role "Heir · Gen {roman(gen)}"
 *      except the heir selected by selectDesignateHeir, who gets
 *      "Heir designate".
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

  const designate = selectDesignateHeir(sims, founderSimId)

  heirs.forEach((sim) => {
    let role: string

    if (designate && sim.id === designate.id) {
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
 * Returns entries NEWEST-FIRST (by sortOrder descending), tie-broken by id
 * for determinism.
 *
 * Origin rows: the founder gets kind 'Founding'; sims born into the legacy
 * (i.e. those appearing as a childId whose parentId is also a legacy sim)
 * get kind 'Birth'. Sims with no in-legacy parent (married/moved-in adults)
 * receive NO origin row — this is the birth-bug fix.
 *
 * Death rows: one per sim where causeOfDeath !== null. sortOrder = updatedAt
 * (proxy for the time of death). Independent of whether an origin row exists.
 *
 * Marriages: one per unique unordered pair (simAId, simBId) where
 * romanticStatus === 'MARRIED'. De-duplicated by canonical pair
 * (lower id first) to handle any accidental reciprocal rows.
 * sortOrder = relationship.createdAt.
 */
export function deriveMilestones(legacy: FetchedLegacy): Milestone[] {
  const simMap = new Map<string, FetchedSim>(legacy.sims.map((s) => [s.id, s]))
  const legacySimIds = new Set(legacy.sims.map((s) => s.id))

  // A sim is "born into the legacy" iff it has ≥1 parent who is also a member.
  const bornInLegacy = new Set<string>()
  for (const rel of legacy.familyRelationships) {
    if (legacySimIds.has(rel.parentId)) bornInLegacy.add(rel.childId)
  }

  const entries: Milestone[] = []

  for (const sim of legacy.sims) {
    const fullName = [sim.firstName, sim.lastName].filter(Boolean).join(' ')
    const isFounder = sim.id === legacy.founderSimId
    const birthSortOrder = sim.createdAt.getTime()

    // --- Origin row: Founding (founder), Birth (born-in), or nothing ---
    if (isFounder) {
      entries.push({
        id: `birth-${sim.id}`,
        kind: 'Founding',
        gen: sim.generationNumber,
        simIds: [sim.id],
        title: `${fullName} founds the legacy`,
        blurb: null,
        userAuthored: false,
        sortOrder: birthSortOrder,
      })
    } else if (bornInLegacy.has(sim.id)) {
      entries.push({
        id: `birth-${sim.id}`,
        kind: 'Birth',
        gen: sim.generationNumber,
        simIds: [sim.id],
        title: `${fullName} is born`,
        blurb: null,
        userAuthored: false,
        sortOrder: birthSortOrder,
      })
    }
    // else: married-in / moved-in adult → no origin row (the bug fix)

    // --- Death row (independent of origin); proxy sort by updatedAt ---
    if (sim.causeOfDeath !== null) {
      entries.push({
        id: `death-${sim.id}`,
        kind: 'Death',
        gen: sim.generationNumber,
        simIds: [sim.id],
        title: `${fullName} dies`,
        blurb: null,
        userAuthored: false,
        sortOrder: sim.updatedAt.getTime(),
      })
    }
  }

  // --- Couple rows: Marriages (MARRIED) and Partnerships (PARTNER) ---
  entries.push(
    ...deriveCoupleMilestones(legacy.socialRelationships, simMap, {
      status: 'MARRIED',
      kind: 'Marriage',
      idPrefix: 'marriage',
      makeTitle: (aName, bName) => `${aName} marries ${bName}`,
    }),
  )
  entries.push(
    ...deriveCoupleMilestones(legacy.socialRelationships, simMap, {
      status: 'PARTNER',
      kind: 'Partnership',
      idPrefix: 'partnership',
      makeTitle: (aName, bName) => `${aName} partners with ${bName}`,
    }),
  )

  entries.sort((a, b) => {
    if (b.sortOrder !== a.sortOrder) return b.sortOrder - a.sortOrder
    return a.id.localeCompare(b.id)
  })

  return entries
}

/** A sim's display name, falling back to 'Unknown' for an unresolved pair member. */
function simDisplayName(sim: FetchedSim | undefined): string {
  return [sim?.firstName ?? 'Unknown', sim?.lastName ?? ''].filter(Boolean).join(' ')
}

/** How a couple milestone kind differs from the others. */
interface CoupleMilestoneSpec {
  status: 'MARRIED' | 'PARTNER'
  kind: 'Marriage' | 'Partnership'
  idPrefix: string
  makeTitle: (aName: string, bName: string) => string
}

/**
 * Derive couple milestones: one per unique unordered pair of the given
 * romanticStatus. De-duplicated by canonical pair (lower id first) to handle
 * any accidental reciprocal rows; gen = min non-null generation of the two
 * sims; sortOrder = relationship.createdAt.
 */
function deriveCoupleMilestones(
  socialRelationships: FetchedLegacy['socialRelationships'],
  simMap: Map<string, FetchedSim>,
  spec: CoupleMilestoneSpec,
): Milestone[] {
  const seenPairs = new Set<string>()
  const entries: Milestone[] = []

  for (const rel of socialRelationships) {
    if (rel.romanticStatus !== spec.status) continue
    const [idA, idB] = [rel.simAId, rel.simBId].sort()
    const pairKey = `${idA}:${idB}`
    if (seenPairs.has(pairKey)) continue
    seenPairs.add(pairKey)

    const simA = simMap.get(idA)
    const simB = simMap.get(idB)
    const aName = simDisplayName(simA)
    const bName = simDisplayName(simB)
    const gens = [simA?.generationNumber, simB?.generationNumber].filter(
      (g): g is number => g !== null && g !== undefined,
    )
    const gen: number | null = gens.length > 0 ? Math.min(...gens) : null

    entries.push({
      id: `${spec.idPrefix}-${idA}-${idB}`,
      kind: spec.kind,
      gen,
      simIds: [idA, idB],
      title: spec.makeTitle(aName, bName),
      blurb: null,
      userAuthored: false,
      sortOrder: rel.createdAt.getTime(),
    })
  }

  return entries
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

// ---------------------------------------------------------------------------
// 7. toUserMilestones
// ---------------------------------------------------------------------------

/**
 * Map persisted user-authored milestones into view `Milestone`s.
 * Generation is inferred from the tagged sims (min non-null generationNumber,
 * the same rule marriages use); null when no tagged sim has a generation.
 */
export function toUserMilestones(legacy: FetchedLegacy): Milestone[] {
  const genById = new Map<string, number | null>(
    legacy.sims.map((s) => [s.id, s.generationNumber]),
  )

  return legacy.userMilestones.map((m) => {
    const simIds = m.sims.map((s) => s.simId)
    const gens = simIds
      .map((id) => genById.get(id))
      .filter((g): g is number => g !== null && g !== undefined)
    const gen: number | null = gens.length > 0 ? Math.min(...gens) : null

    return {
      id: m.id,
      kind: 'Note' as const,
      gen,
      simIds,
      title: m.title,
      blurb: m.blurb,
      userAuthored: true,
      sortOrder: m.sortOrder,
    }
  })
}

// ---------------------------------------------------------------------------
// 8. mergeMilestones
// ---------------------------------------------------------------------------

/**
 * Merge derived (auto) and user-authored milestones into one timeline,
 * newest-first by sortOrder, tie-broken by id for determinism.
 */
export function mergeMilestones(auto: Milestone[], user: Milestone[]): Milestone[] {
  return [...auto, ...user].sort((a, b) => {
    if (b.sortOrder !== a.sortOrder) return b.sortOrder - a.sortOrder
    return a.id.localeCompare(b.id)
  })
}
