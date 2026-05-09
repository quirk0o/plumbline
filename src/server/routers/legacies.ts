import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { Gender, LifeStage, OccultType, EmploymentType, Prisma } from '@prisma/client'
import { router, protectedProcedure } from '../trpc'
import { uniqueSlug } from '@/lib/slugify'
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

const founderInput = z.object({
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

export const legaciesRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().max(2000).optional(),
        imageUrl: imageUrlSchema,
        founder: founderInput.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const traitIds = input.founder?.personalityTraitIds ?? []

      try {
        return await ctx.db.$transaction(async (tx) => {
          const slug = await uniqueSlug(tx, userId, input.name)

          await assertNoTraitConflicts(tx, traitIds)

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
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          throw new TRPCError({ code: 'CONFLICT', message: 'A legacy with this name already exists' })
        }
        throw err
      }
    }),

  getAll: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.legacy.findMany({
      where: { userId: ctx.session.user.id },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        imageUrl: true,
        createdAt: true,
        founderSim: { select: { id: true, firstName: true, lastName: true, imageUrl: true } },
        _count: { select: { households: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }),
})
