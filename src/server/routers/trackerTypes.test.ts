import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { authedCaller, unauthCaller } from '@/test/caller'
import { createTestUser, cleanupUser } from '@/test/helpers'
import { db } from '@/server/db'

describe('trackerTypes.list', () => {
  let userId: string

  beforeEach(async () => { ({ id: userId } = await createTestUser()) })
  afterEach(async () => { await cleanupUser(userId) })

  it('returns built-in tracker types', async () => {
    const result = await authedCaller(userId).trackerTypes.list()
    expect(result.length).toBeGreaterThan(0)
    expect(result.some((t) => t.isBuiltIn)).toBe(true)
  })

  it('includes user-created types owned by the caller', async () => {
    await db.trackerType.create({
      data: { name: `Custom-${Date.now()}`, valueKind: 'BOOLEAN', configSchema: {}, ownerId: userId, isBuiltIn: false, isPublic: false },
    })
    const result = await authedCaller(userId).trackerTypes.list()
    expect(result.some((t) => t.ownerId === userId)).toBe(true)
  })

  it('throws UNAUTHORIZED without a session', async () => {
    await expect(unauthCaller().trackerTypes.list()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })
})

describe('trackerTypes.create', () => {
  let userId: string

  beforeEach(async () => { ({ id: userId } = await createTestUser()) })
  afterEach(async () => { await cleanupUser(userId) })

  it('creates a manual BOOLEAN tracker type owned by the caller', async () => {
    const result = await authedCaller(userId).trackerTypes.create({
      name: `My Custom Goal ${Date.now()}`,
      valueKind: 'BOOLEAN',
    })
    expect(result.ownerId).toBe(userId)
    expect(result.isBuiltIn).toBe(false)
    const record = await db.trackerType.findUnique({ where: { id: result.id } })
    expect(record).not.toBeNull()
  })

  it('creates a THRESHOLD type with goalSchema', async () => {
    const result = await authedCaller(userId).trackerTypes.create({
      name: `Wealth Tracker ${Date.now()}`,
      valueKind: 'THRESHOLD',
      goalSchema: { start: 100000, step: 100000, count: 10, unit: '§' },
    })
    expect(result.valueKind).toBe('THRESHOLD')
  })
})

describe('trackerTypes.delete', () => {
  let userId: string

  beforeEach(async () => { ({ id: userId } = await createTestUser()) })
  afterEach(async () => { await cleanupUser(userId) })

  it('deletes a tracker type owned by the caller', async () => {
    const tt = await db.trackerType.create({
      data: { name: `Del-${Date.now()}`, valueKind: 'BOOLEAN', configSchema: {}, ownerId: userId, isBuiltIn: false, isPublic: false },
    })
    await authedCaller(userId).trackerTypes.delete({ id: tt.id })
    expect(await db.trackerType.findUnique({ where: { id: tt.id } })).toBeNull()
  })

  it('throws FORBIDDEN when deleting another user type', async () => {
    const other = await createTestUser()
    try {
      const tt = await db.trackerType.create({
        data: { name: `Other-${Date.now()}`, valueKind: 'BOOLEAN', configSchema: {}, ownerId: other.id, isBuiltIn: false, isPublic: false },
      })
      await expect(
        authedCaller(userId).trackerTypes.delete({ id: tt.id })
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    } finally {
      await cleanupUser(other.id)
    }
  })

  it('throws FORBIDDEN when deleting a built-in type', async () => {
    const builtIn = await db.trackerType.findFirst({ where: { isBuiltIn: true } })
    if (!builtIn) return
    await expect(
      authedCaller(userId).trackerTypes.delete({ id: builtIn.id })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('returns BAD_REQUEST when tracker type is referenced by a TrackerDefinition', async () => {
    const tt = await db.trackerType.create({
      data: { name: `InUse-${Date.now()}`, valueKind: 'BOOLEAN', configSchema: {}, ownerId: userId, isBuiltIn: false, isPublic: false },
    })
    const challenge = await db.challenge.create({
      data: { name: `Challenge-${Date.now()}`, isPublic: false, ownerId: userId },
    })
    const phase = await db.challengePhase.create({
      data: { challengeId: challenge.id, title: 'Phase 1', sortOrder: 0 },
    })
    await db.trackerDefinition.create({
      data: { challengePhaseId: phase.id, trackerTypeId: tt.id, name: 'Ref Tracker', config: {} },
    })
    await expect(
      authedCaller(userId).trackerTypes.delete({ id: tt.id })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })
})
