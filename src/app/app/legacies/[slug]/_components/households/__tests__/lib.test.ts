import { describe, it, expect } from 'vitest'
import { simoleons, worldOptions, lotOptions } from '../lib'
import type { WorldOption } from '../../../lib/types'

const WORLDS: WorldOption[] = [
  { id: 'w1', name: 'Willow Creek', lots: ['1 Goth Hill', '165 Sim Lane'] },
  { id: 'w2', name: 'Oasis Springs', lots: ['4 Affluista Way'] },
]

describe('simoleons', () => {
  it('formats with the § sign and thousands separators', () => {
    expect(simoleons(184250)).toBe('§184,250')
    expect(simoleons(0)).toBe('§0')
  })
})

describe('worldOptions', () => {
  it('returns the filtered list as-is when the current world is included', () => {
    expect(worldOptions(WORLDS, { worldId: 'w1', worldName: 'Willow Creek' })).toEqual(WORLDS)
  })

  it('prepends the current world when the pack filter excluded it', () => {
    const result = worldOptions(WORLDS, { worldId: 'w9', worldName: 'Ravenwood' })
    expect(result[0]).toEqual({ id: 'w9', name: 'Ravenwood', lots: [] })
    expect(result).toHaveLength(3)
  })

  it('handles no current world', () => {
    expect(worldOptions(WORLDS, { worldId: null, worldName: null })).toEqual(WORLDS)
  })
})

describe('lotOptions', () => {
  it('returns the world lots, preserving a custom current lot at the front', () => {
    expect(lotOptions(WORLDS[0], '7 Custom Way')).toEqual([
      '7 Custom Way',
      '1 Goth Hill',
      '165 Sim Lane',
    ])
  })

  it('does not duplicate a canonical current lot', () => {
    expect(lotOptions(WORLDS[0], '1 Goth Hill')).toEqual(['1 Goth Hill', '165 Sim Lane'])
  })

  it('handles a missing world', () => {
    expect(lotOptions(undefined, '7 Custom Way')).toEqual(['7 Custom Way'])
  })
})
