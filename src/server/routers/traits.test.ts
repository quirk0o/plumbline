import { describe, it, expect } from 'vitest'
import { unauthCaller } from '@/test/caller'
import { withTestUser } from '@/test/fixtures'
import { db } from '@/server/db'

describe('traits.getAll', () => {
  const ctx = withTestUser()

  it('returns a non-empty array of personality traits', async () => {
    const result = await ctx.caller.traits.getAll()
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
  })

  it('includes the conflictsWith relation on every trait', async () => {
    const result = await ctx.caller.traits.getAll()
    expect(result.length).toBeGreaterThan(0)
    for (const trait of result) {
      expect(Array.isArray(trait.conflictsWith)).toBe(true)
    }
  })

  it('throws UNAUTHORIZED without a session', async () => {
    const caller = unauthCaller()
    await expect(caller.traits.getAll()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('excludes traits from packs the user does not own', async () => {
    const packLinkedTrait = await db.personalityTrait.findFirst({
      where: { packId: { not: null } },
    })
    if (!packLinkedTrait) return

    const result = await ctx.caller.traits.getAll()
    expect(result.map((t) => t.id)).not.toContain(packLinkedTrait.id)
  })

  it('includes traits from packs the user owns', async () => {
    const packLinkedTrait = await db.personalityTrait.findFirst({
      where: { packId: { not: null } },
    })
    if (!packLinkedTrait) return

    await db.userPack.create({ data: { userId: ctx.userId, packId: packLinkedTrait.packId! } })

    const result = await ctx.caller.traits.getAll()
    expect(result.map((t) => t.id)).toContain(packLinkedTrait.id)
  })
})
