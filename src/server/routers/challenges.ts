import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc'
import {
  assertChallengeOwned,
  assertChallengePhaseOwned,
  assertChallengeTrackerOwned,
} from '../lib/auth/ownership'

const jsonObjectSchema = z.record(z.string(), z.unknown())

export const challengesRouter = router({
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(200),
      description: z.string().max(2000).optional(),
      isPublic: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.challenge.create({
        data: {
          name: input.name,
          description: input.description ?? null,
          isPublic: input.isPublic,
          ownerId: ctx.session.user.id,
        },
      })
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id
    return ctx.db.challenge.findMany({
      where: { OR: [{ isPublic: true }, { ownerId: userId }] },
      orderBy: { name: 'asc' },
    })
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const challenge = await ctx.db.challenge.findFirst({
        where: { id: input.id, OR: [{ isPublic: true }, { ownerId: userId }] },
        include: {
          phases: {
            include: { trackers: { include: { trackerType: true }, orderBy: { sortOrder: 'asc' } } },
            orderBy: { sortOrder: 'asc' },
          },
        },
      })
      if (!challenge) throw new TRPCError({ code: 'NOT_FOUND' })
      return challenge
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).max(200).optional(),
      description: z.string().max(2000).nullable().optional(),
      isPublic: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertChallengeOwned(ctx.db, input.id, ctx.session.user.id)
      return ctx.db.challenge.update({
        where: { id: input.id },
        data: {
          name: input.name,
          description: input.description,
          isPublic: input.isPublic,
        },
      })
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertChallengeOwned(ctx.db, input.id, ctx.session.user.id)
      return ctx.db.challenge.delete({ where: { id: input.id } })
    }),

  addPhase: protectedProcedure
    .input(z.object({
      challengeId: z.string(),
      generationNumber: z.number().int().min(1).nullable().optional(),
      title: z.string().max(200).optional(),
      description: z.string().max(2000).optional(),
      sortOrder: z.number().int().default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertChallengeOwned(ctx.db, input.challengeId, ctx.session.user.id)
      return ctx.db.challengePhase.create({
        data: {
          challengeId: input.challengeId,
          generationNumber: input.generationNumber ?? null,
          title: input.title ?? null,
          description: input.description ?? null,
          sortOrder: input.sortOrder,
        },
      })
    }),

  updatePhase: protectedProcedure
    .input(z.object({
      id: z.string(),
      generationNumber: z.number().int().min(1).nullable().optional(),
      title: z.string().max(200).nullable().optional(),
      description: z.string().max(2000).nullable().optional(),
      sortOrder: z.number().int().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertChallengePhaseOwned(ctx.db, input.id, ctx.session.user.id)
      return ctx.db.challengePhase.update({
        where: { id: input.id },
        data: {
          generationNumber: input.generationNumber,
          title: input.title,
          description: input.description,
          sortOrder: input.sortOrder,
        },
      })
    }),

  removePhase: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertChallengePhaseOwned(ctx.db, input.id, ctx.session.user.id)
      return ctx.db.challengePhase.delete({ where: { id: input.id } })
    }),

  addTracker: protectedProcedure
    .input(z.object({
      challengePhaseId: z.string(),
      trackerTypeId: z.string(),
      name: z.string().min(1).max(200),
      description: z.string().max(1000).optional(),
      config: jsonObjectSchema.default({}),
      goalConfig: jsonObjectSchema.optional(),
      sortOrder: z.number().int().default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      await assertChallengePhaseOwned(ctx.db, input.challengePhaseId, userId)
      const trackerType = await ctx.db.trackerType.findFirst({
        where: {
          id: input.trackerTypeId,
          OR: [{ isPublic: true }, { isBuiltIn: true }, { ownerId: userId }],
        },
      })
      if (!trackerType) throw new TRPCError({ code: 'NOT_FOUND', message: 'TrackerType not found' })
      return ctx.db.trackerDefinition.create({
        data: {
          challengePhaseId: input.challengePhaseId,
          trackerTypeId: input.trackerTypeId,
          name: input.name,
          description: input.description ?? null,
          config: input.config as Prisma.InputJsonValue,
          goalConfig: input.goalConfig !== undefined
            ? (input.goalConfig as Prisma.InputJsonValue)
            : undefined,
          sortOrder: input.sortOrder,
        },
      })
    }),

  updateTracker: protectedProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).max(200).optional(),
      description: z.string().max(1000).nullable().optional(),
      config: jsonObjectSchema.optional(),
      goalConfig: jsonObjectSchema.nullable().optional(),
      sortOrder: z.number().int().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertChallengeTrackerOwned(ctx.db, input.id, ctx.session.user.id)
      return ctx.db.trackerDefinition.update({
        where: { id: input.id },
        data: {
          name: input.name,
          description: input.description,
          config: input.config !== undefined
            ? (input.config as Prisma.InputJsonValue)
            : undefined,
          goalConfig: input.goalConfig === null
            ? Prisma.DbNull
            : input.goalConfig !== undefined
              ? (input.goalConfig as Prisma.InputJsonValue)
              : undefined,
          sortOrder: input.sortOrder,
        },
      })
    }),

  removeTracker: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertChallengeTrackerOwned(ctx.db, input.id, ctx.session.user.id)
      return ctx.db.trackerDefinition.delete({ where: { id: input.id } })
    }),
})
