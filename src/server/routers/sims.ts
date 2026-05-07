import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { Gender, LifeStage, OccultType, EmploymentType } from '@prisma/client'
import { router, protectedProcedure } from '../trpc'

export const simsRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        legacyId: z.string(),
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        gender: z.nativeEnum(Gender),
        lifeStage: z.nativeEnum(LifeStage).default('YOUNG_ADULT'),
        pronounSubject: z.string().optional(),
        pronounObject: z.string().optional(),
        pronounPossessive: z.string().optional(),
        imageUrl: z.string().url().optional(),
        personalityTraitIds: z.array(z.string()).max(6).optional(),
        aspirationId: z.string().optional(),
        careerId: z.string().optional(),
        occultType: z.nativeEnum(OccultType).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const legacy = await ctx.db.legacy.findFirst({ where: { id: input.legacyId, userId } })
      if (!legacy) throw new TRPCError({ code: 'NOT_FOUND', message: 'Legacy not found' })

      const traitIds = input.personalityTraitIds ?? []
      if (traitIds.length >= 2) {
        const conflict = await ctx.db.personalityTraitConflict.findFirst({
          where: { traitAId: { in: traitIds }, traitBId: { in: traitIds } },
        })
        if (conflict) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Selected traits conflict' })
      }

      const { legacyId, personalityTraitIds, aspirationId, careerId, ...simFields } = input

      return ctx.db.sim.create({
        data: {
          firstName: simFields.firstName,
          lastName: simFields.lastName,
          gender: simFields.gender,
          lifeStage: simFields.lifeStage,
          pronounSubject: simFields.pronounSubject ?? null,
          pronounObject: simFields.pronounObject ?? null,
          pronounPossessive: simFields.pronounPossessive ?? null,
          imageUrl: simFields.imageUrl ?? null,
          occultType: simFields.occultType ?? null,
          ...(personalityTraitIds?.length
            ? { personalityTraits: { create: personalityTraitIds.map((id) => ({ personalityTraitId: id })) } }
            : {}),
          ...(aspirationId ? { aspirations: { create: { aspirationId } } } : {}),
          ...(careerId
            ? { careers: { create: { careerId, employmentType: EmploymentType.EMPLOYED, startedAt: new Date() } } }
            : {}),
        },
      })
    }),
})
