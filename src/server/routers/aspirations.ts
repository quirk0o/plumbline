import { router, protectedProcedure } from '../trpc'

export const aspirationsRouter = router({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const ownedPackIds = (
      await ctx.db.userPack.findMany({
        where: { userId: ctx.session.user.id },
        select: { packId: true },
      })
    ).map((up) => up.packId)

    return ctx.db.aspiration.findMany({
      where: {
        OR: [{ packId: null }, { packId: { in: ownedPackIds } }],
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, category: true, minLifeStage: true, maxLifeStage: true },
    })
  }),
})
