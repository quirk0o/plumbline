import { describe, it, expect } from 'vitest'
import { matchCouples, buildClusters } from '../layout-clusters'
import { COUPLE_WIDTH, NODE_WIDTH, type LineagePartnerEdge } from '../layout-shared'
import type { RomanticStatus } from '@prisma/client'

const edge = (a: string, b: string, romanticStatus: RomanticStatus): LineagePartnerEdge => ({
  simAId: a, simBId: b, romanticStatus,
})
const row0 = (...ids: string[]) => new Map<string, number>(ids.map((id) => [id, 0]))

describe('matchCouples', () => {
  it('prefers the current spouse over an ex (never "first partner wins")', () => {
    const couples = matchCouples(
      [edge('bob', 'a', 'EX_PARTNER'), edge('bob', 'z', 'MARRIED')],
      new Set(['a', 'bob', 'z']),
      row0('a', 'bob', 'z'),
    )
    expect(couples).toEqual([{ a: 'bob', b: 'z', romanticStatus: 'MARRIED' }])
  })

  it('ranks MARRIED > ENGAGED > PARTNER > WIDOWED for the single slot', () => {
    const couples = matchCouples(
      [edge('bob', 'late', 'WIDOWED'), edge('bob', 'new', 'MARRIED')],
      new Set(['bob', 'late', 'new']),
      row0('bob', 'late', 'new'),
    )
    expect(couples).toEqual([{ a: 'bob', b: 'new', romanticStatus: 'MARRIED' }])
  })

  it('keeps a widowed-only pair adjacent', () => {
    const couples = matchCouples(
      [edge('ann', 'joe', 'WIDOWED')],
      new Set(['ann', 'joe']),
      row0('ann', 'joe'),
    )
    expect(couples).toEqual([{ a: 'ann', b: 'joe', romanticStatus: 'WIDOWED' }])
  })

  it('never pairs exes', () => {
    const couples = matchCouples([edge('a', 'b', 'EX_PARTNER')], new Set(['a', 'b']), row0('a', 'b'))
    expect(couples).toEqual([])
  })

  it('only pairs partners in the same row', () => {
    const rowOf = new Map<string, number>([['a', 0], ['b', 1]])
    const couples = matchCouples([edge('a', 'b', 'MARRIED')], new Set(['a', 'b']), rowOf)
    expect(couples).toEqual([])
  })

  it('gives each sim at most one adjacent partner', () => {
    const couples = matchCouples(
      [edge('hub', 'w1', 'MARRIED'), edge('hub', 'w2', 'PARTNER')],
      new Set(['hub', 'w1', 'w2']),
      row0('hub', 'w1', 'w2'),
    )
    expect(couples).toHaveLength(1)
    expect(couples[0]).toMatchObject({ romanticStatus: 'MARRIED' })
  })

  it('treats PARTNER as a current partner that can be adjacent', () => {
    const couples = matchCouples([edge('a', 'b', 'PARTNER')], new Set(['a', 'b']), row0('a', 'b'))
    expect(couples).toEqual([{ a: 'a', b: 'b', romanticStatus: 'PARTNER' }])
  })

  it('ranks PARTNER above WIDOWED but below ENGAGED', () => {
    const couples = matchCouples(
      [edge('bob', 'wid', 'WIDOWED'), edge('bob', 'par', 'PARTNER')],
      new Set(['bob', 'wid', 'par']),
      row0('bob', 'wid', 'par'),
    )
    expect(couples).toEqual([{ a: 'bob', b: 'par', romanticStatus: 'PARTNER' }])
  })

  it('does not draw a bond for casual DATING (not an adjacency candidate)', () => {
    const couples = matchCouples([edge('a', 'b', 'DATING')], new Set(['a', 'b']), row0('a', 'b'))
    expect(couples).toEqual([])
  })
})

describe('buildClusters', () => {
  it('builds couple clusters (sorted members) and singles, sorted by id', () => {
    const sims = [
      { id: 'c', generationNumber: 1 },
      { id: 'a', generationNumber: 1 },
      { id: 'b', generationNumber: 1 },
    ]
    const rowOf = row0('a', 'b', 'c')
    const clusters = buildClusters(sims, rowOf, [{ a: 'a', b: 'c', romanticStatus: 'MARRIED' }])
    expect(clusters).toEqual([
      { id: 'a', members: ['a', 'c'], rowIndex: 0, width: COUPLE_WIDTH },
      { id: 'b', members: ['b'], rowIndex: 0, width: NODE_WIDTH },
    ])
  })
})
