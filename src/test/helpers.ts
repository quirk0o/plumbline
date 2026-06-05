import { db } from '@/server/db'
import { PackType, Gender, LifeStage, Prisma } from '@prisma/client'
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
  overrides: {
    firstName?: string
    lastName?: string
    gender?: Gender
    householdId?: string | null
    generationNumber?: number | null
  } = {},
) {
  return db.sim.create({
    data: {
      legacyId,
      householdId: overrides.householdId ?? null,
      generationNumber: overrides.generationNumber ?? null,
      firstName: overrides.firstName ?? 'Test',
      lastName: overrides.lastName ?? 'Sim',
      gender: overrides.gender ?? Gender.FEMALE,
      lifeStage: LifeStage.YOUNG_ADULT,
    },
  })
}

export async function createTestHousehold(
  legacyId: string,
  overrides: { name?: string; funds?: number; worldId?: string | null } = {},
) {
  return db.household.create({
    data: {
      legacyId,
      name: overrides.name ?? 'Test Household',
      funds: overrides.funds ?? 0,
      worldId: overrides.worldId ?? null,
    },
  })
}

export async function getAnyCareer() {
  const career = await db.career.findFirst()
  if (!career) throw new Error('No careers found. Is the DB seeded?')
  return career
}

export async function getAnySkill(where: { maxLevel?: number } = {}) {
  const skill = await db.skill.findFirst({ where })
  if (!skill) throw new Error('No skill found. Is the DB seeded?')
  return skill
}

export async function getAnyAspiration() {
  const aspiration = await db.aspiration.findFirst()
  if (!aspiration) throw new Error('No aspirations found. Is the DB seeded?')
  return aspiration
}

export async function getTrackerTypeByName(name: string) {
  const trackerType = await db.trackerType.findFirst({ where: { name } })
  if (!trackerType) throw new Error(`No tracker type named "${name}". Is the DB seeded?`)
  return trackerType
}

export async function getAnyBuiltInTrackerType(
  opts: { requireComputationSpec?: boolean } = {},
) {
  const where = opts.requireComputationSpec
    ? { isBuiltIn: true, computationSpec: { not: Prisma.AnyNull } }
    : { isBuiltIn: true }
  const trackerType = await db.trackerType.findFirst({ where })
  if (!trackerType) throw new Error('No built-in tracker type found. Is the DB seeded?')
  return trackerType
}

/** Game traits (the `trait` model used by tracker computation — distinct from `personalityTrait`). */
export async function getGameTraits(count = 1) {
  const traits = await db.trait.findMany({ take: count })
  if (traits.length < count)
    throw new Error(`Need ${count} game traits, found ${traits.length}. Is the DB seeded?`)
  return traits
}

export async function getPersonalityTraits(count: number) {
  const traits = await db.personalityTrait.findMany({ take: count })
  if (traits.length < count)
    throw new Error(`Need ${count} personality traits, found ${traits.length}. Is the DB seeded?`)
  return traits
}

export async function getSkills(count: number) {
  const skills = await db.skill.findMany({ take: count })
  if (skills.length < count)
    throw new Error(`Need ${count} skills, found ${skills.length}. Is the DB seeded?`)
  return skills
}

export async function getBaseGamePack() {
  const pack = await db.pack.findFirst({ where: { type: PackType.BASE_GAME } })
  if (!pack) throw new Error('No BASE_GAME pack found. Is the DB seeded?')
  return pack
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
