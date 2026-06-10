import { describe, expect } from 'vitest'
import { TRPCError } from '@trpc/server'
import { authedCaller } from '@/test/caller'
import { createTestUser, cleanupUser, createTestLegacy, createTestSim } from '@/test/helpers'
import { test } from '@/test/fixtures'
import { db } from '@/server/db'

describe('milestones.reorder', () => {
  test('sets sortOrder to the midpoint between two neighbors', async ({ trpcCaller, legacyId }) => {
    const m = await trpcCaller.milestones.create({ legacyId, title: 'M', simIds: [] })
    const res = await trpcCaller.milestones.reorder({ id: m.id, prevSortOrder: 1000, nextSortOrder: 2000 })
    expect(res.sortOrder).toBe(1500)
  })

  test('places above-all when only nextSortOrder is given', async ({ trpcCaller, legacyId }) => {
    const m = await trpcCaller.milestones.create({ legacyId, title: 'M', simIds: [] })
    const res = await trpcCaller.milestones.reorder({ id: m.id, nextSortOrder: 2000 })
    expect(res.sortOrder).toBe(3000)
  })

  test('places below-all when only prevSortOrder is given', async ({ trpcCaller, legacyId }) => {
    const m = await trpcCaller.milestones.create({ legacyId, title: 'M', simIds: [] })
    const res = await trpcCaller.milestones.reorder({ id: m.id, prevSortOrder: 2000 })
    expect(res.sortOrder).toBe(1000)
  })

  test('rejects when neither neighbor is provided', async ({ trpcCaller, legacyId }) => {
    const m = await trpcCaller.milestones.create({ legacyId, title: 'M', simIds: [] })
    await expect(trpcCaller.milestones.reorder({ id: m.id })).rejects.toBeInstanceOf(TRPCError)
  })

  test("rejects reordering another user's milestone", async ({ trpcCaller, legacyId }) => {
    const created = await trpcCaller.milestones.create({ legacyId, title: 'Mine', simIds: [] })
    const otherUser = await createTestUser()
    await expect(
      authedCaller(otherUser.id).milestones.reorder({ id: created.id, nextSortOrder: 500 }),
    ).rejects.toBeInstanceOf(TRPCError)
    await cleanupUser(otherUser.id)
  })
})

describe('milestones.delete', () => {
  test('deletes the milestone and cascades its tag rows', async ({ trpcCaller, legacyId }) => {
    const sim = await createTestSim(legacyId)
    const created = await trpcCaller.milestones.create({ legacyId, title: 'Bye', simIds: [sim.id] })

    const res = await trpcCaller.milestones.delete({ id: created.id })
    expect(res.id).toBe(created.id)
    expect(await db.milestone.findUnique({ where: { id: created.id } })).toBeNull()
    expect(await db.milestoneSim.count({ where: { milestoneId: created.id } })).toBe(0)
  })

  test("rejects deleting another user's milestone", async ({ trpcCaller, legacyId }) => {
    const created = await trpcCaller.milestones.create({ legacyId, title: 'Mine', simIds: [] })
    const otherUser = await createTestUser()
    await expect(
      authedCaller(otherUser.id).milestones.delete({ id: created.id }),
    ).rejects.toBeInstanceOf(TRPCError)
    await cleanupUser(otherUser.id)
  })
})

describe('milestones.update', () => {
  test('edits title/blurb and replaces the tag set without touching sortOrder', async ({ trpcCaller, legacyId }) => {
    const simA = await createTestSim(legacyId, { firstName: 'A' })
    const simB = await createTestSim(legacyId, { firstName: 'B' })
    const created = await trpcCaller.milestones.create({ legacyId, title: 'Old', simIds: [simA.id] })

    const updated = await trpcCaller.milestones.update({
      id: created.id, title: 'New', blurb: 'now with blurb', simIds: [simB.id],
    })

    expect(updated.title).toBe('New')
    expect(updated.blurb).toBe('now with blurb')
    expect(updated.sims.map((s) => s.simId)).toEqual([simB.id])
    expect(updated.sortOrder).toBe(created.sortOrder)
  })

  test("rejects editing another user's milestone", async ({ trpcCaller, legacyId }) => {
    const created = await trpcCaller.milestones.create({ legacyId, title: 'Mine', simIds: [] })
    const otherUser = await createTestUser()
    const otherCaller = authedCaller(otherUser.id)
    await expect(
      otherCaller.milestones.update({ id: created.id, title: 'Hijack', simIds: [] }),
    ).rejects.toBeInstanceOf(TRPCError)
    await cleanupUser(otherUser.id)
  })
})

describe('milestones.create', () => {
  test('creates a milestone with sortOrder and tagged sims', async ({ trpcCaller, legacyId }) => {
    const sim = await createTestSim(legacyId, { firstName: 'Nina' })
    const result = await trpcCaller.milestones.create({
      legacyId,
      title: 'The Lothario incident',
      blurb: 'She knew what she was doing.',
      simIds: [sim.id],
    })
    expect(result.title).toBe('The Lothario incident')
    expect(typeof result.sortOrder).toBe('number')
    expect(result.sims.map((s) => s.simId)).toEqual([sim.id])

    const row = await db.milestone.findUnique({ where: { id: result.id } })
    expect(row).not.toBeNull()
  })

  test('rejects sims that do not belong to the legacy', async ({ trpcCaller, legacyId }) => {
    const otherUser = await createTestUser()
    const otherLegacy = await createTestLegacy(otherUser.id)
    const foreignSim = await createTestSim(otherLegacy.id)
    await expect(
      trpcCaller.milestones.create({ legacyId, title: 'X', simIds: [foreignSim.id] }),
    ).rejects.toBeInstanceOf(TRPCError)
    await cleanupUser(otherUser.id)
  })

  test("rejects creating against another user's legacy", async ({ trpcCaller }) => {
    const otherUser = await createTestUser()
    const otherLegacy = await createTestLegacy(otherUser.id)
    await expect(
      trpcCaller.milestones.create({ legacyId: otherLegacy.id, title: 'X', simIds: [] }),
    ).rejects.toBeInstanceOf(TRPCError)
    await cleanupUser(otherUser.id)
  })
})
