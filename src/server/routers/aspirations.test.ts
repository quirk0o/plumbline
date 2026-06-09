import { describe, it, expect } from 'vitest'
import { unauthCaller } from '@/test/caller'
import { withTestUser } from '@/test/fixtures'
import { db } from '@/server/db'

describe('aspirations.getAll', () => {
  const ctx = withTestUser()

  it('returns a non-empty array of aspirations', async () => {
    const result = await ctx.caller.aspirations.getAll()
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
  })

  it('excludes aspirations from packs the user does not own', async () => {
    const packLinkedAspiration = await db.aspiration.findFirst({
      where: { packId: { not: null } },
    })
    if (!packLinkedAspiration) throw new Error('No pack-linked aspirations found. Is the DB seeded?')

    const result = await ctx.caller.aspirations.getAll()
    expect(result.map((a) => a.id)).not.toContain(packLinkedAspiration.id)
  })

  it('includes aspirations from packs the user owns', async () => {
    const packLinkedAspiration = await db.aspiration.findFirst({
      where: { packId: { not: null } },
    })
    if (!packLinkedAspiration) throw new Error('No pack-linked aspirations found. Is the DB seeded?')

    await db.userPack.create({ data: { userId: ctx.userId, packId: packLinkedAspiration.packId! } })

    const result = await ctx.caller.aspirations.getAll()
    expect(result.map((a) => a.id)).toContain(packLinkedAspiration.id)
  })

  it('throws UNAUTHORIZED without a session', async () => {
    const caller = unauthCaller()
    await expect(caller.aspirations.getAll()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })
})
