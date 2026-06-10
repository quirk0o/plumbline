import { describe, expect } from 'vitest'
import { PackType } from '@prisma/client'
import { unauthCaller } from '@/test/caller'
import { getAnyPack, getBaseGamePack } from '@/test/helpers'
import { test } from '@/test/test'
import { db } from '@/server/db'

describe('packs.getAll', () => {
  test('returns pack groups excluding BASE_GAME packs', async ({ trpcCaller }) => {
    const result = await trpcCaller.packs.getAll()
    expect(Array.isArray(result)).toBe(true)
    for (const group of result) {
      expect(group.type).not.toBe(PackType.BASE_GAME)
    }
  })

  test('marks owned packs with isOwned true', async ({ trpcCaller, userId }) => {
    const pack = await getAnyPack()
    await db.userPack.create({ data: { userId, packId: pack.id } })
    const result = await trpcCaller.packs.getAll()
    const allPacks = result.flatMap(g => g.packs)
    const ownedPack = allPacks.find(p => p.id === pack.id)
    expect(ownedPack?.isOwned).toBe(true)
  })

  test('marks unowned packs with isOwned false', async ({ trpcCaller }) => {
    const result = await trpcCaller.packs.getAll()
    const allPacks = result.flatMap(g => g.packs)
    expect(allPacks.every(p => !p.isOwned)).toBe(true)
  })

  test('throws UNAUTHORIZED without a session', async () => {
    const caller = unauthCaller()
    await expect(caller.packs.getAll()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })
})

describe('packs.toggle', () => {
  test('creates UserPack and returns isOwned true on first toggle', async ({ trpcCaller, userId }) => {
    const pack = await getAnyPack()
    const result = await trpcCaller.packs.toggle({ packId: pack.id })
    expect(result).toEqual({ isOwned: true })
    const record = await db.userPack.findUnique({
      where: { userId_packId: { userId, packId: pack.id } },
    })
    expect(record).not.toBeNull()
  })

  test('deletes UserPack and returns isOwned false on second toggle', async ({ trpcCaller, userId }) => {
    const pack = await getAnyPack()
    await trpcCaller.packs.toggle({ packId: pack.id })
    const result = await trpcCaller.packs.toggle({ packId: pack.id })
    expect(result).toEqual({ isOwned: false })
    const record = await db.userPack.findUnique({
      where: { userId_packId: { userId, packId: pack.id } },
    })
    expect(record).toBeNull()
  })

  test('throws NOT_FOUND for a BASE_GAME pack', async ({ trpcCaller }) => {
    const basePack = await getBaseGamePack()
    await expect(trpcCaller.packs.toggle({ packId: basePack.id })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  test('throws NOT_FOUND for a non-existent packId', async ({ trpcCaller }) => {
    await expect(
      trpcCaller.packs.toggle({ packId: 'clnonexistentpackid000000' })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  test('throws UNAUTHORIZED without a session', async () => {
    const pack = await getAnyPack()
    const caller = unauthCaller()
    await expect(caller.packs.toggle({ packId: pack.id })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    })
  })

  test('throws a validation error for a non-CUID packId', async ({ trpcCaller }) => {
    await expect(trpcCaller.packs.toggle({ packId: 'not-a-cuid' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    })
  })
})
