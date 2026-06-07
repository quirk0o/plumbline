import { describe, it, expect } from 'vitest'
import { deriveRows } from '../layout-rows'
import type { LayoutSim, LineagePartnerEdge } from '../layout-shared'

const married = (a: string, b: string): LineagePartnerEdge => ({
  simAId: a, simBId: b, romanticStatus: 'MARRIED',
})

describe('deriveRows', () => {
  it('maps distinct generations to ascending row indices', () => {
    const sims: LayoutSim[] = [
      { id: 'a', generationNumber: 3 },
      { id: 'b', generationNumber: 1 },
      { id: 'c', generationNumber: 1 },
    ]
    const { rowGenerations, rowOf } = deriveRows(sims, [])
    expect(rowGenerations).toEqual([1, 3])
    expect(rowOf.get('b')).toBe(0)
    expect(rowOf.get('a')).toBe(1)
  })

  it('places a null-gen sim in their generation-bearing partner’s row', () => {
    const sims: LayoutSim[] = [
      { id: 'gen2', generationNumber: 2 },
      { id: 'gen1', generationNumber: 1 },
      { id: 'townie', generationNumber: null },
    ]
    const { rowGenerations, rowOf } = deriveRows(sims, [married('townie', 'gen2')])
    expect(rowOf.get('townie')).toBe(rowOf.get('gen2'))
    expect(rowGenerations).toEqual([1, 2])
  })

  it('does not chain placement through another null-gen partner', () => {
    const sims: LayoutSim[] = [
      { id: 'g1', generationNumber: 1 },
      { id: 'n1', generationNumber: null },
      { id: 'n2', generationNumber: null },
    ]
    const { rowGenerations, rowOf } = deriveRows(sims, [married('n1', 'n2'), married('n2', 'g1')])
    expect(rowOf.get('n2')).toBe(0)
    expect(rowGenerations).toEqual([1, null])
    expect(rowOf.get('n1')).toBe(1) // shelf
  })

  it('shelves null-gen sims whose only connections are children or parents', () => {
    const sims: LayoutSim[] = [
      { id: 'kid', generationNumber: 2 },
      { id: 'founder', generationNumber: 1 },
      { id: 'mystery', generationNumber: null },
    ]
    const { rowGenerations, rowOf } = deriveRows(sims, [])
    expect(rowGenerations).toEqual([1, 2, null])
    expect(rowOf.get('mystery')).toBe(2)
  })

  it('shelves unconnected null-gen sims in a trailing null row', () => {
    const sims: LayoutSim[] = [
      { id: 'real', generationNumber: 1 },
      { id: 'stray', generationNumber: null },
    ]
    const { rowGenerations, rowOf } = deriveRows(sims, [])
    expect(rowGenerations).toEqual([1, null])
    expect(rowOf.get('stray')).toBe(1)
  })

  it('omits the shelf row when every null-gen sim has a placed partner', () => {
    const sims: LayoutSim[] = [
      { id: 'real', generationNumber: 1 },
      { id: 'spouse', generationNumber: null },
    ]
    const { rowGenerations } = deriveRows(sims, [married('spouse', 'real')])
    expect(rowGenerations).toEqual([1])
  })

  it('shelves everyone when no sim has a generation', () => {
    const sims: LayoutSim[] = [
      { id: 'x', generationNumber: null },
      { id: 'y', generationNumber: null },
    ]
    const { rowGenerations, rowOf } = deriveRows(sims, [married('x', 'y')])
    expect(rowGenerations).toEqual([null])
    expect(rowOf.get('x')).toBe(0)
    expect(rowOf.get('y')).toBe(0)
  })
})
