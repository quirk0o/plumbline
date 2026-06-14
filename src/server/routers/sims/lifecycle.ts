import { z } from 'zod'
import { router, protectedProcedure } from '../../trpc'
import { assertSimOwned } from '../../lib/auth/ownership'
import { completeAspiration, endCareer } from '../../lib/sims/lifecycle'

export const simsLifecycleRouter = router({
  completeAspiration: protectedProcedure
    .input(z.object({ simId: z.string(), aspirationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const sim = await assertSimOwned(ctx.db, input.simId, ctx.session.user.id)
      return completeAspiration(ctx.db, sim, input.aspirationId)
    }),

  endCareer: protectedProcedure
    .input(z.object({ simId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const sim = await assertSimOwned(ctx.db, input.simId, ctx.session.user.id)
      return endCareer(ctx.db, sim)
    }),
})
