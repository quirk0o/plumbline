import { describe, it, expect } from 'vitest'
import {
  computeLineageLayout,
  CREST_ANCHORS,
  HANGING_UNION_BASE_OFFSET,
  MARRIAGE_BOND_GAP,
  NODE_WIDTH,
  TREE_PADDING,
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
  it('does not hang a union for co-parents in different generation rows', () => {
    // p1 (gen 1) and p2 (gen 2) co-parent kid (gen 3): a row-spanning junction
    // would average medallions across rows, so no hanging union is created —
    // the adapter falls back to per-parent descent lines instead.
    const l = computeLineageLayout(
      [sim('p1', 1), sim('p2', 2), sim('kid', 3)],
      [{ parentId: 'p1', childId: 'kid' }, { parentId: 'p2', childId: 'kid' }],
      [],
    )
    expect(l.hangingUnions).toEqual([])
  })
})

describe('computeLineageLayout — cross-gen bonds', () => {
  it('draws a cross-gen current couple as a bond, not per-parent lines', () => {
    const l = computeLineageLayout(
      [sim('sol', 1), sim('bex', 2), sim('pip', 3)],
      [{ parentId: 'sol', childId: 'pip' }, { parentId: 'bex', childId: 'pip' }],
      [{ simAId: 'sol', simBId: 'bex', romanticStatus: 'PARTNER' }],
    )
    expect(l.bonds).toHaveLength(1)
    expect(l.bonds[0].points.length).toBeGreaterThanOrEqual(2)
  })

  it('carries the partner ids (id-sorted) and status on the bond', () => {
    const l = computeLineageLayout(
      [sim('sol', 1), sim('bex', 2)],
      [],
      [{ simAId: 'sol', simBId: 'bex', romanticStatus: 'PARTNER' }],
    )
    expect(l.bonds).toEqual([
      expect.objectContaining({ a: 'bex', b: 'sol', romanticStatus: 'PARTNER' }),
    ])
  })

  it('routes the bond endpoints at the two partners’ medallion-center height', () => {
    const l = computeLineageLayout(
      [sim('sol', 1), sim('bex', 2)],
      [],
      [{ simAId: 'sol', simBId: 'bex', romanticStatus: 'PARTNER' }],
    )
    const ys = l.bonds[0].points.map((p) => p.y)
    expect(Math.min(...ys)).toBe(l.byId['sol'].y + CREST_ANCHORS.cy)
    expect(Math.max(...ys)).toBe(l.byId['bex'].y + CREST_ANCHORS.cy)
  })

  it('emits no bond for a same-gen couple (that is an adjacent couple instead)', () => {
    const l = computeLineageLayout(
      [sim('a', 1), sim('b', 1)],
      [],
      [{ simAId: 'a', simBId: 'b', romanticStatus: 'PARTNER' }],
    )
    expect(l.bonds).toEqual([])
    expect(l.couples).toHaveLength(1)
  })

  it('emits no bond for cross-gen EX or DATING relationships', () => {
    const ex = computeLineageLayout(
      [sim('a', 1), sim('b', 2)],
      [],
      [{ simAId: 'a', simBId: 'b', romanticStatus: 'EX_PARTNER' }],
    )
    expect(ex.bonds).toEqual([])

    const dating = computeLineageLayout(
      [sim('a', 1), sim('b', 2)],
      [],
      [{ simAId: 'a', simBId: 'b', romanticStatus: 'DATING' }],
    )
    expect(dating.bonds).toEqual([])
  })

  it('reroutes an on-column bond into a side gutter so it never overlaps the lower partner’s descent', () => {
    // The bug scenario: jt(gen1) partners gj(gen4); the engine aligns gj directly
    // under jt (a parent-edge model), so a center-to-center bond would run straight
    // down gj's own parental-descent column. The fix re-routes it as a side bracket.
    const l = computeLineageLayout(
      [sim('jt', 1), sim('dh', 2), sim('hh', 3), sim('th', 3), sim('gj', 4)],
      [
        { parentId: 'jt', childId: 'dh' },
        { parentId: 'dh', childId: 'hh' },
        { parentId: 'hh', childId: 'gj' },
        { parentId: 'th', childId: 'gj' },
      ],
      [
        { simAId: 'hh', simBId: 'th', romanticStatus: 'MARRIED' },
        { simAId: 'gj', simBId: 'jt', romanticStatus: 'PARTNER' },
      ],
    )

    expect(l.bonds).toHaveLength(1)
    const bond = l.bonds[0]
    const gjCenterX = l.byId['gj'].x + CREST_ANCHORS.cx
    const gjRightEdge = l.byId['gj'].x + NODE_WIDTH

    // No bond point runs on gj's center column (where its parental descent lives).
    expect(bond.points.some((p) => p.x === gjCenterX)).toBe(false)
    // Regression guard for the complaint: no consecutive pair shares gj's center x.
    for (let i = 1; i < bond.points.length; i++) {
      const colinearOnCenter = bond.points[i].x === gjCenterX && bond.points[i - 1].x === gjCenterX
      expect(colinearOnCenter).toBe(false)
    }

    // The two interior points share one laneX, strictly right of the column.
    expect(bond.points).toHaveLength(4)
    const [p0, p1, p2, p3] = bond.points
    expect(p1.x).toBe(p2.x)
    expect(p1.x).toBeGreaterThan(gjRightEdge)

    // First/last points attach to the partners' right edges at center height.
    const upper = l.byId['jt'].y < l.byId['gj'].y ? l.byId['jt'] : l.byId['gj']
    const lower = l.byId['jt'].y < l.byId['gj'].y ? l.byId['gj'] : l.byId['jt']
    expect(p0).toEqual({ x: upper.x + NODE_WIDTH, y: upper.y + CREST_ANCHORS.cy })
    expect(p3).toEqual({ x: lower.x + NODE_WIDTH, y: lower.y + CREST_ANCHORS.cy })

    // The right-gutter lane must not be clipped by the viewBox.
    expect(l.viewBox.width).toBeGreaterThanOrEqual(p1.x + TREE_PADDING)
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
