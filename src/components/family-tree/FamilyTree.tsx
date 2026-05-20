'use client'
import { useMemo, type CSSProperties } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  type NodeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { SimNode } from './SimNode'
import { useTreeLayout } from './useTreeLayout'
import type { TreeSim, FamilyEdge, PartnerEdge } from './tree-utils'

const nodeTypes = { simNode: SimNode } satisfies NodeTypes

type FamilyTreeProps = {
  sims: TreeSim[]
  familyEdges: FamilyEdge[]
  partnerEdges: PartnerEdge[]
  focusSimId?: string
  showMiniMap?: boolean
  style?: CSSProperties
  ariaLabel?: string
}

function FamilyTreeInner({
  sims,
  familyEdges,
  partnerEdges,
  focusSimId,
  showMiniMap,
  style,
  ariaLabel,
}: FamilyTreeProps) {
  const simsWithFocus = useMemo(
    () => focusSimId ? sims.map((s) => ({ ...s, isFocused: s.id === focusSimId })) : sims,
    [sims, focusSimId],
  )
  const { nodes, edges } = useTreeLayout({ sims: simsWithFocus, familyEdges, partnerEdges })

  return (
    <div style={{ height: 400, ...style }} aria-label={ariaLabel}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
      >
        <Background />
        <Controls />
        {showMiniMap && <MiniMap />}
      </ReactFlow>
    </div>
  )
}

export function FamilyTree(props: FamilyTreeProps) {
  return (
    <ReactFlowProvider>
      <FamilyTreeInner {...props} />
    </ReactFlowProvider>
  )
}
