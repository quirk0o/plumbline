import { z } from 'zod'
import { router, protectedProcedure } from '../../trpc'
import { assertLegacyOwnedBySlug, assertSimOwned } from '../../lib/auth/ownership'
import { getTreeData } from '../../lib/sims/treeData'
import { getMiniTreeData } from '../../lib/sims/buildMiniTree'

export const simsTreeRouter = router({
  getTreeData: protectedProcedure
    .input(z.object({ legacySlug: z.string().min(1).max(100) }))
    .query(async ({ ctx, input }) => {
      const legacy = await assertLegacyOwnedBySlug(ctx.db, input.legacySlug, ctx.session.user.id)
      return getTreeData(ctx.db, legacy.id, input.legacySlug)
    }),

  getMiniTreeData: protectedProcedure
    .input(z.object({ simId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      await assertSimOwned(ctx.db, input.simId, ctx.session.user.id)
      return getMiniTreeData(ctx.db, input.simId, ctx.session.user.id)
    }),
})
