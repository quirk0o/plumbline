import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import type { PrismaClient } from '@prisma/client'
import { router, protectedProcedure } from '../trpc'
import { assertLegacyOwned, assertSimOwned, assertHouseholdOwned } from '../lib/ownership'

/** Throw unless the world exists. The select filters by owned packs as a UX
 *  concern; the server only requires that the world is real. */
async function assertWorldExists(db: PrismaClient, worldId: string) {
  const world = await db.world.findUnique({ where: { id: worldId }, select: { id: true } })
  if (!world) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Unknown world' })
}

export const householdsRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        legacyId: z.string(),
        name: z.string().trim().min(1).max(100),
        worldId: z.string().optional(),
        lot: z.string().max(120).optional(),
        funds: z.number().int().min(0).default(0),
        description: z.string().max(1000).optional(),
        simIds: z.array(z.string()).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const simIds = [...new Set(input.simIds)]
      const legacy = await assertLegacyOwned(ctx.db, input.legacyId, userId)
      if (input.worldId) await assertWorldExists(ctx.db, input.worldId)
      if (simIds.length > 0) {
        const count = await ctx.db.sim.count({
          where: { id: { in: simIds }, legacyId: input.legacyId },
        })
        if (count !== simIds.length) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'All sims must belong to this legacy' })
        }
      }

      const maxGen = await ctx.db.sim.aggregate({
        where: { legacyId: input.legacyId },
        _max: { generationNumber: true },
      })
      const foundedGeneration = maxGen._max.generationNumber ?? 1

      return ctx.db.$transaction(async (tx) => {
        const household = await tx.household.create({
          data: {
            legacyId: input.legacyId,
            name: input.name,
            worldId: input.worldId ?? null,
            lot: input.lot ?? null,
            funds: input.funds,
            description: input.description ?? null,
            foundedGeneration,
          },
        })
        if (simIds.length > 0) {
          const moved = await tx.sim.updateMany({
            where: { id: { in: simIds }, legacyId: input.legacyId },
            data: { householdId: household.id },
          })
          if (moved.count !== simIds.length) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'All sims must belong to this legacy' })
          }
        }
        if (!legacy.activeHouseholdId) {
          await tx.legacy.update({
            where: { id: input.legacyId },
            data: { activeHouseholdId: household.id },
          })
        }
        return { id: household.id }
      })
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
      const userId = ctx.session.user.id
      const sim = await assertSimOwned(ctx.db, input.simId, userId)

      if (input.toHouseholdId) {
        const target = await ctx.db.household.findFirst({
          where: { id: input.toHouseholdId, legacyId: sim.legacyId },
          select: { id: true },
        })
        if (!target) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Household must belong to this legacy' })
        }
      }

      // Moving to the current household is a no-op, not an error.
      if (sim.householdId === input.toHouseholdId) return { id: sim.id }

      await ctx.db.sim.update({
        where: { id: sim.id, legacyId: sim.legacyId },
        data: { householdId: input.toHouseholdId },
      })
      return { id: sim.id }
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
