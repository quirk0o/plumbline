/**
 * Pure adapter: LineageLayout → @xyflow/react nodes/edges.
 *
 * Layout math stays in layout.ts; this file only translates positions into
 * the node/edge shapes xyflow renders. Deterministic, no React, no DOM.
 *
 * Node types: 'crest' (sim medallion), 'genLabel' (row pill), 'union'
 * (invisible 0×0 anchor at a couple's bond midpoint — descent connectors
 * start at a point that is not a sim node, so we materialise that point).
 * Edge types: 'descent' (right-angle parent→child), 'marriage' (amber bond).
 * Descent edges are emitted before marriage edges so bonds paint on top
 * (matching the old SVG render order).
 */
import type { Edge, Node } from '@xyflow/react'
import type { LifeStage } from '@prisma/client'
import {
  CREST_ANCHORS,
  type LineageFamilyEdge,
  type LineageLayout,
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
}

export type CrestNodeData = {
  sim: LineageFlowSim
  isFounder: boolean
  isSelected: boolean
  isDimmed: boolean
  isFocused: boolean
  onSelect?: (id: string) => void
  /** Fired on keyboard focus so the canvas can pan an off-screen node into view. */
  onNodeFocus?: (id: string) => void
}

export type GenLabelNodeData = { label: string }

export type CrestFlowNodeType = Node<CrestNodeData, 'crest'>
export type GenLabelNodeType = Node<GenLabelNodeData, 'genLabel'>

export type FlowGraphOptions = {
  founderSimId?: string
  focusSimId?: string
  selectedId?: string
  dimmedIds?: Set<string>
  onSelect?: (id: string) => void
  onNodeFocus?: (id: string) => void
}

const STATIC_NODE = { draggable: false, selectable: false, focusable: false, connectable: false } as const

export function toFlowGraph(
  layout: LineageLayout,
  sims: LineageFlowSim[],
  familyEdges: LineageFamilyEdge[],
  opts: FlowGraphOptions,
): { nodes: Node[]; edges: Edge[] } {
  const simById = new Map(sims.map((s) => [s.id, s]))

  // Generation row pills. Position mirrors the old SVG gutter placement:
  // pill top-left at (6, rowY + NODE_HEIGHT/2 - 42) for a 54×24 pill.
  const genLabelNodes: GenLabelNodeType[] = layout.rowYs.map((rowY, i) => {
    const gen = layout.rowGenerations[i]
    return {
      id: `gen-${gen ?? 'null'}`,
      type: 'genLabel',
      position: { x: 6, y: rowY + 45 - 42 },
      data: { label: gen === null ? 'GEN —' : `GEN ${roman(gen)}` },
      ...STATIC_NODE,
    }
  })

  // Group family edges by child (only edges whose ends are placed).
  const parentsByChild = new Map<string, string[]>()
  for (const { parentId, childId } of familyEdges) {
    if (!layout.byId[parentId] || !layout.byId[childId]) continue
    const list = parentsByChild.get(childId) ?? []
    if (!list.includes(parentId)) list.push(parentId)
    parentsByChild.set(childId, list)
  }

  // One invisible union node per distinct parent set, at the bond midpoint
  // (avg of parents' medallion centers; y = top parent's medallion center —
  // mirrors the old ParentChildLine source point).
  const unionNodes: Node[] = []
  const unionIdByKey = new Map<string, string>()
  const descentEdges: Edge[] = []
  for (const [childId, parentIds] of parentsByChild) {
    const key = [...parentIds].sort().join('+')
    let unionId = unionIdByKey.get(key)
    if (!unionId) {
      unionId = `union-${key}`
      unionIdByKey.set(key, unionId)
      const placed = parentIds.map((id) => layout.byId[id])
      const midX = placed.reduce((sum, p) => sum + p.x + CREST_ANCHORS.cx, 0) / placed.length
      const topY = Math.min(...placed.map((p) => p.y))
      unionNodes.push({
        id: unionId,
        type: 'union',
        position: { x: midX, y: topY + CREST_ANCHORS.cy },
        data: {},
        ...STATIC_NODE,
      })
    }
    descentEdges.push({
      id: `descent-${childId}`,
      type: 'descent',
      source: unionId,
      sourceHandle: 'out',
      target: childId,
      targetHandle: 'top',
      focusable: false,
    })
  }

  // Marriage bonds: only couples the layout placed adjacently; left node is
  // the edge source (its 'right' handle) so the bond always draws left→right.
  const marriageEdges: Edge[] = layout.couples.flatMap(({ a, b }) => {
    const pa = layout.byId[a]
    const pb = layout.byId[b]
    if (!pa || !pb) return []
    const [left, right] = pa.x <= pb.x ? [a, b] : [b, a]
    return [{
      id: `marriage-${a}-${b}`,
      type: 'marriage',
      source: left,
      sourceHandle: 'right',
      target: right,
      targetHandle: 'left',
      focusable: false,
    }]
  })

  const crestNodes: CrestFlowNodeType[] = layout.nodes.flatMap((n) => {
    const sim = simById.get(n.id)
    if (!sim) return []
    return [{
      id: n.id,
      type: 'crest' as const,
      position: { x: n.x, y: n.y },
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
    }]
  })

  return {
    nodes: [...genLabelNodes, ...unionNodes, ...crestNodes],
    edges: [...descentEdges, ...marriageEdges],
  }
}
