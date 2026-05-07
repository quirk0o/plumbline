import { router, protectedProcedure } from '../trpc'

export const traitsRouter = router({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const traits = await ctx.db.personalityTrait.findMany({
      include: {
        conflictsA: { select: { traitBId: true } },
        conflictsB: { select: { traitAId: true } },
      },
      orderBy: { name: 'asc' },
    })
    return traits.map((t) => ({
      id: t.id,
      name: t.name,
      category: t.category,
      minLifeStage: t.minLifeStage,
      maxLifeStage: t.maxLifeStage,
      conflictsWith: [
        ...t.conflictsA.map((c) => c.traitBId),
        ...t.conflictsB.map((c) => c.traitAId),
      ],
    }))
  }),
})
