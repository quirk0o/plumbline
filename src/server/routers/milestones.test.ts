import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { TRPCError } from '@trpc/server'
import { authedCaller } from '@/test/caller'
import { createTestUser, cleanupUser, createTestLegacy, createTestSim } from '@/test/helpers'
import { db } from '@/server/db'

describe('milestones.reorder', () => {
  let userId: string
  let legacyId: string
  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
    const legacy = await createTestLegacy(userId)
    legacyId = legacy.id
  })
  afterEach(async () => { await cleanupUser(userId) })

  it('sets sortOrder to the midpoint between two neighbors', async () => {
    const caller = authedCaller(userId)
    const m = await caller.milestones.create({ legacyId, title: 'M', simIds: [] })
    const res = await caller.milestones.reorder({ id: m.id, prevSortOrder: 1000, nextSortOrder: 2000 })
    expect(res.sortOrder).toBe(1500)
  })

  it('places above-all when only nextSortOrder is given', async () => {
    const caller = authedCaller(userId)
    const m = await caller.milestones.create({ legacyId, title: 'M', simIds: [] })
    const res = await caller.milestones.reorder({ id: m.id, nextSortOrder: 2000 })
    expect(res.sortOrder).toBe(3000)
  })

  it('places below-all when only prevSortOrder is given', async () => {
    const caller = authedCaller(userId)
    const m = await caller.milestones.create({ legacyId, title: 'M', simIds: [] })
    const res = await caller.milestones.reorder({ id: m.id, prevSortOrder: 2000 })
    expect(res.sortOrder).toBe(1000)
  })

  it('rejects when neither neighbor is provided', async () => {
    const caller = authedCaller(userId)
    const m = await caller.milestones.create({ legacyId, title: 'M', simIds: [] })
    await expect(caller.milestones.reorder({ id: m.id })).rejects.toBeInstanceOf(TRPCError)
  })

  it("rejects reordering another user's milestone", async () => {
    const caller = authedCaller(userId)
    const created = await caller.milestones.create({ legacyId, title: 'Mine', simIds: [] })
    const otherUser = await createTestUser()
    await expect(
      authedCaller(otherUser.id).milestones.reorder({ id: created.id, nextSortOrder: 500 }),
    ).rejects.toBeInstanceOf(TRPCError)
    await cleanupUser(otherUser.id)
  })
})

describe('milestones.delete', () => {
  let userId: string
  let legacyId: string
  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
    const legacy = await createTestLegacy(userId)
    legacyId = legacy.id
  })
  afterEach(async () => { await cleanupUser(userId) })

  it('deletes the milestone and cascades its tag rows', async () => {
    const sim = await createTestSim(legacyId)
    const caller = authedCaller(userId)
    const created = await caller.milestones.create({ legacyId, title: 'Bye', simIds: [sim.id] })

    const res = await caller.milestones.delete({ id: created.id })
    expect(res.id).toBe(created.id)
    expect(await db.milestone.findUnique({ where: { id: created.id } })).toBeNull()
    expect(await db.milestoneSim.count({ where: { milestoneId: created.id } })).toBe(0)
  })

  it("rejects deleting another user's milestone", async () => {
    const caller = authedCaller(userId)
    const created = await caller.milestones.create({ legacyId, title: 'Mine', simIds: [] })
    const otherUser = await createTestUser()
    await expect(
      authedCaller(otherUser.id).milestones.delete({ id: created.id }),
    ).rejects.toBeInstanceOf(TRPCError)
    await cleanupUser(otherUser.id)
  })
})

describe('milestones.update', () => {
  let userId: string
  let legacyId: string

  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
    const legacy = await createTestLegacy(userId)
    legacyId = legacy.id
  })
  afterEach(async () => { await cleanupUser(userId) })

  it('edits title/blurb and replaces the tag set without touching sortOrder', async () => {
    const simA = await createTestSim(legacyId, { firstName: 'A' })
    const simB = await createTestSim(legacyId, { firstName: 'B' })
    const caller = authedCaller(userId)
    const created = await caller.milestones.create({ legacyId, title: 'Old', simIds: [simA.id] })

    const updated = await caller.milestones.update({
      id: created.id, title: 'New', blurb: 'now with blurb', simIds: [simB.id],
    })

    expect(updated.title).toBe('New')
    expect(updated.blurb).toBe('now with blurb')
    expect(updated.sims.map((s) => s.simId)).toEqual([simB.id])
    expect(updated.sortOrder).toBe(created.sortOrder)
  })

  it("rejects editing another user's milestone", async () => {
    const caller = authedCaller(userId)
    const created = await caller.milestones.create({ legacyId, title: 'Mine', simIds: [] })
    const otherUser = await createTestUser()
    const otherCaller = authedCaller(otherUser.id)
    await expect(
      otherCaller.milestones.update({ id: created.id, title: 'Hijack', simIds: [] }),
    ).rejects.toBeInstanceOf(TRPCError)
    await cleanupUser(otherUser.id)
  })
})

describe('milestones.create', () => {
  let userId: string
  let legacyId: string

  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
    const legacy = await createTestLegacy(userId)
    legacyId = legacy.id
  })

  afterEach(async () => {
    await cleanupUser(userId)
  })

  it('creates a milestone with sortOrder and tagged sims', async () => {
    const sim = await createTestSim(legacyId, { firstName: 'Nina' })
    const caller = authedCaller(userId)
    const result = await caller.milestones.create({
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

  it('rejects sims that do not belong to the legacy', async () => {
    const otherUser = await createTestUser()
    const otherLegacy = await createTestLegacy(otherUser.id)
    const foreignSim = await createTestSim(otherLegacy.id)
    const caller = authedCaller(userId)
    await expect(
      caller.milestones.create({ legacyId, title: 'X', simIds: [foreignSim.id] }),
    ).rejects.toBeInstanceOf(TRPCError)
    await cleanupUser(otherUser.id)
  })

  it("rejects creating against another user's legacy", async () => {
    const otherUser = await createTestUser()
    const otherLegacy = await createTestLegacy(otherUser.id)
    const caller = authedCaller(userId)
    await expect(
      caller.milestones.create({ legacyId: otherLegacy.id, title: 'X', simIds: [] }),
    ).rejects.toBeInstanceOf(TRPCError)
    await cleanupUser(otherUser.id)
  })
})
