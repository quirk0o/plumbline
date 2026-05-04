import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc'
import { fetchPacksForUser } from '@/lib/packs'

export const packsRouter = router({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    return fetchPacksForUser(ctx.session.user.id, ctx.db)
  }),

  toggle: protectedProcedure
    .input(z.object({ packId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const existing = await ctx.db.userPack.findUnique({
        where: { userId_packId: { userId, packId: input.packId } },
      })
      if (existing) {
        await ctx.db.userPack.delete({
          where: { userId_packId: { userId, packId: input.packId } },
        })
        return { isOwned: false }
      }
      await ctx.db.pack.findUniqueOrThrow({ where: { id: input.packId } })
        .catch(() => { throw new TRPCError({ code: 'NOT_FOUND', message: 'Pack not found' }) })
      await ctx.db.userPack.create({ data: { userId, packId: input.packId } })
      return { isOwned: true }
    }),
})
