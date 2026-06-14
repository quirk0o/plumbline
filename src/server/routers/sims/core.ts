import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../../trpc'
import { assertLegacyOwned, assertSimOwned } from '../../lib/auth/ownership'
import { createSim, createSimInput } from '../../lib/sims/createSim'
import { updateSim, updateSimInput } from '../../lib/sims/updateSim'

export const simsCoreRouter = router({
  create: protectedProcedure
    .input(createSimInput)
    .mutation(async ({ ctx, input }) => {
      const legacy = await assertLegacyOwned(ctx.db, input.legacyId, ctx.session.user.id)
      return createSim(ctx.db, legacy, input)
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      await assertSimOwned(ctx.db, input.id, userId)
      const sim = await ctx.db.sim.findUnique({
        where: { id: input.id },
        include: {
          personalityTraits: { include: { personalityTrait: true } },
          aspirations: { include: { aspiration: true } },
          careers: { include: { career: true } },
          skills: { include: { skill: true } },
          parentsOf: {
            include: { child: { select: { id: true, firstName: true, lastName: true, imageUrl: true } } },
          },
          childOf: {
            include: { parent: { select: { id: true, firstName: true, lastName: true, imageUrl: true, generationNumber: true } } },
          },
          socialRelationshipsA: {
            include: { simB: { select: { id: true, firstName: true, lastName: true, imageUrl: true } } },
          },
          socialRelationshipsB: {
            include: { simA: { select: { id: true, firstName: true, lastName: true, imageUrl: true } } },
          },
        },
      })
      if (!sim) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sim not found' })
      return sim
    }),

  listByLegacy: protectedProcedure
    .input(z.object({ legacyId: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      await assertLegacyOwned(ctx.db, input.legacyId, userId)
      return ctx.db.sim.findMany({
        where: { legacyId: input.legacyId },
        select: { id: true, firstName: true, lastName: true, imageUrl: true },
        orderBy: { firstName: 'asc' },
      })
    }),

  update: protectedProcedure
    .input(updateSimInput)
    .mutation(async ({ ctx, input }) => {
      const sim = await assertSimOwned(ctx.db, input.id, ctx.session.user.id)
      return updateSim(ctx.db, sim, input)
    }),
})
