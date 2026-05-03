import { z } from 'zod'
import { PackType } from '@prisma/client'
import { router, protectedProcedure } from '../trpc'

const PACK_TYPE_ORDER: PackType[] = [
  PackType.EXPANSION,
  PackType.GAME_PACK,
  PackType.STUFF_PACK,
  PackType.KIT,
]

export const packsRouter = router({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session!.user!.id!
    const packs = await ctx.db.pack.findMany({
      where: { type: { not: PackType.BASE_GAME } },
      include: { userPacks: { where: { userId } } },
      orderBy: { name: 'asc' },
    })
    const withOwned = packs.map(({ userPacks, createdAt: _ca, updatedAt: _ua, ...p }) => ({
      ...p,
      isOwned: userPacks.length > 0,
    }))
    const grouped = PACK_TYPE_ORDER.map(type => ({
      type,
      packs: withOwned.filter(p => p.type === type),
    })).filter(g => g.packs.length > 0)
    return grouped
  }),

  toggle: protectedProcedure
    .input(z.object({ packId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session!.user!.id!
      const existing = await ctx.db.userPack.findUnique({
        where: { userId_packId: { userId, packId: input.packId } },
      })
      if (existing) {
        await ctx.db.userPack.delete({
          where: { userId_packId: { userId, packId: input.packId } },
        })
        return { isOwned: false }
      }
      await ctx.db.userPack.create({ data: { userId, packId: input.packId } })
      return { isOwned: true }
    }),
})
