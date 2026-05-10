import { router, protectedProcedure } from '../trpc'

export const careersRouter = router({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.career.findMany({
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, type: true, branchAName: true, branchBName: true },
    })
  }),
})
