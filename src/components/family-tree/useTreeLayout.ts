import { useMemo } from 'react'
import type { Node, Edge } from '@xyflow/react'
import { buildDagreGraph, buildPartnerEdges } from './tree-utils'
import type { TreeSim, FamilyEdge, PartnerEdge } from './tree-utils'

type UseTreeLayoutInput = {
  sims: TreeSim[]
  familyEdges: FamilyEdge[]
  partnerEdges: PartnerEdge[]
}

export function useTreeLayout({ sims, familyEdges, partnerEdges }: UseTreeLayoutInput): {
  nodes: Node[]
  edges: Edge[]
} {
  return useMemo(() => {
    if (sims.length === 0) return { nodes: [], edges: [] }
    const { nodes, edges: familyFlowEdges } = buildDagreGraph(sims, familyEdges)
    const partnerFlowEdges = buildPartnerEdges(partnerEdges)
    return { nodes, edges: [...familyFlowEdges, ...partnerFlowEdges] }
  }, [sims, familyEdges, partnerEdges])
}
