import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { RomanticStatus } from '@prisma/client'
import { router, protectedProcedure } from '../../trpc'
import { assertSimsOwned } from '../../lib/auth/ownership'
import { addSocialRelationship } from '../../lib/sims/social'

export const simSocialRouter = router({
  add: protectedProcedure
    .input(
      z.object({
        simAId: z.string(),
        simBId: z.string(),
        romanticStatus: z.nativeEnum(RomanticStatus).default('DATING'),
        // coerce: tRPC's httpBatchLink has no transformer, so a Date arrives as
        // an ISO string over the wire; coerce it back. nullable() short-circuits
        // an explicit null (clear) before coercion runs.
        endedAt: z.coerce.date().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.simAId === input.simBId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'A sim cannot have a relationship with themselves' })
      }
      const [simA, simB] = await assertSimsOwned(ctx.db, [input.simAId, input.simBId], ctx.session.user.id)
      return addSocialRelationship(ctx.db, simA, simB, {
        romanticStatus: input.romanticStatus,
        endedAt: input.endedAt ?? null,
      })
    }),

  update: protectedProcedure
    .input(
      z.object({
        simAId: z.string(),
        simBId: z.string(),
        romanticStatus: z.nativeEnum(RomanticStatus),
        // coerce: tRPC's httpBatchLink has no transformer, so a Date arrives as
        // an ISO string over the wire; coerce it back. nullable() short-circuits
        // an explicit null (clear) before coercion runs.
        endedAt: z.coerce.date().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertSimsOwned(ctx.db, [input.simAId, input.simBId], ctx.session.user.id)
      const [normalA, normalB] = [input.simAId, input.simBId].sort()
      return ctx.db.socialRelationship.update({
        where: { simAId_simBId: { simAId: normalA, simBId: normalB } },
        data: {
          romanticStatus: input.romanticStatus,
          ...(input.endedAt !== undefined ? { endedAt: input.endedAt } : {}),
        },
      })
    }),

  remove: protectedProcedure
    .input(z.object({ simAId: z.string(), simBId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertSimsOwned(ctx.db, [input.simAId, input.simBId], ctx.session.user.id)
      const [normalA, normalB] = [input.simAId, input.simBId].sort()
      return ctx.db.socialRelationship.delete({
        where: { simAId_simBId: { simAId: normalA, simBId: normalB } },
      })
    }),
})
