import { describe, it, expect } from 'vitest'
import { unauthCaller } from '@/test/caller'
import { withTestUser } from '@/test/fixtures'
import { db } from '@/server/db'

describe('careers.getAll', () => {
  const ctx = withTestUser()

  it('returns a non-empty array of careers', async () => {
    const result = await ctx.caller.careers.getAll()
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
  })

  it('excludes careers from packs the user does not own', async () => {
    const packLinkedCareer = await db.career.findFirst({
      where: { packId: { not: null } },
    })
    if (!packLinkedCareer) throw new Error('No pack-linked careers found. Is the DB seeded?')

    const result = await ctx.caller.careers.getAll()
    expect(result.map((c) => c.id)).not.toContain(packLinkedCareer.id)
  })

  it('includes careers from packs the user owns', async () => {
    const packLinkedCareer = await db.career.findFirst({
      where: { packId: { not: null } },
    })
    if (!packLinkedCareer) throw new Error('No pack-linked careers found. Is the DB seeded?')

    await db.userPack.create({ data: { userId: ctx.userId, packId: packLinkedCareer.packId! } })

    const result = await ctx.caller.careers.getAll()
    expect(result.map((c) => c.id)).toContain(packLinkedCareer.id)
  })

  it('throws UNAUTHORIZED without a session', async () => {
    const caller = unauthCaller()
    await expect(caller.careers.getAll()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })
})
