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

/**
 * Crest name/life-stage text band, as y-offsets from the node's top edge.
 * The descent line is not painted across this band so it never crosses the
 * sim's own text. Values track crest-flow-node.module.css's label block:
 *   .name  { top: 58px }  — sim name starts here
 *   .stage { top: 75px }  — life-stage label, runs to the node bottom (90px)
 * CREST_TEXT_BAND_TOP is where the name begins; CREST_TEXT_BAND_BOTTOM is the
 * node bottom edge (NODE_HEIGHT = 90), which is also where the next row starts.
 */
export const CREST_TEXT_BAND_TOP = 58
export const CREST_TEXT_BAND_BOTTOM = NODE_HEIGHT

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

/** Vertical pitch between generation rows (top edge to top edge). Generous
 *  enough that descent/co-parent connectors clear the crest text band with
 *  comfortable breathing room before the next generation. */
export const ROW_PITCH = 190
/** Gap between two partners' adjacent medallion edges (the marriage bond). */
export const MARRIAGE_BOND_GAP = 20
/** Horizontal gap between unrelated sims / couple clusters within a row. */
export const CLUSTER_GAP = 40
/**
 * [constructor] Offset from a medallion's right edge to the vertical lane of an
 * on-column partner bond. Half of CLUSTER_GAP lands the lane in the middle of
 * the inter-column gutter — clear of every medallion, and clear of the descent
 * lines (which always run on column CENTERS, not edges).
 */
export const BOND_LANE_GUTTER = 20
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
 * the parents' row, stacked into lanes so horizontal runs never overlap. The
 * offset clears the crest's text band (which ends at NODE_HEIGHT) with a
 * comfortable margin so the horizontal connector doesn't crowd the name/stage.
 */
export const HANGING_UNION_BASE_OFFSET = NODE_HEIGHT + 44
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

/** A current-partner bond drawn as a routed polyline (cross-generation). */
export type BondPath = {
  a: string
  b: string
  romanticStatus: RomanticStatus
  /** Canvas-space waypoints from the engine, top→bottom. */
  points: { x: number; y: number }[]
}

export type LineageLayout = {
  nodes: PositionedNode[]
  byId: Record<string, PositionedNode>
  rowYs: number[]
  rowGenerations: (number | null)[]
  couples: LineageCouple[]
  hangingUnions: HangingUnion[]
  bonds: BondPath[]
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

/**
 * [utility] Like appendToList, but skips values already present under the key
 * (deduped grouping). For the small parent lists here a linear `includes` is
 * cheaper than a per-key Set.
 */
export function addUnique<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key)
  if (!list) map.set(key, [value])
  else if (!list.includes(value)) list.push(value)
}
