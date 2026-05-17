import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc'

const jsonObjectSchema = z.record(z.string(), z.unknown())

export const trackerTypesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id
    return ctx.db.trackerType.findMany({
      where: {
        OR: [{ isPublic: true }, { ownerId: userId }],
      },
      orderBy: [{ isBuiltIn: 'desc' }, { name: 'asc' }],
    })
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().max(500).optional(),
        valueKind: z.enum(['BOOLEAN', 'NUMERICAL', 'THRESHOLD']),
        isPublic: z.boolean().default(false),
        computationSpec: jsonObjectSchema.optional(),
        configSchema: jsonObjectSchema.default({}),
        goalSchema: jsonObjectSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      return ctx.db.trackerType.create({
        data: {
          name: input.name,
          description: input.description ?? null,
          valueKind: input.valueKind,
          isPublic: input.isPublic,
          isBuiltIn: false,
          ownerId: userId,
          computationSpec: input.computationSpec as Prisma.InputJsonValue | undefined,
          configSchema: input.configSchema as Prisma.InputJsonValue,
          goalSchema: input.goalSchema as Prisma.InputJsonValue | undefined,
        },
      })
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().max(500).nullable().optional(),
        isPublic: z.boolean().optional(),
        goalSchema: jsonObjectSchema.nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const tt = await ctx.db.trackerType.findUnique({ where: { id: input.id } })
      if (!tt) throw new TRPCError({ code: 'NOT_FOUND' })
      if (tt.ownerId !== userId || tt.isBuiltIn)
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Cannot modify this tracker type' })
      return ctx.db.trackerType.update({
        where: { id: input.id },
        data: {
          name: input.name,
          description: input.description,
          isPublic: input.isPublic,
          goalSchema:
            input.goalSchema === null
              ? Prisma.DbNull
              : input.goalSchema !== undefined
                ? (input.goalSchema as Prisma.InputJsonValue)
                : undefined,
        },
      })
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const tt = await ctx.db.trackerType.findUnique({ where: { id: input.id } })
      if (!tt) throw new TRPCError({ code: 'NOT_FOUND' })
      if (tt.ownerId !== userId || tt.isBuiltIn)
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Cannot delete this tracker type' })
      try {
        return await ctx.db.trackerType.delete({ where: { id: input.id } })
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Tracker type is in use by one or more challenges and cannot be deleted',
          })
        }
        throw err
      }
    }),
})
