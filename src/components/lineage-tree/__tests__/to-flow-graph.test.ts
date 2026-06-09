import { describe, it, expect, assert } from 'vitest'
import { computeLineageLayout, CREST_ANCHORS, CREST_TEXT_BAND_BOTTOM, CREST_TEXT_BAND_TOP } from '../layout'
import { toFlowGraph, type LineageFlowSim } from '../to-flow-graph'
import type { Node } from '@xyflow/react'
import type { CrestNodeData, GenLabelNodeData } from '../to-flow-graph'
import { bondPath, descentPath } from '../flow-parts'

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
const partnerEdges = [{ simAId: 'f1', simBId: 'f2', romanticStatus: 'MARRIED' as const }]
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

  it('emits one union node per distinct parent set; bottom-center handle lands on bond midpoint', () => {
    // The union node is 1×1. Its bottom-center handle sits at (x+0.5, y+1).
    // We verify that these equal the bond midpoint (midX, topY+CREST_ANCHORS.cy)
    // so the descent edge originates at exactly the right geometric point.
    const unions = graph.nodes.filter((n) => n.type === 'union')
    expect(unions).toHaveLength(1)
    const [union] = unions
    const f1 = layout.byId['f1']
    const f2 = layout.byId['f2']
    const midX = (f1.x + CREST_ANCHORS.cx + f2.x + CREST_ANCHORS.cx) / 2
    const topY = Math.min(f1.y, f2.y)
    // Bottom-center of the 1×1 node = (position.x + 0.5, position.y + 1)
    expect(union.position.x + 0.5).toBeCloseTo(midX, 5)
    expect(union.position.y + 1).toBeCloseTo(topY + CREST_ANCHORS.cy, 5)
    // Verify the node is 1×1 (not 0×0) so xyflow's handleBounds gate passes
    expect(union.width).toBe(1)
    expect(union.height).toBe(1)
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

  it('marks decorative edges aria-hidden so xyflow does not leak ids to AT', () => {
    // xyflow's EdgeWrapper always emits an auto aria-label "Edge from <id> to
    // <id>"; the only reliable suppression is aria-hidden on the wrapper, set
    // via domAttributes (spread last by the wrapper, so it wins).
    for (const edge of graph.edges) {
      expect(edge.domAttributes?.['aria-hidden']).toBe('true')
    }
  })

  it('marks decorative genLabel and union nodes aria-hidden', () => {
    for (const node of graph.nodes.filter((n) => n.type === 'genLabel' || n.type === 'union')) {
      expect(node.domAttributes?.['aria-hidden']).toBe('true')
    }
  })

  it('suppresses aria-roledescription on crest nodes (nodesFocusable=false → no role → violation)', () => {
    // xyflow sets aria-roledescription="node" on every wrapper div.
    // Without a concrete role that attribute violates WAI-ARIA. Since crest
    // wrappers use nodesFocusable=false (no role is emitted), we pass
    // domAttributes: { 'aria-roledescription': undefined } so React omits it.
    for (const node of graph.nodes.filter((n) => n.type === 'crest')) {
      expect(node.domAttributes).toHaveProperty('aria-roledescription', undefined)
    }
  })

  it('sets measured {width:1, height:1} on union nodes so both xyflow init gates pass', () => {
    // Union nodes are 1×1 invisible anchors. Two xyflow gates must be passed:
    //
    // 1. nodesInitialized / fitView gate (=== undefined check): without an
    //    explicit measured value, ResizeObserver keeps measured.width===
    //    undefined → nodesInitialized=false → imperative fitView() silently
    //    breaks.
    //
    // 2. handleBounds / edge-render gate (TRUTHINESS check): updateNodeDimensions
    //    skips handleBounds capture when dimensions.width is falsy (0). Then
    //    isNodeInitialized checks `!!(node.measured.width || ...)` — measured.
    //    width=0 is falsy → union node fails init → ALL descent edges dropped.
    //
    // 1×1 passes both checks. The 0.5px contribution to fitView bounds is
    // imperceptible.
    for (const node of graph.nodes.filter((n) => n.type === 'union')) {
      expect(node.measured).toEqual({ width: 1, height: 1 })
    }
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

  describe('descent text-band gap', () => {
    it("gives a lone parent's descent a gap covering that parent's text band", () => {
      // A lone parent's union sits at the parent's own medallion center, so the
      // descent drops straight through the parent's name/stage text. The gap
      // band (canvas coords) must equal the parent's placed y + CREST_TEXT_BAND_*.
      const s = [sim('p', 1), sim('k', 2)]
      const fe = [{ parentId: 'p', childId: 'k' }]
      const l = computeLineageLayout(s, fe, [])
      const g = toFlowGraph(l, s, fe, {})
      const descent = g.edges.find((e) => e.type === 'descent' && e.target === 'k')!
      const parentY = l.byId['p'].y
      expect(descent.data).toEqual({
        gapTop: parentY + CREST_TEXT_BAND_TOP,
        gapBottom: parentY + CREST_TEXT_BAND_BOTTOM,
      })
    })

    it('gives an adjacent couple\'s descent no gap (it drops between the medallions)', () => {
      // The couple union sits in the horizontal gap BETWEEN the two medallions,
      // crossing no one's text, so no gap data is attached.
      const descent = graph.edges.find((e) => e.type === 'descent' && e.target === 'c1')!
      expect(descent.data).toBeUndefined()
    })
  })
})

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
  it("gives each coParent elbow a gap covering its parent's text band", () => {
    // The elbow leaves the parent's medallion bottom (above the band) and drops
    // to the hanging union below — it must skip the parent's name/stage text.
    const co = hGraph.edges.filter((e) => e.type === 'coParent')
    for (const e of co) {
      const parentY = hLayout.byId[e.source].y
      expect(e.data).toEqual({
        gapTop: parentY + CREST_TEXT_BAND_TOP,
        gapBottom: parentY + CREST_TEXT_BAND_BOTTOM,
      })
    }
  })
  it('paints coParent elbows after descents and before marriage bonds', () => {
    const types = hGraph.edges.map((e) => e.type)
    const lastDescent = types.lastIndexOf('descent')
    const firstCoParent = types.indexOf('coParent')
    const firstMarriage = types.indexOf('marriage')
    expect(lastDescent).toBeLessThan(firstCoParent)
    expect(firstCoParent).toBeLessThan(firstMarriage)
  })
  it('falls back to per-parent descent lines for ≥3-parent sets, each with its own text-band gap', () => {
    const s = [sim('p1', 1), sim('p2', 1), sim('p3', 1), sim('k', 2)]
    const fe = [
      { parentId: 'p1', childId: 'k' }, { parentId: 'p2', childId: 'k' }, { parentId: 'p3', childId: 'k' },
    ]
    const l = computeLineageLayout(s, fe, [])
    const g = toFlowGraph(l, s, fe, {})
    const d = g.edges.filter((e) => e.type === 'descent' && e.target === 'k')
    expect(d.map((e) => e.source).sort()).toEqual(['p1', 'p2', 'p3'])
    // Each per-parent descent is crest-sourced, so it must carry a gap derived
    // from its OWN parent's placed y — guarding against lines through text.
    for (const edge of d) {
      const parentY = l.byId[edge.source].y
      expect(edge.data).toEqual({
        gapTop: parentY + CREST_TEXT_BAND_TOP,
        gapBottom: parentY + CREST_TEXT_BAND_BOTTOM,
      })
    }
  })
  it('falls back to per-parent descent lines for co-parents in different rows (no hanging union), each with its own gap', () => {
    const s = [sim('p1', 1), sim('p2', 2), sim('k', 3)]
    const fe = [{ parentId: 'p1', childId: 'k' }, { parentId: 'p2', childId: 'k' }]
    const l = computeLineageLayout(s, fe, [])
    const g = toFlowGraph(l, s, fe, {})
    expect(g.nodes.filter((n) => n.type === 'union')).toHaveLength(0)
    const d = g.edges.filter((e) => e.type === 'descent' && e.target === 'k')
    expect(d.map((e) => e.source).sort()).toEqual(['p1', 'p2'])
    for (const edge of d) {
      const parentY = l.byId[edge.source].y
      expect(edge.data).toEqual({
        gapTop: parentY + CREST_TEXT_BAND_TOP,
        gapBottom: parentY + CREST_TEXT_BAND_BOTTOM,
      })
    }
  })
})

describe('toFlowGraph — cross-gen bonds', () => {
  const bSims = [sim('sol', 1), sim('bex', 2), sim('pip', 3)]
  const bFamily = [
    { parentId: 'sol', childId: 'pip' },
    { parentId: 'bex', childId: 'pip' },
  ]
  const bPartners = [{ simAId: 'sol', simBId: 'bex', romanticStatus: 'PARTNER' as const }]
  const bLayout = computeLineageLayout(bSims, bFamily, bPartners)
  const bGraph = toFlowGraph(bLayout, bSims, bFamily, {})

  it('emits a routed bond polyline whose path is built from the layout points', () => {
    const bond = bGraph.edges.find((e) => e.type === 'bond')!
    expect(bond).toBeDefined()
    const data = bond.data as { points: { x: number; y: number }[]; dashed: boolean }
    expect(data.points).toEqual(bLayout.bonds[0].points)
    expect(data.points.length).toBeGreaterThanOrEqual(2)
  })

  it('marks current bonds solid and widowed bonds dashed', () => {
    const current = bGraph.edges.find((e) => e.type === 'bond')!
    expect(current.data).toMatchObject({ dashed: false })

    const wSims = [sim('a', 1), sim('b', 2)]
    const wLayout = computeLineageLayout(wSims, [], [{ simAId: 'a', simBId: 'b', romanticStatus: 'WIDOWED' as const }])
    const wGraph = toFlowGraph(wLayout, wSims, [], {})
    expect(wGraph.edges.find((e) => e.type === 'bond')!.data).toMatchObject({ dashed: true })
  })

  it('hides the bond edge from the accessibility tree', () => {
    const bond = bGraph.edges.find((e) => e.type === 'bond')!
    expect(bond.domAttributes?.['aria-hidden']).toBe('true')
  })

  it('descends the cross-gen couple’s child from a single diamond, not per-parent lines', () => {
    const descents = bGraph.edges.filter((e) => e.type === 'descent' && e.target === 'pip')
    expect(descents).toHaveLength(1)
    // It descends from a union node (the diamond), not from either parent crest.
    const source = bGraph.nodes.find((n) => n.id === descents[0].source)!
    expect(source.type).toBe('union')
    expect(source.data).toMatchObject({ diamond: true })
  })

  it('gives the bond child’s descent a gap covering the LOWER partner’s text band', () => {
    // The diamond sits at the lower partner's medallion center, so the descent
    // drops straight through that partner's own name/stage text — it must carry
    // the lower partner's gap band (canvas coords) to skip it.
    const descent = bGraph.edges.find((e) => e.type === 'descent' && e.target === 'pip')!
    const lowerY = bLayout.byId['bex'].y // bex (gen 2) is the lower partner
    expect(descent.data).toEqual({
      gapTop: lowerY + CREST_TEXT_BAND_TOP,
      gapBottom: lowerY + CREST_TEXT_BAND_BOTTOM,
    })
  })

  it('places the diamond at the lower partner’s medallion center', () => {
    const descent = bGraph.edges.find((e) => e.type === 'descent' && e.target === 'pip')!
    const union = bGraph.nodes.find((n) => n.id === descent.source)!
    const lower = bLayout.byId['bex'] // bex (gen 2) is below sol (gen 1)
    expect(union.position.x + 0.5).toBeCloseTo(lower.x + CREST_ANCHORS.cx, 5)
    expect(union.position.y + 1).toBeCloseTo(lower.y + CREST_ANCHORS.cy, 5)
  })

  it('paints the bond after descents so it renders on top', () => {
    const types = bGraph.edges.map((e) => e.type)
    expect(types.lastIndexOf('descent')).toBeLessThan(types.indexOf('bond'))
  })
})

describe('bondPath', () => {
  it('draws a moveto then lineto chain through the waypoints', () => {
    expect(bondPath([{ x: 10, y: 20 }, { x: 10, y: 40 }, { x: 10, y: 60 }])).toBe(
      'M 10 20 L 10 40 L 10 60',
    )
  })
  it('returns an empty path for no points', () => {
    expect(bondPath([])).toBe('')
  })
})

describe('descentPath', () => {
  it('draws vertical → horizontal → vertical through the midpoint (old ParentChildLine shape)', () => {
    expect(descentPath(100, 50, 240, 170)).toBe('M 100 50 V 110 H 240 V 170')
  })

  it('keeps a single straight drop when source and target share an x (lone parent)', () => {
    expect(descentPath(100, 50, 100, 170)).toBe('M 100 50 V 110 H 100 V 170')
  })

  it('routes through the midpoint even when the target sits above the source (inverted)', () => {
    expect(descentPath(100, 170, 240, 50)).toBe('M 100 170 V 110 H 240 V 50')
  })
})
