import type { RomanticStatus } from '@prisma/client'

/** The commitment bonds that survive the model redesign (weakest → strongest). */
export type RomanticBond = 'DATING' | 'PARTNER' | 'ENGAGED' | 'MARRIED'

/**
 * Display-relevant relationship state, derived from stored fields:
 * - active:  together, both alive
 * - ended:   deliberately ended while alive (break-up / divorce)
 * - widowed: a partner is deceased and the bond was not deliberately ended
 */
export type RomanticState =
  | { kind: 'active'; bond: RomanticBond }
  | { kind: 'ended'; bond: RomanticBond }
  | { kind: 'widowed'; bond: RomanticBond }

/**
 * Derive the relationship state from the stored bond, the deliberate-end
 * timestamp, and whether the *other* partner is deceased.
 *
 * Precedence: a deliberate end beats death (a couple who divorced and then one
 * ex died stays `ended`, not `widowed`). Non-romantic bonds → null. The bond
 * guard also absorbs the legacy EX_PARTNER/WIDOWED values during the
 * expand-phase migration without naming them.
 */
export function deriveRomanticState(
  bond: RomanticStatus,
  endedAt: Date | null,
  partnerDeceased: boolean,
): RomanticState | null {
  if (bond !== 'DATING' && bond !== 'PARTNER' && bond !== 'ENGAGED' && bond !== 'MARRIED') return null
  if (endedAt !== null) return { kind: 'ended', bond }
  if (partnerDeceased) return { kind: 'widowed', bond }
  return { kind: 'active', bond }
}

/** Non-gendered badge text for the relationships editor and sim inspector. */
export function romanticStateBadge(state: RomanticState): string {
  const bondWord =
    state.bond === 'MARRIED' ? 'Married'
    : state.bond === 'ENGAGED' ? 'Engaged'
    : state.bond === 'PARTNER' ? 'Partner'
    : 'Dating'
  switch (state.kind) {
    case 'active':
      return bondWord
    case 'widowed':
      return 'Widowed'
    case 'ended':
      switch (state.bond) {
        case 'MARRIED':
          return 'Divorced'
        case 'ENGAGED':
          return 'Engagement ended'
        case 'PARTNER':
          return 'Separated'
        case 'DATING':
          return 'Broke up'
      }
  }
}
