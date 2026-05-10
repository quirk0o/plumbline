import { router, protectedProcedure } from '../trpc'

export const aspirationsRouter = router({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.aspiration.findMany({
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, category: true, minLifeStage: true, maxLifeStage: true },
    })
  }),
})
