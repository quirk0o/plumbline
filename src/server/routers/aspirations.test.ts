import { describe, expect } from 'vitest'
import { unauthCaller } from '@/test/caller'
import { test } from '@/test/test'
import { db } from '@/server/db'

describe('aspirations.getAll', () => {
  test('returns a non-empty array of aspirations', async ({ trpcCaller }) => {
    const result = await trpcCaller.aspirations.getAll()
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
  })

  test('excludes aspirations from packs the user does not own', async ({ trpcCaller }) => {
    const packLinkedAspiration = await db.aspiration.findFirst({
      where: { packId: { not: null } },
    })
    if (!packLinkedAspiration) throw new Error('No pack-linked aspirations found. Is the DB seeded?')

    const result = await trpcCaller.aspirations.getAll()
    expect(result.map((a) => a.id)).not.toContain(packLinkedAspiration.id)
  })

  test('includes aspirations from packs the user owns', async ({ trpcCaller, userId }) => {
    const packLinkedAspiration = await db.aspiration.findFirst({
      where: { packId: { not: null } },
    })
    if (!packLinkedAspiration) throw new Error('No pack-linked aspirations found. Is the DB seeded?')

    await db.userPack.create({ data: { userId, packId: packLinkedAspiration.packId! } })

    const result = await trpcCaller.aspirations.getAll()
    expect(result.map((a) => a.id)).toContain(packLinkedAspiration.id)
  })

  test('throws UNAUTHORIZED without a session', async () => {
    const caller = unauthCaller()
    await expect(caller.aspirations.getAll()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })
})
