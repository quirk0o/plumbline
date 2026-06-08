/**
 * Partner ranking + greedy matching, and cluster construction. One adjacency
 * slot per sim; EX_PARTNER never gets adjacency (exes connect only through
 * shared children — see placeHangingUnions in layout.ts).
 */
import type { RomanticStatus } from '@prisma/client'
import {
  COUPLE_WIDTH,
  NODE_WIDTH,
  type Cluster,
  type LayoutSim,
  type LineageCouple,
  type LineagePartnerEdge,
} from './layout-shared'

/** Lower = more current. DATING (casual) and EX_PARTNER are deliberately absent. */
const ADJACENCY_RANK: Partial<Record<RomanticStatus, number>> = {
  MARRIED: 0,
  ENGAGED: 1,
  PARTNER: 2,
  WIDOWED: 3,
}

type RankedCandidate = {
  lo: string
  hi: string
  romanticStatus: RomanticStatus
  rank: number
}

/** [high] */
export function matchCouples(
  partnerEdges: LineagePartnerEdge[],
  idSet: Set<string>,
  rowOf: Map<string, number>,
): LineageCouple[] {
  const candidates = listRankedCandidates(partnerEdges, idSet, rowOf)
  return pickGreedyMatching(candidates)
}

/** [high] */
export function buildClusters(
  sims: LayoutSim[],
  rowOf: Map<string, number>,
  couples: LineageCouple[],
): Cluster[] {
  const coupleOf = indexCouplesByMember(couples)
  return collectClusters(sims, rowOf, coupleOf)
}

/** [utility] Deterministic tiebreak: compare pairs by (lo, hi) sim ids. */
function comparePairIds(a: { lo: string; hi: string }, b: { lo: string; hi: string }): number {
  if (a.lo !== b.lo) return a.lo < b.lo ? -1 : 1
  if (a.hi !== b.hi) return a.hi < b.hi ? -1 : 1
  return 0
}

/**
 * [low] Adjacency candidates: rankable status, both sims known, same row.
 * Sorted by rank, then pair ids — the order the greedy matcher consumes.
 */
function listRankedCandidates(
  partnerEdges: LineagePartnerEdge[],
  idSet: Set<string>,
  rowOf: Map<string, number>,
): RankedCandidate[] {
  return partnerEdges
    .map(({ simAId, simBId, romanticStatus }) => {
      const [lo, hi] = [simAId, simBId].sort()
      return { lo, hi, romanticStatus, rank: ADJACENCY_RANK[romanticStatus] }
    })
    .filter(
      (c): c is RankedCandidate =>
        c.rank !== undefined &&
        c.lo !== c.hi &&
        idSet.has(c.lo) &&
        idSet.has(c.hi) &&
        rowOf.get(c.lo) !== undefined &&
        rowOf.get(c.lo) === rowOf.get(c.hi),
    )
    .sort((a, b) => a.rank - b.rank || comparePairIds(a, b))
}

/** [low] First candidate wins each sim's single adjacency slot. */
function pickGreedyMatching(candidates: RankedCandidate[]): LineageCouple[] {
  const matched = new Set<string>()
  const couples: LineageCouple[] = []
  for (const { lo, hi, romanticStatus } of candidates) {
    if (matched.has(lo) || matched.has(hi)) continue
    matched.add(lo)
    matched.add(hi)
    couples.push({ a: lo, b: hi, romanticStatus })
  }
  return couples
}

/** [low] */
function indexCouplesByMember(couples: LineageCouple[]): Map<string, LineageCouple> {
  const coupleOf = new Map<string, LineageCouple>()
  for (const c of couples) {
    coupleOf.set(c.a, c)
    coupleOf.set(c.b, c)
  }
  return coupleOf
}

/** [low] One couple cluster per matched pair ([lo, hi]), singles for the rest. */
function collectClusters(
  sims: LayoutSim[],
  rowOf: Map<string, number>,
  coupleOf: Map<string, LineageCouple>,
): Cluster[] {
  const sortedIds = sims.map((s) => s.id).sort()
  const placed = new Set<string>()
  const clusters: Cluster[] = []
  for (const id of sortedIds) {
    if (placed.has(id)) continue
    const couple = coupleOf.get(id)
    if (couple) {
      placed.add(couple.a)
      placed.add(couple.b)
      clusters.push({
        id: couple.a,
        members: [couple.a, couple.b],
        rowIndex: rowOf.get(couple.a)!,
        width: COUPLE_WIDTH,
      })
    } else {
      placed.add(id)
      clusters.push({ id, members: [id], rowIndex: rowOf.get(id)!, width: NODE_WIDTH })
    }
  }
  return clusters
}
