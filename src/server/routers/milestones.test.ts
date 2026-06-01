import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { TRPCError } from '@trpc/server'
import { authedCaller } from '@/test/caller'
import { createTestUser, cleanupUser, createTestLegacy, createTestSim } from '@/test/helpers'
import { db } from '@/server/db'

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
