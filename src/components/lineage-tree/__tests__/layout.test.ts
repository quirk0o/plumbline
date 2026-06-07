import { describe, it, expect } from 'vitest'
import {
  computeLineageLayout,
  CREST_ANCHORS,
  HANGING_UNION_BASE_OFFSET,
  MARRIAGE_BOND_GAP,
  NODE_WIDTH,
  type LayoutSim,
  type LineagePartnerEdge,
} from '../layout'
import type { RomanticStatus } from '@prisma/client'

const edge = (a: string, b: string, romanticStatus: RomanticStatus = 'MARRIED'): LineagePartnerEdge => ({
  simAId: a, simBId: b, romanticStatus,
})
const sim = (id: string, generationNumber: number | null): LayoutSim => ({ id, generationNumber })

function expectNoRowOverlap(layout: ReturnType<typeof computeLineageLayout>) {
  const byRow = new Map<number, number[]>()
  for (const n of layout.nodes) byRow.set(n.y, [...(byRow.get(n.y) ?? []), n.x])
  for (const xs of byRow.values()) {
    const sorted = [...xs].sort((a, b) => a - b)
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i] - sorted[i - 1]).toBeGreaterThanOrEqual(NODE_WIDTH)
    }
  }
}

describe('computeLineageLayout — rows', () => {
  const sims = [sim('f1', 1), sim('f2', 1), sim('c1', 2), sim('c2', 2), sim('stray', null)]
  const familyEdges = [{ parentId: 'f1', childId: 'c1' }, { parentId: 'f2', childId: 'c1' }]
  const layout = computeLineageLayout(sims, familyEdges, [edge('f1', 'f2')])

  it('same-gen sims share y; later gens are lower', () => {
    expect(layout.byId['f1'].y).toBe(layout.byId['f2'].y)
    expect(layout.byId['c1'].y).toBe(layout.byId['c2'].y)
    expect(layout.byId['c1'].y).toBeGreaterThan(layout.byId['f1'].y)
  })
  it('shelves the unconnected null-gen sim below all real rows', () => {
    expect(layout.rowGenerations).toEqual([1, 2, null])
    expect(layout.byId['stray'].y).toBeGreaterThan(layout.byId['c1'].y)
  })
  it('places a connected null-gen sim in their partner’s row', () => {
    const l = computeLineageLayout([sim('f1', 1), sim('spouse', null)], [], [edge('f1', 'spouse')])
    expect(l.byId['spouse'].y).toBe(l.byId['f1'].y)
    expect(l.rowGenerations).toEqual([1])
  })
  it('returns a node per sim and handles an empty tree', () => {
    expect(layout.nodes.map((n) => n.id).sort()).toEqual(sims.map((s) => s.id).sort())
    const empty = computeLineageLayout([], [], [])
    expect(empty.nodes).toHaveLength(0)
    expect(empty.viewBox.width).toBeGreaterThan(0)
  })
})

describe('computeLineageLayout — couples', () => {
  it('places the matched couple adjacent (node width + bond gap)', () => {
    const l = computeLineageLayout([sim('f1', 1), sim('f2', 1)], [], [edge('f1', 'f2')])
    expect(Math.abs(l.byId['f1'].x - l.byId['f2'].x)).toBe(NODE_WIDTH + MARRIAGE_BOND_GAP)
    expect(l.couples).toEqual([{ a: 'f1', b: 'f2', romanticStatus: 'MARRIED' }])
  })
  it('prefers the current spouse over an ex', () => {
    const l = computeLineageLayout(
      [sim('alice', 1), sim('bob', 1), sim('dana', 1)],
      [],
      [edge('alice', 'bob', 'EX_PARTNER'), edge('bob', 'dana', 'MARRIED')],
    )
    expect(l.couples).toEqual([{ a: 'bob', b: 'dana', romanticStatus: 'MARRIED' }])
  })
  it('keeps widowed couples adjacent', () => {
    const l = computeLineageLayout([sim('ann', 1), sim('joe', 1)], [], [edge('ann', 'joe', 'WIDOWED')])
    expect(l.couples).toEqual([{ a: 'ann', b: 'joe', romanticStatus: 'WIDOWED' }])
  })
  it('emits no couple for ex-only pairs', () => {
    const l = computeLineageLayout([sim('a', 1), sim('b', 1)], [], [edge('a', 'b', 'EX_PARTNER')])
    expect(l.couples).toEqual([])
  })
})

describe('computeLineageLayout — hanging unions', () => {
  const sims = [sim('alice', 1), sim('bob', 1), sim('dana', 1), sim('carol', 2), sim('evan', 2)]
  const familyEdges = [
    { parentId: 'alice', childId: 'carol' },
    { parentId: 'bob', childId: 'carol' },
    { parentId: 'bob', childId: 'evan' },
    { parentId: 'dana', childId: 'evan' },
  ]
  const layout = computeLineageLayout(sims, familyEdges, [edge('alice', 'bob', 'EX_PARTNER'), edge('bob', 'dana', 'MARRIED')])

  it('one hanging union for the non-adjacent co-parent pair', () => {
    expect(layout.couples).toEqual([{ a: 'bob', b: 'dana', romanticStatus: 'MARRIED' }])
    expect(layout.hangingUnions).toHaveLength(1)
    expect([layout.hangingUnions[0].parentA, layout.hangingUnions[0].parentB].sort()).toEqual(['alice', 'bob'])
  })
  it('centers the junction between parents, below their row', () => {
    const [u] = layout.hangingUnions
    const expectedX = (layout.byId['alice'].x + CREST_ANCHORS.cx + layout.byId['bob'].x + CREST_ANCHORS.cx) / 2
    expect(u.x).toBeCloseTo(expectedX, 5)
    expect(u.y).toBe(layout.byId['alice'].y + HANGING_UNION_BASE_OFFSET)
  })
  it('no hanging union for childless exes', () => {
    const l = computeLineageLayout([sim('a', 1), sim('b', 1)], [], [edge('a', 'b', 'EX_PARTNER')])
    expect(l.hangingUnions).toEqual([])
  })
  it('stacks two same-row hanging unions into distinct lanes', () => {
    const wide = computeLineageLayout(
      [sim('a', 1), sim('b', 1), sim('c', 1), sim('d', 1), sim('k1', 2), sim('k2', 2)],
      [
        { parentId: 'a', childId: 'k1' }, { parentId: 'b', childId: 'k1' },
        { parentId: 'c', childId: 'k2' }, { parentId: 'd', childId: 'k2' },
      ],
      [],
    )
    expect(wide.hangingUnions).toHaveLength(2)
    expect(new Set(wide.hangingUnions.map((u) => u.y)).size).toBe(2)
  })
})

describe('computeLineageLayout — components and singles', () => {
  const sims = [sim('f1', 1), sim('f2', 1), sim('c1', 2), sim('g1', 1), sim('c2', 2), sim('pia', 1)]
  const familyEdges = [
    { parentId: 'f1', childId: 'c1' }, { parentId: 'f2', childId: 'c1' },
    { parentId: 'g1', childId: 'c2' },
  ]
  const layout = computeLineageLayout(sims, familyEdges, [edge('f1', 'f2')])

  it('aligns both components to the same generation rows', () => {
    expect(layout.byId['g1'].y).toBe(layout.byId['f1'].y)
    expect(layout.byId['c2'].y).toBe(layout.byId['c1'].y)
  })
  it('renders the unconnected sim in her generation row', () => {
    expect(layout.byId['pia'].y).toBe(layout.byId['f1'].y)
  })
  it('keeps components horizontally separated', () => {
    const aRight = Math.max(layout.byId['f1'].x, layout.byId['f2'].x, layout.byId['c1'].x) + NODE_WIDTH
    const bLeft = Math.min(layout.byId['g1'].x, layout.byId['c2'].x)
    expect(bLeft).toBeGreaterThanOrEqual(aRight)
  })
  it('never overlaps medallions within a row', () => expectNoRowOverlap(layout))
  it('keeps children within their parents’ span', () => {
    const left = Math.min(layout.byId['f1'].x, layout.byId['f2'].x)
    const right = Math.max(layout.byId['f1'].x, layout.byId['f2'].x) + NODE_WIDTH
    expect(layout.byId['c1'].x + CREST_ANCHORS.cx).toBeGreaterThanOrEqual(left)
    expect(layout.byId['c1'].x + CREST_ANCHORS.cx).toBeLessThanOrEqual(right)
  })
})

describe('computeLineageLayout — determinism and resilience', () => {
  const sims = [sim('f1', 1), sim('f2', 1), sim('c1', 2), sim('z', null)]
  const familyEdges = [{ parentId: 'f1', childId: 'c1' }]
  const partnerEdges = [edge('f1', 'f2')]

  it('is deterministic across repeated calls', () => {
    expect(computeLineageLayout(sims, familyEdges, partnerEdges)).toEqual(
      computeLineageLayout(sims, familyEdges, partnerEdges),
    )
  })
  it('grows the viewBox with content', () => {
    const small = computeLineageLayout([sim('solo', 1)], [], [])
    const large = computeLineageLayout(sims, familyEdges, partnerEdges)
    expect(large.viewBox.width).toBeGreaterThan(small.viewBox.width)
    expect(large.viewBox.height).toBeGreaterThan(small.viewBox.height)
  })
  it('ignores self-edges, unknown-id edges, and same-row parent-child edges without dropping sims', () => {
    const l = computeLineageLayout(
      [sim('a', 1), sim('b', 1)],
      [{ parentId: 'a', childId: 'a' }, { parentId: 'ghost', childId: 'a' }, { parentId: 'a', childId: 'b' }],
      [edge('a', 'ghost')],
    )
    expect(l.nodes).toHaveLength(2)
    expectNoRowOverlap(l)
  })
})
