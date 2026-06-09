import { describe, it, expect } from 'vitest'
import { deriveRomanticState, romanticStateBadge } from './romantic-status'

const DAY = new Date('2026-01-01T00:00:00Z')

describe('deriveRomanticState', () => {
  it('returns null for non-romantic bonds', () => {
    expect(deriveRomanticState('NONE', null, false)).toBeNull()
  })

  it('active when together and both alive', () => {
    expect(deriveRomanticState('MARRIED', null, false)).toEqual({ kind: 'active', bond: 'MARRIED' })
    expect(deriveRomanticState('PARTNER', null, false)).toEqual({ kind: 'active', bond: 'PARTNER' })
    expect(deriveRomanticState('DATING', null, false)).toEqual({ kind: 'active', bond: 'DATING' })
  })

  it('widowed when a partner is deceased and the bond was not deliberately ended', () => {
    expect(deriveRomanticState('MARRIED', null, true)).toEqual({ kind: 'widowed', bond: 'MARRIED' })
    expect(deriveRomanticState('ENGAGED', null, true)).toEqual({ kind: 'widowed', bond: 'ENGAGED' })
  })

  it('ended when deliberately ended, regardless of bond', () => {
    expect(deriveRomanticState('MARRIED', DAY, false)).toEqual({ kind: 'ended', bond: 'MARRIED' })
    expect(deriveRomanticState('DATING', DAY, false)).toEqual({ kind: 'ended', bond: 'DATING' })
  })

  it('a deliberate end beats death (divorced-then-deceased stays ended)', () => {
    expect(deriveRomanticState('MARRIED', DAY, true)).toEqual({ kind: 'ended', bond: 'MARRIED' })
  })
})

describe('romanticStateBadge', () => {
  it('labels active bonds by commitment', () => {
    expect(romanticStateBadge({ kind: 'active', bond: 'MARRIED' })).toBe('Married')
    expect(romanticStateBadge({ kind: 'active', bond: 'DATING' })).toBe('Dating')
  })
  it('labels widowhood', () => {
    expect(romanticStateBadge({ kind: 'widowed', bond: 'MARRIED' })).toBe('Widowed')
  })
  it('distinguishes divorce, separation, and a break-up by bond', () => {
    expect(romanticStateBadge({ kind: 'ended', bond: 'MARRIED' })).toBe('Divorced')
    expect(romanticStateBadge({ kind: 'ended', bond: 'ENGAGED' })).toBe('Engagement ended')
    expect(romanticStateBadge({ kind: 'ended', bond: 'PARTNER' })).toBe('Separated')
    expect(romanticStateBadge({ kind: 'ended', bond: 'DATING' })).toBe('Broke up')
  })
  it('labels an active partnership', () => {
    expect(romanticStateBadge({ kind: 'active', bond: 'PARTNER' })).toBe('Partner')
  })
})
