import { describe, it, expect, assert } from 'vitest'
import { computeLineageLayout, CREST_ANCHORS } from '../layout'
import { toFlowGraph, type LineageFlowSim } from '../to-flow-graph'
import type { Node } from '@xyflow/react'
import type { CrestNodeData, GenLabelNodeData } from '../to-flow-graph'

const sim = (id: string, gen: number | null, extra: Partial<LineageFlowSim> = {}): LineageFlowSim => ({
  id,
  firstName: id,
  lastName: 'Test',
  imageUrl: null,
  generationNumber: gen,
  lifeStage: 'ADULT',
  isHeir: false,
  ...extra,
})

// Founder couple (gen 1) with one child (gen 2).
const sims = [sim('f1', 1), sim('f2', 1), sim('c1', 2, { isHeir: true })]
const familyEdges = [
  { parentId: 'f1', childId: 'c1' },
  { parentId: 'f2', childId: 'c1' },
]
const partnerEdges = [{ simAId: 'f1', simBId: 'f2' }]
const layout = computeLineageLayout(sims, familyEdges, partnerEdges)

function isCrestNode(n: Node): n is Node<CrestNodeData, 'crest'> {
  return n.type === 'crest'
}

function isGenLabelNode(n: Node): n is Node<GenLabelNodeData, 'genLabel'> {
  return n.type === 'genLabel'
}

describe('toFlowGraph', () => {
  const graph = toFlowGraph(layout, sims, familyEdges, {})

  it('emits one crest node per sim at the layout position', () => {
    const crests = graph.nodes.filter((n) => n.type === 'crest')
    expect(crests).toHaveLength(3)
    for (const node of crests) {
      expect(node.position).toEqual({ x: layout.byId[node.id].x, y: layout.byId[node.id].y })
    }
  })

  it('emits a non-interactive genLabel node per rendered row', () => {
    const labels = graph.nodes.filter(isGenLabelNode)
    expect(labels.map((n) => n.data.label)).toEqual(['GEN I', 'GEN II'])
    expect(labels.every((n) => n.focusable === false && n.selectable === false)).toBe(true)
  })

  it('emits one marriage edge per placed couple, left node as source', () => {
    const marriages = graph.edges.filter((e) => e.type === 'marriage')
    expect(marriages).toHaveLength(1)
    const [edge] = marriages
    const left = layout.byId[edge.source]
    const right = layout.byId[edge.target]
    expect(left.x).toBeLessThan(right.x)
    expect(edge.sourceHandle).toBe('right')
    expect(edge.targetHandle).toBe('left')
  })

  it('emits one union node per distinct parent set, at the bond midpoint', () => {
    const unions = graph.nodes.filter((n) => n.type === 'union')
    expect(unions).toHaveLength(1)
    const [union] = unions
    const f1 = layout.byId['f1']
    const f2 = layout.byId['f2']
    const midX = (f1.x + CREST_ANCHORS.cx + f2.x + CREST_ANCHORS.cx) / 2
    expect(union.position).toEqual({ x: midX, y: Math.min(f1.y, f2.y) + CREST_ANCHORS.cy })
  })

  it('emits one descent edge per child, from its union to its top handle', () => {
    const descents = graph.edges.filter((e) => e.type === 'descent')
    expect(descents).toHaveLength(1)
    expect(descents[0].target).toBe('c1')
    expect(descents[0].targetHandle).toBe('top')
    expect(graph.nodes.some((n) => n.id === descents[0].source && n.type === 'union')).toBe(true)
  })

  it('orders descent edges before marriage edges so bonds render on top', () => {
    const firstMarriage = graph.edges.findIndex((e) => e.type === 'marriage')
    const lastDescent = graph.edges.map((e) => e.type).lastIndexOf('descent')
    expect(lastDescent).toBeLessThan(firstMarriage)
  })

  it('flags dimmed / selected / founder / focused sims in crest data', () => {
    const flagged = toFlowGraph(layout, sims, familyEdges, {
      dimmedIds: new Set(['f2']),
      selectedId: 'c1',
      founderSimId: 'f1',
      focusSimId: 'f1',
    })
    const byId = new Map(flagged.nodes.map((n) => [n.id, n]))
    const f2Node = byId.get('f2')
    const c1Node = byId.get('c1')
    const f1Node = byId.get('f1')

    assert(f2Node && isCrestNode(f2Node))
    expect(f2Node.data.isDimmed).toBe(true)

    assert(c1Node && isCrestNode(c1Node))
    expect(c1Node.data.isSelected).toBe(true)

    assert(f1Node && isCrestNode(f1Node))
    expect(f1Node.data.isFounder).toBe(true)
    expect(f1Node.data.isFocused).toBe(true)
  })

  it('skips descent edges referencing parents or children missing from the layout', () => {
    const graph2 = toFlowGraph(
      layout,
      sims,
      [...familyEdges, { parentId: 'ghost', childId: 'c1' }, { parentId: 'f1', childId: 'ghost' }],
      {},
    )
    expect(graph2.edges.filter((e) => e.type === 'descent')).toHaveLength(1)
  })

  it('skips marriage edges for couples whose sims are filtered out', () => {
    const graph2 = toFlowGraph(layout, sims.filter((s) => s.id !== 'f2'), familyEdges, {})
    expect(graph2.edges.filter((e) => e.type === 'marriage')).toHaveLength(0)
    expect(graph2.nodes.some((n) => n.id === 'f2')).toBe(false)
  })

  it('produces a "GEN —" label row for null-generation sims', () => {
    const sims2 = [...sims, sim('x1', null)]
    const layout2 = computeLineageLayout(sims2, familyEdges, partnerEdges)
    const labels = toFlowGraph(layout2, sims2, familyEdges, {}).nodes.filter(isGenLabelNode)
    expect(labels.map((n) => n.data.label)).toEqual(['GEN I', 'GEN II', 'GEN —'])
  })
})
