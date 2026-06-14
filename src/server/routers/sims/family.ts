import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { FamilyRelationshipType } from '@prisma/client'
import { router, protectedProcedure } from '../../trpc'
import { assertSimsOwned } from '../../lib/auth/ownership'
import { addFamilyRelationship, removeFamilyRelationship } from '../../lib/sims/family'

export const simFamilyRouter = router({
  add: protectedProcedure
    .input(
      z.object({
        parentId: z.string(),
        childId: z.string(),
        type: z.nativeEnum(FamilyRelationshipType),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.parentId === input.childId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'A sim cannot be their own parent' })
      }
      const [parent, child] = await assertSimsOwned(ctx.db, [input.parentId, input.childId], ctx.session.user.id)
      return addFamilyRelationship(ctx.db, parent, child, input.type)
    }),

  remove: protectedProcedure
    .input(z.object({ parentId: z.string(), childId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [, child] = await assertSimsOwned(ctx.db, [input.parentId, input.childId], ctx.session.user.id)
      return removeFamilyRelationship(ctx.db, input.parentId, child)
    }),
})
