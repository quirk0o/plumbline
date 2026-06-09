/**
 * Pure adapter: LineageLayout → @xyflow/react nodes/edges.
 *
 * Layout math stays in layout.ts; this file only translates positions into
 * the node/edge shapes xyflow renders. Deterministic, no React, no DOM.
 *
 * Node types: 'crest' (sim medallion), 'genLabel' (row pill), 'union'
 * (invisible 1×1 anchor at a couple's bond midpoint or hanging below the row —
 * descent connectors start at a point that is not a sim node, so we materialise
 * that point; the amber diamond, when present, is rendered by the union node).
 * Edge types: 'descent' (right-angle parent→child), 'coParent' (elbow from a
 * non-adjacent parent down to a hanging union), 'marriage' (amber bond).
 * Descent edges are emitted before co-parent elbows, which are emitted before
 * marriage edges, so bonds paint on top (matching the old SVG render order).
 */
import type { Edge, Node } from '@xyflow/react'
import type { Gender, LifeStage } from '@prisma/client'
import {
  CREST_ANCHORS,
  CREST_TEXT_BAND_BOTTOM,
  CREST_TEXT_BAND_TOP,
  NODE_HEIGHT,
  NODE_WIDTH,
  addUnique,
  pairKey,
  type BondPath,
  type HangingUnion,
  type LineageCouple,
  type LineageFamilyEdge,
  type LineageLayout,
  type PositionedNode,
} from './layout'
import { roman } from '@/lib/legacy-format'

/**
 * Structural sim shape the renderer needs. Both `sims.getTreeData` and
 * (after a later task's select change) `sims.getMiniTreeData` satisfy it.
 * NOTE: must stay a `type` (not `interface`) — xyflow's `Node<T>` constraint
 * requires an implicit index signature, which interfaces don't get.
 */
export type LineageFlowSim = {
  id: string
  firstName: string
  lastName: string
  imageUrl: string | null
  generationNumber: number | null
  lifeStage: LifeStage
  isHeir: boolean
  isDeceased: boolean
  gender: Gender
}

export type CrestNodeData = {
  sim: LineageFlowSim
  isFounder: boolean
  isSelected: boolean
  isDimmed: boolean
  isFocused: boolean
  /** Relationship to the current focus sim; replaces the life-stage caption when set. */
  kinshipLabel?: string
  onSelect?: (id: string) => void
  /** Fired on keyboard focus so the canvas can pan an off-screen node into view. */
  onNodeFocus?: (id: string) => void
}

export type GenLabelNodeData = { label: string }

/** Whether the union renders the amber parents-to-children junction diamond. */
export type UnionNodeData = { diamond: boolean }

/** Whether the marriage bond renders dashed (widowed) instead of solid. */
export type MarriageEdgeData = { dashed: boolean }

/**
 * A cross-generation current-partner bond, drawn as a routed amber polyline
 * from canvas-space waypoints (top→bottom). Dashed only when widowed.
 */
export type BondEdgeData = { points: { x: number; y: number }[]; dashed: boolean }

/**
 * Gap band for descent edges whose source is a crest node (lone parent or
 * per-parent fallback). The descent line skips this y-range so it never
 * paints across the source sim's own name/life-stage text. Canvas coordinates:
 * gapTop = sourceNode.y + CREST_TEXT_BAND_TOP,
 * gapBottom = sourceNode.y + CREST_TEXT_BAND_BOTTOM.
 * Union-sourced descents leave this undefined → plain descentPath. The two
 * fields are required (both-or-neither): a descent either has a full gap band
 * or no `data` at all — a partial `{ gapTop }` is meaningless.
 */
export type DescentEdgeData = { gapTop: number; gapBottom: number }

export type CrestFlowNodeType = Node<CrestNodeData, 'crest'>
export type GenLabelNodeType = Node<GenLabelNodeData, 'genLabel'>

export type FlowGraphOptions = {
  founderSimId?: string
  focusSimId?: string
  selectedId?: string
  dimmedIds?: Set<string>
  kinshipLabels?: Map<string, string>
  onSelect?: (id: string) => void
  onNodeFocus?: (id: string) => void
}

const STATIC_NODE = { draggable: false, selectable: false, focusable: false, connectable: false } as const

/**
 * Hides a decorative element from the accessibility tree. xyflow's edge/node
 * wrappers always emit an auto `aria-label` ("Edge from <id> to <id>") plus
 * `aria-roledescription`/`aria-describedby` that leak internal union/sim ids to
 * screen readers. `ariaRole: 'presentation'` does NOT help: the wrapper only
 * drops the auto label when `ariaLabel === null` (forbidden by the `string`
 * type), and WAI-ARIA's presentational-conflict rule makes user agents ignore
 * role="presentation" while those global aria-* props remain. The reliable fix
 * is `aria-hidden` on the wrapper element: both wrappers spread
 * `...edge.domAttributes` / `...node.domAttributes` LAST, so it wins, and
 * `aria-hidden="true"` hides the whole subtree (auto label included). The edge
 * domAttributes type omits `aria-label` but not `aria-hidden`.
 */
const A11Y_HIDDEN = { domAttributes: { 'aria-hidden': 'true' } } as const

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
  const bondEdges = buildBondEdges(layout, simById)
  const crestNodes = buildCrestNodes(layout, simById, opts)
  return assembleGraph({ genLabelNodes, descents, crestNodes, marriageEdges, bondEdges })
}

type DescentBuild = {
  unionNodes: Node[]
  descentEdges: Edge[]
  coParentEdges: Edge[]
  unionIdByKey: Map<string, string>
}

type DescentKind = 'row' | 'hanging' | 'bond' | 'perParent'

/** [high] Classify each child's parent set, then emit the matching shape. */
function buildUnionsAndDescents(
  layout: LineageLayout,
  parentsByChild: Map<string, string[]>,
): DescentBuild {
  const coupleKeys = collectCoupleKeys(layout.couples)
  const hangingByKey = indexHangingUnions(layout.hangingUnions)
  const bondByKey = indexBonds(layout.bonds)
  const build = createDescentBuild()
  for (const [childId, parentIds] of parentsByChild) {
    const kind = classifyDescent(parentIds, coupleKeys, hangingByKey, bondByKey)
    if (kind === 'row') emitRowDescent(build, layout, childId, parentIds)
    else if (kind === 'hanging') emitHangingDescent(build, layout, hangingByKey, childId, parentIds)
    else if (kind === 'bond') emitBondDescent(build, layout, bondByKey, childId, parentIds)
    else emitPerParentDescents(build, childId, parentIds, layout)
  }
  return build
}

/**
 * [low] row: a lone parent or the adjacent couple (shared union up in the
 * row); hanging: a known non-adjacent pair (union below the row); bond: a
 * cross-gen current pair (diamond at the lower partner); perParent: ≥3 parents
 * or a defensive miss (one line per parent — the superseded
 * fix/tree-descent-split-parents behavior, kept as fallback).
 */
function classifyDescent(
  parentIds: string[],
  coupleKeys: Set<string>,
  hangingByKey: Map<string, HangingUnion>,
  bondByKey: Map<string, BondPath>,
): DescentKind {
  if (parentIds.length === 1) return 'row'
  if (parentIds.length === 2 && coupleKeys.has(pairKey(parentIds))) return 'row'
  if (parentIds.length === 2 && hangingByKey.has(pairKey(parentIds))) return 'hanging'
  if (parentIds.length === 2 && bondByKey.has(pairKey(parentIds))) return 'bond'
  return 'perParent'
}

/**
 * [low] Cross-gen couple child: descend from a single diamond at the LOWER
 * partner's medallion center (the partner placed further down the canvas).
 * One union + one descent — never per-parent lines. The descent drops through
 * the lower partner's own text band, so it carries that parent's gap data.
 */
function emitBondDescent(
  build: DescentBuild,
  layout: LineageLayout,
  bondByKey: Map<string, BondPath>,
  childId: string,
  parentIds: string[],
): void {
  const key = pairKey(parentIds)
  const lowerId = lowerPartnerId(bondByKey.get(key)!, layout)
  let unionId = build.unionIdByKey.get(key)
  if (!unionId) {
    unionId = `union-${key}`
    build.unionIdByKey.set(key, unionId)
    build.unionNodes.push(lowerPartnerUnion(unionId, lowerId, layout))
  }
  const gapData = crestGapData(layout.byId[lowerId])
  build.descentEdges.push(descentEdge(`descent-${childId}`, unionId, 'out', childId, gapData))
}

/** [low] The partner placed further down the canvas (larger y). */
function lowerPartnerId(bond: BondPath, layout: LineageLayout): string {
  return layout.byId[bond.a].y >= layout.byId[bond.b].y ? bond.a : bond.b
}

/**
 * [low] Ensure the row union exists, then descend the child from it.
 *
 * A lone parent's row union sits at that parent's own medallion center, so the
 * descent drops straight down through the parent's name/stage text band — it
 * needs gap data. An adjacent couple's union sits in the horizontal gap BETWEEN
 * the two medallions, crossing no one's text, so it gets no gap data.
 */
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
  const gapData = parentIds.length === 1 ? crestGapData(layout.byId[parentIds[0]]) : undefined
  build.descentEdges.push(descentEdge(`descent-${childId}`, unionId, 'out', childId, gapData))
}

/**
 * [low] Gap band (in canvas coords) for a descent that drops through a crest's
 * own name/stage text. Undefined when the source crest is not placed.
 */
function crestGapData(parentNode: PositionedNode | undefined): DescentEdgeData | undefined {
  if (!parentNode) return undefined
  return { gapTop: parentNode.y + CREST_TEXT_BAND_TOP, gapBottom: parentNode.y + CREST_TEXT_BAND_BOTTOM }
}

/** [low] Ensure the hanging union + its two co-parent elbows exist, then
 *  descend the child from it. */
function emitHangingDescent(
  build: DescentBuild,
  layout: LineageLayout,
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
    // The elbow leaves each co-parent's medallion bottom (above the text band),
    // so it carries that parent's gap data to skip the name/stage text.
    build.coParentEdges.push(coParentEdge(key, hanging.parentA, unionId, crestGapData(layout.byId[hanging.parentA])))
    build.coParentEdges.push(coParentEdge(key, hanging.parentB, unionId, crestGapData(layout.byId[hanging.parentB])))
  }
  build.descentEdges.push(descentEdge(`descent-${childId}`, unionId, 'out', childId))
}

/**
 * [low] One descent line per parent. Each source is a crest node, so we
 * attach gap data so the descent line skips the source crest's text band.
 */
function emitPerParentDescents(
  build: DescentBuild,
  childId: string,
  parentIds: string[],
  layout: LineageLayout,
): void {
  for (const parentId of parentIds) {
    const gapData = crestGapData(layout.byId[parentId])
    build.descentEdges.push(
      descentEdge(`descent-${childId}-${parentId}`, parentId, 'bottom', childId, gapData),
    )
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

/** [low] Cross-gen bonds by their partner-pair key. */
function indexBonds(bonds: BondPath[]): Map<string, BondPath> {
  return new Map(bonds.map((b) => [pairKey([b.a, b.b]), b]))
}

/** [low] Family edges grouped by child; only fully placed edges count. */
function groupParentsByChild(
  layout: LineageLayout,
  familyEdges: LineageFamilyEdge[],
): Map<string, string[]> {
  const parentsByChild = new Map<string, string[]>()
  for (const { parentId, childId } of familyEdges) {
    if (!layout.byId[parentId] || !layout.byId[childId]) continue
    addUnique(parentsByChild, childId, parentId)
  }
  return parentsByChild
}

/**
 * [low] A current couple is "widowed" — and its bond dashes — when either
 * partner is deceased. Ended bonds never reach the layout's couples/bonds
 * (layout-clusters filters them out), so an adjacent/bonded couple with a dead
 * member is a widowhood, not a break-up.
 */
function coupleIsWidowed(aId: string, bId: string, simById: Map<string, LineageFlowSim>): boolean {
  return simById.get(aId)?.isDeceased === true || simById.get(bId)?.isDeceased === true
}

/** [low] Bonds only between placed, present couples; left medallion is source. */
function buildMarriageEdges(layout: LineageLayout, simById: Map<string, LineageFlowSim>): Edge[] {
  return layout.couples.flatMap((couple) => {
    const pa = layout.byId[couple.a]
    const pb = layout.byId[couple.b]
    if (!pa || !pb) return []
    if (!simById.has(couple.a) || !simById.has(couple.b)) return []
    return [marriageEdge(couple, pa.x <= pb.x, coupleIsWidowed(couple.a, couple.b, simById))]
  })
}

/**
 * [low] One routed amber polyline per cross-gen bond, between placed, present
 * partners. The edge carries the canvas-space waypoints; the BondEdge renderer
 * draws them as a polyline. Dashed only when widowed (a deceased partner).
 */
function buildBondEdges(layout: LineageLayout, simById: Map<string, LineageFlowSim>): Edge[] {
  return layout.bonds.flatMap((bond) => {
    if (!layout.byId[bond.a] || !layout.byId[bond.b]) return []
    if (!simById.has(bond.a) || !simById.has(bond.b)) return []
    return [bondEdge(bond, coupleIsWidowed(bond.a, bond.b, simById))]
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
 *  Edge paint order: descents under co-parent elbows under bonds (marriage and
 *  cross-gen) — all amber bonds paint on top. */
function assembleGraph(parts: {
  genLabelNodes: Node[]
  descents: DescentBuild
  crestNodes: Node[]
  marriageEdges: Edge[]
  bondEdges: Edge[]
}): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: [...parts.genLabelNodes, ...parts.descents.unionNodes, ...parts.crestNodes],
    edges: [
      ...parts.descents.descentEdges,
      ...parts.descents.coParentEdges,
      ...parts.marriageEdges,
      ...parts.bondEdges,
    ],
  }
}

/** [constructor] Shared 1×1 union scaffolding (the falsy-zero rationale for
 *  why it is 1×1 and not 0×0 is the inline block below). */
function unionNode(id: string, position: { x: number; y: number }, diamond: boolean): Node {
  return {
    id,
    type: 'union',
    position,
    data: { diamond } satisfies UnionNodeData,
    // xyflow has TWO falsy-zero pitfalls — both must be avoided:
    //
    // 1. nodesInitialized / fitView gate (=== undefined check):
    //    ResizeObserver never fires for a 0×0 DOM element, leaving
    //    measured.width/height === undefined, which keeps
    //    nodesInitialized=false and silently breaks imperative fitView().
    //
    // 2. Edge-rendering / handleBounds gate (TRUTHINESS check):
    //    updateNodeDimensions skips the handleBounds capture when
    //    dimensions.width and dimensions.height are both falsy
    //    (`doUpdate = !!(dimensions.width && dimensions.height && ...)`).
    //    isNodeInitialized then tests `!!(node.measured.width || ...)` —
    //    measured.width=0 is falsy, so the union node is never considered
    //    initialised, and every descent edge (which uses this node as
    //    source) is silently dropped from rendering.
    //
    // Fix: 1×1 so both checks pass. getFitViewNodes still excludes this
    // node from viewport fitting because it checks for truthy
    // measured.width (0×0 would be excluded; 1×1 is included but the
    // 0.5px contribution to bounds is imperceptible and acceptable).
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

/** [constructor] Diamond union at the LOWER partner's medallion center — the
 *  cross-gen couple's children descend from here. */
function lowerPartnerUnion(id: string, lowerId: string, layout: LineageLayout): Node {
  const p = layout.byId[lowerId]
  return unionNode(id, { x: p.x + CREST_ANCHORS.cx - 0.5, y: p.y + CREST_ANCHORS.cy - 1 }, true)
}

/** [constructor] Elbow from one parent's bottom handle to a hanging union. The
 *  parent is a crest, so it carries gap data to skip its own text band. */
function coParentEdge(key: string, parentId: string, unionId: string, gapData?: DescentEdgeData): Edge {
  return {
    id: `coparent-${key}-${parentId}`,
    type: 'coParent',
    source: parentId,
    sourceHandle: 'bottom',
    target: unionId,
    targetHandle: 'in',
    data: gapData,
    focusable: false,
    ...A11Y_HIDDEN,
  }
}

/** [constructor] */
function descentEdge(
  id: string,
  source: string,
  sourceHandle: string,
  target: string,
  data?: DescentEdgeData,
): Edge {
  return {
    id,
    type: 'descent',
    source,
    sourceHandle,
    target,
    targetHandle: 'top',
    focusable: false,
    data,
    ...A11Y_HIDDEN,
  }
}

/** [constructor] Solid for current bonds, dashed for widowed (a deceased partner). */
function marriageEdge(couple: LineageCouple, aIsLeft: boolean, dashed: boolean): Edge {
  const [left, right] = aIsLeft ? [couple.a, couple.b] : [couple.b, couple.a]
  return {
    id: `marriage-${couple.a}-${couple.b}`,
    type: 'marriage',
    source: left,
    sourceHandle: 'right',
    target: right,
    targetHandle: 'left',
    focusable: false,
    data: { dashed } satisfies MarriageEdgeData,
    ...A11Y_HIDDEN,
  }
}

/**
 * [constructor] Routed amber bond polyline for a cross-gen current couple. The
 * waypoints already live in canvas space, so the edge's source/target handles
 * are unused for geometry — the renderer draws straight from `points`. Source
 * and target are the two partners so xyflow still treats it as a real edge.
 * Dashed only when widowed (a deceased partner).
 */
function bondEdge(bond: BondPath, dashed: boolean): Edge {
  return {
    id: `bond-${bond.a}-${bond.b}`,
    type: 'bond',
    source: bond.a,
    target: bond.b,
    focusable: false,
    data: { points: bond.points, dashed } satisfies BondEdgeData,
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

/** [constructor] Crest medallion node. */
function crestNode(sim: LineageFlowSim, n: PositionedNode, opts: FlowGraphOptions): CrestFlowNodeType {
  return {
    id: n.id,
    type: 'crest' as const,
    position: { x: n.x, y: n.y },
    // Declare the design-canonical bbox so xyflow treats this node as
    // measured immediately (no ResizeObserver round-trip needed). Without
    // these xyflow keeps visibility:hidden until the observer fires, which
    // never happens in jsdom. They are also correct at runtime: the layout
    // already positions children using exactly NODE_WIDTH × NODE_HEIGHT.
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
    // xyflow sets pointer-events:none on the wrapper when the node has no
    // xyflow-level interaction (no dragging/selecting/clicking). The inner
    // <button> handles selection via CrestNodeData.onSelect, so we need the
    // wrapper to pass pointer events through. Explicitly set pointer-events:
    // all — xyflow spreads node.style after its own computed value, so this
    // wins regardless of draggable/selectable/focusable flags.
    style: { pointerEvents: 'all' },
    // xyflow emits aria-roledescription="node" on every node wrapper div.
    // Crest nodes have nodesFocusable=false (no role), so that attribute is
    // a WAI-ARIA violation (aria-roledescription requires a concrete role).
    // Setting it to undefined omits it from the rendered DOM — React drops
    // undefined attribute values — while keeping the crest in the a11y tree
    // so its inner buttons remain reachable.
    domAttributes: { 'aria-roledescription': undefined },
    data: {
      sim,
      isFounder: opts.founderSimId === n.id,
      isSelected: opts.selectedId === n.id,
      isDimmed: opts.dimmedIds?.has(n.id) ?? false,
      isFocused: opts.focusSimId === n.id,
      kinshipLabel: opts.kinshipLabels?.get(n.id),
      onSelect: opts.onSelect,
      onNodeFocus: opts.onNodeFocus,
    },
    ...STATIC_NODE,
  }
}
