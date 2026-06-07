# Lineage Tree Layout on d3-dag — Implementation Plan (Plan B)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the buggy hand-rolled lineage-tree position calculation with a d3-dag sugiyama pipeline (pinned generation rows, per-component banding, partner ranking, hanging unions) per the approved spec — organized so every function is at a single level of abstraction.

**Architecture:** `computeLineageLayout` keeps its public signature and output shape (extended with `hangingUnions`); internals split into focused modules (rows, clusters, engine) plus the orchestrator. The xyflow adapter (`to-flow-graph.ts`) gains hanging-union nodes, co-parent elbow edges, and the diamond-as-descent-junction rule. The per-parent descent fallback from `fix/tree-descent-split-parents` is superseded (kept only for ≥3-parent sets). Every function is **high-level** (composes named steps) or **low-level** (primitive ops) — never both.

**Tech Stack:** TypeScript, d3-dag ^1.2.1 (new dep), @xyflow/react 12, Vitest, Playwright. VCS via GitButler (`but`) only.

**Spec:** `docs/superpowers/specs/2026-06-07-lineage-layout-redesign-design.md` — read it first.

> This is the executable plan. It supersedes the sibling `2026-06-07-lineage-layout-d3dag.md` (Plan A), which holds the same design with a flatter code organization. Once this plan is chosen, Plan A can be deleted.

---

## Project rules that bind every task

- **VCS:** All writes via `but`, never `git add/commit`. Session branch: `feat/lineage-layout-d3dag`. Before every commit run `but status -f`, pick ONLY the file ids belonging to this work (other agents have uncommitted files in the unassigned area — `.claude/...`, `AGENTS.md`, migrations; never include those ids). After each commit, verify with `git show --stat` on the new commit that nothing foreign was absorbed.
- **No suppressions:** `eslint-disable`, `@ts-ignore`, `@ts-expect-error` are illegal. Fix root causes.
- **No `cd`:** run all commands from the repo root with explicit paths.
- **After each task:** `npx tsc --noEmit` and `npm run lint` must both be clean before committing.
- **Test style:** Testing Trophy. Assert observable behavior (positions, emitted nodes/edges, rendered attributes), never internals. The layout modules are genuinely complex isolated logic — focused tests on their *exported* functions are sanctioned; the private `[low]` helpers are covered transitively through those.

## The single-level-of-abstraction rule

Every function is exactly one of:

Every function is exactly one of:

- **[high]** — composes named functions. Allowed glue: destructuring, object/array
  literals for return values, `.map(fn)` over a collection of work items, and
  `if`-dispatch on a value produced by a named classifier. No arithmetic, no
  comparisons on primitives, no inline data transformation.
- **[low]** — operates on primitive data (numbers, strings, arrays, Maps, Sets,
  plain objects). Never calls another domain step.

Two categories count as primitives, the way `Math.min` does, callable from either
level:

- **utilities** — tiny generic helpers with no domain knowledge (`pairKey`,
  `comparePairIds`, `appendToList`),
- **constructors** — pure data-in → data-out builders of a single node/edge/record
  (`descentEdge(...)`, `rowUnion(...)`). They contain literals and arithmetic but no
  orchestration.

Every function below is tagged. If a tag is wrong, the function is misplaced — that
is the review criterion.

---

## File map

| File | Action | Responsibility |
| --- | --- | --- |
| `src/components/lineage-tree/layout-shared.ts` | Create | Types + constants + `pairKey`/`appendToList` utilities (no domain logic) |
| `src/components/lineage-tree/layout-rows.ts` | Create | Row derivation: generation rows, partner-row placement, shelf |
| `src/components/lineage-tree/layout-clusters.ts` | Create | Partner ranking + matching; cluster building |
| `src/components/lineage-tree/layout-engine.ts` | Create | d3-dag sugiyama per component; banding; loose-cluster packing |
| `src/components/lineage-tree/layout.ts` | Rewrite | Orchestrator + cluster graph + hanging unions + viewBox; re-exports shared API |
| `src/components/lineage-tree/to-flow-graph.ts` | Modify | Hanging-union nodes, coParent edges, diamond rule, dashed widowed bonds |
| `src/components/lineage-tree/flow-parts.tsx` | Modify | `UnionNode` diamond variant + `in` handle; `MarriageEdge` line-only/dashed; new `CoParentEdge` |
| `src/components/lineage-tree/lineage-flow.tsx` | Modify | Register `coParent` edge type |
| `src/server/routers/sims.ts` | Modify | `romanticStatus` on partner edges (getTreeData + getMiniTreeData) |
| `src/components/lineage-tree/__tests__/*.test.ts(x)` | Create/Modify | Scenario + module suites (Tasks below) |
| `src/server/routers/sims.test.ts` | Modify | Partner-edge shape assertions |

The **Code Reference** sections below give the full, final source for each module
(every function tagged `[high]`/`[low]`/`[utility]`/`[constructor]`). The **Execution
Tasks** section sequences the TDD steps, tests, and commits; its implement-steps point
back to these Code Reference sections in this same document.

---

# Code Reference

## `src/components/lineage-tree/layout-shared.ts`

```ts
/**
 * Shared types, constants, and generic utilities for the lineage-tree layout
 * pipeline. No domain logic — only shapes, numbers, and tiny helpers — so the
 * pipeline modules and the orchestrator can all import without cycles.
 */
import type { RomanticStatus } from '@prisma/client'

export type LayoutSim = {
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
  romanticStatus: RomanticStatus
}

/** Node bounding box (matches the design's 140×90 with the Crest medallion). */
export const NODE_WIDTH = 140
export const NODE_HEIGHT = 90

/** Connector anchor offsets within a node's bbox (medallion edge, not corners). */
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
/** Horizontal gap between disconnected family-tree components. */
export const COMPONENT_GAP = 96
/** Left gutter reserved for the generation-row labels. */
export const ROW_LABEL_GUTTER = 64
/** Outer padding around the whole tree. */
export const TREE_PADDING = 24
/** Width of a 2-member couple cluster. */
export const COUPLE_WIDTH = NODE_WIDTH * 2 + MARRIAGE_BOND_GAP

/**
 * Hanging unions (descent junctions for non-adjacent co-parents) sit below
 * the parents' row, stacked into lanes so horizontal runs never overlap.
 */
export const HANGING_UNION_BASE_OFFSET = NODE_HEIGHT + 4
export const HANGING_UNION_LANE_PITCH = 12
export const HANGING_UNION_MAX_LANES = 4

export type PositionedNode = {
  id: string
  x: number
  y: number
}

/** A partner pair the layout placed adjacently, with its bond status. */
export type LineageCouple = {
  a: string
  b: string
  romanticStatus: RomanticStatus
}

/** Descent junction for a non-adjacent co-parent pair with shared children. */
export type HangingUnion = {
  /**
   * pairKey of the two parents — the layout↔adapter join point: the adapter
   * derives the union node id (`union-${key}`) and coParent edge ids from it.
   */
  key: string
  parentA: string
  parentB: string
  /** Junction point (diamond center) in canvas coordinates. */
  x: number
  y: number
}

export type LineageLayout = {
  nodes: PositionedNode[]
  byId: Record<string, PositionedNode>
  rowYs: number[]
  rowGenerations: (number | null)[]
  couples: LineageCouple[]
  hangingUnions: HangingUnion[]
  viewBox: { width: number; height: number }
}

/** A layout unit: a couple (2 members, [lo, hi]) or a single. */
export type Cluster = {
  /** Smallest member id — stable cluster identifier (cluster-space, not sim-space). */
  id: string
  members: string[]
  rowIndex: number
  width: number
}

/** [utility] Canonical unordered-pair key. */
export function pairKey(ids: readonly string[]): string {
  return [...ids].sort().join('+')
}

/**
 * [utility] Append to a Map-of-arrays entry, creating it on first use.
 * In-place push, not spread-copy — re-spreading the list on every insertion
 * costs O(degree²) per key.
 */
export function appendToList<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key)
  if (list) list.push(value)
  else map.set(key, [value])
}
```

---

## `src/components/lineage-tree/layout-rows.ts`

```ts
/**
 * Row derivation: generation rows, partner-row placement for null-gen
 * spouses, trailing shelf. Assumes pre-sanitized edges (the orchestrator
 * guarantees this).
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
```

---

## `src/components/lineage-tree/layout-clusters.ts`

```ts
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

/** Lower = more current. EX_PARTNER is deliberately absent. */
const ADJACENCY_RANK: Partial<Record<RomanticStatus, number>> = {
  MARRIED: 0,
  ENGAGED: 1,
  DATING: 2,
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
```

---

## `src/components/lineage-tree/layout-engine.ts`

```ts
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
```

---

## `src/components/lineage-tree/layout.ts`

```ts
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
```

---

## `src/components/lineage-tree/to-flow-graph.ts`

Types (`LineageFlowSim`, `CrestNodeData`, `GenLabelNodeData`, `FlowGraphOptions`,
`UnionNodeData`, `MarriageEdgeData`), `STATIC_NODE`, and `A11Y_HIDDEN` (with its full
a11y rationale comment) are unchanged from Plan A. The function body reorganizes:

```ts
/** [high] */
export function toFlowGraph(
  layout: LineageLayout,
  sims: LineageFlowSim[],
  familyEdges: LineageFamilyEdge[],
  opts: FlowGraphOptions,
): { nodes: Node[]; edges: Edge[] } {
  const simById = indexSimsById(sims)
  const genLabelNodes = buildGenLabelNodes(layout)
  const parentsByChild = groupParentsByChild(layout, familyEdges)
  const descents = buildUnionsAndDescents(layout, parentsByChild)
  const marriageEdges = buildMarriageEdges(layout, simById)
  const crestNodes = buildCrestNodes(layout, simById, opts)
  return assembleGraph({ genLabelNodes, descents, crestNodes, marriageEdges })
}

type DescentBuild = {
  unionNodes: Node[]
  descentEdges: Edge[]
  coParentEdges: Edge[]
  unionIdByKey: Map<string, string>
}

type DescentKind = 'row' | 'hanging' | 'perParent'

/** [high] Classify each child's parent set, then emit the matching shape. */
function buildUnionsAndDescents(
  layout: LineageLayout,
  parentsByChild: Map<string, string[]>,
): DescentBuild {
  const coupleKeys = collectCoupleKeys(layout.couples)
  const hangingByKey = indexHangingUnions(layout.hangingUnions)
  const build = createDescentBuild()
  for (const [childId, parentIds] of parentsByChild) {
    const kind = classifyDescent(parentIds, coupleKeys, hangingByKey)
    if (kind === 'row') emitRowDescent(build, layout, childId, parentIds)
    else if (kind === 'hanging') emitHangingDescent(build, hangingByKey, childId, parentIds)
    else emitPerParentDescents(build, childId, parentIds)
  }
  return build
}

/**
 * [low] row: a lone parent or the adjacent couple (shared union up in the
 * row); hanging: a known non-adjacent pair (union below the row);
 * perParent: ≥3 parents or a defensive miss (one line per parent — the
 * superseded fix/tree-descent-split-parents behavior, kept as fallback).
 */
function classifyDescent(
  parentIds: string[],
  coupleKeys: Set<string>,
  hangingByKey: Map<string, HangingUnion>,
): DescentKind {
  if (parentIds.length === 1) return 'row'
  if (parentIds.length === 2 && coupleKeys.has(pairKey(parentIds))) return 'row'
  if (parentIds.length === 2 && hangingByKey.has(pairKey(parentIds))) return 'hanging'
  return 'perParent'
}

/** [low] Ensure the row union exists, then descend the child from it. */
function emitRowDescent(
  build: DescentBuild,
  layout: LineageLayout,
  childId: string,
  parentIds: string[],
): void {
  const key = pairKey(parentIds)
  let unionId = build.unionIdByKey.get(key)
  if (!unionId) {
    unionId = `union-${key}`
    build.unionIdByKey.set(key, unionId)
    build.unionNodes.push(rowUnion(unionId, parentIds, layout))
  }
  build.descentEdges.push(descentEdge(`descent-${childId}`, unionId, 'out', childId))
}

/** [low] Ensure the hanging union + its two co-parent elbows exist, then
 *  descend the child from it. */
function emitHangingDescent(
  build: DescentBuild,
  hangingByKey: Map<string, HangingUnion>,
  childId: string,
  parentIds: string[],
): void {
  const key = pairKey(parentIds)
  let unionId = build.unionIdByKey.get(key)
  if (!unionId) {
    const hanging = hangingByKey.get(key)!
    unionId = `union-${key}`
    build.unionIdByKey.set(key, unionId)
    build.unionNodes.push(hangingUnionNode(unionId, hanging))
    build.coParentEdges.push(coParentEdge(key, hanging.parentA, unionId))
    build.coParentEdges.push(coParentEdge(key, hanging.parentB, unionId))
  }
  build.descentEdges.push(descentEdge(`descent-${childId}`, unionId, 'out', childId))
}

/** [low] One descent line per parent. */
function emitPerParentDescents(build: DescentBuild, childId: string, parentIds: string[]): void {
  for (const parentId of parentIds) {
    build.descentEdges.push(descentEdge(`descent-${childId}-${parentId}`, parentId, 'bottom', childId))
  }
}

/** [low] */
function createDescentBuild(): DescentBuild {
  return { unionNodes: [], descentEdges: [], coParentEdges: [], unionIdByKey: new Map() }
}

/** [low] */
function indexSimsById(sims: LineageFlowSim[]): Map<string, LineageFlowSim> {
  return new Map(sims.map((s) => [s.id, s]))
}

/** [low] */
function collectCoupleKeys(couples: LineageCouple[]): Set<string> {
  return new Set(couples.map((c) => pairKey([c.a, c.b])))
}

/** [low] */
function indexHangingUnions(hangingUnions: HangingUnion[]): Map<string, HangingUnion> {
  return new Map(hangingUnions.map((u) => [u.key, u]))
}

/** [low] Family edges grouped by child; only fully placed edges count. */
function groupParentsByChild(
  layout: LineageLayout,
  familyEdges: LineageFamilyEdge[],
): Map<string, string[]> {
  const parentsByChild = new Map<string, string[]>()
  for (const { parentId, childId } of familyEdges) {
    if (!layout.byId[parentId] || !layout.byId[childId]) continue
    const list = parentsByChild.get(childId) ?? []
    if (!list.includes(parentId)) list.push(parentId)
    parentsByChild.set(childId, list)
  }
  return parentsByChild
}

/** [low] Bonds only between placed, present couples; left medallion is source. */
function buildMarriageEdges(layout: LineageLayout, simById: Map<string, LineageFlowSim>): Edge[] {
  return layout.couples.flatMap((couple) => {
    const pa = layout.byId[couple.a]
    const pb = layout.byId[couple.b]
    if (!pa || !pb) return []
    if (!simById.has(couple.a) || !simById.has(couple.b)) return []
    return [marriageEdge(couple, pa.x <= pb.x)]
  })
}

/** [low] Generation pills in the left gutter (position mirrors the old SVG). */
function buildGenLabelNodes(layout: LineageLayout): Node[] {
  return layout.rowYs.map((rowY, i) => genLabelNode(layout.rowGenerations[i], rowY))
}

/** [low] One crest medallion per placed sim that is present in the data. */
function buildCrestNodes(
  layout: LineageLayout,
  simById: Map<string, LineageFlowSim>,
  opts: FlowGraphOptions,
): Node[] {
  return layout.nodes.flatMap((n) => {
    const sim = simById.get(n.id)
    if (!sim) return []
    return [crestNode(sim, n, opts)]
  })
}

/** [low] Node z-order: labels, unions, crests (nodes render in array order).
 *  Edge paint order: descents under co-parent elbows under bonds. */
function assembleGraph(parts: {
  genLabelNodes: Node[]
  descents: DescentBuild
  crestNodes: Node[]
  marriageEdges: Edge[]
}): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: [...parts.genLabelNodes, ...parts.descents.unionNodes, ...parts.crestNodes],
    edges: [...parts.descents.descentEdges, ...parts.descents.coParentEdges, ...parts.marriageEdges],
  }
}
```

Constructors (all `[constructor]` — pure data builders; they keep Plan A's
load-bearing comments verbatim):

```ts
/** [constructor] Shared 1×1 union scaffolding. The ~20-line falsy-zero
 *  rationale comment from the current file (nodesInitialized gate +
 *  handleBounds gate) moves here VERBATIM and must survive the refactor. */
function unionNode(id: string, position: { x: number; y: number }, diamond: boolean): Node {
  return {
    id,
    type: 'union',
    position,
    data: { diamond } satisfies UnionNodeData,
    width: 1,
    height: 1,
    measured: { width: 1, height: 1 },
    ...STATIC_NODE,
    ...A11Y_HIDDEN,
  }
}

/** [constructor] The union that sits up IN the row — at the couple's bond
 *  midpoint, or at a lone parent's medallion center. Diamond rule: only a
 *  two-parent junction gets the diamond. */
function rowUnion(id: string, parentIds: string[], layout: LineageLayout): Node {
  const placed = parentIds.map((pid) => layout.byId[pid])
  const midX = placed.reduce((sum, p) => sum + p.x + CREST_ANCHORS.cx, 0) / placed.length
  const topY = Math.min(...placed.map((p) => p.y))
  return unionNode(id, { x: midX - 0.5, y: topY + CREST_ANCHORS.cy - 1 }, parentIds.length === 2)
}

/** [constructor] The union hanging below the row for a non-adjacent pair. */
function hangingUnionNode(id: string, hu: HangingUnion): Node {
  return unionNode(id, { x: hu.x - 0.5, y: hu.y - 1 }, true)
}

/** [constructor] Elbow from one parent's bottom handle to a hanging union. */
function coParentEdge(key: string, parentId: string, unionId: string): Edge {
  return {
    id: `coparent-${key}-${parentId}`,
    type: 'coParent',
    source: parentId,
    sourceHandle: 'bottom',
    target: unionId,
    targetHandle: 'in',
    focusable: false,
    ...A11Y_HIDDEN,
  }
}

/** [constructor] */
function descentEdge(id: string, source: string, sourceHandle: string, target: string): Edge {
  return {
    id,
    type: 'descent',
    source,
    sourceHandle,
    target,
    targetHandle: 'top',
    focusable: false,
    ...A11Y_HIDDEN,
  }
}

/** [constructor] Solid for current bonds, dashed for widowed. */
function marriageEdge(couple: LineageCouple, aIsLeft: boolean): Edge {
  const [left, right] = aIsLeft ? [couple.a, couple.b] : [couple.b, couple.a]
  return {
    id: `marriage-${couple.a}-${couple.b}`,
    type: 'marriage',
    source: left,
    sourceHandle: 'right',
    target: right,
    targetHandle: 'left',
    focusable: false,
    data: { dashed: couple.romanticStatus === 'WIDOWED' } satisfies MarriageEdgeData,
    ...A11Y_HIDDEN,
  }
}

/** [constructor] Amber generation pill (old SVG gutter placement). */
function genLabelNode(gen: number | null, rowY: number): GenLabelNodeType {
  return {
    id: `gen-${gen ?? 'null'}`,
    type: 'genLabel',
    position: { x: 6, y: rowY + NODE_HEIGHT / 2 - 42 },
    data: { label: gen === null ? 'GEN —' : `GEN ${roman(gen)}` },
    ...STATIC_NODE,
    ...A11Y_HIDDEN,
  }
}

/** [constructor] Crest medallion node. The width/height pre-measurement,
 *  pointer-events, and aria-roledescription comments from the current file
 *  move here verbatim. */
function crestNode(sim: LineageFlowSim, n: PositionedNode, opts: FlowGraphOptions): CrestFlowNodeType {
  return {
    id: n.id,
    type: 'crest' as const,
    position: { x: n.x, y: n.y },
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
    style: { pointerEvents: 'all' },
    domAttributes: { 'aria-roledescription': undefined },
    data: {
      sim,
      isFounder: opts.founderSimId === n.id,
      isSelected: opts.selectedId === n.id,
      isDimmed: opts.dimmedIds?.has(n.id) ?? false,
      isFocused: opts.focusSimId === n.id,
      onSelect: opts.onSelect,
      onNodeFocus: opts.onNodeFocus,
    },
    ...STATIC_NODE,
  }
}
```

---

## `src/components/lineage-tree/flow-parts.tsx`

Leaf presentation components and pure path helpers. The components are JSX leaves
(outside the high/low rule); `descentPath`/`coParentPath` are `[low]`.

```tsx
'use client'
import { Handle, Position, type EdgeProps } from '@xyflow/react'
import type { GenLabelNodeData, MarriageEdgeData, UnionNodeData } from './to-flow-graph'
import styles from './lineage-flow.module.css'

/** Amber generation pill in the left gutter. */
export function GenLabelNode({ data }: { data: GenLabelNodeData }) {
  return (
    <div className={styles.genPill} aria-hidden="true">
      {data.label}
    </div>
  )
}

/**
 * Invisible 1×1 anchor where children descend from. For an adjacent couple it
 * sits at the marriage-bond midpoint; for non-adjacent co-parents it hangs
 * below the row (fed by coParent elbows). When the junction joins two parents
 * to children it renders the amber diamond — the diamond ALWAYS means
 * "parents-to-children junction", never "marriage".
 *
 * Must be 1×1, not 0×0 — see to-flow-graph.ts union node comment for the two
 * xyflow falsy-zero pitfalls (nodesInitialized gate and handleBounds gate).
 */
export function UnionNode({ data }: { data: UnionNodeData }) {
  return (
    <div style={{ width: 1, height: 1, background: 'transparent', position: 'relative', overflow: 'visible' }}>
      {data.diamond && (
        <span
          data-testid="union-diamond"
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: -3.5,
            top: -3.5,
            width: 8,
            height: 8,
            background: 'var(--amber)',
            transform: 'rotate(45deg)',
          }}
        />
      )}
      <Handle type="target" id="in" position={Position.Top} className={styles.handle} isConnectable={false} />
      <Handle type="source" id="out" position={Position.Bottom} className={styles.handle} isConnectable={false} />
    </div>
  )
}

/** [low] Right-angle path: down from the bond, across, down to the child's top. */
export function descentPath(sourceX: number, sourceY: number, targetX: number, targetY: number): string {
  const midY = (sourceY + targetY) / 2
  return `M ${sourceX} ${sourceY} V ${midY} H ${targetX} V ${targetY}`
}

export function DescentEdge({ sourceX, sourceY, targetX, targetY }: EdgeProps) {
  return (
    <path
      d={descentPath(sourceX, sourceY, targetX, targetY)}
      stroke="var(--border-bright)"
      strokeWidth="1.5"
      fill="none"
      strokeLinejoin="round"
      aria-hidden="true"
    />
  )
}

/**
 * [low] Elbow from a parent's bottom handle down and across to a hanging
 * union. No trailing vertical: the union sits exactly at targetY, so the
 * horizontal run lands on it (contrast descentPath, which continues down to
 * the child's top handle).
 */
export function coParentPath(sourceX: number, sourceY: number, targetX: number, targetY: number): string {
  return `M ${sourceX} ${sourceY} V ${targetY} H ${targetX}`
}

export function CoParentEdge({ sourceX, sourceY, targetX, targetY }: EdgeProps) {
  return (
    <path
      d={coParentPath(sourceX, sourceY, targetX, targetY)}
      stroke="var(--border-bright)"
      strokeWidth="1.5"
      fill="none"
      strokeLinejoin="round"
      aria-hidden="true"
    />
  )
}

/**
 * Amber bond between adjacent partners. Line only — the descent diamond is
 * rendered by the union node (and only exists when the couple has children).
 * Widowed bonds render dashed and faded.
 */
export function MarriageEdge({ sourceX, sourceY, targetX, targetY, data }: EdgeProps) {
  // xyflow's EdgeProps types data as an open record; narrow it to the
  // adapter's named contract rather than an anonymous inline shape.
  const dashed = (data as MarriageEdgeData | undefined)?.dashed === true
  return (
    <line
      x1={sourceX}
      y1={sourceY}
      x2={targetX}
      y2={targetY}
      stroke="var(--amber)"
      strokeWidth="1.5"
      strokeDasharray={dashed ? '4 3' : undefined}
      opacity={dashed ? 0.7 : undefined}
      aria-hidden="true"
    />
  )
}
```

In `lineage-flow.tsx`, register the new edge type and keep the `UnionNode` node-type
registration (it now takes `{ data }`, so reuse the existing `as NodeTypes[string]`
assertion pattern if TS requires it):

```ts
import { CoParentEdge, DescentEdge, GenLabelNode, MarriageEdge, UnionNode } from './flow-parts'

const edgeTypes = { marriage: MarriageEdge, descent: DescentEdge, coParent: CoParentEdge } satisfies EdgeTypes
```

---

## `src/components/lineage-tree/to-flow-graph.ts` — preserved declarations

The orchestration code above (`toFlowGraph` + builders + constructors) replaces the
current function body. These declarations from the current file are **kept verbatim**
and referenced by the code above:

- `LineageFlowSim`, `CrestNodeData`, `GenLabelNodeData`, `CrestFlowNodeType`,
  `GenLabelNodeType`, `FlowGraphOptions` types.
- `STATIC_NODE` and `A11Y_HIDDEN` constants — including `A11Y_HIDDEN`'s full
  rationale comment (xyflow leaks auto `aria-label`; `aria-hidden` via
  `domAttributes` is the only reliable suppression).
- New exported types added by this plan: `export type UnionNodeData = { diamond: boolean }`
  and `export type MarriageEdgeData = { dashed: boolean }`.

The `unionNode` constructor MUST carry the current file's ~20-line falsy-zero
rationale comment (why 1×1 and not 0×0 — the nodesInitialized gate and the
handleBounds gate) VERBATIM. The `crestNode` constructor MUST carry the current
file's width/height pre-measurement, `pointerEvents: 'all'`, and
`aria-roledescription: undefined` comments verbatim. Reviewers reject the change if
these go missing.

---

# Execution Tasks

Sequenced TDD. Each code-bearing task implements the module from its Code Reference
section above; tests are inlined here. Run `npx tsc --noEmit && npm run lint` before
every commit, and verify each commit with `git show --stat` per the project rules.

### Task 1: Stack the branch and install d3-dag

- [ ] **Step 1:** Stack onto the branch this work supersedes (avoids GitButler dependency locks on the shared `to-flow-graph.ts`/`crest-flow-node.tsx`):
  `but move feat/lineage-layout-d3dag fix/tree-descent-split-parents`
  then `but status -f` to confirm the stack order.
- [ ] **Step 2:** `npm install d3-dag` → `^1.2.1` in `dependencies`.
- [ ] **Step 3:** `npx tsc --noEmit && npm run lint` (clean), then commit `package.json` + `package-lock.json` only:
  `but commit feat/lineage-layout-d3dag -m "build(deps): add d3-dag for lineage layout" --changes <ids>`

### Task 2: `romanticStatus` on partner edges (API)

**Files:** `src/server/routers/sims.ts`, `src/server/routers/sims.test.ts`

- [ ] **Step 1 (failing tests):** in the existing `getTreeData` and `getMiniTreeData` describe blocks, assert every returned `partnerEdges` element has a `romanticStatus` that is not `'NONE'`. Adapt to the file's existing fixture helpers.
- [ ] **Step 2:** `npm test -- sims.test` → new assertions FAIL.
- [ ] **Step 3 (implement):** add `romanticStatus: true` to the social-relationship `select` in `getTreeData` (and map it onto `partnerEdges`); add it to all four `socialRelationshipsA/B` selects in `getMiniTreeData`; widen the accumulator type and `addPartnerEdge(...)` to carry `romanticStatus` through every call site.
- [ ] **Step 4:** `npm test -- sims.test` → PASS.
- [ ] **Step 5:** validate + commit `sims.ts` + `sims.test.ts` only.

### Task 3: `layout-shared.ts` + fixture migration

**Files:** create `layout-shared.ts` (Code Reference above); touch existing test fixtures.

- [ ] **Step 1:** create `layout-shared.ts` exactly as in the Code Reference.
- [ ] **Step 2:** `grep -rln "simAId" src --include="*.test.ts" --include="*.test.tsx"` and add `romanticStatus: 'MARRIED' as const` to every inline partner-edge literal (the required field now exists).
- [ ] **Step 3:** `npx tsc --noEmit && npm run lint && npm test -- lineage-tree` → clean (existing behavior unchanged).
- [ ] **Step 4:** commit the new file + fixture touch-ups.

### Task 4: `layout-rows.ts`

**Files:** create `layout-rows.ts` (Code Reference); test `__tests__/layout-rows.test.ts`.

- [ ] **Step 1 (failing tests):**

```ts
import { describe, it, expect } from 'vitest'
import { deriveRows } from '../layout-rows'
import type { LayoutSim, LineagePartnerEdge } from '../layout-shared'

const married = (a: string, b: string): LineagePartnerEdge => ({
  simAId: a, simBId: b, romanticStatus: 'MARRIED',
})

describe('deriveRows', () => {
  it('maps distinct generations to ascending row indices', () => {
    const sims: LayoutSim[] = [
      { id: 'a', generationNumber: 3 },
      { id: 'b', generationNumber: 1 },
      { id: 'c', generationNumber: 1 },
    ]
    const { rowGenerations, rowOf } = deriveRows(sims, [])
    expect(rowGenerations).toEqual([1, 3])
    expect(rowOf.get('b')).toBe(0)
    expect(rowOf.get('a')).toBe(1)
  })

  it('places a null-gen sim in their generation-bearing partner’s row', () => {
    const sims: LayoutSim[] = [
      { id: 'gen2', generationNumber: 2 },
      { id: 'gen1', generationNumber: 1 },
      { id: 'townie', generationNumber: null },
    ]
    const { rowGenerations, rowOf } = deriveRows(sims, [married('townie', 'gen2')])
    expect(rowOf.get('townie')).toBe(rowOf.get('gen2'))
    expect(rowGenerations).toEqual([1, 2])
  })

  it('does not chain placement through another null-gen partner', () => {
    const sims: LayoutSim[] = [
      { id: 'g1', generationNumber: 1 },
      { id: 'n1', generationNumber: null },
      { id: 'n2', generationNumber: null },
    ]
    const { rowGenerations, rowOf } = deriveRows(sims, [married('n1', 'n2'), married('n2', 'g1')])
    expect(rowOf.get('n2')).toBe(0)
    expect(rowGenerations).toEqual([1, null])
    expect(rowOf.get('n1')).toBe(1) // shelf
  })

  it('shelves null-gen sims whose only connections are children or parents', () => {
    const sims: LayoutSim[] = [
      { id: 'kid', generationNumber: 2 },
      { id: 'founder', generationNumber: 1 },
      { id: 'mystery', generationNumber: null },
    ]
    const { rowGenerations, rowOf } = deriveRows(sims, [])
    expect(rowGenerations).toEqual([1, 2, null])
    expect(rowOf.get('mystery')).toBe(2)
  })

  it('shelves unconnected null-gen sims in a trailing null row', () => {
    const sims: LayoutSim[] = [
      { id: 'real', generationNumber: 1 },
      { id: 'stray', generationNumber: null },
    ]
    const { rowGenerations, rowOf } = deriveRows(sims, [])
    expect(rowGenerations).toEqual([1, null])
    expect(rowOf.get('stray')).toBe(1)
  })

  it('omits the shelf row when every null-gen sim has a placed partner', () => {
    const sims: LayoutSim[] = [
      { id: 'real', generationNumber: 1 },
      { id: 'spouse', generationNumber: null },
    ]
    const { rowGenerations } = deriveRows(sims, [married('spouse', 'real')])
    expect(rowGenerations).toEqual([1])
  })

  it('shelves everyone when no sim has a generation', () => {
    const sims: LayoutSim[] = [
      { id: 'x', generationNumber: null },
      { id: 'y', generationNumber: null },
    ]
    const { rowGenerations, rowOf } = deriveRows(sims, [married('x', 'y')])
    expect(rowGenerations).toEqual([null])
    expect(rowOf.get('x')).toBe(0)
    expect(rowOf.get('y')).toBe(0)
  })
})
```

- [ ] **Step 2:** `npm test -- layout-rows` → FAIL (module missing).
- [ ] **Step 3:** implement `layout-rows.ts` from the Code Reference.
- [ ] **Step 4:** `npm test -- layout-rows` → PASS.
- [ ] **Step 5:** validate + commit.

### Task 5: `layout-clusters.ts`

**Files:** create `layout-clusters.ts` (Code Reference); test `__tests__/layout-clusters.test.ts`.

- [ ] **Step 1 (failing tests):**

```ts
import { describe, it, expect } from 'vitest'
import { matchCouples, buildClusters } from '../layout-clusters'
import { COUPLE_WIDTH, NODE_WIDTH, type LineagePartnerEdge } from '../layout-shared'
import type { RomanticStatus } from '@prisma/client'

const edge = (a: string, b: string, romanticStatus: RomanticStatus): LineagePartnerEdge => ({
  simAId: a, simBId: b, romanticStatus,
})
const row0 = (...ids: string[]) => new Map<string, number>(ids.map((id) => [id, 0]))

describe('matchCouples', () => {
  it('prefers the current spouse over an ex (never "first partner wins")', () => {
    const couples = matchCouples(
      [edge('bob', 'a', 'EX_PARTNER'), edge('bob', 'z', 'MARRIED')],
      new Set(['a', 'bob', 'z']),
      row0('a', 'bob', 'z'),
    )
    expect(couples).toEqual([{ a: 'bob', b: 'z', romanticStatus: 'MARRIED' }])
  })

  it('ranks MARRIED > ENGAGED > DATING > WIDOWED for the single slot', () => {
    const couples = matchCouples(
      [edge('bob', 'late', 'WIDOWED'), edge('bob', 'new', 'MARRIED')],
      new Set(['bob', 'late', 'new']),
      row0('bob', 'late', 'new'),
    )
    expect(couples).toEqual([{ a: 'bob', b: 'new', romanticStatus: 'MARRIED' }])
  })

  it('keeps a widowed-only pair adjacent', () => {
    const couples = matchCouples(
      [edge('ann', 'joe', 'WIDOWED')],
      new Set(['ann', 'joe']),
      row0('ann', 'joe'),
    )
    expect(couples).toEqual([{ a: 'ann', b: 'joe', romanticStatus: 'WIDOWED' }])
  })

  it('never pairs exes', () => {
    const couples = matchCouples([edge('a', 'b', 'EX_PARTNER')], new Set(['a', 'b']), row0('a', 'b'))
    expect(couples).toEqual([])
  })

  it('only pairs partners in the same row', () => {
    const rowOf = new Map<string, number>([['a', 0], ['b', 1]])
    const couples = matchCouples([edge('a', 'b', 'MARRIED')], new Set(['a', 'b']), rowOf)
    expect(couples).toEqual([])
  })

  it('gives each sim at most one adjacent partner', () => {
    const couples = matchCouples(
      [edge('hub', 'w1', 'MARRIED'), edge('hub', 'w2', 'DATING')],
      new Set(['hub', 'w1', 'w2']),
      row0('hub', 'w1', 'w2'),
    )
    expect(couples).toHaveLength(1)
    expect(couples[0]).toMatchObject({ romanticStatus: 'MARRIED' })
  })
})

describe('buildClusters', () => {
  it('builds couple clusters (sorted members) and singles, sorted by id', () => {
    const sims = [
      { id: 'c', generationNumber: 1 },
      { id: 'a', generationNumber: 1 },
      { id: 'b', generationNumber: 1 },
    ]
    const rowOf = row0('a', 'b', 'c')
    const clusters = buildClusters(sims, rowOf, [{ a: 'a', b: 'c', romanticStatus: 'MARRIED' }])
    expect(clusters).toEqual([
      { id: 'a', members: ['a', 'c'], rowIndex: 0, width: COUPLE_WIDTH },
      { id: 'b', members: ['b'], rowIndex: 0, width: NODE_WIDTH },
    ])
  })
})
```

- [ ] **Step 2:** `npm test -- layout-clusters` → FAIL.
- [ ] **Step 3:** implement `layout-clusters.ts` from the Code Reference.
- [ ] **Step 4:** `npm test -- layout-clusters` → PASS.
- [ ] **Step 5:** validate + commit.

### Task 6: `layout-engine.ts`

**Files:** create `layout-engine.ts` (Code Reference); test `__tests__/layout-engine.test.ts`.

- [ ] **Step 1 (failing tests):**

```ts
import { describe, it, expect } from 'vitest'
import { positionClusters } from '../layout-engine'
import { CLUSTER_GAP, COMPONENT_GAP, COUPLE_WIDTH, NODE_WIDTH, type Cluster } from '../layout-shared'

const couple = (id: string, rowIndex: number): Cluster => ({
  id, members: [id, `${id}-partner`], rowIndex, width: COUPLE_WIDTH,
})
const single = (id: string, rowIndex: number): Cluster => ({
  id, members: [id], rowIndex, width: NODE_WIDTH,
})

describe('positionClusters', () => {
  it('positions a child within its parents’ horizontal span', () => {
    const clusters = [couple('p', 0), single('c', 1)]
    const x = positionClusters({ clusters, parentClusterIdsOf: new Map([['c', ['p']]]) })
    expect(x.get('c')!).toBeGreaterThanOrEqual(x.get('p')! - NODE_WIDTH)
    expect(x.get('c')!).toBeLessThanOrEqual(x.get('p')! + COUPLE_WIDTH)
  })

  it('never overlaps clusters within a row', () => {
    const clusters = [
      couple('p1', 0), couple('p2', 0),
      single('a', 1), single('b', 1), single('c', 1), single('d', 1),
    ]
    const x = positionClusters({
      clusters,
      parentClusterIdsOf: new Map([['a', ['p1']], ['b', ['p1']], ['c', ['p2']], ['d', ['p2']]]),
    })
    for (const row of [0, 1]) {
      const inRow = clusters
        .filter((c) => c.rowIndex === row)
        .map((c) => ({ left: x.get(c.id)!, right: x.get(c.id)! + c.width }))
        .sort((a, b) => a.left - b.left)
      for (let i = 1; i < inRow.length; i++) {
        expect(inRow[i].left).toBeGreaterThanOrEqual(inRow[i - 1].right)
      }
    }
  })

  it('bands disconnected multi-cluster components left-to-right with COMPONENT_GAP', () => {
    const clusters = [couple('fam1', 0), single('kid1', 1), couple('fam2', 0), single('kid2', 1)]
    const x = positionClusters({
      clusters,
      parentClusterIdsOf: new Map([['kid1', ['fam1']], ['kid2', ['fam2']]]),
    })
    expect(x.get('fam1')!).toBeLessThan(x.get('fam2')!)
    const fam1Right = Math.max(x.get('fam1')! + COUPLE_WIDTH, x.get('kid1')! + NODE_WIDTH)
    const fam2Left = Math.min(x.get('fam2')!, x.get('kid2')!)
    expect(fam2Left).toBeGreaterThanOrEqual(fam1Right + COMPONENT_GAP)
  })

  it('packs loose clusters (no layout edges) per row after the last component with CLUSTER_GAP', () => {
    const clusters = [couple('fam', 0), single('kid', 1), single('loner1', 0), single('loner2', 0)]
    const x = positionClusters({ clusters, parentClusterIdsOf: new Map([['kid', ['fam']]]) })
    const bandRight = Math.max(x.get('fam')! + COUPLE_WIDTH, x.get('kid')! + NODE_WIDTH)
    expect(x.get('loner1')!).toBeGreaterThanOrEqual(bandRight)
    expect(x.get('loner2')!).toBe(x.get('loner1')! + NODE_WIDTH + CLUSTER_GAP)
  })

  it('handles rows the component does not occupy (family starting at row 2)', () => {
    const clusters = [couple('late', 2), single('latekid', 3)]
    const x = positionClusters({ clusters, parentClusterIdsOf: new Map([['latekid', ['late']]]) })
    expect(x.get('late')).toBeDefined()
    expect(x.get('latekid')).toBeDefined()
  })

  it('is deterministic', () => {
    const clusters = [couple('p1', 0), couple('p2', 0), single('a', 1), single('b', 1), single('c', 1)]
    const input = {
      clusters,
      parentClusterIdsOf: new Map([['a', ['p1']], ['b', ['p2']], ['c', ['p1']]]),
    }
    expect(positionClusters(input)).toEqual(positionClusters(input))
  })

  it('returns an empty map for no clusters', () => {
    expect(positionClusters({ clusters: [], parentClusterIdsOf: new Map() }).size).toBe(0)
  })
})
```

- [ ] **Step 2:** `npm test -- layout-engine` → FAIL.
- [ ] **Step 3:** implement `layout-engine.ts` from the Code Reference. If d3-dag throws on any fixture, debug against it — do NOT loosen assertions.
- [ ] **Step 4:** `npm test -- layout-engine` → PASS.
- [ ] **Step 5:** validate + commit.

### Task 7: `layout.ts` orchestrator

**Files:** rewrite `layout.ts` (Code Reference); rewrite `__tests__/layout.test.ts`.

- [ ] **Step 1 (failing scenario suite):** replace `layout.test.ts` with the scenario suite covering: same-gen y / later-gen lower; shelf for unconnected null-gen; partner-row placement; couples adjacency + ranking (spouse over ex) + widowed adjacency + ex-only → no couple; hanging unions (one per non-adjacent co-parent pair, centered below the row, none for childless exes, two same-row → distinct lanes); components aligned to shared rows + unconnected sim in its row + horizontal separation + no row overlap + child within parents' span; determinism (deep-equal across two calls); viewBox growth; degenerate data (self-edges, unknown ids, same-row parent-child) ignored without dropping sims. Reuse the `sim`/`edge` helpers and the `expectNoRowOverlap` invariant.

```ts
import { describe, it, expect } from 'vitest'
import {
  computeLineageLayout,
  CREST_ANCHORS,
  HANGING_UNION_BASE_OFFSET,
  MARRIAGE_BOND_GAP,
  NODE_WIDTH,
  type LayoutSim,
  type LineagePartnerEdge,
} from '../layout'
import type { RomanticStatus } from '@prisma/client'

const edge = (a: string, b: string, romanticStatus: RomanticStatus = 'MARRIED'): LineagePartnerEdge => ({
  simAId: a, simBId: b, romanticStatus,
})
const sim = (id: string, generationNumber: number | null): LayoutSim => ({ id, generationNumber })

function expectNoRowOverlap(layout: ReturnType<typeof computeLineageLayout>) {
  const byRow = new Map<number, number[]>()
  for (const n of layout.nodes) byRow.set(n.y, [...(byRow.get(n.y) ?? []), n.x])
  for (const xs of byRow.values()) {
    const sorted = [...xs].sort((a, b) => a - b)
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i] - sorted[i - 1]).toBeGreaterThanOrEqual(NODE_WIDTH)
    }
  }
}

describe('computeLineageLayout — rows', () => {
  const sims = [sim('f1', 1), sim('f2', 1), sim('c1', 2), sim('c2', 2), sim('stray', null)]
  const familyEdges = [{ parentId: 'f1', childId: 'c1' }, { parentId: 'f2', childId: 'c1' }]
  const layout = computeLineageLayout(sims, familyEdges, [edge('f1', 'f2')])

  it('same-gen sims share y; later gens are lower', () => {
    expect(layout.byId['f1'].y).toBe(layout.byId['f2'].y)
    expect(layout.byId['c1'].y).toBe(layout.byId['c2'].y)
    expect(layout.byId['c1'].y).toBeGreaterThan(layout.byId['f1'].y)
  })
  it('shelves the unconnected null-gen sim below all real rows', () => {
    expect(layout.rowGenerations).toEqual([1, 2, null])
    expect(layout.byId['stray'].y).toBeGreaterThan(layout.byId['c1'].y)
  })
  it('places a connected null-gen sim in their partner’s row', () => {
    const l = computeLineageLayout([sim('f1', 1), sim('spouse', null)], [], [edge('f1', 'spouse')])
    expect(l.byId['spouse'].y).toBe(l.byId['f1'].y)
    expect(l.rowGenerations).toEqual([1])
  })
  it('returns a node per sim and handles an empty tree', () => {
    expect(layout.nodes.map((n) => n.id).sort()).toEqual(sims.map((s) => s.id).sort())
    const empty = computeLineageLayout([], [], [])
    expect(empty.nodes).toHaveLength(0)
    expect(empty.viewBox.width).toBeGreaterThan(0)
  })
})

describe('computeLineageLayout — couples', () => {
  it('places the matched couple adjacent (node width + bond gap)', () => {
    const l = computeLineageLayout([sim('f1', 1), sim('f2', 1)], [], [edge('f1', 'f2')])
    expect(Math.abs(l.byId['f1'].x - l.byId['f2'].x)).toBe(NODE_WIDTH + MARRIAGE_BOND_GAP)
    expect(l.couples).toEqual([{ a: 'f1', b: 'f2', romanticStatus: 'MARRIED' }])
  })
  it('prefers the current spouse over an ex', () => {
    const l = computeLineageLayout(
      [sim('alice', 1), sim('bob', 1), sim('dana', 1)],
      [],
      [edge('alice', 'bob', 'EX_PARTNER'), edge('bob', 'dana', 'MARRIED')],
    )
    expect(l.couples).toEqual([{ a: 'bob', b: 'dana', romanticStatus: 'MARRIED' }])
  })
  it('keeps widowed couples adjacent', () => {
    const l = computeLineageLayout([sim('ann', 1), sim('joe', 1)], [], [edge('ann', 'joe', 'WIDOWED')])
    expect(l.couples).toEqual([{ a: 'ann', b: 'joe', romanticStatus: 'WIDOWED' }])
  })
  it('emits no couple for ex-only pairs', () => {
    const l = computeLineageLayout([sim('a', 1), sim('b', 1)], [], [edge('a', 'b', 'EX_PARTNER')])
    expect(l.couples).toEqual([])
  })
})

describe('computeLineageLayout — hanging unions', () => {
  const sims = [sim('alice', 1), sim('bob', 1), sim('dana', 1), sim('carol', 2), sim('evan', 2)]
  const familyEdges = [
    { parentId: 'alice', childId: 'carol' },
    { parentId: 'bob', childId: 'carol' },
    { parentId: 'bob', childId: 'evan' },
    { parentId: 'dana', childId: 'evan' },
  ]
  const layout = computeLineageLayout(sims, familyEdges, [edge('alice', 'bob', 'EX_PARTNER'), edge('bob', 'dana', 'MARRIED')])

  it('one hanging union for the non-adjacent co-parent pair', () => {
    expect(layout.couples).toEqual([{ a: 'bob', b: 'dana', romanticStatus: 'MARRIED' }])
    expect(layout.hangingUnions).toHaveLength(1)
    expect([layout.hangingUnions[0].parentA, layout.hangingUnions[0].parentB].sort()).toEqual(['alice', 'bob'])
  })
  it('centers the junction between parents, below their row', () => {
    const [u] = layout.hangingUnions
    const expectedX = (layout.byId['alice'].x + CREST_ANCHORS.cx + layout.byId['bob'].x + CREST_ANCHORS.cx) / 2
    expect(u.x).toBeCloseTo(expectedX, 5)
    expect(u.y).toBe(layout.byId['alice'].y + HANGING_UNION_BASE_OFFSET)
  })
  it('no hanging union for childless exes', () => {
    const l = computeLineageLayout([sim('a', 1), sim('b', 1)], [], [edge('a', 'b', 'EX_PARTNER')])
    expect(l.hangingUnions).toEqual([])
  })
  it('stacks two same-row hanging unions into distinct lanes', () => {
    const wide = computeLineageLayout(
      [sim('a', 1), sim('b', 1), sim('c', 1), sim('d', 1), sim('k1', 2), sim('k2', 2)],
      [
        { parentId: 'a', childId: 'k1' }, { parentId: 'b', childId: 'k1' },
        { parentId: 'c', childId: 'k2' }, { parentId: 'd', childId: 'k2' },
      ],
      [],
    )
    expect(wide.hangingUnions).toHaveLength(2)
    expect(new Set(wide.hangingUnions.map((u) => u.y)).size).toBe(2)
  })
})

describe('computeLineageLayout — components and singles', () => {
  const sims = [sim('f1', 1), sim('f2', 1), sim('c1', 2), sim('g1', 1), sim('c2', 2), sim('pia', 1)]
  const familyEdges = [
    { parentId: 'f1', childId: 'c1' }, { parentId: 'f2', childId: 'c1' },
    { parentId: 'g1', childId: 'c2' },
  ]
  const layout = computeLineageLayout(sims, familyEdges, [edge('f1', 'f2')])

  it('aligns both components to the same generation rows', () => {
    expect(layout.byId['g1'].y).toBe(layout.byId['f1'].y)
    expect(layout.byId['c2'].y).toBe(layout.byId['c1'].y)
  })
  it('renders the unconnected sim in her generation row', () => {
    expect(layout.byId['pia'].y).toBe(layout.byId['f1'].y)
  })
  it('keeps components horizontally separated', () => {
    const aRight = Math.max(layout.byId['f1'].x, layout.byId['f2'].x, layout.byId['c1'].x) + NODE_WIDTH
    const bLeft = Math.min(layout.byId['g1'].x, layout.byId['c2'].x)
    expect(bLeft).toBeGreaterThanOrEqual(aRight)
  })
  it('never overlaps medallions within a row', () => expectNoRowOverlap(layout))
  it('keeps children within their parents’ span', () => {
    const left = Math.min(layout.byId['f1'].x, layout.byId['f2'].x)
    const right = Math.max(layout.byId['f1'].x, layout.byId['f2'].x) + NODE_WIDTH
    expect(layout.byId['c1'].x + CREST_ANCHORS.cx).toBeGreaterThanOrEqual(left)
    expect(layout.byId['c1'].x + CREST_ANCHORS.cx).toBeLessThanOrEqual(right)
  })
})

describe('computeLineageLayout — determinism and resilience', () => {
  const sims = [sim('f1', 1), sim('f2', 1), sim('c1', 2), sim('z', null)]
  const familyEdges = [{ parentId: 'f1', childId: 'c1' }]
  const partnerEdges = [edge('f1', 'f2')]

  it('is deterministic across repeated calls', () => {
    expect(computeLineageLayout(sims, familyEdges, partnerEdges)).toEqual(
      computeLineageLayout(sims, familyEdges, partnerEdges),
    )
  })
  it('grows the viewBox with content', () => {
    const small = computeLineageLayout([sim('solo', 1)], [], [])
    const large = computeLineageLayout(sims, familyEdges, partnerEdges)
    expect(large.viewBox.width).toBeGreaterThan(small.viewBox.width)
    expect(large.viewBox.height).toBeGreaterThan(small.viewBox.height)
  })
  it('ignores self-edges, unknown-id edges, and same-row parent-child edges without dropping sims', () => {
    const l = computeLineageLayout(
      [sim('a', 1), sim('b', 1)],
      [{ parentId: 'a', childId: 'a' }, { parentId: 'ghost', childId: 'a' }, { parentId: 'a', childId: 'b' }],
      [edge('a', 'ghost')],
    )
    expect(l.nodes).toHaveLength(2)
    expectNoRowOverlap(l)
  })
})
```

- [ ] **Step 2:** `npm test -- lineage-tree/__tests__/layout.test` → FAIL.
- [ ] **Step 3:** rewrite `layout.ts` from the Code Reference (delete the old `centerChildrenUnderParents`/`applyClusterShift`).
- [ ] **Step 4:** PASS (confirm any remaining failures are confined to `to-flow-graph.test.ts`, fixed in Task 8).
- [ ] **Step 5:** validate + commit.

### Task 8: adapter — `to-flow-graph.ts`

**Files:** modify `to-flow-graph.ts` (Code Reference); modify `__tests__/to-flow-graph.test.ts`.

- [ ] **Step 1 (failing tests):** keep the existing top-level `describe('toFlowGraph')` and its shared `graph`/`layout`/`sims` fixtures; migrate fixtures to ranked statuses; REPLACE the old `parents not placed as an adjacent couple` block. Add — **nested inside** the top-level describe so they see its `graph` fixture — `marriage edge styling` (widowed → `data.dashed === true`, current → `false`) and `diamond rule` (couple union `data.diamond === true`; childless couple → zero union nodes, one marriage edge; single-parent union → `diamond === false`). Add a **top-level** `hanging unions` describe with its own fixtures asserting: a 1×1 diamond union node at the layout point; two `coParent` elbows (`bottom`→`in`, `aria-hidden`); the child descends from the union, not the parents; ≥3-parent set falls back to one descent line per parent.

```ts
// inside describe('toFlowGraph', ...), reusing its `graph`, `layout`, `sims`:
describe('marriage edge styling', () => {
  it('marks current bonds solid', () => {
    expect(graph.edges.find((e) => e.type === 'marriage')!.data).toMatchObject({ dashed: false })
  })
  it('marks widowed bonds dashed', () => {
    const s = [sim('ann', 1), sim('joe', 1)]
    const l = computeLineageLayout(s, [], [{ simAId: 'ann', simBId: 'joe', romanticStatus: 'WIDOWED' as const }])
    const g = toFlowGraph(l, s, [], {})
    expect(g.edges.find((e) => e.type === 'marriage')!.data).toMatchObject({ dashed: true })
  })
})

describe('diamond rule', () => {
  it('gives the couple union a diamond', () => {
    const unions = graph.nodes.filter((n) => n.type === 'union')
    expect(unions).toHaveLength(1)
    expect(unions[0].data).toMatchObject({ diamond: true })
  })
  it('emits no union node for a childless couple', () => {
    const s = [sim('a', 1), sim('b', 1)]
    const l = computeLineageLayout(s, [], [{ simAId: 'a', simBId: 'b', romanticStatus: 'MARRIED' as const }])
    const g = toFlowGraph(l, s, [], {})
    expect(g.nodes.filter((n) => n.type === 'union')).toHaveLength(0)
    expect(g.edges.filter((e) => e.type === 'marriage')).toHaveLength(1)
  })
  it('gives single-parent unions no diamond', () => {
    const s = [sim('p', 1), sim('k', 2)]
    const fe = [{ parentId: 'p', childId: 'k' }]
    const g = toFlowGraph(computeLineageLayout(s, fe, []), s, fe, {})
    expect(g.nodes.find((n) => n.type === 'union')!.data).toMatchObject({ diamond: false })
  })
})
```

```ts
// top-level — its own fixtures:
describe('toFlowGraph — hanging unions', () => {
  const hSims = [sim('alice', 1), sim('bob', 1), sim('dana', 1), sim('carol', 2)]
  const hFamily = [{ parentId: 'alice', childId: 'carol' }, { parentId: 'bob', childId: 'carol' }]
  const hPartners = [
    { simAId: 'alice', simBId: 'bob', romanticStatus: 'EX_PARTNER' as const },
    { simAId: 'bob', simBId: 'dana', romanticStatus: 'MARRIED' as const },
  ]
  const hLayout = computeLineageLayout(hSims, hFamily, hPartners)
  const hGraph = toFlowGraph(hLayout, hSims, hFamily, {})

  it('materialises a 1×1 diamond union node at the layout point', () => {
    const [hu] = hLayout.hangingUnions
    const node = hGraph.nodes.find((n) => n.type === 'union' && n.id === `union-${hu.key}`)!
    expect(node.position.x + 0.5).toBeCloseTo(hu.x, 5)
    expect(node.position.y + 1).toBeCloseTo(hu.y, 5)
    expect(node.data).toMatchObject({ diamond: true })
    expect(node.measured).toEqual({ width: 1, height: 1 })
  })
  it('connects both parents to the union with coParent elbows', () => {
    const [hu] = hLayout.hangingUnions
    const co = hGraph.edges.filter((e) => e.type === 'coParent')
    expect(co.map((e) => [e.source, e.target]).sort()).toEqual([
      ['alice', `union-${hu.key}`],
      ['bob', `union-${hu.key}`],
    ])
    for (const e of co) {
      expect(e.sourceHandle).toBe('bottom')
      expect(e.targetHandle).toBe('in')
      expect(e.domAttributes?.['aria-hidden']).toBe('true')
    }
  })
  it('descends the child from the union, not from either parent', () => {
    const [hu] = hLayout.hangingUnions
    const d = hGraph.edges.filter((e) => e.type === 'descent' && e.target === 'carol')
    expect(d).toHaveLength(1)
    expect(d[0].source).toBe(`union-${hu.key}`)
  })
  it('falls back to per-parent descent lines for ≥3-parent sets', () => {
    const s = [sim('p1', 1), sim('p2', 1), sim('p3', 1), sim('k', 2)]
    const fe = [
      { parentId: 'p1', childId: 'k' }, { parentId: 'p2', childId: 'k' }, { parentId: 'p3', childId: 'k' },
    ]
    const g = toFlowGraph(computeLineageLayout(s, fe, []), s, fe, {})
    const d = g.edges.filter((e) => e.type === 'descent' && e.target === 'k')
    expect(d.map((e) => e.source).sort()).toEqual(['p1', 'p2', 'p3'])
  })
})
```

Keep the existing a11y / ordering / union-midpoint tests; update the union-midpoint test if it asserts `data` (now `{ diamond: true }`).

- [ ] **Step 2:** `npm test -- to-flow-graph` → new tests FAIL.
- [ ] **Step 3:** implement the `to-flow-graph.ts` reorganization from the Code Reference (keep preserved declarations + verbatim comments; add `UnionNodeData`/`MarriageEdgeData` exports).
- [ ] **Step 4:** `npm test -- to-flow-graph` → PASS.
- [ ] **Step 5:** validate + commit.

### Task 9: `flow-parts.tsx` + edge-type registration

**Files:** modify `flow-parts.tsx` (Code Reference); modify `lineage-flow.tsx`; test `__tests__/flow-parts.test.tsx`.

- [ ] **Step 1 (failing tests):**

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import type { EdgeProps } from '@xyflow/react'
import { CoParentEdge, MarriageEdge, UnionNode, coParentPath } from '../flow-parts'

const edgeProps = (over: Partial<EdgeProps> = {}): EdgeProps =>
  ({ id: 'e', source: 'a', target: 'b', sourceX: 0, sourceY: 0, targetX: 100, targetY: 50, ...over }) as EdgeProps

describe('coParentPath', () => {
  it('drops from the parent, then runs across to the union', () => {
    expect(coParentPath(70, 70, 175, 118)).toBe('M 70 70 V 118 H 175')
  })
})

describe('MarriageEdge', () => {
  it('renders a solid line without a diamond by default', () => {
    const { container } = render(<svg><MarriageEdge {...edgeProps({ data: { dashed: false } })} /></svg>)
    expect(container.querySelector('line')).not.toHaveAttribute('stroke-dasharray')
    expect(container.querySelector('rect')).toBeNull()
  })
  it('renders dashed when data.dashed is true', () => {
    const { container } = render(<svg><MarriageEdge {...edgeProps({ data: { dashed: true } })} /></svg>)
    expect(container.querySelector('line')).toHaveAttribute('stroke-dasharray')
  })
})

describe('UnionNode', () => {
  it('renders a diamond when data.diamond is true', () => {
    const { container } = render(<UnionNode data={{ diamond: true }} />)
    expect(container.querySelector('[data-testid="union-diamond"]')).not.toBeNull()
  })
  it('renders no diamond when data.diamond is false', () => {
    const { container } = render(<UnionNode data={{ diamond: false }} />)
    expect(container.querySelector('[data-testid="union-diamond"]')).toBeNull()
  })
})

describe('CoParentEdge', () => {
  it('renders the elbow path', () => {
    const { container } = render(<svg><CoParentEdge {...edgeProps()} /></svg>)
    expect(container.querySelector('path')).toHaveAttribute('d', 'M 0 0 V 50 H 100')
  })
})
```

(If `UnionNode`'s `Handle` needs a provider in this test setup, match how the existing `crest-flow-node.test.tsx` renders Handle-bearing components.)

- [ ] **Step 2:** `npm test -- flow-parts` → FAIL.
- [ ] **Step 3:** implement `flow-parts.tsx` from the Code Reference; register `coParent` in `lineage-flow.tsx`'s `edgeTypes`.
- [ ] **Step 4:** `npm test -- flow-parts && npm test -- lineage-flow` → PASS.
- [ ] **Step 5:** validate + commit.

### Task 10: Full validation

- [ ] **Step 1:** `npx tsc --noEmit && npm run lint` repo-wide. Fix any consumer fallout (`tree-atlas.tsx`, `family-tree-mini.tsx`, `sim-detail-client.tsx`) — they receive partner edges from tRPC outputs that now include `romanticStatus`, so they should compile unchanged; update any local annotation pinning the old shape.
- [ ] **Step 2:** `npm test` — full suite green; update any non-lineage test asserting partner-edge shapes.
- [ ] **Step 3:** kill stray dev server (`lsof -ti :3737 | xargs -r kill`), then `npm run test:e2e` — fix genuine regressions, don't weaken specs.
- [ ] **Step 4:** Visual check: dev server + magic-link sign-in (AGENTS.md), open a multi-generation legacy, verify against the spec's composite mockup (rows, couple bonds, diamonds only above children, hanging unions for re-partnered parents, side-by-side components, shelf row).
- [ ] **Step 5:** commit any fixups.

### Task 11: Reviews (required before merge)

- [ ] **Step 1:** Run `/code-review` on the branch; address findings (re-run after large changes).
- [ ] **Step 2:** Run the `design-system-reviewer` agent (UI changed: diamond, dashed bonds) — confirm amber stays within the heir/legacy-callout rule (the descent diamond is a lineage callout, so amber is correct).
- [ ] **Step 3:** Run the `web-qa-tester` agent on both tree surfaces (legacy Atlas + sim mini-tree): remarried-parent scenarios, widowed bonds, two-family legacies, shelf row, keyboard focus-pan.
- [ ] **Step 4:** Address findings; document false positives and get a second opinion per AGENTS.md.

---

## Self-review notes

- **Spec coverage:** rows/pinning (Tasks 4, 6, 7); ranking + widowed (5); hanging unions + lanes (7, 8); diamond rule (8, 9); components/banding + loose packing (6); shelf (4); API `romanticStatus` (2); determinism (every module test); supersession of per-parent descent (8 — replaced, kept only for ≥3 parents); preserved a11y/1×1 union behavior (8, 9).
- **Component ordering:** retained the `(topmost row, smallest cluster id)` rule (decision finalized — not the id-only simplification).
- **Out of scope honored:** no drag, no crest changes, no DB layout storage.
- **Level rule:** every function in the Code Reference is tagged; review rejects any mis-tag.

## What changed relative to Plan A, structurally

Same approved design, public APIs, types, constants, behavior, and load-bearing
comments — only internal function boundaries differ (each split to a single level
of abstraction):

| Plan A | Plan B |
| --- | --- |
| `deriveRows` — one mixed function | [high] `deriveRows` + 6 [low] steps |
| `matchCouples` — one mixed function | [high] + `listRankedCandidates` / `pickGreedyMatching` |
| `buildClusters` — one mixed function | [high] + `indexCouplesByMember` / `collectClusters` |
| `splitComponents` — BFS + sort inline | [high] + `buildNeighborMap` / `walkComponents` / `sortComponents` |
| `layoutComponent` — data + sugiyama + lefts inline | [high] + `toComponentData` / `runSugiyama` / `collectLefts` |
| `positionClusters` — banding + packing inline | [high] + `bandLeftToRight` / `packLooseClusters` / `mergeXMaps` |
| `placeHangingUnions` — collect + position + lanes | [high] + `collectCoParentPairs` / `positionJunctions` / `stackIntoLanes` |
| `toFlowGraph` — one large mixed function | [high] + builders + `classifyDescent` / three `emit*` |
