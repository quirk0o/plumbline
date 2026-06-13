import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { Prisma } from '@prisma/client'
import { router, protectedProcedure } from '../trpc'
import { resolveThresholds, countThresholdsCrossed } from '../lib/challenges/trackerComputation'
import { assertLegacyOwned, assertChallengeRunOwned } from '../lib/auth/ownership'

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

      const challenge = await ctx.db.challenge.findFirst({
        where: { id: input.challengeId, OR: [{ isPublic: true }, { ownerId: userId }] },
        include: {
          phases: {
            include: { trackers: { include: { trackerType: true } } },
            orderBy: { sortOrder: 'asc' },
          },
        },
      })
      if (!challenge) throw new TRPCError({ code: 'NOT_FOUND', message: 'Challenge not found' })

      const run = await ctx.db.$transaction(async (tx) => {
        const newRun = await tx.challengeRun.create({
          data: {
            legacyId: input.legacyId,
            sourceChallengeId: input.challengeId,
            name: input.name ?? challenge.name,
          },
        })

        for (const phase of challenge.phases) {
          const runPhase = await tx.challengeRunPhase.create({
            data: {
              challengeRunId: newRun.id,
              generationNumber: phase.generationNumber,
              title: phase.title,
              description: phase.description,
              sortOrder: phase.sortOrder,
            },
          })

          for (const tracker of phase.trackers) {
            const runTracker = await tx.challengeRunTracker.create({
              data: {
                challengeRunPhaseId: runPhase.id,
                trackerTypeId: tracker.trackerTypeId,
                name: tracker.name,
                description: tracker.description,
                config: tracker.config as Prisma.InputJsonValue,
                goalConfig: tracker.goalConfig as Prisma.InputJsonValue | undefined,
                sortOrder: tracker.sortOrder,
              },
            })
            await tx.trackerProgress.create({
              data: {
                challengeRunTrackerId: runTracker.id,
                isManual: tracker.trackerType.computationSpec === null,
                value: tracker.trackerType.valueKind === 'BOOLEAN' ? false : 0,
              },
            })
          }
        }

        return newRun
      })

      return run
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

      const phases = run.phases.map((phase) => ({
        ...phase,
        isComplete:
          phase.trackers.length > 0 && phase.trackers.every((t) => t.progress?.completedAt != null),
      }))

      return {
        ...run,
        phases,
        isComplete: phases.length > 0 && phases.every((p) => p.isComplete),
      }
    }),

  updatePhase: protectedProcedure
    .input(z.object({
      id: z.string(),
      title: z.string().max(200).nullable().optional(),
      description: z.string().max(2000).nullable().optional(),
      generationNumber: z.number().int().min(1).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const phase = await ctx.db.challengeRunPhase.findUnique({
        where: { id: input.id },
        include: { run: { include: { legacy: true } } },
      })
      if (!phase) throw new TRPCError({ code: 'NOT_FOUND' })
      if (phase.run.legacy.userId !== userId) throw new TRPCError({ code: 'FORBIDDEN' })
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
      const userId = ctx.session.user.id
      const tracker = await ctx.db.challengeRunTracker.findUnique({
        where: { id: input.id },
        include: { phase: { include: { run: { include: { legacy: true } } } } },
      })
      if (!tracker) throw new TRPCError({ code: 'NOT_FOUND' })
      if (tracker.phase.run.legacy.userId !== userId) throw new TRPCError({ code: 'FORBIDDEN' })
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
      const userId = ctx.session.user.id
      const progress = await ctx.db.trackerProgress.findUnique({
        where: { challengeRunTrackerId: input.challengeRunTrackerId },
        include: {
          tracker: {
            include: {
              trackerType: true,
              phase: { include: { run: { include: { legacy: true } } } },
            },
          },
        },
      })
      if (!progress) throw new TRPCError({ code: 'NOT_FOUND' })
      if (progress.tracker.phase.run.legacy.userId !== userId) throw new TRPCError({ code: 'FORBIDDEN' })
      if (!progress.isManual) throw new TRPCError({ code: 'BAD_REQUEST', message: 'This tracker is auto-computed' })

      const { valueKind } = progress.tracker.trackerType
      const now = new Date()

      let value: boolean | number = input.value as boolean | number
      let isComplete = false

      if (valueKind === 'BOOLEAN') {
        value = input.value
        isComplete = input.value === true
      } else if (valueKind === 'THRESHOLD') {
        if (typeof input.value !== 'number') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'THRESHOLD tracker requires a numeric value' })
        }
        const thresholds = resolveThresholds(progress.tracker.goalConfig)
        if (!thresholds) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'THRESHOLD tracker has no valid goalConfig' })
        }
        value = countThresholdsCrossed(input.value, thresholds)
        isComplete = value >= thresholds.length
      } else {
        // NUMERICAL
        if (typeof input.value !== 'number') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'NUMERICAL tracker requires a numeric value' })
        }
        value = input.value
        const goalValue = (progress.tracker.goalConfig as { goalValue?: number } | null)?.goalValue
        isComplete = goalValue !== undefined && input.value >= goalValue
      }

      return ctx.db.trackerProgress.update({
        where: { challengeRunTrackerId: input.challengeRunTrackerId },
        data: {
          value: value as Prisma.InputJsonValue,
          ...(!progress.completedAt && isComplete ? { completedAt: now } : {}),
        },
      })
    }),
})
