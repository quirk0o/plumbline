/**
 * Cluster positioning. Only x comes from this module; y always derives from
 * the row index in the orchestrator — that keeps generation rows aligned
 * across separate components.
 */
import {
  graphStratify,
  sugiyama,
  decrossTwoLayer,
  type Graph,
  type MutGraph,
  type Separation,
} from 'd3-dag'
import type { RomanticStatus } from '@prisma/client'
import { CLUSTER_GAP, COMPONENT_GAP, appendToList, type Cluster } from './layout-shared'

/** A current-partner bond between two single-clusters in different rows. The
 *  cluster ids are each partner's own single-cluster id. */
export type BondEdge = { a: string; b: string; romanticStatus: RomanticStatus }

export type ClusterGraph = {
  clusters: Cluster[]
  /** childClusterId → parent CLUSTER ids; only edges spanning ≥1 row down. */
  parentClusterIdsOf: Map<string, string[]>
  /** Cross-row current-partner bonds, routed by the engine into lanes. */
  bondEdges?: BondEdge[]
}

/**
 * A routed bond returned from the engine. `x` is band-relative (component
 * offset applied, but no gutter/padding) and `row` is the ABSOLUTE cluster row
 * the waypoint passes through. The orchestrator finishes the transform: adds
 * baseX to x and resolves row → canvas y via rowYs.
 */
export type RoutedBondPath = {
  a: string
  b: string
  romanticStatus: RomanticStatus
  waypoints: { x: number; row: number }[]
}

type ComponentDatum = {
  /** CLUSTER id (graphStratify's required `id` accessor). */
  id: string
  /** Parent CLUSTER ids (graphStratify's required `parentIds` accessor —
   *  the field name is the library's contract, not ours). */
  parentIds: string[]
  cluster: Cluster
  normRow: number
}

type ComponentLayout = {
  /** clusterId → 0-based left edge within the component. */
  lefts: Map<string, number>
  width: number
  /** Routed bond paths, x band-relative to the component (offset added later). */
  bondPaths: RoutedBondPath[]
}

/** [high] Absolute left x per cluster id, 0-based (no gutter/padding). */
export function positionClusters(graph: ClusterGraph): Map<string, number> {
  return positionClustersWithBonds(graph).lefts
}

/**
 * [high] Like positionClusters, but also routes cross-row partner bonds. The
 * engine threads each bond as an extra (tagged) parent edge so d3-dag opens a
 * vertical lane that clears intervening crests; the lane waypoints come back as
 * band-relative bond paths.
 */
export function positionClustersWithBonds(graph: ClusterGraph): {
  lefts: Map<string, number>
  width: number
  bondPaths: RoutedBondPath[]
} {
  const bondEdges = graph.bondEdges ?? []
  const bondsByCluster = indexBondsByCluster(bondEdges, graph.clusters)
  const { components, loose } = splitComponents(graph)
  const layouts = components.map((component) =>
    layoutComponent(component, graph.parentClusterIdsOf, bondsByCluster),
  )
  const band = bandLeftToRight(layouts)
  const packed = packLooseClusters(loose, band.width)
  return {
    lefts: mergeXMaps(band.xById, packed),
    width: band.width,
    bondPaths: band.bondPaths,
  }
}

/**
 * One bond as the engine sees it: the upper partner (smaller rowIndex) becomes
 * an extra graph parent of the lower partner, opening a routed vertical lane.
 */
type BondLink = { upper: string; lower: string; romanticStatus: RomanticStatus }

/** clusterId-keyed bond data: links indexed by lower partner, plus the
 *  upper→lower keys that mark a graph link as a bond (not a descent). */
type BondsByCluster = {
  byLower: Map<string, BondLink[]>
  bondKeys: Set<string>
}

/** [low] Orient each bond (upper = smaller rowIndex) and index it by the lower
 *  partner cluster, the one that receives the extra parent edge. */
function indexBondsByCluster(bondEdges: BondEdge[], clusters: Cluster[]): BondsByCluster {
  const rowOf = new Map(clusters.map((c) => [c.id, c.rowIndex]))
  const byLower = new Map<string, BondLink[]>()
  const bondKeys = new Set<string>()
  for (const { a, b, romanticStatus } of bondEdges) {
    if (rowOf.get(a) === undefined || rowOf.get(b) === undefined) continue
    const [upper, lower] = rowOf.get(a)! <= rowOf.get(b)! ? [a, b] : [b, a]
    appendToList(byLower, lower, { upper, lower, romanticStatus })
    bondKeys.add(bondKey(upper, lower))
  }
  return { byLower, bondKeys }
}

/** [utility] */
function bondKey(upper: string, lower: string): string {
  return `${upper}->${lower}`
}

/**
 * [high] Group clusters into connected components plus "loose" clusters
 * (no layout edges at all — lone sims, childless orphan couples, the whole
 * shelf row). We group ourselves rather than via d3-dag's graph.split():
 * grouping must happen before any d3-dag graph exists, and we control the
 * deterministic ordering.
 */
export function splitComponents(graph: ClusterGraph): {
  components: Cluster[][]
  loose: Cluster[]
} {
  const neighbors = buildNeighborMap(graph.parentClusterIdsOf)
  addBondNeighbors(neighbors, graph.bondEdges ?? [])
  const grouped = walkComponents(graph.clusters, neighbors)
  return { components: sortComponents(grouped.components), loose: grouped.loose }
}

/** [low] Bonds also connect their two clusters, so the engine routes them in a
 *  single component (a lane can only clear crests it shares a component with). */
function addBondNeighbors(neighbors: Map<string, string[]>, bondEdges: BondEdge[]): void {
  for (const { a, b } of bondEdges) {
    appendToList(neighbors, a, b)
    appendToList(neighbors, b, a)
  }
}

/** [high] X-position one component: pinned rows, d3-dag orders and spaces.
 *  Bonds touching this component are routed into lanes alongside descent. */
export function layoutComponent(
  component: Cluster[],
  parentClusterIdsOf: Map<string, string[]>,
  bondsByCluster: BondsByCluster = { byLower: new Map(), bondKeys: new Set() },
): ComponentLayout {
  const data = toComponentData(component, parentClusterIdsOf, bondsByCluster.byLower)
  const graph = runSugiyama(data)
  const rowOf = new Map(component.map((c) => [c.id, c.rowIndex]))
  // The shared engine-space origin for both node lefts and bond-lane xs —
  // computed once so the two readers can't drift apart.
  const minLeft = componentMinLeft(graph)
  const layout = collectLefts(graph, minLeft)
  return { ...layout, bondPaths: collectBondPaths(graph, bondsByCluster, rowOf, minLeft) }
}

/** [high] Build the d3-dag graph and run sugiyama over it in place. */
function runSugiyama(data: ComponentDatum[]): MutGraph<ComponentDatum, undefined> {
  const graph = graphStratify()(data)
  const layout = sugiyama()
    .layering(pinnedRowLayering)
    .decross(decrossTwoLayer())
    .nodeSize(componentNodeSize)
  layout(graph)
  return graph
}

/** [low] Undirected adjacency between clusters, from the parent edges.
 *  Nested loop ≠ quadratic: the body runs once per (child, parent) pair,
 *  i.e. once per edge — O(E) total. */
function buildNeighborMap(parentClusterIdsOf: Map<string, string[]>): Map<string, string[]> {
  const neighbors = new Map<string, string[]>()
  for (const [child, parents] of parentClusterIdsOf) {
    for (const parent of parents) {
      appendToList(neighbors, child, parent)
      appendToList(neighbors, parent, child)
    }
  }
  return neighbors
}

/**
 * [low] Breadth-first walk: clusters with neighbors group into components;
 * clusters without any are loose. Deterministic (id-sorted seeds).
 */
function walkComponents(
  clusters: Cluster[],
  neighbors: Map<string, string[]>,
): { components: Cluster[][]; loose: Cluster[] } {
  const byId = new Map(clusters.map((c) => [c.id, c]))
  const visited = new Set<string>()
  const components: Cluster[][] = []
  const loose: Cluster[] = []
  for (const cluster of [...clusters].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    if (visited.has(cluster.id)) continue
    if (!neighbors.has(cluster.id)) {
      loose.push(cluster)
      continue
    }
    const component: Cluster[] = []
    const queue = [cluster.id]
    visited.add(cluster.id)
    while (queue.length > 0) {
      const id = queue.shift()!
      component.push(byId.get(id)!)
      for (const next of neighbors.get(id) ?? []) {
        if (!visited.has(next)) {
          visited.add(next)
          queue.push(next)
        }
      }
    }
    components.push(component)
  }
  return { components, loose }
}

/**
 * [low] Banding order: (topmost row, smallest cluster id) — founder-era
 * trees band left, side-families to their right. Sort keys are computed once
 * per component up front; computing them inside the comparator would redo
 * the min/sort work on every comparison.
 */
function sortComponents(components: Cluster[][]): Cluster[][] {
  const keyed = components.map((component) => ({
    component,
    minRow: Math.min(...component.map((c) => c.rowIndex)),
    minId: [...component.map((c) => c.id)].sort()[0],
  }))
  keyed.sort((a, b) => a.minRow - b.minRow || (a.minId < b.minId ? -1 : 1))
  return keyed.map((k) => k.component)
}

/** [low] graphStratify input: parentIds (descent + bonds) scoped to the
 *  component, rows normalized. A bond adds the upper partner as an extra parent
 *  of the lower one — d3-dag then routes a lane between them. */
function toComponentData(
  component: Cluster[],
  parentClusterIdsOf: Map<string, string[]>,
  bondsByLower: Map<string, BondLink[]>,
): ComponentDatum[] {
  const minRow = Math.min(...component.map((c) => c.rowIndex))
  const inComponent = new Set(component.map((c) => c.id))
  return [...component]
    .sort((a, b) => a.rowIndex - b.rowIndex || (a.id < b.id ? -1 : 1))
    .map((cluster) => ({
      id: cluster.id,
      parentIds: parentIdsFor(cluster.id, parentClusterIdsOf, bondsByLower, inComponent),
      cluster,
      normRow: cluster.rowIndex - minRow,
    }))
}

/** [low] Descent parents plus any bond's upper partner, deduped and scoped. */
function parentIdsFor(
  clusterId: string,
  parentClusterIdsOf: Map<string, string[]>,
  bondsByLower: Map<string, BondLink[]>,
  inComponent: Set<string>,
): string[] {
  const descent = parentClusterIdsOf.get(clusterId) ?? []
  const bondParents = (bondsByLower.get(clusterId) ?? []).map((b) => b.upper)
  const all = new Set([...descent, ...bondParents].filter((p) => inComponent.has(p)))
  return [...all].sort()
}

/** [low] Cluster width plus the in-row gap; height is unused (y is ours). */
function componentNodeSize(node: { data: ComponentDatum }): readonly [number, number] {
  return [node.data.cluster.width + CLUSTER_GAP, 1] as const
}

/**
 * [low] Custom d3-dag layering: every cluster gets the y of its pinned
 * (component-normalized) generation row, instead of deriving layers from
 * edges. The separation callback is honored when computing bounds (it
 * measures node-to-boundary padding in d3-dag's protocol), then all layers
 * shift so the topmost starts at 0. Returns the total layered height — the
 * d3-dag Layering contract requires it.
 */
function pinnedRowLayering<N extends { normRow: number }, L>(
  graph: Graph<N, L>,
  sep: Separation<N, L>,
): number {
  let min = Infinity
  let max = -Infinity
  for (const node of graph.nodes()) {
    node.y = node.data.normRow
    min = Math.min(min, node.y - sep(undefined, node))
    max = Math.max(max, node.y + sep(node, undefined))
  }
  if (min === Infinity) return 0
  for (const node of graph.nodes()) node.y -= min
  return max - min
}

/** [low] Smallest left edge across the component's nodes — the shared origin
 *  for both node lefts and bond-lane xs (they live in one engine frame). */
function componentMinLeft(graph: Graph<ComponentDatum, undefined>): number {
  let minLeft = Infinity
  for (const node of graph.nodes()) {
    minLeft = Math.min(minLeft, node.x - node.data.cluster.width / 2)
  }
  return minLeft
}

/** [low] d3-dag reports centers; convert to left edges normalized to 0 using
 *  the shared component origin. */
function collectLefts(
  graph: Graph<ComponentDatum, undefined>,
  minLeft: number,
): { lefts: Map<string, number>; width: number } {
  const lefts = new Map<string, number>()
  let width = 0
  for (const node of graph.nodes()) {
    const left = node.x - node.data.cluster.width / 2 - minLeft
    lefts.set(node.data.id, left)
    width = Math.max(width, left + node.data.cluster.width)
  }
  return { lefts, width }
}

/**
 * [low] Extract the routed lane for each bond link. d3-dag's link.points are
 * [ex, ey] in engine space, top→bottom: x is a center-line, normalized like
 * node lefts (ex - minLeft); the two endpoint points sit on the partner nodes
 * whose rows we know, so every waypoint's row is a linear interpolation of ey
 * between the endpoints' engine ys. (Interpolating against the real endpoints
 * is robust to d3-dag's internal layer spacing — which is a fixed 2× pitch when
 * intervening rows are populated, but collapses when they are not; the spike
 * confirmed both, and interpolation maps both to the right integer rows.)
 */
function collectBondPaths(
  graph: Graph<ComponentDatum, undefined>,
  bonds: BondsByCluster,
  rowOf: Map<string, number>,
  minLeft: number,
): RoutedBondPath[] {
  if (bonds.bondKeys.size === 0) return []
  const statusByKey = indexBondStatusByKey(bonds.byLower)
  const paths: RoutedBondPath[] = []
  for (const link of graph.links()) {
    const key = bondKey(link.source.data.id, link.target.data.id)
    if (!bonds.bondKeys.has(key)) continue
    paths.push({
      a: link.source.data.id,
      b: link.target.data.id,
      romanticStatus: statusByKey.get(key)!,
      waypoints: routeWaypoints(link.points, minLeft, {
        ey0: link.points[0][1],
        ey1: link.points[link.points.length - 1][1],
        row0: rowOf.get(link.source.data.id)!,
        row1: rowOf.get(link.target.data.id)!,
      }),
    })
  }
  return paths
}

type BondEndpoints = { ey0: number; ey1: number; row0: number; row1: number }

/** [low] Normalize x and interpolate each waypoint's engine y to a cluster row
 *  from the bond's two known endpoints. */
function routeWaypoints(
  points: readonly (readonly [number, number])[],
  minLeft: number,
  ends: BondEndpoints,
): { x: number; row: number }[] {
  const span = ends.ey1 - ends.ey0
  return points.map(([ex, ey]) => ({
    x: ex - minLeft,
    row: span === 0 ? ends.row0 : ends.row0 + ((ey - ends.ey0) / span) * (ends.row1 - ends.row0),
  }))
}

/** [utility] (upper→lower) bond key → its romantic status. */
function indexBondStatusByKey(byLower: Map<string, BondLink[]>): Map<string, RomanticStatus> {
  const byKey = new Map<string, RomanticStatus>()
  for (const links of byLower.values()) {
    for (const l of links) byKey.set(bondKey(l.upper, l.lower), l.romanticStatus)
  }
  return byKey
}

/** [low] Cumulative offsets; COMPONENT_GAP between components. The returned
 *  width includes the trailing gap — it is the start x for loose packing.
 *  Bond-lane xs shift by the same per-component offset as node lefts. */
function bandLeftToRight(
  layouts: ComponentLayout[],
): { xById: Map<string, number>; width: number; bondPaths: RoutedBondPath[] } {
  const xById = new Map<string, number>()
  const bondPaths: RoutedBondPath[] = []
  let offset = 0
  for (const { lefts, width, bondPaths: localBonds } of layouts) {
    for (const [id, left] of lefts) xById.set(id, offset + left)
    for (const bp of localBonds) {
      bondPaths.push({ ...bp, waypoints: bp.waypoints.map((w) => ({ x: w.x + offset, row: w.row })) })
    }
    offset += width + COMPONENT_GAP
  }
  return { xById, width: offset, bondPaths }
}

/** [low] Per-row cursors: loose clusters pack compactly after the last band. */
function packLooseClusters(loose: Cluster[], startX: number): Map<string, number> {
  const xById = new Map<string, number>()
  const cursorByRow = new Map<number, number>()
  for (const c of loose) {
    const cursor = cursorByRow.get(c.rowIndex) ?? startX
    xById.set(c.id, cursor)
    cursorByRow.set(c.rowIndex, cursor + c.width + CLUSTER_GAP)
  }
  return xById
}

/** [low] */
function mergeXMaps(a: Map<string, number>, b: Map<string, number>): Map<string, number> {
  return new Map([...a, ...b])
}
