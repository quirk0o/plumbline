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
import { CLUSTER_GAP, COMPONENT_GAP, appendToList, type Cluster } from './layout-shared'

export type ClusterGraph = {
  clusters: Cluster[]
  /** childClusterId → parent CLUSTER ids; only edges spanning ≥1 row down. */
  parentClusterIdsOf: Map<string, string[]>
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
}

/** [high] Absolute left x per cluster id, 0-based (no gutter/padding). */
export function positionClusters(graph: ClusterGraph): Map<string, number> {
  const { components, loose } = splitComponents(graph)
  const layouts = components.map((component) => layoutComponent(component, graph.parentClusterIdsOf))
  const band = bandLeftToRight(layouts)
  const packed = packLooseClusters(loose, band.width)
  return mergeXMaps(band.xById, packed)
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
  const grouped = walkComponents(graph.clusters, neighbors)
  return { components: sortComponents(grouped.components), loose: grouped.loose }
}

/** [high] X-position one component: pinned rows, d3-dag orders and spaces. */
export function layoutComponent(
  component: Cluster[],
  parentClusterIdsOf: Map<string, string[]>,
): ComponentLayout {
  const data = toComponentData(component, parentClusterIdsOf)
  const graph = runSugiyama(data)
  return collectLefts(graph)
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

/** [low] graphStratify input: parentIds scoped to the component, rows normalized. */
function toComponentData(
  component: Cluster[],
  parentClusterIdsOf: Map<string, string[]>,
): ComponentDatum[] {
  const minRow = Math.min(...component.map((c) => c.rowIndex))
  const inComponent = new Set(component.map((c) => c.id))
  return [...component]
    .sort((a, b) => a.rowIndex - b.rowIndex || (a.id < b.id ? -1 : 1))
    .map((cluster) => ({
      id: cluster.id,
      parentIds: (parentClusterIdsOf.get(cluster.id) ?? []).filter((p) => inComponent.has(p)).sort(),
      cluster,
      normRow: cluster.rowIndex - minRow,
    }))
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

/** [low] d3-dag reports centers; convert to left edges normalized to 0. */
function collectLefts(graph: Graph<ComponentDatum, undefined>): ComponentLayout {
  let minLeft = Infinity
  for (const node of graph.nodes()) {
    minLeft = Math.min(minLeft, node.x - node.data.cluster.width / 2)
  }
  const lefts = new Map<string, number>()
  let width = 0
  for (const node of graph.nodes()) {
    const left = node.x - node.data.cluster.width / 2 - minLeft
    lefts.set(node.data.id, left)
    width = Math.max(width, left + node.data.cluster.width)
  }
  return { lefts, width }
}

/** [low] Cumulative offsets; COMPONENT_GAP between components. The returned
 *  width includes the trailing gap — it is the start x for loose packing. */
function bandLeftToRight(layouts: ComponentLayout[]): { xById: Map<string, number>; width: number } {
  const xById = new Map<string, number>()
  let offset = 0
  for (const { lefts, width } of layouts) {
    for (const [id, left] of lefts) xById.set(id, offset + left)
    offset += width + COMPONENT_GAP
  }
  return { xById, width: offset }
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
