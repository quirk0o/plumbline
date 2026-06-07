/**
 * Row derivation for the lineage layout.
 *
 * - Each distinct real generation gets one row, ascending.
 * - A null-generation sim partnered with a generation-bearing sim sits in
 *   that partner's row (single pass, partner-only — deliberately no chained
 *   inference and no child/parent fallbacks; the common case is a townie
 *   spouse, and anything murkier belongs on the shelf as a visible nudge to
 *   set the generation in the data).
 * - Every other null-generation sim goes to a trailing shelf row, which
 *   exists only when occupied.
 *
 * Assumes edges are pre-sanitized (no self-references or unknown sim ids) —
 * the orchestrator guarantees this.
 */
import { appendToList, type LayoutSim, type LineagePartnerEdge } from './layout-shared'

export type RowAssignment = {
  rowGenerations: (number | null)[]
  /** simId → 0-based row index. Every sim gets a row. */
  rowOf: Map<string, number>
}

/** [high] */
export function deriveRows(
  sims: LayoutSim[],
  partnerEdges: LineagePartnerEdge[],
): RowAssignment {
  const realGens = listGenerationsAscending(sims)
  const generationPlacements = placeByGeneration(sims, realGens)
  const partnerPlacements = placeByPartnerRow(sims, partnerEdges, generationPlacements)
  const placed = mergeRowMaps(generationPlacements, partnerPlacements)
  const shelfSimIds = collectUnplacedSimIds(sims, placed)
  return assembleRowAssignment(realGens, placed, shelfSimIds)
}

/** [low] Distinct non-null generation numbers, ascending. */
function listGenerationsAscending(sims: LayoutSim[]): number[] {
  const gens = sims.map((s) => s.generationNumber).filter((g): g is number => g !== null)
  return [...new Set(gens)].sort((a, b) => a - b)
}

/** [low] simId → row index for every sim that has a generation. */
function placeByGeneration(sims: LayoutSim[], realGens: number[]): Map<string, number> {
  const rowByGen = new Map(realGens.map((g, i) => [g, i] as const))
  const placed = new Map<string, number>()
  for (const s of sims) {
    if (s.generationNumber !== null) placed.set(s.id, rowByGen.get(s.generationNumber)!)
  }
  return placed
}

/**
 * [low] Null-gen sims partnered with an already-placed sim borrow that
 * partner's row (lowest wins). Reads only the snapshot it was given, so
 * placements can't chain through other null-gen sims and the result never
 * depends on iteration order.
 */
function placeByPartnerRow(
  sims: LayoutSim[],
  partnerEdges: LineagePartnerEdge[],
  placed: Map<string, number>,
): Map<string, number> {
  const partnersOf = new Map<string, string[]>()
  for (const { simAId, simBId } of partnerEdges) {
    appendToList(partnersOf, simAId, simBId)
    appendToList(partnersOf, simBId, simAId)
  }
  const result = new Map<string, number>()
  for (const s of sims) {
    if (placed.has(s.id)) continue
    const partnerRows = (partnersOf.get(s.id) ?? [])
      .map((other) => placed.get(other))
      .filter((r): r is number => r !== undefined)
    if (partnerRows.length > 0) result.set(s.id, Math.min(...partnerRows))
  }
  return result
}

/** [low] */
function mergeRowMaps(a: Map<string, number>, b: Map<string, number>): Map<string, number> {
  return new Map([...a, ...b])
}

/** [low] Sorted SIM ids of sims with no row — the shelf's future occupants. */
function collectUnplacedSimIds(sims: LayoutSim[], placed: Map<string, number>): string[] {
  return sims.map((s) => s.id).filter((id) => !placed.has(id)).sort()
}

/**
 * [low] Final assembly: `placed` (simId → row) plus every shelved sim on a
 * trailing shelf row, which exists only when occupied.
 */
function assembleRowAssignment(
  realGens: number[],
  placed: Map<string, number>,
  shelfSimIds: string[],
): RowAssignment {
  const rowGenerations: (number | null)[] =
    shelfSimIds.length > 0 ? [...realGens, null] : [...realGens]
  const rowOf = new Map(placed)
  for (const simId of shelfSimIds) rowOf.set(simId, realGens.length)
  return { rowGenerations, rowOf }
}
