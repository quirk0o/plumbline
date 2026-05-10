import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { Gender, LifeStage, OccultType, EmploymentType } from '@prisma/client'
import { router, protectedProcedure } from '../trpc'
import { assertNoTraitConflicts } from './validate-traits'

const imageUrlSchema = z
  .string()
  .refine(
    (url) => {
      if (url.startsWith('/uploads/')) return true
      try {
        const { hostname } = new URL(url)
        return hostname.endsWith('.vercel-storage.com') || hostname === 'localhost'
      } catch {
        return false
      }
    },
    { message: 'Image must be hosted on an allowed domain' },
  )
  .optional()

export const simsRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        legacyId: z.string(),
        firstName: z.string().min(1).max(50),
        lastName: z.string().min(1).max(50),
        gender: z.nativeEnum(Gender),
        lifeStage: z.nativeEnum(LifeStage).default('YOUNG_ADULT'),
        pronounSubject: z.string().max(20).optional(),
        pronounObject: z.string().max(20).optional(),
        pronounPossessive: z.string().max(20).optional(),
        imageUrl: imageUrlSchema,
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
      await assertNoTraitConflicts(ctx.db, traitIds)

      let household = await ctx.db.household.findFirst({ where: { legacyId: input.legacyId } })
      if (!household) {
        household = await ctx.db.household.create({
          data: { name: 'Household 1', legacyId: input.legacyId },
        })
      }

      const { legacyId: _legacyId, personalityTraitIds, aspirationId, careerId, ...simFields } = input

      return ctx.db.sim.create({
        data: {
          legacyId: input.legacyId,
          firstName: simFields.firstName,
          lastName: simFields.lastName,
          gender: simFields.gender,
          lifeStage: simFields.lifeStage,
          pronounSubject: simFields.pronounSubject ?? null,
          pronounObject: simFields.pronounObject ?? null,
          pronounPossessive: simFields.pronounPossessive ?? null,
          imageUrl: simFields.imageUrl ?? null,
          occultType: simFields.occultType ?? null,
          householdId: household.id,
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
