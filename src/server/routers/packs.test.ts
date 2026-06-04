import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PackType } from '@prisma/client'
import { authedCaller, unauthCaller } from '@/test/caller'
import { createTestUser, cleanupUser, getAnyPack, getBaseGamePack } from '@/test/helpers'
import { db } from '@/server/db'

describe('packs.getAll', () => {
  let userId: string

  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
  })

  afterEach(async () => {
    await cleanupUser(userId)
  })

  it('returns pack groups excluding BASE_GAME packs', async () => {
    const caller = authedCaller(userId)
    const result = await caller.packs.getAll()
    expect(Array.isArray(result)).toBe(true)
    for (const group of result) {
      expect(group.type).not.toBe(PackType.BASE_GAME)
    }
  })

  it('marks owned packs with isOwned true', async () => {
    const pack = await getAnyPack()
    await db.userPack.create({ data: { userId, packId: pack.id } })
    const caller = authedCaller(userId)
    const result = await caller.packs.getAll()
    const allPacks = result.flatMap(g => g.packs)
    const ownedPack = allPacks.find(p => p.id === pack.id)
    expect(ownedPack?.isOwned).toBe(true)
  })

  it('marks unowned packs with isOwned false', async () => {
    const caller = authedCaller(userId)
    const result = await caller.packs.getAll()
    const allPacks = result.flatMap(g => g.packs)
    expect(allPacks.every(p => !p.isOwned)).toBe(true)
  })

  it('throws UNAUTHORIZED without a session', async () => {
    const caller = unauthCaller()
    await expect(caller.packs.getAll()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })
})

describe('packs.toggle', () => {
  let userId: string

  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
  })

  afterEach(async () => {
    await cleanupUser(userId)
  })

  it('creates UserPack and returns isOwned true on first toggle', async () => {
    const pack = await getAnyPack()
    const caller = authedCaller(userId)
    const result = await caller.packs.toggle({ packId: pack.id })
    expect(result).toEqual({ isOwned: true })
    const record = await db.userPack.findUnique({
      where: { userId_packId: { userId, packId: pack.id } },
    })
    expect(record).not.toBeNull()
  })

  it('deletes UserPack and returns isOwned false on second toggle', async () => {
    const pack = await getAnyPack()
    const caller = authedCaller(userId)
    await caller.packs.toggle({ packId: pack.id })
    const result = await caller.packs.toggle({ packId: pack.id })
    expect(result).toEqual({ isOwned: false })
    const record = await db.userPack.findUnique({
      where: { userId_packId: { userId, packId: pack.id } },
    })
    expect(record).toBeNull()
  })

  it('throws NOT_FOUND for a BASE_GAME pack', async () => {
    const basePack = await getBaseGamePack()
    const caller = authedCaller(userId)
    await expect(caller.packs.toggle({ packId: basePack.id })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('throws NOT_FOUND for a non-existent packId', async () => {
    const caller = authedCaller(userId)
    await expect(
      caller.packs.toggle({ packId: 'clnonexistentpackid000000' })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('throws UNAUTHORIZED without a session', async () => {
    const pack = await getAnyPack()
    const caller = unauthCaller()
    await expect(caller.packs.toggle({ packId: pack.id })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    })
  })

  it('throws a validation error for a non-CUID packId', async () => {
    const caller = authedCaller(userId)
    await expect(caller.packs.toggle({ packId: 'not-a-cuid' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    })
  })
})
