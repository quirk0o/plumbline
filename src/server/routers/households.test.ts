import { describe, expect } from 'vitest'
import { authedCaller, unauthCaller } from '@/test/caller'
import {
  createTestUser,
  cleanupUser,
  createTestLegacy,
  createTestSim,
  createTestHousehold,
} from '@/test/helpers'
import { test } from '@/test/fixtures'
import { db } from '@/server/db'

describe('households router', () => {
  describe('create', () => {
    test('creates a household and returns its id', async ({ trpcCaller, legacyId }) => {
      const result = await trpcCaller.households.create({
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

    test('becomes the active household when the legacy has none', async ({ trpcCaller, legacyId }) => {
      const first = await trpcCaller.households.create({ legacyId, name: 'First', funds: 0 })
      const second = await trpcCaller.households.create({ legacyId, name: 'Second', funds: 0 })
      const legacy = await db.legacy.findUnique({ where: { id: legacyId } })
      expect(legacy!.activeHouseholdId).toBe(first.id)
      expect(legacy!.activeHouseholdId).not.toBe(second.id)
    })

    test('snapshots foundedGeneration from the highest sim generation (default 1)', async ({ trpcCaller, legacyId }) => {
      const empty = await trpcCaller.households.create({ legacyId, name: 'Empty Era', funds: 0 })
      expect((await db.household.findUnique({ where: { id: empty.id } }))!.foundedGeneration).toBe(1)

      await createTestSim(legacyId, { generationNumber: 3 })
      const later = await trpcCaller.households.create({ legacyId, name: 'Later Era', funds: 0 })
      expect((await db.household.findUnique({ where: { id: later.id } }))!.foundedGeneration).toBe(3)
    })

    test('moves chosen sims in, pulling them from their old household', async ({ trpcCaller, legacyId }) => {
      const old = await createTestHousehold(legacyId, { name: 'Old House' })
      const housed = await createTestSim(legacyId, { firstName: 'Dina', householdId: old.id })
      const unhoused = await createTestSim(legacyId, { firstName: 'Nina' })

      const result = await trpcCaller.households.create({
        legacyId,
        name: 'New House',
        funds: 0,
        simIds: [housed.id, unhoused.id],
      })

      const sims = await db.sim.findMany({ where: { householdId: result.id } })
      expect(sims.map((s) => s.firstName).sort()).toEqual(['Dina', 'Nina'])
      expect(await db.sim.count({ where: { householdId: old.id } })).toBe(0)
    })

    test('stores world and lot when given', async ({ trpcCaller, legacyId }) => {
      const world = await db.world.findUniqueOrThrow({ where: { name: 'Willow Creek' } })
      const result = await trpcCaller.households.create({
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

    test('rejects an unknown worldId', async ({ trpcCaller, legacyId }) => {
      await expect(
        trpcCaller.households.create({ legacyId, name: 'X', funds: 0, worldId: 'nope' }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    })

    test('rejects sims from another legacy', async ({ trpcCaller, legacyId, userId }) => {
      const otherLegacy = await createTestLegacy(userId, { slug: `other-${Date.now()}` })
      const foreignSim = await createTestSim(otherLegacy.id)
      await expect(
        trpcCaller.households.create({ legacyId, name: 'X', funds: 0, simIds: [foreignSim.id] }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    })

    test("throws NOT_FOUND for another user's legacy", async ({ legacyId }) => {
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

    test('rejects unauthenticated calls', async ({ legacyId }) => {
      const caller = unauthCaller()
      await expect(
        caller.households.create({ legacyId, name: 'X', funds: 0 }),
      ).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    })
  })

  describe('update', () => {
    test('updates only the provided fields', async ({ trpcCaller, legacyId }) => {
      const h = await createTestHousehold(legacyId, { name: 'Before', funds: 100 })
      await trpcCaller.households.update({ householdId: h.id, name: 'After', lotValue: 50000 })
      const record = await db.household.findUnique({ where: { id: h.id } })
      expect(record).toMatchObject({ name: 'After', funds: 100, lotValue: 50000 })
    })

    test('rejects negative funds', async ({ trpcCaller, legacyId }) => {
      const h = await createTestHousehold(legacyId)
      await expect(
        trpcCaller.households.update({ householdId: h.id, funds: -1 }),
      ).rejects.toThrow()
    })

    test("throws NOT_FOUND for another user's household", async ({ legacyId }) => {
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

    test('clears nullable fields when null is passed', async ({ trpcCaller, legacyId }) => {
      const world = await db.world.findUniqueOrThrow({ where: { name: 'Willow Creek' } })
      const h = await createTestHousehold(legacyId, { worldId: world.id })
      await trpcCaller.households.update({
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
    test('swaps the active household pointer', async ({ trpcCaller, legacyId }) => {
      const a = await createTestHousehold(legacyId, { name: 'A' })
      const b = await createTestHousehold(legacyId, { name: 'B' })
      await trpcCaller.households.setActive({ householdId: a.id })
      expect((await db.legacy.findUnique({ where: { id: legacyId } }))!.activeHouseholdId).toBe(a.id)
      await trpcCaller.households.setActive({ householdId: b.id })
      expect((await db.legacy.findUnique({ where: { id: legacyId } }))!.activeHouseholdId).toBe(b.id)
    })

    test("throws NOT_FOUND for another user's household", async ({ legacyId }) => {
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
    test('moves a sim between households', async ({ trpcCaller, legacyId }) => {
      const from = await createTestHousehold(legacyId, { name: 'From' })
      const to = await createTestHousehold(legacyId, { name: 'To' })
      const sim = await createTestSim(legacyId, { householdId: from.id })
      await trpcCaller.households.moveSim({ simId: sim.id, toHouseholdId: to.id })
      expect((await db.sim.findUnique({ where: { id: sim.id } }))!.householdId).toBe(to.id)
    })

    test('moves a sim out to unhoused with null', async ({ trpcCaller, legacyId }) => {
      const from = await createTestHousehold(legacyId)
      const sim = await createTestSim(legacyId, { householdId: from.id })
      await trpcCaller.households.moveSim({ simId: sim.id, toHouseholdId: null })
      expect((await db.sim.findUnique({ where: { id: sim.id } }))!.householdId).toBeNull()
    })

    test('rejects a target household from a different legacy', async ({ trpcCaller, legacyId, userId }) => {
      const otherLegacy = await createTestLegacy(userId, { slug: `other-${Date.now()}` })
      const foreignHousehold = await createTestHousehold(otherLegacy.id)
      const sim = await createTestSim(legacyId)
      await expect(
        trpcCaller.households.moveSim({ simId: sim.id, toHouseholdId: foreignHousehold.id }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    })

    test("throws NOT_FOUND for another user's sim", async ({ legacyId }) => {
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

    test('is a no-op when the sim already lives in the target household', async ({ trpcCaller, legacyId }) => {
      const home = await createTestHousehold(legacyId)
      const sim = await createTestSim(legacyId, { householdId: home.id })
      const before = (await db.sim.findUnique({ where: { id: sim.id } }))!.updatedAt
      await trpcCaller.households.moveSim({ simId: sim.id, toHouseholdId: home.id })
      const after = (await db.sim.findUnique({ where: { id: sim.id } }))!
      expect(after.householdId).toBe(home.id)
      expect(after.updatedAt).toEqual(before)
    })
  })

  describe('listByLegacy', () => {
    test('lists the legacy households as id + name', async ({ trpcCaller, legacyId }) => {
      await createTestHousehold(legacyId, { name: 'Alpha' })
      await createTestHousehold(legacyId, { name: 'Beta' })
      const result = await trpcCaller.households.listByLegacy({ legacyId })
      expect(result.map((h) => h.name)).toEqual(['Alpha', 'Beta'])
      expect(Object.keys(result[0]).sort()).toEqual(['id', 'name'])
    })

    test("throws NOT_FOUND for another user's legacy", async ({ legacyId }) => {
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
