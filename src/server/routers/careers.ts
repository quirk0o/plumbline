import { router, protectedProcedure } from '../trpc'

export const careersRouter = router({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const ownedPackIds = (
      await ctx.db.userPack.findMany({
        where: { userId: ctx.session.user.id },
        select: { packId: true },
      })
    ).map((up) => up.packId)

    return ctx.db.career.findMany({
      where: {
        OR: [{ packId: null }, { packId: { in: ownedPackIds } }],
      },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, type: true, branchAName: true, branchBName: true },
    })
  }),
})
