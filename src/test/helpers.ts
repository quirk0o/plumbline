import { db } from '@/server/db'
import { PackType, Gender, LifeStage } from '@prisma/client'
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
  overrides: { firstName?: string; lastName?: string; gender?: Gender } = {},
) {
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

export async function createTestTrackerType(
  overrides: { name?: string; valueKind?: 'BOOLEAN' | 'NUMERICAL' | 'THRESHOLD'; ownerId?: string } = {},
) {
  return db.trackerType.create({
    data: {
      name: overrides.name ?? `Test Tracker ${randomUUID()}`,
      valueKind: overrides.valueKind ?? 'BOOLEAN',
      configSchema: {},
      isBuiltIn: false,
      isPublic: false,
      ownerId: overrides.ownerId ?? null,
    },
  })
}

export async function createTestChallenge(
  ownerId: string,
  overrides: { name?: string; isPublic?: boolean } = {},
) {
  return db.challenge.create({
    data: {
      name: overrides.name ?? `Test Challenge ${randomUUID()}`,
      isPublic: overrides.isPublic ?? false,
      ownerId,
    },
  })
}

export async function createTestChallengePhase(
  challengeId: string,
  overrides: { generationNumber?: number | null; title?: string } = {},
) {
  return db.challengePhase.create({
    data: {
      challengeId,
      generationNumber: overrides.generationNumber ?? null,
      title: overrides.title ?? 'Phase 1',
      sortOrder: 0,
    },
  })
}

export async function createTestChallengeRun(
  legacyId: string,
  overrides: { name?: string; sourceChallengeId?: string } = {},
) {
  return db.challengeRun.create({
    data: {
      legacyId,
      name: overrides.name ?? `Test Run ${randomUUID()}`,
      sourceChallengeId: overrides.sourceChallengeId ?? null,
    },
  })
}
