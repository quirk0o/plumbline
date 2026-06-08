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
  const candidates = listRankedCandidates(partnerEdges, idSet, rowOf, true)
  return pickGreedyMatching(candidates)
}

/**
 * [low] Current-partner pairs (rankable statuses) whose two sims sit in
 * DIFFERENT rows — the cross-generation complement of matchCouples' same-row
 * pairs. These can't be placed adjacently, so the orchestrator draws them as a
 * routed bond polyline instead. Members are id-sorted (a=lo, b=hi), matching
 * the LineageCouple shape. Deduped by pair; deterministic (rank, then ids).
 */
export function crossGenCurrentPairs(
  partnerEdges: LineagePartnerEdge[],
  idSet: Set<string>,
  rowOf: Map<string, number>,
): LineageCouple[] {
  const seen = new Set<string>()
  const pairs: LineageCouple[] = []
  for (const { lo, hi, romanticStatus } of listRankedCandidates(partnerEdges, idSet, rowOf, false)) {
    const key = `${lo}+${hi}`
    if (seen.has(key)) continue
    seen.add(key)
    pairs.push({ a: lo, b: hi, romanticStatus })
  }
  return pairs
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
 * [low] Rankable partner candidates, both sims known, sharing a row when
 * `sameRow` is true or in different rows when false. Sorted by rank, then pair
 * ids — the deterministic order the greedy matcher and cross-gen bonds consume.
 *
 * `sameRow: true` → adjacency candidates for matchCouples (same-row pairs).
 * `sameRow: false` → cross-generation pairs for crossGenCurrentPairs.
 */
function listRankedCandidates(
  partnerEdges: LineagePartnerEdge[],
  idSet: Set<string>,
  rowOf: Map<string, number>,
  sameRow: boolean,
): RankedCandidate[] {
  return partnerEdges
    .map(({ simAId, simBId, romanticStatus }) => {
      const [lo, hi] = [simAId, simBId].sort()
      return { lo, hi, romanticStatus, rank: ADJACENCY_RANK[romanticStatus] }
    })
    .filter((c): c is RankedCandidate => {
      if (c.rank === undefined || c.lo === c.hi) return false
      if (!idSet.has(c.lo) || !idSet.has(c.hi)) return false
      const rowLo = rowOf.get(c.lo)
      const rowHi = rowOf.get(c.hi)
      if (rowLo === undefined || rowHi === undefined) return false
      return sameRow ? rowLo === rowHi : rowLo !== rowHi
    })
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
