import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { Gender, LifeStage, OccultType, EmploymentType } from '@prisma/client'
import { router, protectedProcedure } from '../trpc'
import { uniqueSlug } from '@/lib/slugify'

const founderInput = z.object({
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

export const legaciesRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        imageUrl: z.string().url().optional(),
        founder: founderInput.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const slug = await uniqueSlug(ctx.db, userId, input.name)

      const traitIds = input.founder?.personalityTraitIds ?? []
      if (traitIds.length >= 2) {
        const conflict = await ctx.db.personalityTraitConflict.findFirst({
          where: { traitAId: { in: traitIds }, traitBId: { in: traitIds } },
        })
        if (conflict) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Selected traits conflict' })
        }
      }

      return ctx.db.$transaction(async (tx) => {
        const legacy = await tx.legacy.create({
          data: { name: input.name, slug, description: input.description, imageUrl: input.imageUrl, userId },
        })

        if (!input.founder) return { legacy: { id: legacy.id, slug: legacy.slug, name: legacy.name } }

        const { personalityTraitIds, aspirationId, careerId, ...simFields } = input.founder

        const sim = await tx.sim.create({
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

        await tx.legacy.update({ where: { id: legacy.id }, data: { founderSimId: sim.id } })

        return { legacy: { id: legacy.id, slug: legacy.slug, name: legacy.name } }
      })
    }),

  getAll: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.legacy.findMany({
      where: { userId: ctx.session.user.id },
      include: {
        founderSim: { select: { id: true, firstName: true, lastName: true, imageUrl: true } },
        _count: { select: { households: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }),
})
