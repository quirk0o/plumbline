import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TRPCError } from '@trpc/server'
import { PackType } from '@prisma/client'

// Must mock BEFORE importing anything that pulls in trpc.ts or db.ts
vi.mock('@/server/db', () => ({ db: {} }))
vi.mock('../../../../auth', () => ({ auth: vi.fn() }))

import { createCallerFactory } from '../../trpc'
import { packsRouter } from '../packs'

const VALID_CUID = 'clg9hfpd10000356memz2yjqq'

const mockDb = {
  pack: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  userPack: {
    findUnique: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
}

const authedCtx = {
  session: { user: { id: 'user-1', name: 'Test User', email: 'test@example.com' } },
  db: mockDb as any,
}

const createCaller = createCallerFactory(packsRouter)

beforeEach(() => vi.clearAllMocks())

// ------- getAll -------

describe('packs.getAll', () => {
  it('returns grouped packs for the authenticated user', async () => {
    mockDb.pack.findMany.mockResolvedValue([
      {
        id: VALID_CUID, name: 'City Living', type: PackType.EXPANSION,
        icon: null, imageUrl: null, userPacks: [],
        createdAt: new Date(), updatedAt: new Date(),
      },
    ])
    const caller = createCaller(authedCtx as any)
    const result = await caller.getAll()
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe(PackType.EXPANSION)
    expect(result[0].packs[0].name).toBe('City Living')
    expect(result[0].packs[0].isOwned).toBe(false)
  })

  it('throws UNAUTHORIZED when there is no session', async () => {
    const caller = createCaller({ session: null, db: mockDb as any } as any)
    await expect(caller.getAll()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })
})

// ------- toggle -------

describe('packs.toggle', () => {
  it('removes ownership and returns { isOwned: false } when pack is already owned', async () => {
    mockDb.userPack.findUnique.mockResolvedValue({ userId: 'user-1', packId: VALID_CUID })
    mockDb.userPack.deleteMany.mockResolvedValue({ count: 1 })
    const caller = createCaller(authedCtx as any)
    const result = await caller.toggle({ packId: VALID_CUID })
    expect(result).toEqual({ isOwned: false })
    expect(mockDb.userPack.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', packId: VALID_CUID },
    })
  })

  it('adds ownership and returns { isOwned: true } when pack is not owned', async () => {
    mockDb.userPack.findUnique.mockResolvedValue(null)
    mockDb.pack.findUnique.mockResolvedValue({ id: VALID_CUID, type: PackType.EXPANSION })
    mockDb.userPack.create.mockResolvedValue({ userId: 'user-1', packId: VALID_CUID })
    const caller = createCaller(authedCtx as any)
    const result = await caller.toggle({ packId: VALID_CUID })
    expect(result).toEqual({ isOwned: true })
    expect(mockDb.userPack.create).toHaveBeenCalledWith({
      data: { userId: 'user-1', packId: VALID_CUID },
    })
  })

  it('throws NOT_FOUND when trying to toggle a BASE_GAME pack', async () => {
    mockDb.userPack.findUnique.mockResolvedValue(null)
    mockDb.pack.findUnique.mockResolvedValue({ id: VALID_CUID, type: PackType.BASE_GAME })
    const caller = createCaller(authedCtx as any)
    await expect(caller.toggle({ packId: VALID_CUID })).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Pack not found',
    })
  })

  it('throws NOT_FOUND when pack does not exist in the database', async () => {
    mockDb.userPack.findUnique.mockResolvedValue(null)
    mockDb.pack.findUnique.mockResolvedValue(null)
    const caller = createCaller(authedCtx as any)
    await expect(caller.toggle({ packId: VALID_CUID })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('throws UNAUTHORIZED when there is no session', async () => {
    const caller = createCaller({ session: null, db: mockDb as any } as any)
    await expect(caller.toggle({ packId: VALID_CUID })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    })
  })
})
