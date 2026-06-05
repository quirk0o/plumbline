import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { authedCaller, unauthCaller } from '@/test/caller'
import {
  createTestUser,
  cleanupUser,
  createTestLegacy,
  createTestSim,
  createTestHousehold,
} from '@/test/helpers'
import { db } from '@/server/db'

describe('households router', () => {
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

  describe('create', () => {
    it('creates a household and returns its id', async () => {
      const caller = authedCaller(userId)
      const result = await caller.households.create({
        legacyId,
        name: 'Goth Manor',
        funds: 20000,
        description: 'The founding home.',
      })
      const record = await db.household.findUnique({ where: { id: result.id } })
      expect(record).toMatchObject({
        name: 'Goth Manor',
        funds: 20000,
        description: 'The founding home.',
        legacyId,
      })
    })

    it('becomes the active household when the legacy has none', async () => {
      const caller = authedCaller(userId)
      const first = await caller.households.create({ legacyId, name: 'First', funds: 0 })
      const second = await caller.households.create({ legacyId, name: 'Second', funds: 0 })
      const legacy = await db.legacy.findUnique({ where: { id: legacyId } })
      expect(legacy!.activeHouseholdId).toBe(first.id)
      expect(legacy!.activeHouseholdId).not.toBe(second.id)
    })

    it('snapshots foundedGeneration from the highest sim generation (default 1)', async () => {
      const caller = authedCaller(userId)
      const empty = await caller.households.create({ legacyId, name: 'Empty Era', funds: 0 })
      expect((await db.household.findUnique({ where: { id: empty.id } }))!.foundedGeneration).toBe(1)

      await createTestSim(legacyId, { generationNumber: 3 })
      const later = await caller.households.create({ legacyId, name: 'Later Era', funds: 0 })
      expect((await db.household.findUnique({ where: { id: later.id } }))!.foundedGeneration).toBe(3)
    })

    it('moves chosen sims in, pulling them from their old household', async () => {
      const old = await createTestHousehold(legacyId, { name: 'Old House' })
      const housed = await createTestSim(legacyId, { firstName: 'Dina', householdId: old.id })
      const unhoused = await createTestSim(legacyId, { firstName: 'Nina' })

      const caller = authedCaller(userId)
      const result = await caller.households.create({
        legacyId,
        name: 'New House',
        funds: 0,
        simIds: [housed.id, unhoused.id],
      })

      const sims = await db.sim.findMany({ where: { householdId: result.id } })
      expect(sims.map((s) => s.firstName).sort()).toEqual(['Dina', 'Nina'])
      expect(await db.sim.count({ where: { householdId: old.id } })).toBe(0)
    })

    it('stores world and lot when given', async () => {
      const world = await db.world.findUniqueOrThrow({ where: { name: 'Willow Creek' } })
      const caller = authedCaller(userId)
      const result = await caller.households.create({
        legacyId,
        name: 'Creek House',
        funds: 0,
        worldId: world.id,
        lot: '1 Goth Hill',
      })
      const record = await db.household.findUnique({ where: { id: result.id } })
      expect(record!.worldId).toBe(world.id)
      expect(record!.lot).toBe('1 Goth Hill')
    })

    it('rejects an unknown worldId', async () => {
      const caller = authedCaller(userId)
      await expect(
        caller.households.create({ legacyId, name: 'X', funds: 0, worldId: 'nope' }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    })

    it('rejects sims from another legacy', async () => {
      const otherLegacy = await createTestLegacy(userId, { slug: `other-${Date.now()}` })
      const foreignSim = await createTestSim(otherLegacy.id)
      const caller = authedCaller(userId)
      await expect(
        caller.households.create({ legacyId, name: 'X', funds: 0, simIds: [foreignSim.id] }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    })

    it("throws NOT_FOUND for another user's legacy", async () => {
      const other = await createTestUser()
      try {
        const caller = authedCaller(other.id)
        await expect(
          caller.households.create({ legacyId, name: 'X', funds: 0 }),
        ).rejects.toMatchObject({ code: 'NOT_FOUND' })
      } finally {
        await cleanupUser(other.id)
      }
    })

    it('rejects unauthenticated calls', async () => {
      const caller = unauthCaller()
      await expect(
        caller.households.create({ legacyId, name: 'X', funds: 0 }),
      ).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    })
  })

  describe('update', () => {
    it('updates only the provided fields', async () => {
      const h = await createTestHousehold(legacyId, { name: 'Before', funds: 100 })
      const caller = authedCaller(userId)
      await caller.households.update({ householdId: h.id, name: 'After', lotValue: 50000 })
      const record = await db.household.findUnique({ where: { id: h.id } })
      expect(record).toMatchObject({ name: 'After', funds: 100, lotValue: 50000 })
    })

    it('rejects negative funds', async () => {
      const h = await createTestHousehold(legacyId)
      const caller = authedCaller(userId)
      await expect(
        caller.households.update({ householdId: h.id, funds: -1 }),
      ).rejects.toThrow()
    })

    it("throws NOT_FOUND for another user's household", async () => {
      const h = await createTestHousehold(legacyId)
      const other = await createTestUser()
      try {
        await expect(
          authedCaller(other.id).households.update({ householdId: h.id, name: 'Stolen' }),
        ).rejects.toMatchObject({ code: 'NOT_FOUND' })
      } finally {
        await cleanupUser(other.id)
      }
    })

    it('clears nullable fields when null is passed', async () => {
      const world = await db.world.findUniqueOrThrow({ where: { name: 'Willow Creek' } })
      const h = await createTestHousehold(legacyId, { worldId: world.id })
      const caller = authedCaller(userId)
      await caller.households.update({
        householdId: h.id,
        worldId: null,
        lot: null,
        description: null,
      })
      const record = await db.household.findUnique({ where: { id: h.id } })
      expect(record).toMatchObject({ worldId: null, lot: null, description: null })
    })
  })

  describe('setActive', () => {
    it('swaps the active household pointer', async () => {
      const a = await createTestHousehold(legacyId, { name: 'A' })
      const b = await createTestHousehold(legacyId, { name: 'B' })
      const caller = authedCaller(userId)
      await caller.households.setActive({ householdId: a.id })
      expect((await db.legacy.findUnique({ where: { id: legacyId } }))!.activeHouseholdId).toBe(a.id)
      await caller.households.setActive({ householdId: b.id })
      expect((await db.legacy.findUnique({ where: { id: legacyId } }))!.activeHouseholdId).toBe(b.id)
    })

    it("throws NOT_FOUND for another user's household", async () => {
      const h = await createTestHousehold(legacyId)
      const other = await createTestUser()
      try {
        await expect(
          authedCaller(other.id).households.setActive({ householdId: h.id }),
        ).rejects.toMatchObject({ code: 'NOT_FOUND' })
      } finally {
        await cleanupUser(other.id)
      }
    })
  })

  describe('moveSim', () => {
    it('moves a sim between households', async () => {
      const from = await createTestHousehold(legacyId, { name: 'From' })
      const to = await createTestHousehold(legacyId, { name: 'To' })
      const sim = await createTestSim(legacyId, { householdId: from.id })
      const caller = authedCaller(userId)
      await caller.households.moveSim({ simId: sim.id, toHouseholdId: to.id })
      expect((await db.sim.findUnique({ where: { id: sim.id } }))!.householdId).toBe(to.id)
    })

    it('moves a sim out to unhoused with null', async () => {
      const from = await createTestHousehold(legacyId)
      const sim = await createTestSim(legacyId, { householdId: from.id })
      const caller = authedCaller(userId)
      await caller.households.moveSim({ simId: sim.id, toHouseholdId: null })
      expect((await db.sim.findUnique({ where: { id: sim.id } }))!.householdId).toBeNull()
    })

    it('rejects a target household from a different legacy', async () => {
      const otherLegacy = await createTestLegacy(userId, { slug: `other-${Date.now()}` })
      const foreignHousehold = await createTestHousehold(otherLegacy.id)
      const sim = await createTestSim(legacyId)
      const caller = authedCaller(userId)
      await expect(
        caller.households.moveSim({ simId: sim.id, toHouseholdId: foreignHousehold.id }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    })

    it("throws NOT_FOUND for another user's sim", async () => {
      const sim = await createTestSim(legacyId)
      const other = await createTestUser()
      try {
        await expect(
          authedCaller(other.id).households.moveSim({ simId: sim.id, toHouseholdId: null }),
        ).rejects.toMatchObject({ code: 'NOT_FOUND' })
      } finally {
        await cleanupUser(other.id)
      }
    })

    it('is a no-op when the sim already lives in the target household', async () => {
      const home = await createTestHousehold(legacyId)
      const sim = await createTestSim(legacyId, { householdId: home.id })
      const before = (await db.sim.findUnique({ where: { id: sim.id } }))!.updatedAt
      const caller = authedCaller(userId)
      await caller.households.moveSim({ simId: sim.id, toHouseholdId: home.id })
      const after = (await db.sim.findUnique({ where: { id: sim.id } }))!
      expect(after.householdId).toBe(home.id)
      expect(after.updatedAt).toEqual(before)
    })
  })

  describe('listByLegacy', () => {
    it('lists the legacy households as id + name', async () => {
      await createTestHousehold(legacyId, { name: 'Alpha' })
      await createTestHousehold(legacyId, { name: 'Beta' })
      const caller = authedCaller(userId)
      const result = await caller.households.listByLegacy({ legacyId })
      expect(result.map((h) => h.name)).toEqual(['Alpha', 'Beta'])
      expect(Object.keys(result[0]).sort()).toEqual(['id', 'name'])
    })

    it("throws NOT_FOUND for another user's legacy", async () => {
      const other = await createTestUser()
      try {
        await expect(
          authedCaller(other.id).households.listByLegacy({ legacyId }),
        ).rejects.toMatchObject({ code: 'NOT_FOUND' })
      } finally {
        await cleanupUser(other.id)
      }
    })
  })
})
