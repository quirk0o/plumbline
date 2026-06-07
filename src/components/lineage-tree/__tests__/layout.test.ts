import { describe, it, expect } from 'vitest'
import {
  computeLineageLayout,
  NODE_WIDTH,
  MARRIAGE_BOND_GAP,
  type LayoutSim,
  type LineageFamilyEdge,
} from '../layout'
import type { LineagePartnerEdge } from '../layout-shared'

// Fixture: 2 real generations + 1 null-generation sim, ≥1 couple, ≥1 parent-child link.
const sims: LayoutSim[] = [
  { id: 'founder-a', generationNumber: 1 },
  { id: 'founder-b', generationNumber: 1 },
  { id: 'child-c', generationNumber: 2 },
  { id: 'sibling-d', generationNumber: 2 },
  { id: 'orphan-z', generationNumber: null },
]
const familyEdges: LineageFamilyEdge[] = [
  { parentId: 'founder-a', childId: 'child-c' },
  { parentId: 'founder-b', childId: 'child-c' },
]
const partnerEdges: LineagePartnerEdge[] = [
  { simAId: 'founder-a', simBId: 'founder-b', romanticStatus: 'MARRIED' as const },
]

describe('computeLineageLayout', () => {
  it('places sims in the same generation at the same y', () => {
    const { byId } = computeLineageLayout(sims, familyEdges, partnerEdges)
    expect(byId['founder-a'].y).toBe(byId['founder-b'].y)
    expect(byId['child-c'].y).toBe(byId['sibling-d'].y)
  })

  it('places later generations at a larger y', () => {
    const { byId } = computeLineageLayout(sims, familyEdges, partnerEdges)
    expect(byId['child-c'].y).toBeGreaterThan(byId['founder-a'].y)
  })

  it('places the null-generation sim in a trailing row below all real generations', () => {
    const { byId } = computeLineageLayout(sims, familyEdges, partnerEdges)
    expect(byId['orphan-z'].y).toBeGreaterThan(byId['child-c'].y)
  })

  it('places partners horizontally adjacent (one node width + bond gap apart)', () => {
    const { byId } = computeLineageLayout(sims, familyEdges, partnerEdges)
    const gap = Math.abs(byId['founder-a'].x - byId['founder-b'].x)
    expect(gap).toBe(NODE_WIDTH + MARRIAGE_BOND_GAP)
  })

  it('grows the viewBox with content', () => {
    const small = computeLineageLayout(
      [{ id: 'solo', generationNumber: 1 }],
      [],
      [],
    )
    const large = computeLineageLayout(sims, familyEdges, partnerEdges)
    expect(large.viewBox.width).toBeGreaterThan(small.viewBox.width)
    expect(large.viewBox.height).toBeGreaterThan(small.viewBox.height)
  })

  it('is deterministic across repeated calls', () => {
    const first = computeLineageLayout(sims, familyEdges, partnerEdges)
    const second = computeLineageLayout(sims, familyEdges, partnerEdges)
    expect(second.nodes).toEqual(first.nodes)
    expect(second.viewBox).toEqual(first.viewBox)
  })

  it('returns a node for every sim', () => {
    const { nodes } = computeLineageLayout(sims, familyEdges, partnerEdges)
    expect(nodes.map((n) => n.id).sort()).toEqual(sims.map((s) => s.id).sort())
  })

  it('handles an empty tree', () => {
    const result = computeLineageLayout([], [], [])
    expect(result.nodes).toHaveLength(0)
    expect(result.viewBox.width).toBeGreaterThan(0)
  })

  it('keeps nodes in the same row non-overlapping after centering', () => {
    const { nodes } = computeLineageLayout(sims, familyEdges, partnerEdges)
    const byRow = new Map<number, number[]>()
    for (const n of nodes) {
      const xs = byRow.get(n.y) ?? []
      xs.push(n.x)
      byRow.set(n.y, xs)
    }
    for (const xs of byRow.values()) {
      const sorted = [...xs].sort((a, b) => a - b)
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i] - sorted[i - 1]).toBeGreaterThanOrEqual(NODE_WIDTH)
      }
    }
  })

  it('emits one couple per adjacent pair, not one per partner edge', () => {
    const sims = [
      { id: 'a', generationNumber: 1 },
      { id: 'b', generationNumber: 1 },
      { id: 'c', generationNumber: 1 },
    ]
    // 'a' has two partner edges in the same generation. Only one partner can be
    // placed adjacent, so the layout must expose exactly one couple — never two.
    const partnerEdges = [
      { simAId: 'a', simBId: 'b', romanticStatus: 'MARRIED' as const },
      { simAId: 'a', simBId: 'c', romanticStatus: 'MARRIED' as const },
    ]
    const layout = computeLineageLayout(sims, [], partnerEdges)
    expect(layout.couples).toHaveLength(1)
    const [couple] = layout.couples
    expect(layout.byId[couple.a].y).toBe(layout.byId[couple.b].y)
  })
})
