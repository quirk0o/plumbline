import { describe, it, expect, vi } from 'vitest'
import { createCallerFactory } from '../trpc'
import { legaciesRouter } from './legacies'
import { Gender } from '@prisma/client'
import type { Session } from 'next-auth'
import type { db as dbType } from '@/server/db'

const createCaller = createCallerFactory(legaciesRouter)

function makeDb(overrides: Record<string, unknown> = {}) {
  const tx = {
    legacy: {
      create: vi.fn().mockImplementation((args) => ({
        id: 'legacy-1',
        slug: args.data.slug,
        name: args.data.name,
        ...args.data,
      })),
      update: vi.fn().mockResolvedValue({}),
    },
    sim: {
      create: vi.fn().mockResolvedValue({ id: 'sim-1' }),
    },
    personalityTraitConflict: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
  }
  return {
    legacy: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    personalityTraitConflict: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    $transaction: vi.fn().mockImplementation(async (fn) => fn(tx)),
    _tx: tx,
    ...overrides,
  }
}

function makeCtx(dbOverrides = {}) {
  return {
    session: {
      user: { id: 'user-1', email: 'test@example.com', name: null, image: null },
      expires: new Date().toISOString(),
    } as Session & { user: { id: string } },
    db: makeDb(dbOverrides) as unknown as typeof dbType,
  }
}

describe('legacies.create', () => {
  it('creates a legacy with a derived slug', async () => {
    const ctx = makeCtx()
    const caller = createCaller(ctx)
    const result = await caller.create({ name: 'The Caliente Legacy' })
    expect(result.legacy.slug).toBe('the-caliente-legacy')
  })

  it('appends -2 suffix when slug is taken', async () => {
    const db = makeDb()
    ;(db.legacy.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { slug: 'my-legacy' },
    ])
    const caller = createCaller({ ...makeCtx(), db: db as unknown as typeof dbType })
    const result = await caller.create({ name: 'My Legacy' })
    expect(result.legacy.slug).toBe('my-legacy-2')
  })

  it('creates a sim when founder is provided', async () => {
    const ctx = makeCtx()
    const caller = createCaller(ctx)
    await caller.create({
      name: 'Test Legacy',
      founder: { firstName: 'Nina', lastName: 'Caliente', gender: Gender.FEMALE },
    })
    expect((ctx.db as unknown as ReturnType<typeof makeDb>)._tx.sim.create).toHaveBeenCalled()
  })

  it('does not create a sim when founder is omitted', async () => {
    const ctx = makeCtx()
    const caller = createCaller(ctx)
    await caller.create({ name: 'No Founder Legacy' })
    expect((ctx.db as unknown as ReturnType<typeof makeDb>)._tx.sim.create).not.toHaveBeenCalled()
  })

  it('throws BAD_REQUEST when selected traits conflict', async () => {
    const db = makeDb()
    ;(db.personalityTraitConflict.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      traitAId: 'trait-neat',
      traitBId: 'trait-slob',
    })
    const caller = createCaller({ ...makeCtx(), db: db as unknown as typeof dbType })
    await expect(
      caller.create({
        name: 'Bad Legacy',
        founder: {
          firstName: 'A',
          lastName: 'B',
          gender: Gender.FEMALE,
          personalityTraitIds: ['trait-neat', 'trait-slob'],
        },
      })
    ).rejects.toThrow('Selected traits conflict')
  })
})

describe('legacies.getAll', () => {
  it('returns legacies for the current user', async () => {
    const db = makeDb()
    ;(db.legacy.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'l1', name: 'My Legacy', slug: 'my-legacy', founderSim: null, _count: { households: 0 } },
    ])
    const caller = createCaller({ ...makeCtx(), db: db as unknown as typeof dbType })
    const result = await caller.getAll()
    expect(result).toHaveLength(1)
    expect(result[0].slug).toBe('my-legacy')
  })
})
