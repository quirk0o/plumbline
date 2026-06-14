import { z } from 'zod'
import { router, protectedProcedure } from '../trpc'
import { assertLegacyOwned, assertSimOwned, assertHouseholdOwned } from '../lib/auth/ownership'
import { createHousehold, createHouseholdInput } from '../lib/households/createHousehold'
import { moveSimToHousehold } from '../lib/households/moveSim'
import { assertWorldExists } from '../lib/households/world-options'

export const householdsRouter = router({
  create: protectedProcedure
    .input(createHouseholdInput)
    .mutation(async ({ ctx, input }) => {
      const legacy = await assertLegacyOwned(ctx.db, input.legacyId, ctx.session.user.id)
      return createHousehold(ctx.db, legacy, input)
    }),

  update: protectedProcedure
    .input(
      z.object({
        householdId: z.string(),
        name: z.string().trim().min(1).max(100).optional(),
        worldId: z.string().nullable().optional(),
        lot: z.string().max(120).nullable().optional(),
        description: z.string().max(1000).nullable().optional(),
        funds: z.number().int().min(0).optional(),
        lotValue: z.number().int().min(0).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const { householdId, ...fields } = input
      await assertHouseholdOwned(ctx.db, householdId, userId)
      if (fields.worldId) await assertWorldExists(ctx.db, fields.worldId)
      return ctx.db.household.update({ where: { id: householdId }, data: fields })
    }),

  setActive: protectedProcedure
    .input(z.object({ householdId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const household = await assertHouseholdOwned(ctx.db, input.householdId, userId)
      await ctx.db.legacy.update({
        where: { id: household.legacyId },
        data: { activeHouseholdId: household.id },
      })
      return { id: household.id }
    }),

  moveSim: protectedProcedure
    .input(z.object({ simId: z.string(), toHouseholdId: z.string().nullable() }))
    .mutation(async ({ ctx, input }) => {
      const sim = await assertSimOwned(ctx.db, input.simId, ctx.session.user.id)
      return moveSimToHousehold(ctx.db, sim, input.toHouseholdId)
    }),

  listByLegacy: protectedProcedure
    .input(z.object({ legacyId: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      await assertLegacyOwned(ctx.db, input.legacyId, userId)
      return ctx.db.household.findMany({
        where: { legacyId: input.legacyId },
        select: { id: true, name: true },
        orderBy: { createdAt: 'asc' },
      })
    }),
})
