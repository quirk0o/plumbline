import { db } from '@/server/db'
import { PackType } from '@prisma/client'
import { randomUUID } from 'crypto'

export async function createTestUser(overrides: { name?: string; email?: string } = {}) {
  return db.user.create({
    data: {
      email: overrides.email ?? `test-${randomUUID()}@simtrack-test.invalid`,
      name: overrides.name ?? 'Test User',
    },
  })
}

export async function cleanupUser(userId: string) {
  await db.user.deleteMany({ where: { id: userId } })
}

export async function getAnyPack(type?: PackType) {
  const where = type ? { type } : { type: { not: PackType.BASE_GAME } }
  const pack = await db.pack.findFirst({ where })
  if (!pack) throw new Error(`No pack found${type ? ` of type ${type}` : ''}. Is the DB seeded?`)
  return pack
}

export async function getAnyTrait() {
  const trait = await db.personalityTrait.findFirst()
  if (!trait) throw new Error('No personality traits found. Is the DB seeded?')
  return trait
}

export async function getConflictingTraits() {
  const conflict = await db.personalityTraitConflict.findFirst({
    include: { traitA: true, traitB: true },
  })
  if (!conflict) throw new Error('No trait conflicts found. Is the DB seeded?')
  return { traitA: conflict.traitA, traitB: conflict.traitB }
}

export async function createTestLegacy(
  userId: string,
  overrides: { name?: string; slug?: string } = {},
) {
  return db.legacy.create({
    data: {
      userId,
      name: overrides.name ?? 'Test Legacy',
      slug: overrides.slug ?? `test-legacy-${randomUUID()}`,
    },
  })
}

export async function createTestSim(
  legacyId: string,
  overrides: { firstName?: string; lastName?: string; gender?: import('@prisma/client').Gender } = {},
) {
  const { Gender, LifeStage } = await import('@prisma/client')
  let household = await db.household.findFirst({ where: { legacyId } })
  if (!household) {
    household = await db.household.create({ data: { name: 'Household 1', legacyId } })
  }
  return db.sim.create({
    data: {
      legacyId,
      householdId: household.id,
      firstName: overrides.firstName ?? 'Test',
      lastName: overrides.lastName ?? 'Sim',
      gender: overrides.gender ?? Gender.FEMALE,
      lifeStage: LifeStage.YOUNG_ADULT,
    },
  })
}

export async function getAnyCareer() {
  const career = await db.career.findFirst()
  if (!career) throw new Error('No careers found. Is the DB seeded?')
  return career
}
