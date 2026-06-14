/**
 * Lineage-tree layout orchestrator. Pure and deterministic: same input →
 * identical output, all tie-breaks by sim id. Pipeline rationale lives in
 * docs/superpowers/specs/2026-06-07-lineage-layout-redesign-design.md.
 */
export * from './layout-shared'
import {
  BOND_LANE_GUTTER,
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
  addUnique,
  appendToList,
  pairKey,
  type BondPath,
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
import { buildClusters, crossGenCurrentPairs, matchCouples } from './layout-clusters'
import { positionClustersWithBonds, type BondEdge, type ClusterGraph, type RoutedBondPath } from './layout-engine'

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
  const bondPairs = listDrawableBondPairs(crossGenCurrentPairs(cleanPartners, idSet, rowOf), clusters)
  const bondChildLower = mapBondChildrenToLowerParent(cleanFamily, bondPairs, rowOf)
  const clusterGraph = buildClusterGraph(clusters, cleanFamily, rowOf, bondPairs, bondChildLower)
  const { lefts: xByCluster, bondPaths } = positionClustersWithBonds(clusterGraph)
  const rowYs = computeRowYs(rowGenerations)
  const { nodes, byId } = placeMedallions(clusters, xByCluster, rowYs)
  const hangingUnions = placeHangingUnions({ familyEdges: cleanFamily, couples, byId, rowOf, rowYs })
  const bonds = toBondPaths(bondPaths, bondPairs, rowYs, byId, hangingUnions)
  const viewBox = computeViewBox(nodes, rowYs, bonds)
  return { nodes, byId, rowYs, rowGenerations, couples, hangingUnions, bonds, viewBox }
}

/**
 * [low] Keep only cross-gen pairs the engine can route as a clean lane: both
 * partners must be their own single-cluster. A sim already matched into a
 * same-row adjacent couple keeps that bond as primary; a lane into a couple
 * block has no single medallion to anchor on.
 */
function listDrawableBondPairs(bondPairs: LineageCouple[], clusters: Cluster[]): LineageCouple[] {
  const singleIds = new Set(clusters.filter((c) => c.members.length === 1).map((c) => c.id))
  return bondPairs.filter((p) => singleIds.has(p.a) && singleIds.has(p.b))
}

/**
 * [low] For each cross-gen current pair, the child whose two parents are
 * EXACTLY that pair descends from the LOWER partner (childId → lower parent id).
 * Other children, and children of three+ parents, are not re-routed.
 */
function mapBondChildrenToLowerParent(
  familyEdges: LineageFamilyEdge[],
  bondPairs: LineageCouple[],
  rowOf: Map<string, number>,
): Map<string, string> {
  const bondKeys = new Set(bondPairs.map((p) => pairKey([p.a, p.b])))
  const parentsOfChild = new Map<string, string[]>()
  for (const { parentId, childId } of familyEdges) addUnique(parentsOfChild, childId, parentId)
  const lowerByChild = new Map<string, string>()
  for (const [childId, parents] of parentsOfChild) {
    if (parents.length !== 2 || !bondKeys.has(pairKey(parents))) continue
    const [a, b] = parents
    lowerByChild.set(childId, rowOf.get(a)! >= rowOf.get(b)! ? a : b)
  }
  return lowerByChild
}

/** [low] Engine bonds carry cluster ids + interpolated rows; finish the canvas
 *  transform: add the gutter/padding baseX to x, resolve row → medallion-center
 *  y, and re-attach the actual partner sim-id pair (id-sorted, like couples).
 *
 *  When the engine routed the lane onto the partners' shared column (the common
 *  aligned case), a center-to-center polyline would coincide with the lower
 *  partner's own parental descent. Re-route those as a side bracket in the empty
 *  gutter beside the column; leave already-offset gutter lanes unchanged. */
function toBondPaths(
  routed: RoutedBondPath[],
  bondPairs: LineageCouple[],
  rowYs: number[],
  byId: Record<string, PositionedNode>,
  hangingUnions: HangingUnion[],
): BondPath[] {
  const baseX = ROW_LABEL_GUTTER + TREE_PADDING
  const pairByKey = new Map(bondPairs.map((p) => [pairKey([p.a, p.b]), p]))
  return routed.flatMap((path) => {
    const pair = pairByKey.get(pairKey([path.a, path.b]))
    if (!pair) return []
    const points = path.waypoints.map((w) => ({
      x: baseX + w.x,
      y: rowYs[Math.round(w.row)] + CREST_ANCHORS.cy,
    }))
    const { upper, lower } = orderPartnersByRow(byId[pair.a], byId[pair.b])
    const routedPoints = isOnColumn(points, upper, lower)
      ? sideBracketPoints(upper, lower, byId, hangingUnions)
      : points
    return [{ a: pair.a, b: pair.b, romanticStatus: pair.romanticStatus, points: routedPoints }]
  })
}

/** [utility] The partner with the smaller y is the upper one. */
function orderPartnersByRow(
  a: PositionedNode,
  b: PositionedNode,
): { upper: PositionedNode; lower: PositionedNode } {
  return a.y <= b.y ? { upper: a, lower: b } : { upper: b, lower: a }
}

/**
 * [utility] True when every waypoint sits within a partner medallion's
 * horizontal extent — i.e. the lane runs on the shared column rather than an
 * off-column gutter the engine opened to clear intervening crests.
 */
function isOnColumn(
  points: { x: number; y: number }[],
  upper: PositionedNode,
  lower: PositionedNode,
): boolean {
  const within = (x: number, n: PositionedNode) => x >= n.x && x <= n.x + NODE_WIDTH
  return points.every((p) => within(p.x, upper) || within(p.x, lower))
}

/**
 * [low] A 4-point bracket attaching to the partners' side edges and running the
 * vertical lane just outside the column, so it never coincides with any descent
 * (descents make their vertical approach on column CENTERS). The lane goes on the
 * side of the UPPER partner — so the bond hugs that side instead of spanning
 * across the lower partner (and its parental descent) to reach the far gutter.
 * The lane is pushed past any co-parent connector that spans the bond's rows near
 * the column (see bracketLaneX) so it never cuts through a partner's parents' elbows.
 */
function sideBracketPoints(
  upper: PositionedNode,
  lower: PositionedNode,
  byId: Record<string, PositionedNode>,
  hangingUnions: HangingUnion[],
): { x: number; y: number }[] {
  const goLeft = upper.x < lower.x
  const sideEdge = (n: PositionedNode) => n.x + (goLeft ? CREST_ANCHORS.left : CREST_ANCHORS.right)
  const laneX = bracketLaneX(upper, lower, byId, hangingUnions, goLeft)
  const upperY = upper.y + CREST_ANCHORS.cy
  const lowerY = lower.y + CREST_ANCHORS.cy
  return [
    { x: sideEdge(upper), y: upperY },
    { x: laneX, y: upperY },
    { x: laneX, y: lowerY },
    { x: sideEdge(lower), y: lowerY },
  ]
}

/**
 * [low] The bracket's vertical lane x: just outside the partners' medallions on
 * the chosen side, but pushed further out to clear any hanging-union co-parent
 * whose connector elbows span the bond's rows near the column. Without this, a
 * lane in the gutter beside the lower partner can cut through that partner's
 * parents' elbows (a co-parent runs its elbow toward the union over the gutter).
 */
function bracketLaneX(
  upper: PositionedNode,
  lower: PositionedNode,
  byId: Record<string, PositionedNode>,
  hangingUnions: HangingUnion[],
  goLeft: boolean,
): number {
  const top = Math.min(upper.y, lower.y)
  const bottom = Math.max(upper.y, lower.y)
  const colLeft = Math.min(upper.x, lower.x) - NODE_WIDTH
  const colRight = Math.max(upper.x, lower.x) + NODE_WIDTH
  const coParents: PositionedNode[] = []
  for (const hu of hangingUnions) {
    if (hu.y <= top || hu.y >= bottom) continue // not within the bond's vertical span
    if (hu.x < colLeft || hu.x > colRight) continue // not near the bond column
    for (const parentId of [hu.parentA, hu.parentB]) {
      const parent = byId[parentId]
      if (parent) coParents.push(parent)
    }
  }
  if (goLeft) {
    let leftmost = Math.min(upper.x, lower.x) + CREST_ANCHORS.left
    for (const p of coParents) leftmost = Math.min(leftmost, p.x + CREST_ANCHORS.left)
    return leftmost - BOND_LANE_GUTTER
  }
  let rightmost = Math.max(upper.x, lower.x) + CREST_ANCHORS.right
  for (const p of coParents) rightmost = Math.max(rightmost, p.x + CREST_ANCHORS.right)
  return rightmost + BOND_LANE_GUTTER
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
 *
 * Cross-gen current pairs get two extra treatments: their child descends from
 * the LOWER partner only (so the engine routes one descent, not two crossing
 * lines), and the pair itself becomes a bond edge the engine routes as a lane.
 */
function buildClusterGraph(
  clusters: Cluster[],
  familyEdges: LineageFamilyEdge[],
  rowOf: Map<string, number>,
  bondPairs: LineageCouple[],
  bondChildLower: Map<string, string>,
): ClusterGraph {
  const clusterOf = indexClustersByMember(clusters)
  const layoutEdges = rerouteBondChildren(listDownwardEdges(familyEdges, rowOf), bondChildLower)
  const parentClusterIdsOf = groupParentClustersByChildCluster(layoutEdges, clusterOf)
  const bondEdges = buildBondEdges(bondPairs)
  return { clusters, parentClusterIdsOf, bondEdges }
}

/**
 * [low] Replace a bond-child's two parent edges with a single edge from the
 * lower partner — the descent then drops from the couple's diamond at the lower
 * partner instead of crossing two generations from each parent.
 */
function rerouteBondChildren(
  familyEdges: LineageFamilyEdge[],
  bondChildLower: Map<string, string>,
): LineageFamilyEdge[] {
  return familyEdges.filter((e) => {
    const lower = bondChildLower.get(e.childId)
    return lower === undefined || e.parentId === lower
  })
}

/**
 * [low] One bond edge per drawable cross-gen pair. Both partners are already
 * single-clusters (listDrawableBondPairs guarantees it), so the cluster id is
 * the sim id — the lane anchors directly on each partner's medallion.
 */
function buildBondEdges(bondPairs: LineageCouple[]): BondEdge[] {
  return bondPairs.map((p) => ({ a: p.a, b: p.b, romanticStatus: p.romanticStatus }))
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
    addUnique(parentClusterIdsOf, childCluster.id, parentCluster.id)
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
  const pairs = collectCoParentPairs(args.familyEdges, args.couples, args.rowOf)
  const junctions = positionJunctions(pairs, args.byId, args.rowOf)
  return stackIntoLanes(junctions, args.rowYs)
}

/**
 * [low] Two-parent sets that are NOT the adjacent couple, deduped by pair.
 * Restricted to SAME-ROW pairs: a hanging union hangs below one row with a
 * midpoint between two medallions in that row, which is only meaningful when
 * both parents share it. Cross-row co-parents (e.g. partners across
 * generations) are left out here so the adapter falls back to per-parent
 * descent lines, which render correctly for any geometry.
 */
function collectCoParentPairs(
  familyEdges: LineageFamilyEdge[],
  couples: LineageCouple[],
  rowOf: Map<string, number>,
): [string, string][] {
  const coupleKeys = new Set(couples.map((c) => pairKey([c.a, c.b])))
  const parentsOfChild = new Map<string, string[]>()
  for (const { parentId, childId } of familyEdges) {
    addUnique(parentsOfChild, childId, parentId)
  }
  const pairs: [string, string][] = []
  const seen = new Set<string>()
  for (const parents of parentsOfChild.values()) {
    if (parents.length !== 2) continue
    const key = pairKey(parents)
    if (coupleKeys.has(key) || seen.has(key)) continue
    const [a, b] = [...parents].sort()
    if (rowOf.get(a) !== rowOf.get(b)) continue
    seen.add(key)
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

/** [low] Width = rightmost medallion OR bond-lane point + padding; height = last
 *  row + medallion + padding. Bonds are included so a right-gutter bond lane
 *  near the edge isn't clipped. */
function computeViewBox(
  nodes: PositionedNode[],
  rowYs: number[],
  bonds: BondPath[],
): { width: number; height: number } {
  let widest = ROW_LABEL_GUTTER + NODE_WIDTH + TREE_PADDING * 2
  for (const n of nodes) widest = Math.max(widest, n.x + NODE_WIDTH + TREE_PADDING)
  for (const bond of bonds) {
    for (const p of bond.points) widest = Math.max(widest, p.x + TREE_PADDING)
  }
  const lastRowTop = rowYs.length > 0 ? rowYs[rowYs.length - 1] : TREE_PADDING
  return { width: widest, height: lastRowTop + NODE_HEIGHT + TREE_PADDING }
}
