import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { Prisma } from '@prisma/client'
import { router, protectedProcedure } from '../trpc'
import { linkChallenge } from '../lib/challenges/linkChallenge'
import { computeProgressUpdate, summarizeRun } from '../lib/challenges/runProgress'
import {
  assertLegacyOwned,
  assertChallengeRunOwned,
  assertRunPhaseOwned,
  assertRunTrackerOwned,
  assertProgressOwned,
} from '../lib/auth/ownership'

export const challengeRunsRouter = router({
  link: protectedProcedure
    .input(z.object({
      legacyId: z.string(),
      challengeId: z.string(),
      name: z.string().max(200).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      await assertLegacyOwned(ctx.db, input.legacyId, userId)
      return linkChallenge(ctx.db, input.legacyId, input.challengeId, userId, input.name)
    }),

  listByLegacy: protectedProcedure
    .input(z.object({ legacyId: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      await assertLegacyOwned(ctx.db, input.legacyId, userId)
      return ctx.db.challengeRun.findMany({
        where: { legacyId: input.legacyId },
        orderBy: { startedAt: 'desc' },
      })
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      await assertChallengeRunOwned(ctx.db, input.id, userId)
      const run = await ctx.db.challengeRun.findUnique({
        where: { id: input.id },
        include: {
          phases: {
            orderBy: { sortOrder: 'asc' },
            include: {
              trackers: {
                orderBy: { sortOrder: 'asc' },
                include: { trackerType: true, progress: true },
              },
            },
          },
        },
      })
      if (!run) throw new TRPCError({ code: 'NOT_FOUND' })
      return summarizeRun(run)
    }),

  updatePhase: protectedProcedure
    .input(z.object({
      id: z.string(),
      title: z.string().max(200).nullable().optional(),
      description: z.string().max(2000).nullable().optional(),
      generationNumber: z.number().int().min(1).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertRunPhaseOwned(ctx.db, input.id, ctx.session.user.id)
      const { id, ...fields } = input
      return ctx.db.challengeRunPhase.update({ where: { id }, data: fields })
    }),

  updateTracker: protectedProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).max(200).optional(),
      description: z.string().max(1000).nullable().optional(),
      config: z.record(z.string(), z.unknown()).optional(),
      goalConfig: z.record(z.string(), z.unknown()).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertRunTrackerOwned(ctx.db, input.id, ctx.session.user.id)
      const { id, config, goalConfig, ...rest } = input
      return ctx.db.challengeRunTracker.update({
        where: { id },
        data: {
          ...rest,
          ...(config !== undefined ? { config: config as Prisma.InputJsonValue } : {}),
          ...(goalConfig !== undefined ? { goalConfig: goalConfig === null ? Prisma.DbNull : goalConfig as Prisma.InputJsonValue } : {}),
        },
      })
    }),

  updateProgress: protectedProcedure
    .input(z.object({
      challengeRunTrackerId: z.string(),
      value: z.union([z.boolean(), z.number()]),
    }))
    .mutation(async ({ ctx, input }) => {
      const progress = await assertProgressOwned(ctx.db, input.challengeRunTrackerId, ctx.session.user.id)
      if (!progress.isManual) throw new TRPCError({ code: 'BAD_REQUEST', message: 'This tracker is auto-computed' })

      const { value, isComplete } = computeProgressUpdate(
        progress.tracker.trackerType.valueKind,
        progress.tracker.goalConfig,
        input.value,
      )

      return ctx.db.trackerProgress.update({
        where: { challengeRunTrackerId: input.challengeRunTrackerId },
        data: {
          value: value as Prisma.InputJsonValue,
          ...(!progress.completedAt && isComplete ? { completedAt: new Date() } : {}),
        },
      })
    }),
})
