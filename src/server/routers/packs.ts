import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { PackType } from '@prisma/client'
import { router, protectedProcedure } from '../trpc'
import { fetchPacksForUser } from '@/lib/packs'

export const packsRouter = router({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    return fetchPacksForUser(ctx.session.user.id, ctx.db)
  }),

  toggle: protectedProcedure
    .input(z.object({ packId: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const existing = await ctx.db.userPack.findUnique({
        where: { userId_packId: { userId, packId: input.packId } },
      })
      if (existing) {
        await ctx.db.userPack.deleteMany({
          where: { userId, packId: input.packId },
        })
        return { isOwned: false }
      }
      const pack = await ctx.db.pack.findUnique({ where: { id: input.packId } })
      if (!pack || pack.type === PackType.BASE_GAME) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Pack not found' })
      }
      await ctx.db.userPack.create({ data: { userId, packId: input.packId } })
      return { isOwned: true }
    }),
})
