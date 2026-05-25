import { describe, it, expect } from 'vitest'
import {
  computeLineageLayout,
  NODE_WIDTH,
  MARRIAGE_BOND_GAP,
  type LineageTreeSim,
  type LineageFamilyEdge,
  type LineagePartnerEdge,
} from '../layout'

// Fixture: 2 real generations + 1 null-generation sim, ≥1 couple, ≥1 parent-child link.
const sims: LineageTreeSim[] = [
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
const partnerEdges: LineagePartnerEdge[] = [{ simAId: 'founder-a', simBId: 'founder-b' }]

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
})
