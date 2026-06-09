import { describe, it, expect } from 'vitest'
import { authedCaller, unauthCaller } from '@/test/caller'
import {
  createTestUser,
  cleanupUser,
  createTestLegacy,
  createTestSim,
  createTestHousehold,
} from '@/test/helpers'
import { withTestLegacy } from '@/test/fixtures'
import { db } from '@/server/db'

describe('households router', () => {
  const ctx = withTestLegacy()

  describe('create', () => {
    it('creates a household and returns its id', async () => {
      const result = await ctx.caller.households.create({
        legacyId: ctx.legacyId,
        name: 'Goth Manor',
        funds: 20000,
        description: 'The founding home.',
      })
      const record = await db.household.findUnique({ where: { id: result.id } })
      expect(record).toMatchObject({
        name: 'Goth Manor',
        funds: 20000,
        description: 'The founding home.',
        legacyId: ctx.legacyId,
      })
    })

    it('becomes the active household when the legacy has none', async () => {
      const first = await ctx.caller.households.create({ legacyId: ctx.legacyId, name: 'First', funds: 0 })
      const second = await ctx.caller.households.create({ legacyId: ctx.legacyId, name: 'Second', funds: 0 })
      const legacy = await db.legacy.findUnique({ where: { id: ctx.legacyId } })
      expect(legacy!.activeHouseholdId).toBe(first.id)
      expect(legacy!.activeHouseholdId).not.toBe(second.id)
    })

    it('snapshots foundedGeneration from the highest sim generation (default 1)', async () => {
      const empty = await ctx.caller.households.create({ legacyId: ctx.legacyId, name: 'Empty Era', funds: 0 })
      expect((await db.household.findUnique({ where: { id: empty.id } }))!.foundedGeneration).toBe(1)

      await createTestSim(ctx.legacyId, { generationNumber: 3 })
      const later = await ctx.caller.households.create({ legacyId: ctx.legacyId, name: 'Later Era', funds: 0 })
      expect((await db.household.findUnique({ where: { id: later.id } }))!.foundedGeneration).toBe(3)
    })

    it('moves chosen sims in, pulling them from their old household', async () => {
      const old = await createTestHousehold(ctx.legacyId, { name: 'Old House' })
      const housed = await createTestSim(ctx.legacyId, { firstName: 'Dina', householdId: old.id })
      const unhoused = await createTestSim(ctx.legacyId, { firstName: 'Nina' })

      const result = await ctx.caller.households.create({
        legacyId: ctx.legacyId,
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
      const result = await ctx.caller.households.create({
        legacyId: ctx.legacyId,
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
      await expect(
        ctx.caller.households.create({ legacyId: ctx.legacyId, name: 'X', funds: 0, worldId: 'nope' }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    })

    it('rejects sims from another legacy', async () => {
      const otherLegacy = await createTestLegacy(ctx.userId, { slug: `other-${Date.now()}` })
      const foreignSim = await createTestSim(otherLegacy.id)
      await expect(
        ctx.caller.households.create({ legacyId: ctx.legacyId, name: 'X', funds: 0, simIds: [foreignSim.id] }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    })

    it("throws NOT_FOUND for another user's legacy", async () => {
      const other = await createTestUser()
      try {
        const caller = authedCaller(other.id)
        await expect(
          caller.households.create({ legacyId: ctx.legacyId, name: 'X', funds: 0 }),
        ).rejects.toMatchObject({ code: 'NOT_FOUND' })
      } finally {
        await cleanupUser(other.id)
      }
    })

    it('rejects unauthenticated calls', async () => {
      const caller = unauthCaller()
      await expect(
        caller.households.create({ legacyId: ctx.legacyId, name: 'X', funds: 0 }),
      ).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    })
  })

  describe('update', () => {
    it('updates only the provided fields', async () => {
      const h = await createTestHousehold(ctx.legacyId, { name: 'Before', funds: 100 })
      await ctx.caller.households.update({ householdId: h.id, name: 'After', lotValue: 50000 })
      const record = await db.household.findUnique({ where: { id: h.id } })
      expect(record).toMatchObject({ name: 'After', funds: 100, lotValue: 50000 })
    })

    it('rejects negative funds', async () => {
      const h = await createTestHousehold(ctx.legacyId)
      await expect(
        ctx.caller.households.update({ householdId: h.id, funds: -1 }),
      ).rejects.toThrow()
    })

    it("throws NOT_FOUND for another user's household", async () => {
      const h = await createTestHousehold(ctx.legacyId)
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
      const h = await createTestHousehold(ctx.legacyId, { worldId: world.id })
      await ctx.caller.households.update({
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
      const a = await createTestHousehold(ctx.legacyId, { name: 'A' })
      const b = await createTestHousehold(ctx.legacyId, { name: 'B' })
      await ctx.caller.households.setActive({ householdId: a.id })
      expect((await db.legacy.findUnique({ where: { id: ctx.legacyId } }))!.activeHouseholdId).toBe(a.id)
      await ctx.caller.households.setActive({ householdId: b.id })
      expect((await db.legacy.findUnique({ where: { id: ctx.legacyId } }))!.activeHouseholdId).toBe(b.id)
    })

    it("throws NOT_FOUND for another user's household", async () => {
      const h = await createTestHousehold(ctx.legacyId)
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
      const from = await createTestHousehold(ctx.legacyId, { name: 'From' })
      const to = await createTestHousehold(ctx.legacyId, { name: 'To' })
      const sim = await createTestSim(ctx.legacyId, { householdId: from.id })
      await ctx.caller.households.moveSim({ simId: sim.id, toHouseholdId: to.id })
      expect((await db.sim.findUnique({ where: { id: sim.id } }))!.householdId).toBe(to.id)
    })

    it('moves a sim out to unhoused with null', async () => {
      const from = await createTestHousehold(ctx.legacyId)
      const sim = await createTestSim(ctx.legacyId, { householdId: from.id })
      await ctx.caller.households.moveSim({ simId: sim.id, toHouseholdId: null })
      expect((await db.sim.findUnique({ where: { id: sim.id } }))!.householdId).toBeNull()
    })

    it('rejects a target household from a different legacy', async () => {
      const otherLegacy = await createTestLegacy(ctx.userId, { slug: `other-${Date.now()}` })
      const foreignHousehold = await createTestHousehold(otherLegacy.id)
      const sim = await createTestSim(ctx.legacyId)
      await expect(
        ctx.caller.households.moveSim({ simId: sim.id, toHouseholdId: foreignHousehold.id }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    })

    it("throws NOT_FOUND for another user's sim", async () => {
      const sim = await createTestSim(ctx.legacyId)
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
      const home = await createTestHousehold(ctx.legacyId)
      const sim = await createTestSim(ctx.legacyId, { householdId: home.id })
      const before = (await db.sim.findUnique({ where: { id: sim.id } }))!.updatedAt
      await ctx.caller.households.moveSim({ simId: sim.id, toHouseholdId: home.id })
      const after = (await db.sim.findUnique({ where: { id: sim.id } }))!
      expect(after.householdId).toBe(home.id)
      expect(after.updatedAt).toEqual(before)
    })
  })

  describe('listByLegacy', () => {
    it('lists the legacy households as id + name', async () => {
      await createTestHousehold(ctx.legacyId, { name: 'Alpha' })
      await createTestHousehold(ctx.legacyId, { name: 'Beta' })
      const result = await ctx.caller.households.listByLegacy({ legacyId: ctx.legacyId })
      expect(result.map((h) => h.name)).toEqual(['Alpha', 'Beta'])
      expect(Object.keys(result[0]).sort()).toEqual(['id', 'name'])
    })

    it("throws NOT_FOUND for another user's legacy", async () => {
      const other = await createTestUser()
      try {
        await expect(
          authedCaller(other.id).households.listByLegacy({ legacyId: ctx.legacyId }),
        ).rejects.toMatchObject({ code: 'NOT_FOUND' })
      } finally {
        await cleanupUser(other.id)
      }
    })
  })
})
