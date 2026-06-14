import { z } from 'zod'
import { router, protectedProcedure } from '../../trpc'
import { assertSimOwned } from '../../lib/auth/ownership'
import { upsertSimSkill, setSimSkillLevel } from '../../lib/sims/skills'

const skillLevelInput = z.object({ simId: z.string(), skillId: z.string(), level: z.number().int().min(1) })

export const simSkillsRouter = router({
  add: protectedProcedure.input(skillLevelInput).mutation(async ({ ctx, input }) => {
    const sim = await assertSimOwned(ctx.db, input.simId, ctx.session.user.id)
    return upsertSimSkill(ctx.db, sim, input.skillId, input.level)
  }),

  setLevel: protectedProcedure.input(skillLevelInput).mutation(async ({ ctx, input }) => {
    const sim = await assertSimOwned(ctx.db, input.simId, ctx.session.user.id)
    return setSimSkillLevel(ctx.db, sim, input.skillId, input.level)
  }),

  remove: protectedProcedure
    .input(z.object({ simId: z.string(), skillId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertSimOwned(ctx.db, input.simId, ctx.session.user.id)
      return ctx.db.simSkill.delete({
        where: { simId_skillId: { simId: input.simId, skillId: input.skillId } },
      })
    }),
})
