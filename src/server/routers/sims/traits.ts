import { z } from 'zod'
import { router, protectedProcedure } from '../../trpc'
import { assertSimOwned } from '../../lib/auth/ownership'
import { addSimTrait } from '../../lib/sims/traits'

export const simTraitsRouter = router({
  add: protectedProcedure
    .input(z.object({ simId: z.string(), traitId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const sim = await assertSimOwned(ctx.db, input.simId, ctx.session.user.id)
      return addSimTrait(ctx.db, sim, input.traitId)
    }),

  remove: protectedProcedure
    .input(z.object({ simId: z.string(), traitId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertSimOwned(ctx.db, input.simId, ctx.session.user.id)
      return ctx.db.simPersonalityTrait.delete({
        where: {
          simId_personalityTraitId: { simId: input.simId, personalityTraitId: input.traitId },
        },
      })
    }),
})
