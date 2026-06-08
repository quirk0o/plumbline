'use client'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  ReactFlow,
  useReactFlow,
  useStoreApi,
  type EdgeTypes,
  type NodeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/base.css'
import { cn } from '@/lib/utils'
import {
  computeLineageLayout,
  NODE_HEIGHT,
  NODE_WIDTH,
  type LineageFamilyEdge,
  type LineagePartnerEdge,
} from './layout'
import { toFlowGraph, type LineageFlowSim } from './to-flow-graph'
import { FIT_VIEW_OPTIONS, MIN_ZOOM, MAX_ZOOM } from './fit-options'
import { CrestFlowNode } from './crest-flow-node'
import { BondEdge, CoParentEdge, DescentEdge, GenLabelNode, MarriageEdge, UnionNode } from './flow-parts'
import styles from './lineage-flow.module.css'

// CrestFlowNode/GenLabelNode accept only `{ data }` (keeps them directly
// testable without fabricating full NodeProps). Under strictFunctionTypes
// that narrower props type is not assignable to ComponentType<NodeProps>,
// so register with an explicit assertion — an assertion, NOT a suppression.
// If `satisfies NodeTypes` accepts them without the casts on this xyflow
// version, drop the casts.
const nodeTypes = {
  crest: CrestFlowNode as NodeTypes[string],
  genLabel: GenLabelNode as NodeTypes[string],
  union: UnionNode as NodeTypes[string],
} satisfies NodeTypes
const edgeTypes = {
  marriage: MarriageEdge,
  descent: DescentEdge,
  coParent: CoParentEdge,
  bond: BondEdge,
} satisfies EdgeTypes

export type LineageFlowProps = {
  sims: LineageFlowSim[]
  familyEdges: LineageFamilyEdge[]
  partnerEdges: LineagePartnerEdge[]
  founderSimId?: string
  /** Mini-tree: marks the page's sim with aria-current + ring. */
  focusSimId?: string
  selectedId?: string
  dimmedIds?: Set<string>
  onSelectSim?: (id: string) => void
  legacyName?: string
  /** Change to re-fit the viewport (e.g. the Atlas generation filter). */
  refitKey?: string | number
  className?: string
}

/**
 * The lineage tree on an xyflow canvas. Layout still comes from
 * computeLineageLayout; xyflow contributes pan, wheel-zoom-toward-cursor,
 * pinch-zoom, and fit. Must be rendered inside a <ReactFlowProvider> so
 * siblings (zoom toolbar) can share the instance.
 */
export function LineageFlow({
  sims,
  familyEdges,
  partnerEdges,
  founderSimId,
  focusSimId,
  selectedId,
  dimmedIds,
  onSelectSim,
  legacyName,
  refitKey,
  className,
}: LineageFlowProps) {
  const { fitView, getViewport, setCenter } = useReactFlow()
  // Read canvas dimensions lazily at call time instead of subscribing — this
  // prevents handleNodeFocus (and the nodes/edges useMemo that depends on it)
  // from rebuilding on every canvas resize. store is stable across renders.
  const store = useStoreApi()

  const layout = useMemo(
    () => computeLineageLayout(sims, familyEdges, partnerEdges),
    [sims, familyEdges, partnerEdges],
  )

  // Keyboard focus on an off-screen node pans it into view (tracked follow-up).
  // Click-focus on a visible node is a no-op: the medallion is already on screen.
  const handleNodeFocus = useCallback(
    (id: string) => {
      const node = layout.byId[id]
      if (!node) return
      const { width, height } = store.getState()
      // Canvas not yet measured (e.g. jsdom / pre-layout): no-op, never pan.
      if (!width || !height) return
      const { x, y, zoom } = getViewport()
      const view = {
        left: -x / zoom,
        top: -y / zoom,
        right: (-x + width) / zoom,
        bottom: (-y + height) / zoom,
      }
      const visible =
        node.x >= view.left &&
        node.x + NODE_WIDTH <= view.right &&
        node.y >= view.top &&
        node.y + NODE_HEIGHT <= view.bottom
      if (visible) return
      // Focus-pan must not change the user's zoom — fitView may legitimately sit
      // below the interactive floor (fit-options minZoom 0.05), and zooming in
      // 2.5× on keyboard focus is more disorienting than the wheel re-clamping
      // from a sub-floor zoom, which is old-parity behavior (the deleted
      // clampZoom did the same) and already occurs after any sub-floor fit
      // regardless of this call.
      void setCenter(node.x + NODE_WIDTH / 2, node.y + NODE_HEIGHT / 2, { zoom, duration: 200 })
    },
    [layout, getViewport, setCenter, store],
  )

  const { nodes, edges } = useMemo(
    () =>
      toFlowGraph(layout, sims, familyEdges, {
        founderSimId,
        focusSimId,
        selectedId,
        dimmedIds,
        onSelect: onSelectSim,
        onNodeFocus: handleNodeFocus,
      }),
    [layout, sims, familyEdges, founderSimId, focusSimId, selectedId, dimmedIds, onSelectSim, handleNodeFocus],
  )

  // Re-fit when the caller's filter changes (initial fit comes from fitView prop).
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    void fitView(FIT_VIEW_OPTIONS)
  }, [refitKey, fitView])

  if (sims.length === 0) return null

  return (
    <div
      role="group"
      aria-label={`${legacyName ?? 'Family'} tree — ${sims.length} sims`}
      className={cn(styles.flow, className)}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={FIT_VIEW_OPTIONS}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        nodesDraggable={false}
        nodesConnectable={false}
        nodesFocusable={false}
        edgesFocusable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
      />
    </div>
  )
}
