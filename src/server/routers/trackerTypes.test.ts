import { describe, expect } from 'vitest'
import { unauthCaller } from '@/test/caller'
import { createTestUser, cleanupUser, getAnyBuiltInTrackerType } from '@/test/helpers'
import { test } from '@/test/fixtures'
import { db } from '@/server/db'

describe('trackerTypes.list', () => {
  test('returns built-in tracker types', async ({ trpcCaller }) => {
    const result = await trpcCaller.trackerTypes.list()
    expect(result.length).toBeGreaterThan(0)
    expect(result.some((t) => t.isBuiltIn)).toBe(true)
  })

  test('includes user-created types owned by the caller', async ({ trpcCaller, userId }) => {
    await db.trackerType.create({
      data: { name: `Custom-${Date.now()}`, valueKind: 'BOOLEAN', configSchema: {}, ownerId: userId, isBuiltIn: false, isPublic: false },
    })
    const result = await trpcCaller.trackerTypes.list()
    expect(result.some((t) => t.ownerId === userId)).toBe(true)
  })

  test('throws UNAUTHORIZED without a session', async () => {
    await expect(unauthCaller().trackerTypes.list()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })
})

describe('trackerTypes.create', () => {
  test('creates a manual BOOLEAN tracker type owned by the caller', async ({ trpcCaller, userId }) => {
    const result = await trpcCaller.trackerTypes.create({
      name: `My Custom Goal ${Date.now()}`,
      valueKind: 'BOOLEAN',
    })
    expect(result.ownerId).toBe(userId)
    expect(result.isBuiltIn).toBe(false)
    const record = await db.trackerType.findUnique({ where: { id: result.id } })
    expect(record).not.toBeNull()
  })

  test('creates a THRESHOLD type with goalSchema', async ({ trpcCaller }) => {
    const result = await trpcCaller.trackerTypes.create({
      name: `Wealth Tracker ${Date.now()}`,
      valueKind: 'THRESHOLD',
      goalSchema: { start: 100000, step: 100000, count: 10, unit: '§' },
    })
    expect(result.valueKind).toBe('THRESHOLD')
  })
})

describe('trackerTypes.delete', () => {
  test('deletes a tracker type owned by the caller', async ({ trpcCaller, userId }) => {
    const tt = await db.trackerType.create({
      data: { name: `Del-${Date.now()}`, valueKind: 'BOOLEAN', configSchema: {}, ownerId: userId, isBuiltIn: false, isPublic: false },
    })
    await trpcCaller.trackerTypes.delete({ id: tt.id })
    expect(await db.trackerType.findUnique({ where: { id: tt.id } })).toBeNull()
  })

  test('throws FORBIDDEN when deleting another user type', async ({ trpcCaller }) => {
    const other = await createTestUser()
    try {
      const tt = await db.trackerType.create({
        data: { name: `Other-${Date.now()}`, valueKind: 'BOOLEAN', configSchema: {}, ownerId: other.id, isBuiltIn: false, isPublic: false },
      })
      await expect(
        trpcCaller.trackerTypes.delete({ id: tt.id })
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    } finally {
      await cleanupUser(other.id)
    }
  })

  test('throws FORBIDDEN when deleting a built-in type', async ({ trpcCaller }) => {
    const builtIn = await getAnyBuiltInTrackerType()
    await expect(
      trpcCaller.trackerTypes.delete({ id: builtIn.id })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  test('returns BAD_REQUEST when tracker type is referenced by a TrackerDefinition', async ({ trpcCaller, userId }) => {
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
      trpcCaller.trackerTypes.delete({ id: tt.id })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })
})
