import { describe, it, expect } from 'vitest'
import { matchCouples, buildClusters, crossGenCurrentPairs } from '../layout-clusters'
import { COUPLE_WIDTH, NODE_WIDTH, type LineagePartnerEdge } from '../layout-shared'
import type { RomanticStatus } from '@prisma/client'

const edge = (a: string, b: string, romanticStatus: RomanticStatus): LineagePartnerEdge => ({
  simAId: a, simBId: b, romanticStatus, endedAt: null,
})
/** A deliberately-ended bond (a break-up / divorce — an "ex"). */
const endedEdge = (a: string, b: string, romanticStatus: RomanticStatus): LineagePartnerEdge => ({
  simAId: a, simBId: b, romanticStatus, endedAt: new Date('2026-01-01'),
})
const row0 = (...ids: string[]) => new Map<string, number>(ids.map((id) => [id, 0]))

describe('matchCouples', () => {
  it('prefers the current spouse over an ex (never "first partner wins")', () => {
    const couples = matchCouples(
      [endedEdge('bob', 'a', 'MARRIED'), edge('bob', 'z', 'MARRIED')],
      new Set(['a', 'bob', 'z']),
      row0('a', 'bob', 'z'),
    )
    expect(couples).toEqual([{ a: 'bob', b: 'z', romanticStatus: 'MARRIED' }])
  })

  it('ranks MARRIED above ENGAGED for the single slot', () => {
    const couples = matchCouples(
      [edge('bob', 'eng', 'ENGAGED'), edge('bob', 'new', 'MARRIED')],
      new Set(['bob', 'eng', 'new']),
      row0('bob', 'eng', 'new'),
    )
    expect(couples).toEqual([{ a: 'bob', b: 'new', romanticStatus: 'MARRIED' }])
  })

  it('keeps a current married couple adjacent (widowhood does not unseat them)', () => {
    const couples = matchCouples(
      [edge('ann', 'joe', 'MARRIED')],
      new Set(['ann', 'joe']),
      row0('ann', 'joe'),
    )
    expect(couples).toEqual([{ a: 'ann', b: 'joe', romanticStatus: 'MARRIED' }])
  })

  it('an ended relationship never claims an adjacency slot', () => {
    const couples = matchCouples([endedEdge('a', 'b', 'MARRIED')], new Set(['a', 'b']), row0('a', 'b'))
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

  it('ranks ENGAGED above PARTNER for the single slot', () => {
    const couples = matchCouples(
      [edge('bob', 'par', 'PARTNER'), edge('bob', 'eng', 'ENGAGED')],
      new Set(['bob', 'par', 'eng']),
      row0('bob', 'par', 'eng'),
    )
    expect(couples).toEqual([{ a: 'bob', b: 'eng', romanticStatus: 'ENGAGED' }])
  })

  it('does not draw a bond for casual DATING (not an adjacency candidate)', () => {
    const couples = matchCouples([edge('a', 'b', 'DATING')], new Set(['a', 'b']), row0('a', 'b'))
    expect(couples).toEqual([])
  })
})

describe('crossGenCurrentPairs', () => {
  it('identifies current-partner pairs that span generations', () => {
    const rowOf = new Map<string, number>([['sol', 0], ['bex', 1]])
    const pairs = crossGenCurrentPairs([edge('sol', 'bex', 'PARTNER')], new Set(['sol', 'bex']), rowOf)
    expect(pairs).toEqual([{ a: 'bex', b: 'sol', romanticStatus: 'PARTNER' }])
  })

  it('excludes DATING and ended bonds from cross-gen bonds', () => {
    const rowOf = new Map<string, number>([['a', 0], ['b', 1]])
    expect(crossGenCurrentPairs([edge('a', 'b', 'DATING')], new Set(['a', 'b']), rowOf)).toEqual([])
    expect(crossGenCurrentPairs([endedEdge('a', 'b', 'MARRIED')], new Set(['a', 'b']), rowOf)).toEqual([])
  })

  it('excludes same-row pairs (those become adjacent couples, not bonds)', () => {
    const rowOf = new Map<string, number>([['a', 0], ['b', 0]])
    expect(crossGenCurrentPairs([edge('a', 'b', 'PARTNER')], new Set(['a', 'b']), rowOf)).toEqual([])
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
