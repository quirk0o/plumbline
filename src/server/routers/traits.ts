import { router, protectedProcedure } from '../trpc'

export const traitsRouter = router({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const ownedPackIds = (
      await ctx.db.userPack.findMany({
        where: { userId: ctx.session.user.id },
        select: { packId: true },
      })
    ).map((up) => up.packId)

    const traits = await ctx.db.personalityTrait.findMany({
      where: {
        OR: [{ packId: null }, { packId: { in: ownedPackIds } }],
      },
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
