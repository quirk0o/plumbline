import { describe, expect } from 'vitest'
import { unauthCaller } from '@/test/caller'
import { test } from '@/test/test'
import { db } from '@/server/db'

describe('traits.getAll', () => {
  test('returns a non-empty array of personality traits', async ({ trpcCaller }) => {
    const result = await trpcCaller.traits.getAll()
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
  })

  test('includes the conflictsWith relation on every trait', async ({ trpcCaller }) => {
    const result = await trpcCaller.traits.getAll()
    expect(result.length).toBeGreaterThan(0)
    for (const trait of result) {
      expect(Array.isArray(trait.conflictsWith)).toBe(true)
    }
  })

  test('throws UNAUTHORIZED without a session', async () => {
    const caller = unauthCaller()
    await expect(caller.traits.getAll()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  test('excludes traits from packs the user does not own', async ({ trpcCaller }) => {
    const packLinkedTrait = await db.personalityTrait.findFirst({
      where: { packId: { not: null } },
    })
    if (!packLinkedTrait) return

    const result = await trpcCaller.traits.getAll()
    expect(result.map((t) => t.id)).not.toContain(packLinkedTrait.id)
  })

  test('includes traits from packs the user owns', async ({ trpcCaller, userId }) => {
    const packLinkedTrait = await db.personalityTrait.findFirst({
      where: { packId: { not: null } },
    })
    if (!packLinkedTrait) return

    await db.userPack.create({ data: { userId, packId: packLinkedTrait.packId! } })

    const result = await trpcCaller.traits.getAll()
    expect(result.map((t) => t.id)).toContain(packLinkedTrait.id)
  })
})
