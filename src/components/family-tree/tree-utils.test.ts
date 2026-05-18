import { describe, it, expect } from 'vitest'
import { buildDagreGraph, buildPartnerEdges } from './tree-utils'
import type { TreeSim, FamilyEdge, PartnerEdge } from './tree-utils'

const makeSim = (id: string, gen: number): TreeSim => ({
  id,
  firstName: id,
  lastName: 'Goth',
  imageUrl: null,
  generationNumber: gen,
})

describe('buildDagreGraph', () => {
  it('returns a node for each sim', () => {
    const sims = [makeSim('a', 1), makeSim('b', 2)]
    const { nodes } = buildDagreGraph(sims, [])
    expect(nodes).toHaveLength(2)
    expect(nodes.map((n) => n.id)).toEqual(expect.arrayContaining(['a', 'b']))
  })

  it('positions children below their parents', () => {
    const sims = [makeSim('parent', 1), makeSim('child', 2)]
    const edges: FamilyEdge[] = [{ parentId: 'parent', childId: 'child' }]
    const { nodes } = buildDagreGraph(sims, edges)
    const parent = nodes.find((n) => n.id === 'parent')!
    const child = nodes.find((n) => n.id === 'child')!
    expect(child.position.y).toBeGreaterThan(parent.position.y)
  })

  it('places both parents of a shared child at the same y-position', () => {
    const sims = [makeSim('p1', 1), makeSim('p2', 1), makeSim('c1', 2)]
    const edges: FamilyEdge[] = [
      { parentId: 'p1', childId: 'c1' },
      { parentId: 'p2', childId: 'c1' },
    ]
    const { nodes } = buildDagreGraph(sims, edges)
    const p1 = nodes.find((n) => n.id === 'p1')!
    const p2 = nodes.find((n) => n.id === 'p2')!
    expect(p1.position.y).toBe(p2.position.y)
  })

  it('positions children from two different partners below their respective parents', () => {
    const sims = [
      makeSim('mortimer', 1), makeSim('bella', 1), makeSim('dina', 1),
      makeSim('cassandra', 2), makeSim('dirk', 2),
    ]
    const edges: FamilyEdge[] = [
      { parentId: 'mortimer', childId: 'cassandra' },
      { parentId: 'bella', childId: 'cassandra' },
      { parentId: 'mortimer', childId: 'dirk' },
      { parentId: 'dina', childId: 'dirk' },
    ]
    const { nodes } = buildDagreGraph(sims, edges)
    const mortimer = nodes.find((n) => n.id === 'mortimer')!
    const cassandra = nodes.find((n) => n.id === 'cassandra')!
    const dirk = nodes.find((n) => n.id === 'dirk')!
    expect(cassandra.position.y).toBeGreaterThan(mortimer.position.y)
    expect(dirk.position.y).toBeGreaterThan(mortimer.position.y)
  })

  it('returns a family edge with correct source, target, and id', () => {
    const sims = [makeSim('p', 1), makeSim('c', 2)]
    const { edges } = buildDagreGraph(sims, [{ parentId: 'p', childId: 'c' }])
    expect(edges).toHaveLength(1)
    expect(edges[0]).toMatchObject({ id: 'family-p-c', source: 'p', target: 'c' })
  })

  it('returns empty edges for a single sim with no relationships', () => {
    const { nodes, edges } = buildDagreGraph([makeSim('lone', 1)], [])
    expect(nodes).toHaveLength(1)
    expect(edges).toHaveLength(0)
  })

  it('does not stack disconnected sims on top of each other', () => {
    const sims = [makeSim('a', 1), makeSim('b', 1)]
    const { nodes } = buildDagreGraph(sims, [])
    const a = nodes.find((n) => n.id === 'a')!
    const b = nodes.find((n) => n.id === 'b')!
    expect(a.position.x).not.toBe(b.position.x)
  })
})

describe('buildPartnerEdges', () => {
  it('creates a dashed straight edge for each partner pair', () => {
    const pairs: PartnerEdge[] = [{ simAId: 'a', simBId: 'b' }]
    const edges = buildPartnerEdges(pairs)
    expect(edges).toHaveLength(1)
    expect(edges[0]).toMatchObject({ id: 'partner-a-b', source: 'a', target: 'b', type: 'straight' })
    expect(String(edges[0].style?.strokeDasharray)).toMatch(/\d/)
  })

  it('returns empty array when there are no partner pairs', () => {
    expect(buildPartnerEdges([])).toHaveLength(0)
  })
})
