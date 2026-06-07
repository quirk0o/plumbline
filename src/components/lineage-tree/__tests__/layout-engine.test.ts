import { describe, it, expect } from 'vitest'
import { positionClusters } from '../layout-engine'
import { CLUSTER_GAP, COMPONENT_GAP, COUPLE_WIDTH, NODE_WIDTH, type Cluster } from '../layout-shared'

const couple = (id: string, rowIndex: number): Cluster => ({
  id, members: [id, `${id}-partner`], rowIndex, width: COUPLE_WIDTH,
})
const single = (id: string, rowIndex: number): Cluster => ({
  id, members: [id], rowIndex, width: NODE_WIDTH,
})

describe('positionClusters', () => {
  it('positions a child within its parents’ horizontal span', () => {
    const clusters = [couple('p', 0), single('c', 1)]
    const x = positionClusters({ clusters, parentClusterIdsOf: new Map([['c', ['p']]]) })
    expect(x.get('c')!).toBeGreaterThanOrEqual(x.get('p')! - NODE_WIDTH)
    expect(x.get('c')!).toBeLessThanOrEqual(x.get('p')! + COUPLE_WIDTH)
  })

  it('never overlaps clusters within a row', () => {
    const clusters = [
      couple('p1', 0), couple('p2', 0),
      single('a', 1), single('b', 1), single('c', 1), single('d', 1),
    ]
    const x = positionClusters({
      clusters,
      parentClusterIdsOf: new Map([['a', ['p1']], ['b', ['p1']], ['c', ['p2']], ['d', ['p2']]]),
    })
    for (const row of [0, 1]) {
      const inRow = clusters
        .filter((c) => c.rowIndex === row)
        .map((c) => ({ left: x.get(c.id)!, right: x.get(c.id)! + c.width }))
        .sort((a, b) => a.left - b.left)
      for (let i = 1; i < inRow.length; i++) {
        expect(inRow[i].left).toBeGreaterThanOrEqual(inRow[i - 1].right)
      }
    }
  })

  it('bands disconnected multi-cluster components left-to-right with COMPONENT_GAP', () => {
    const clusters = [couple('fam1', 0), single('kid1', 1), couple('fam2', 0), single('kid2', 1)]
    const x = positionClusters({
      clusters,
      parentClusterIdsOf: new Map([['kid1', ['fam1']], ['kid2', ['fam2']]]),
    })
    expect(x.get('fam1')!).toBeLessThan(x.get('fam2')!)
    const fam1Right = Math.max(x.get('fam1')! + COUPLE_WIDTH, x.get('kid1')! + NODE_WIDTH)
    const fam2Left = Math.min(x.get('fam2')!, x.get('kid2')!)
    expect(fam2Left).toBeGreaterThanOrEqual(fam1Right + COMPONENT_GAP)
  })

  it('packs loose clusters (no layout edges) per row after the last component with CLUSTER_GAP', () => {
    const clusters = [couple('fam', 0), single('kid', 1), single('loner1', 0), single('loner2', 0)]
    const x = positionClusters({ clusters, parentClusterIdsOf: new Map([['kid', ['fam']]]) })
    const bandRight = Math.max(x.get('fam')! + COUPLE_WIDTH, x.get('kid')! + NODE_WIDTH)
    expect(x.get('loner1')!).toBeGreaterThanOrEqual(bandRight)
    expect(x.get('loner2')!).toBe(x.get('loner1')! + NODE_WIDTH + CLUSTER_GAP)
  })

  it('handles rows the component does not occupy (family starting at row 2)', () => {
    const clusters = [couple('late', 2), single('latekid', 3)]
    const x = positionClusters({ clusters, parentClusterIdsOf: new Map([['latekid', ['late']]]) })
    expect(x.get('late')).toBeDefined()
    expect(x.get('latekid')).toBeDefined()
  })

  it('is deterministic', () => {
    const clusters = [couple('p1', 0), couple('p2', 0), single('a', 1), single('b', 1), single('c', 1)]
    const input = {
      clusters,
      parentClusterIdsOf: new Map([['a', ['p1']], ['b', ['p2']], ['c', ['p1']]]),
    }
    expect(positionClusters(input)).toEqual(positionClusters(input))
  })

  it('returns an empty map for no clusters', () => {
    expect(positionClusters({ clusters: [], parentClusterIdsOf: new Map() }).size).toBe(0)
  })
})
