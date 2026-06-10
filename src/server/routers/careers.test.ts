import { describe, expect } from 'vitest'
import { unauthCaller } from '@/test/caller'
import { test } from '@/test/test'
import { db } from '@/server/db'

describe('careers.getAll', () => {
  test('returns a non-empty array of careers', async ({ trpcCaller }) => {
    const result = await trpcCaller.careers.getAll()
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
  })

  test('excludes careers from packs the user does not own', async ({ trpcCaller }) => {
    const packLinkedCareer = await db.career.findFirst({
      where: { packId: { not: null } },
    })
    if (!packLinkedCareer) throw new Error('No pack-linked careers found. Is the DB seeded?')

    const result = await trpcCaller.careers.getAll()
    expect(result.map((c) => c.id)).not.toContain(packLinkedCareer.id)
  })

  test('includes careers from packs the user owns', async ({ trpcCaller, userId }) => {
    const packLinkedCareer = await db.career.findFirst({
      where: { packId: { not: null } },
    })
    if (!packLinkedCareer) throw new Error('No pack-linked careers found. Is the DB seeded?')

    await db.userPack.create({ data: { userId, packId: packLinkedCareer.packId! } })

    const result = await trpcCaller.careers.getAll()
    expect(result.map((c) => c.id)).toContain(packLinkedCareer.id)
  })

  test('throws UNAUTHORIZED without a session', async () => {
    const caller = unauthCaller()
    await expect(caller.careers.getAll()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })
})
