import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { authedCaller, unauthCaller } from '@/test/caller'
import { createTestUser, cleanupUser } from '@/test/helpers'
import { db } from '@/server/db'

describe('careers.getAll', () => {
  let userId: string

  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
  })

  afterEach(async () => {
    await cleanupUser(userId)
  })

  it('returns a non-empty array of careers', async () => {
    const caller = authedCaller(userId)
    const result = await caller.careers.getAll()
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
  })

  it('excludes careers from packs the user does not own', async () => {
    const packLinkedCareer = await db.career.findFirst({
      where: { packId: { not: null } },
    })
    if (!packLinkedCareer) throw new Error('No pack-linked careers found. Is the DB seeded?')

    const caller = authedCaller(userId)
    const result = await caller.careers.getAll()
    expect(result.map((c) => c.id)).not.toContain(packLinkedCareer.id)
  })

  it('includes careers from packs the user owns', async () => {
    const packLinkedCareer = await db.career.findFirst({
      where: { packId: { not: null } },
    })
    if (!packLinkedCareer) throw new Error('No pack-linked careers found. Is the DB seeded?')

    await db.userPack.create({ data: { userId, packId: packLinkedCareer.packId! } })

    const caller = authedCaller(userId)
    const result = await caller.careers.getAll()
    expect(result.map((c) => c.id)).toContain(packLinkedCareer.id)
  })

  it('throws UNAUTHORIZED without a session', async () => {
    const caller = unauthCaller()
    await expect(caller.careers.getAll()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })
})
