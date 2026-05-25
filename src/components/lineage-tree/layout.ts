/**
 * Pure, deterministic layout math for the SVG lineage tree.
 *
 * No React, no DOM — fully unit-testable. Consumes the exact shape returned by
 * the `sims.getTreeData` tRPC procedure and produces absolute node positions
 * (top-left of each 140×90 node bbox) plus a computed viewBox sized to the
 * content (never hard-coded to the mock's 1000×460).
 */

/** A sim as returned by `sims.getTreeData` (structural subset used for layout). */
export type LineageTreeSim = {
  id: string
  generationNumber: number | null
}

export type LineageFamilyEdge = {
  parentId: string
  childId: string
}

export type LineagePartnerEdge = {
  simAId: string
  simBId: string
}

/** Node bounding box (matches the design's 140×90 with the Crest medallion). */
export const NODE_WIDTH = 140
export const NODE_HEIGHT = 90

/**
 * Connector anchor offsets within a node's bbox, for the Crest renderer.
 * Lines attach to the medallion edge, not the bbox corners.
 * Mirrors `SimNodeCrest.anchors` in the design handoff.
 */
export const CREST_ANCHORS = {
  top: 2,
  bottom: 46,
  left: 48,
  right: 92,
  cx: 70,
  cy: 24,
} as const

export type CrestAnchors = typeof CREST_ANCHORS

/** Vertical pitch between generation rows (top edge to top edge). */
export const ROW_PITCH = 160
/** Gap between two partners' adjacent medallion edges (the marriage bond). */
export const MARRIAGE_BOND_GAP = 20
/** Horizontal gap between unrelated sims / couple clusters within a row. */
export const CLUSTER_GAP = 40
/** Left gutter reserved for the generation-row labels. */
export const ROW_LABEL_GUTTER = 64
/** Outer padding around the whole tree. */
export const TREE_PADDING = 24

export type PositionedNode = {
  id: string
  /** Top-left x of the 140×90 node bbox. */
  x: number
  /** Top-left y of the 140×90 node bbox. */
  y: number
}

export type LineageLayout = {
  nodes: PositionedNode[]
  /** id → positioned node, for convenient lookup by consumers. */
  byId: Record<string, PositionedNode>
  /** Top-left y of each rendered generation row, keyed by row index (0-based). */
  rowYs: number[]
  /** Generation number for each rendered row (null-gen sims live in a trailing row). */
  rowGenerations: (number | null)[]
  viewBox: { width: number; height: number }
}

type Cluster = {
  /** Member ids in render order (1 for singles, 2 for couples). */
  members: string[]
  /** Stable sort key derived from member ids. */
  key: string
}

/**
 * Compute deterministic node positions from the real tree data.
 *
 * Algorithm (a clean generation-row layout, per README "fidelity is
 * approximate"):
 *  1. Group sims into rows by `generationNumber`, ascending. Sims with a null
 *     generation are collected into a single trailing row (documented choice:
 *     keep them visible rather than omit, so the tree never silently drops a
 *     sim).
 *  2. Within a row, pair partners (from `partnerEdges`) into adjacent clusters
 *     and leave everyone else as singletons. Partners sit side-by-side with one
 *     node width + a 20px marriage-bond gap between their medallion edges.
 *  3. Lay clusters left-to-right with a consistent gap. Ordering within a row is
 *     stable: clusters sort by a key built from their member ids, so two calls
 *     with the same input yield identical output.
 *  4. The viewBox grows with content: width = widest row, height = row count.
 */
export function computeLineageLayout(
  sims: LineageTreeSim[],
  familyEdges: LineageFamilyEdge[],
  partnerEdges: LineagePartnerEdge[],
): LineageLayout {
  const idSet = new Set(sims.map((s) => s.id))

  // 1. Group into rows by generation. Stable ordering: sims arrive sorted by id
  //    from getTreeData; we preserve that within each generation bucket.
  const sorted = [...sims].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))

  const realGenerations = Array.from(
    new Set(
      sorted
        .map((s) => s.generationNumber)
        .filter((g): g is number => g !== null),
    ),
  ).sort((a, b) => a - b)

  const hasNullGen = sorted.some((s) => s.generationNumber === null)
  const rowGenerations: (number | null)[] = hasNullGen
    ? [...realGenerations, null]
    : [...realGenerations]

  const simsByRow: LineageTreeSim[][] = rowGenerations.map((gen) =>
    sorted.filter((s) => s.generationNumber === gen),
  )

  // Partner lookup: normalized pair set + per-sim partner map (first partner wins,
  // deterministically, since ids are sorted).
  const partnerOf = new Map<string, string>()
  const normalizedPairs = partnerEdges
    .map(({ simAId, simBId }) => {
      const [lo, hi] = [simAId, simBId].sort()
      return { lo, hi }
    })
    .filter(({ lo, hi }) => idSet.has(lo) && idSet.has(hi) && lo !== hi)
    .sort((a, b) => (a.lo < b.lo ? -1 : a.lo > b.lo ? 1 : a.hi < b.hi ? -1 : 1))
  for (const { lo, hi } of normalizedPairs) {
    if (!partnerOf.has(lo) && !partnerOf.has(hi)) {
      partnerOf.set(lo, hi)
      partnerOf.set(hi, lo)
    }
  }

  // Child → parents (for centering children under their parents' midpoint).
  const parentsOfChild = new Map<string, string[]>()
  for (const { parentId, childId } of familyEdges) {
    if (!idSet.has(parentId) || !idSet.has(childId)) continue
    const list = parentsOfChild.get(childId) ?? []
    if (!list.includes(parentId)) list.push(parentId)
    parentsOfChild.set(childId, list)
  }

  const byId: Record<string, PositionedNode> = {}
  const nodes: PositionedNode[] = []
  const rowYs: number[] = []
  let maxRowWidth = 0

  // First pass: place every row left-to-right at its natural position so we know
  // each node's x. We build clusters per row deterministically.
  rowGenerations.forEach((_gen, rowIndex) => {
    const rowSims = simsByRow[rowIndex]
    const rowY = TREE_PADDING + rowIndex * ROW_PITCH
    rowYs.push(rowY)

    const placedInRow = new Set<string>()
    const clusters: Cluster[] = []
    for (const sim of rowSims) {
      if (placedInRow.has(sim.id)) continue
      const partner = partnerOf.get(sim.id)
      if (partner && !placedInRow.has(partner) && rowSims.some((r) => r.id === partner)) {
        // Couple: order the two members by id for determinism.
        const members = [sim.id, partner].sort()
        clusters.push({ members, key: members.join('|') })
        placedInRow.add(sim.id)
        placedInRow.add(partner)
      } else {
        clusters.push({ members: [sim.id], key: sim.id })
        placedInRow.add(sim.id)
      }
    }
    clusters.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))

    // Lay clusters left-to-right.
    let cursorX = ROW_LABEL_GUTTER + TREE_PADDING
    for (const cluster of clusters) {
      cluster.members.forEach((id, idx) => {
        const x =
          idx === 0
            ? cursorX
            : // partner: one node width + bond gap to the right of the first member
              cursorX + NODE_WIDTH + MARRIAGE_BOND_GAP
        const node: PositionedNode = { id, x, y: rowY }
        byId[id] = node
        nodes.push(node)
      })
      const clusterWidth =
        cluster.members.length === 2
          ? NODE_WIDTH * 2 + MARRIAGE_BOND_GAP
          : NODE_WIDTH
      cursorX += clusterWidth + CLUSTER_GAP
    }

    const rowRight = cursorX - CLUSTER_GAP + TREE_PADDING
    if (rowRight > maxRowWidth) maxRowWidth = rowRight
  })

  // Second pass (best-effort centering): nudge each child cluster so children
  // sit roughly under their parents' midpoint, without overlapping siblings.
  // Per README this is approximate; we only shift when it does not collide.
  centerChildrenUnderParents(nodes, byId, simsByRow, rowGenerations, parentsOfChild, partnerOf)

  // Recompute width after centering (centering can push the rightmost node out).
  let widest = 0
  for (const node of nodes) {
    const right = node.x + NODE_WIDTH + TREE_PADDING
    if (right > widest) widest = right
  }
  const viewBoxWidth = Math.max(maxRowWidth, widest, ROW_LABEL_GUTTER + NODE_WIDTH + TREE_PADDING * 2)

  const lastRowTop = rowYs.length > 0 ? rowYs[rowYs.length - 1] : TREE_PADDING
  const viewBoxHeight = lastRowTop + NODE_HEIGHT + TREE_PADDING

  return {
    nodes,
    byId,
    rowYs,
    rowGenerations,
    viewBox: { width: viewBoxWidth, height: viewBoxHeight },
  }
}

/**
 * Best-effort horizontal centering of child clusters beneath their parents'
 * midpoint. Operates row by row; only applies a shift that keeps clusters
 * non-overlapping and within the left gutter. Deterministic.
 */
function centerChildrenUnderParents(
  nodes: PositionedNode[],
  byId: Record<string, PositionedNode>,
  simsByRow: LineageTreeSim[][],
  rowGenerations: (number | null)[],
  parentsOfChild: Map<string, string[]>,
  partnerOf: Map<string, string>,
): void {
  // Process rows top-down so parent rows are already positioned.
  for (let rowIndex = 1; rowIndex < rowGenerations.length; rowIndex++) {
    const rowSims = simsByRow[rowIndex]
    if (rowSims.length === 0) continue

    // Build the same clusters used for placement (couple or single), in their
    // current left-to-right order by x.
    const seen = new Set<string>()
    type RowCluster = { members: string[]; minX: number }
    const clusters: RowCluster[] = []
    for (const sim of rowSims) {
      if (seen.has(sim.id)) continue
      const partner = partnerOf.get(sim.id)
      const members =
        partner && rowSims.some((r) => r.id === partner)
          ? [sim.id, partner].sort()
          : [sim.id]
      members.forEach((m) => seen.add(m))
      const minX = Math.min(...members.map((m) => byId[m].x))
      clusters.push({ members, minX })
    }
    clusters.sort((a, b) => a.minX - b.minX)

    // For each cluster, compute the desired center from its (first) member's
    // parents' midpoint. Apply as a delta, clamped so clusters stay ordered.
    let leftBound = -Infinity
    for (let i = 0; i < clusters.length; i++) {
      const cluster = clusters[i]
      const clusterWidth =
        cluster.members.length === 2
          ? NODE_WIDTH * 2 + MARRIAGE_BOND_GAP
          : NODE_WIDTH
      const currentCenter = cluster.minX + clusterWidth / 2

      const parentCenters: number[] = []
      for (const member of cluster.members) {
        const parents = parentsOfChild.get(member) ?? []
        for (const parentId of parents) {
          const p = byId[parentId]
          if (p) parentCenters.push(p.x + CREST_ANCHORS.cx)
        }
      }
      if (parentCenters.length === 0) {
        // No known parents; just respect the left bound.
        const minStart = leftBound === -Infinity ? cluster.minX : leftBound + CLUSTER_GAP
        const newMinX = Math.max(cluster.minX, minStart)
        applyClusterShift(byId, cluster.members, newMinX - cluster.minX)
        leftBound = newMinX + clusterWidth
        continue
      }
      const desiredCenter =
        parentCenters.reduce((sum, c) => sum + c, 0) / parentCenters.length
      const desiredMinX = desiredCenter - clusterWidth / 2

      // Clamp so we never push left of the previous cluster.
      const minStart = leftBound === -Infinity ? cluster.minX : leftBound + CLUSTER_GAP
      const newMinX = Math.max(desiredMinX, minStart, ROW_LABEL_GUTTER + TREE_PADDING)
      // Only move rightward or to the centered spot; never collapse left of start.
      applyClusterShift(byId, cluster.members, newMinX - cluster.minX)
      leftBound = newMinX + clusterWidth

      // currentCenter is unused beyond documentation of intent.
      void currentCenter
    }
  }
}

function applyClusterShift(
  byId: Record<string, PositionedNode>,
  members: string[],
  delta: number,
): void {
  if (delta === 0) return
  for (const id of members) {
    byId[id].x += delta
  }
}
