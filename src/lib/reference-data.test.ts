import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createTestUser, cleanupUser } from '@/test/helpers'
import { db } from '@/server/db'
import { fetchSkills, fetchTraitsWithConflicts, fetchAspirations, fetchCareers } from './reference-data'

describe('fetchSkills', () => {
  let userId: string

  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
  })

  afterEach(async () => {
    await cleanupUser(userId)
  })

  it('excludes skills from packs the user does not own', async () => {
    const packLinkedSkill = await db.skill.findFirst({ where: { packId: { not: null } } })
    if (!packLinkedSkill) throw new Error('No pack-linked skills found. Is the DB seeded?')

    const result = await fetchSkills(userId)
    expect(result.map((s) => s.id)).not.toContain(packLinkedSkill.id)
  })

  it('includes skills from packs the user owns', async () => {
    const packLinkedSkill = await db.skill.findFirst({ where: { packId: { not: null } } })
    if (!packLinkedSkill) throw new Error('No pack-linked skills found. Is the DB seeded?')

    await db.userPack.create({ data: { userId, packId: packLinkedSkill.packId! } })

    const result = await fetchSkills(userId)
    expect(result.map((s) => s.id)).toContain(packLinkedSkill.id)
  })
})

describe('fetchTraitsWithConflicts', () => {
  let userId: string

  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
  })

  afterEach(async () => {
    await cleanupUser(userId)
  })

  it('excludes personality traits from packs the user does not own', async () => {
    const packLinkedTrait = await db.personalityTrait.findFirst({ where: { packId: { not: null } } })
    if (!packLinkedTrait) throw new Error('No pack-linked personality traits found. Is the DB seeded?')

    const result = await fetchTraitsWithConflicts(userId)
    expect(result.map((t) => t.id)).not.toContain(packLinkedTrait.id)
  })

  it('includes personality traits from packs the user owns', async () => {
    const packLinkedTrait = await db.personalityTrait.findFirst({ where: { packId: { not: null } } })
    if (!packLinkedTrait) throw new Error('No pack-linked personality traits found. Is the DB seeded?')

    await db.userPack.create({ data: { userId, packId: packLinkedTrait.packId! } })

    const result = await fetchTraitsWithConflicts(userId)
    expect(result.map((t) => t.id)).toContain(packLinkedTrait.id)
  })

  it('returns minLifeStage and maxLifeStage for each trait', async () => {
    const result = await fetchTraitsWithConflicts(userId)
    expect(result.length).toBeGreaterThan(0)
    for (const t of result) {
      expect(t).toHaveProperty('minLifeStage')
      expect(t).toHaveProperty('maxLifeStage')
    }
  })
})

describe('fetchAspirations', () => {
  let userId: string

  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
  })

  afterEach(async () => {
    await cleanupUser(userId)
  })

  it('excludes aspirations from packs the user does not own', async () => {
    const packLinkedAspiration = await db.aspiration.findFirst({ where: { packId: { not: null } } })
    if (!packLinkedAspiration) throw new Error('No pack-linked aspirations found. Is the DB seeded?')

    const result = await fetchAspirations(userId)
    expect(result.map((a) => a.id)).not.toContain(packLinkedAspiration.id)
  })

  it('includes aspirations from packs the user owns', async () => {
    const packLinkedAspiration = await db.aspiration.findFirst({ where: { packId: { not: null } } })
    if (!packLinkedAspiration) throw new Error('No pack-linked aspirations found. Is the DB seeded?')

    await db.userPack.create({ data: { userId, packId: packLinkedAspiration.packId! } })

    const result = await fetchAspirations(userId)
    expect(result.map((a) => a.id)).toContain(packLinkedAspiration.id)
  })

  it('returns minLifeStage and maxLifeStage for each aspiration', async () => {
    const result = await fetchAspirations(userId)
    expect(result.length).toBeGreaterThan(0)
    for (const a of result) {
      expect(a).toHaveProperty('minLifeStage')
      expect(a).toHaveProperty('maxLifeStage')
    }
  })
})

describe('fetchCareers', () => {
  let userId: string

  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
  })

  afterEach(async () => {
    await cleanupUser(userId)
  })

  it('excludes careers from packs the user does not own', async () => {
    const packLinkedCareer = await db.career.findFirst({ where: { packId: { not: null } } })
    if (!packLinkedCareer) throw new Error('No pack-linked careers found. Is the DB seeded?')

    const result = await fetchCareers(userId)
    expect(result.map((c) => c.id)).not.toContain(packLinkedCareer.id)
  })

  it('includes careers from packs the user owns', async () => {
    const packLinkedCareer = await db.career.findFirst({ where: { packId: { not: null } } })
    if (!packLinkedCareer) throw new Error('No pack-linked careers found. Is the DB seeded?')

    await db.userPack.create({ data: { userId, packId: packLinkedCareer.packId! } })

    const result = await fetchCareers(userId)
    expect(result.map((c) => c.id)).toContain(packLinkedCareer.id)
  })
})
