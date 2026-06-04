import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { authedCaller, unauthCaller } from '@/test/caller'
import { createTestUser, cleanupUser } from '@/test/helpers'
import { db } from '@/server/db'

describe('aspirations.getAll', () => {
  let userId: string

  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
  })

  afterEach(async () => {
    await cleanupUser(userId)
  })

  it('returns a non-empty array of aspirations', async () => {
    const caller = authedCaller(userId)
    const result = await caller.aspirations.getAll()
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
  })

  it('excludes aspirations from packs the user does not own', async () => {
    const packLinkedAspiration = await db.aspiration.findFirst({
      where: { packId: { not: null } },
    })
    if (!packLinkedAspiration) throw new Error('No pack-linked aspirations found. Is the DB seeded?')

    const caller = authedCaller(userId)
    const result = await caller.aspirations.getAll()
    expect(result.map((a) => a.id)).not.toContain(packLinkedAspiration.id)
  })

  it('includes aspirations from packs the user owns', async () => {
    const packLinkedAspiration = await db.aspiration.findFirst({
      where: { packId: { not: null } },
    })
    if (!packLinkedAspiration) throw new Error('No pack-linked aspirations found. Is the DB seeded?')

    await db.userPack.create({ data: { userId, packId: packLinkedAspiration.packId! } })

    const caller = authedCaller(userId)
    const result = await caller.aspirations.getAll()
    expect(result.map((a) => a.id)).toContain(packLinkedAspiration.id)
  })

  it('throws UNAUTHORIZED without a session', async () => {
    const caller = unauthCaller()
    await expect(caller.aspirations.getAll()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })
})
