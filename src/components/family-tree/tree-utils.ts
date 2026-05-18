import { graphlib, layout } from '@dagrejs/dagre'
import type { Node, Edge } from '@xyflow/react'

export const NODE_WIDTH = 100
export const NODE_HEIGHT = 80

export type TreeSim = {
  id: string
  firstName: string
  lastName: string
  imageUrl: string | null
  generationNumber: number | null
  isFocused?: boolean
}

export type FamilyEdge = {
  parentId: string
  childId: string
}

export type PartnerEdge = {
  simAId: string
  simBId: string
}

export function buildDagreGraph(
  sims: TreeSim[],
  familyEdges: FamilyEdge[],
): { nodes: Node[]; edges: Edge[] } {
  const g = new graphlib.Graph()
  g.setGraph({ rankdir: 'TB', ranksep: 80, nodesep: 40 })
  g.setDefaultEdgeLabel(() => ({}))

  for (const sim of sims) {
    g.setNode(sim.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  }
  for (const { parentId, childId } of familyEdges) {
    g.setEdge(parentId, childId)
  }

  layout(g)

  const nodes: Node[] = sims.map((sim) => {
    const { x, y } = g.node(sim.id)
    return {
      id: sim.id,
      type: 'simNode',
      position: { x: x - NODE_WIDTH / 2, y: y - NODE_HEIGHT / 2 },
      data: sim,
    }
  })

  const edges: Edge[] = familyEdges.map(({ parentId, childId }) => ({
    id: `family-${parentId}-${childId}`,
    source: parentId,
    target: childId,
    type: 'smoothstep',
    style: { stroke: 'var(--border)' },
  }))

  return { nodes, edges }
}

export function buildPartnerEdges(partnerPairs: PartnerEdge[]): Edge[] {
  return partnerPairs.map(({ simAId, simBId }) => ({
    id: `partner-${simAId}-${simBId}`,
    source: simAId,
    target: simBId,
    type: 'straight',
    style: { stroke: 'var(--border)', strokeDasharray: '4 2' },
  }))
}
