import { LifeStage } from '@prisma/client'

const LIFE_STAGE_ORDER: Record<LifeStage, number> = {
  NEWBORN: 0,
  INFANT: 1,
  TODDLER: 2,
  CHILD: 3,
  TEEN: 4,
  YOUNG_ADULT: 5,
  ADULT: 6,
  ELDER: 7,
}

export function isLifeStageInRange(
  lifeStage: LifeStage,
  min: LifeStage | null,
  max: LifeStage | null,
): boolean {
  const order = LIFE_STAGE_ORDER[lifeStage]
  if (min !== null && order < LIFE_STAGE_ORDER[min]) return false
  if (max !== null && order > LIFE_STAGE_ORDER[max]) return false
  return true
}
