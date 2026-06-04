import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createTestUser, cleanupUser } from '@/test/helpers'
import { db } from '@/server/db'
import { fetchSkills } from './reference-data'

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
