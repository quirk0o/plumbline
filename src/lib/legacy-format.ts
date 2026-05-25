import type { LifeStage } from '@prisma/client'

const ROMAN_NUMERALS = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']

export function roman(n: number): string {
  return ROMAN_NUMERALS[n] ?? String(n)
}

const LIFE_STAGE_LABELS: Record<LifeStage, string> = {
  NEWBORN: 'Newborn',
  INFANT: 'Infant',
  TODDLER: 'Toddler',
  CHILD: 'Child',
  TEEN: 'Teen',
  YOUNG_ADULT: 'Young Adult',
  ADULT: 'Adult',
  ELDER: 'Elder',
}

export function formatLifeStage(stage: LifeStage): string {
  return LIFE_STAGE_LABELS[stage]
}
