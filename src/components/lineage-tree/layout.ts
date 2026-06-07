/**
 * Lineage-tree layout orchestrator. Pure and deterministic: same input →
 * identical output, all tie-breaks by sim id. Pipeline rationale lives in
 * docs/superpowers/specs/2026-06-07-lineage-layout-redesign-design.md.
 */
export * from './layout-shared'
import {
  CREST_ANCHORS,
  HANGING_UNION_BASE_OFFSET,
  HANGING_UNION_LANE_PITCH,
  HANGING_UNION_MAX_LANES,
  MARRIAGE_BOND_GAP,
  NODE_HEIGHT,
  NODE_WIDTH,
  ROW_LABEL_GUTTER,
  ROW_PITCH,
  TREE_PADDING,
  appendToList,
  pairKey,
  type Cluster,
  type HangingUnion,
  type LayoutSim,
  type LineageCouple,
  type LineageFamilyEdge,
  type LineageLayout,
  type LineagePartnerEdge,
  type PositionedNode,
} from './layout-shared'
import { deriveRows } from './layout-rows'
import { buildClusters, matchCouples } from './layout-clusters'
import { positionClusters, type ClusterGraph } from './layout-engine'

/** [high] The pipeline — one named step per spec section. */
export function computeLineageLayout(
  sims: LayoutSim[],
  familyEdges: LineageFamilyEdge[],
  partnerEdges: LineagePartnerEdge[],
): LineageLayout {
  const { idSet, cleanFamily, cleanPartners } = sanitizeEdges(sims, familyEdges, partnerEdges)
  const { rowGenerations, rowOf } = deriveRows(sims, cleanPartners)
  const couples = matchCouples(cleanPartners, idSet, rowOf)
  const clusters = buildClusters(sims, rowOf, couples)
  const clusterGraph = buildClusterGraph(clusters, cleanFamily, rowOf)
  const xByCluster = positionClusters(clusterGraph)
  const rowYs = computeRowYs(rowGenerations)
  const { nodes, byId } = placeMedallions(clusters, xByCluster, rowYs)
  const hangingUnions = placeHangingUnions({ familyEdges: cleanFamily, couples, byId, rowOf, rowYs })
  const viewBox = computeViewBox(nodes, rowYs)
  return { nodes, byId, rowYs, rowGenerations, couples, hangingUnions, viewBox }
}

/** [low] Drop self-edges and edges referencing unknown sims; dedupe family edges. */
function sanitizeEdges(
  sims: LayoutSim[],
  familyEdges: LineageFamilyEdge[],
  partnerEdges: LineagePartnerEdge[],
): { idSet: Set<string>; cleanFamily: LineageFamilyEdge[]; cleanPartners: LineagePartnerEdge[] } {
  const idSet = new Set(sims.map((s) => s.id))
  const cleanFamily: LineageFamilyEdge[] = []
  const seen = new Set<string>()
  for (const e of familyEdges) {
    if (!idSet.has(e.parentId) || !idSet.has(e.childId) || e.parentId === e.childId) continue
    const key = `${e.parentId}->${e.childId}`
    if (seen.has(key)) continue
    seen.add(key)
    cleanFamily.push(e)
  }
  const cleanPartners = partnerEdges.filter(
    (e) => idSet.has(e.simAId) && idSet.has(e.simBId) && e.simAId !== e.simBId,
  )
  return { idSet, cleanFamily, cleanPartners }
}

/**
 * [high] Translate sim-level family edges into the cluster-level graph the
 * engine positions. The engine lays out CLUSTERS (a couple is one block),
 * so "bob → carol" and "alice → carol" both become "[alice+bob] cluster →
 * [carol] cluster" — one deduped edge.
 */
function buildClusterGraph(
  clusters: Cluster[],
  familyEdges: LineageFamilyEdge[],
  rowOf: Map<string, number>,
): ClusterGraph {
  const clusterOf = indexClustersByMember(clusters)
  const layoutEdges = listDownwardEdges(familyEdges, rowOf)
  const parentClusterIdsOf = groupParentClustersByChildCluster(layoutEdges, clusterOf)
  return { clusters, parentClusterIdsOf }
}

/** [low] member simId → the cluster containing that sim. */
function indexClustersByMember(clusters: Cluster[]): Map<string, Cluster> {
  const clusterOf = new Map<string, Cluster>()
  for (const c of clusters) {
    for (const m of c.members) clusterOf.set(m, c)
  }
  return clusterOf
}

/**
 * [low] Only edges where the parent's row is strictly ABOVE the child's
 * constrain the layout. Degenerate edges (same-row or inverted, from
 * manually edited generations) still render later — they just don't
 * participate here. Since every kept edge descends, the engine can never
 * see a cycle.
 */
function listDownwardEdges(
  familyEdges: LineageFamilyEdge[],
  rowOf: Map<string, number>,
): LineageFamilyEdge[] {
  return familyEdges.filter((e) => rowOf.get(e.parentId)! < rowOf.get(e.childId)!)
}

/**
 * [low] childClusterId → unique, sorted parent CLUSTER ids. Edges that fold
 * into a single cluster (parent and child in the same cluster) are dropped.
 */
function groupParentClustersByChildCluster(
  familyEdges: LineageFamilyEdge[],
  clusterOf: Map<string, Cluster>,
): Map<string, string[]> {
  const parentClusterIdsOf = new Map<string, string[]>()
  for (const { parentId, childId } of familyEdges) {
    const parentCluster = clusterOf.get(parentId)!
    const childCluster = clusterOf.get(childId)!
    if (parentCluster.id === childCluster.id) continue
    const list = parentClusterIdsOf.get(childCluster.id) ?? []
    if (!list.includes(parentCluster.id)) list.push(parentCluster.id)
    parentClusterIdsOf.set(childCluster.id, list)
  }
  for (const list of parentClusterIdsOf.values()) list.sort()
  return parentClusterIdsOf
}

/** [low] */
function computeRowYs(rowGenerations: (number | null)[]): number[] {
  return rowGenerations.map((_, i) => TREE_PADDING + i * ROW_PITCH)
}

/** [low] Absolute medallion positions: engine x + label gutter; y from the row. */
function placeMedallions(
  clusters: Cluster[],
  xByCluster: Map<string, number>,
  rowYs: number[],
): { nodes: PositionedNode[]; byId: Record<string, PositionedNode> } {
  const baseX = ROW_LABEL_GUTTER + TREE_PADDING
  const nodes: PositionedNode[] = []
  const byId: Record<string, PositionedNode> = {}
  for (const cluster of clusters) {
    const left = baseX + (xByCluster.get(cluster.id) ?? 0)
    const y = rowYs[cluster.rowIndex]
    cluster.members.forEach((id, idx) => {
      const node: PositionedNode = {
        id,
        x: idx === 0 ? left : left + NODE_WIDTH + MARRIAGE_BOND_GAP,
        y,
      }
      byId[id] = node
      nodes.push(node)
    })
  }
  return { nodes, byId }
}

type CoParentJunction = {
  key: string
  parentA: string
  parentB: string
  x: number
  rowIndex: number
}

/** [high] Descent junctions below the row for non-adjacent co-parent pairs. */
function placeHangingUnions(args: {
  familyEdges: LineageFamilyEdge[]
  couples: LineageCouple[]
  byId: Record<string, PositionedNode>
  rowOf: Map<string, number>
  rowYs: number[]
}): HangingUnion[] {
  const pairs = collectCoParentPairs(args.familyEdges, args.couples)
  const junctions = positionJunctions(pairs, args.byId, args.rowOf)
  return stackIntoLanes(junctions, args.rowYs)
}

/** [low] Two-parent sets that are NOT the adjacent couple, deduped by pair. */
function collectCoParentPairs(
  familyEdges: LineageFamilyEdge[],
  couples: LineageCouple[],
): [string, string][] {
  const coupleKeys = new Set(couples.map((c) => pairKey([c.a, c.b])))
  const parentsOfChild = new Map<string, string[]>()
  for (const { parentId, childId } of familyEdges) {
    const list = parentsOfChild.get(childId) ?? []
    if (!list.includes(parentId)) list.push(parentId)
    parentsOfChild.set(childId, list)
  }
  const pairs: [string, string][] = []
  const seen = new Set<string>()
  for (const parents of parentsOfChild.values()) {
    if (parents.length !== 2) continue
    const key = pairKey(parents)
    if (coupleKeys.has(key) || seen.has(key)) continue
    seen.add(key)
    const [a, b] = [...parents].sort()
    pairs.push([a, b])
  }
  return pairs
}

/** [low] Junction x = midpoint of the parents' medallion centers; row = the
 *  lower parent's row. */
function positionJunctions(
  pairs: [string, string][],
  byId: Record<string, PositionedNode>,
  rowOf: Map<string, number>,
): CoParentJunction[] {
  return pairs.map(([parentA, parentB]) => ({
    key: pairKey([parentA, parentB]),
    parentA,
    parentB,
    x: (byId[parentA].x + CREST_ANCHORS.cx + byId[parentB].x + CREST_ANCHORS.cx) / 2,
    rowIndex: Math.max(rowOf.get(parentA)!, rowOf.get(parentB)!),
  }))
}

/** [low] Same-row junctions stack into lanes, left to right, so their
 *  horizontal runs never overlap. */
function stackIntoLanes(junctions: CoParentJunction[], rowYs: number[]): HangingUnion[] {
  const byRow = new Map<number, CoParentJunction[]>()
  for (const j of junctions) {
    appendToList(byRow, j.rowIndex, j)
  }
  const hangingUnions: HangingUnion[] = []
  for (const rowIndex of [...byRow.keys()].sort((a, b) => a - b)) {
    const inRow = byRow.get(rowIndex)!.sort((a, b) => a.x - b.x || (a.key < b.key ? -1 : 1))
    inRow.forEach(({ key, parentA, parentB, x }, i) => {
      const lane = i % HANGING_UNION_MAX_LANES
      hangingUnions.push({
        key,
        parentA,
        parentB,
        x,
        y: rowYs[rowIndex] + HANGING_UNION_BASE_OFFSET + lane * HANGING_UNION_LANE_PITCH,
      })
    })
  }
  return hangingUnions
}

/** [low] Width = rightmost medallion + padding; height = last row + medallion + padding. */
function computeViewBox(nodes: PositionedNode[], rowYs: number[]): { width: number; height: number } {
  let widest = ROW_LABEL_GUTTER + NODE_WIDTH + TREE_PADDING * 2
  for (const n of nodes) widest = Math.max(widest, n.x + NODE_WIDTH + TREE_PADDING)
  const lastRowTop = rowYs.length > 0 ? rowYs[rowYs.length - 1] : TREE_PADDING
  return { width: widest, height: lastRowTop + NODE_HEIGHT + TREE_PADDING }
}
