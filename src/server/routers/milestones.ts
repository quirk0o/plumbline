import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc'
import type { PrismaClient } from '@prisma/client'

const milestoneInclude = { sims: { select: { simId: true } } } as const

/** Throw unless the legacy exists and is owned by the user. */
async function assertOwnedLegacy(db: PrismaClient, legacyId: string, userId: string) {
  const legacy = await db.legacy.findFirst({ where: { id: legacyId, userId } })
  if (!legacy) throw new TRPCError({ code: 'NOT_FOUND', message: 'Legacy not found' })
}

/** Throw unless every simId belongs to the given legacy. */
async function assertSimsInLegacy(db: PrismaClient, simIds: string[], legacyId: string) {
  if (simIds.length === 0) return
  const count = await db.sim.count({ where: { id: { in: simIds }, legacyId } })
  if (count !== simIds.length) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'All tagged sims must belong to this legacy' })
  }
}

/** Return the owned milestone's id + legacyId, or throw NOT_FOUND. */
async function findOwnedMilestone(db: PrismaClient, id: string, userId: string) {
  const existing = await db.milestone.findFirst({
    where: { id, legacy: { userId } },
    select: { id: true, legacyId: true },
  })
  if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Milestone not found' })
  return existing
}

export const milestonesRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        legacyId: z.string(),
        title: z.string().min(1).max(120),
        blurb: z.string().max(1000).optional(),
        simIds: z.array(z.string()).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const simIds = [...new Set(input.simIds)]
      await assertOwnedLegacy(ctx.db, input.legacyId, userId)
      await assertSimsInLegacy(ctx.db, simIds, input.legacyId)

      return ctx.db.milestone.create({
        data: {
          legacyId: input.legacyId,
          title: input.title,
          blurb: input.blurb ?? null,
          sortOrder: Date.now(),
          sims: { create: simIds.map((simId) => ({ simId })) },
        },
        include: milestoneInclude,
      })
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(1).max(120),
        blurb: z.string().max(1000).optional(),
        simIds: z.array(z.string()).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const simIds = [...new Set(input.simIds)]
      const existing = await findOwnedMilestone(ctx.db, input.id, userId)
      await assertSimsInLegacy(ctx.db, simIds, existing.legacyId)

      return ctx.db.$transaction(async (tx) => {
        await tx.milestoneSim.deleteMany({ where: { milestoneId: input.id } })
        return tx.milestone.update({
          where: { id: input.id },
          data: {
            title: input.title,
            blurb: input.blurb ?? null,
            sims: { create: simIds.map((simId) => ({ simId })) },
          },
          include: milestoneInclude,
        })
      })
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      await findOwnedMilestone(ctx.db, input.id, userId)
      await ctx.db.milestone.delete({ where: { id: input.id } })
      return { id: input.id }
    }),

  reorder: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        prevSortOrder: z.number().optional(),
        nextSortOrder: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      await findOwnedMilestone(ctx.db, input.id, userId)

      const { prevSortOrder: prev, nextSortOrder: next } = input
      let sortOrder: number
      if (prev !== undefined && next !== undefined) {
        sortOrder = (prev + next) / 2
      } else if (next !== undefined) {
        sortOrder = next + 1000
      } else if (prev !== undefined) {
        sortOrder = prev - 1000
      } else {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'At least one neighbor required' })
      }

      return ctx.db.milestone.update({
        where: { id: input.id },
        data: { sortOrder },
        include: milestoneInclude,
      })
    }),
})
