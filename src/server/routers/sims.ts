import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { FamilyRelationshipType, RomanticStatus } from '@prisma/client'
import { router, protectedProcedure } from '../trpc'
import { assertLegacyOwned, assertLegacyOwnedBySlug, assertSimOwned, assertSimsOwned } from '../lib/auth/ownership'
import { createSim, createSimInput } from '../lib/sims/createSim'
import { updateSim, updateSimInput } from '../lib/sims/updateSim'
import { addSimTrait } from '../lib/sims/traits'
import { upsertSimSkill, setSimSkillLevel } from '../lib/sims/skills'
import { addFamilyRelationship, removeFamilyRelationship } from '../lib/sims/family'
import { addSocialRelationship } from '../lib/sims/social'
import { completeAspiration, endCareer } from '../lib/sims/lifecycle'
import { getTreeData } from '../lib/sims/treeData'
import { getMiniTreeData } from '../lib/sims/buildMiniTree'

export const simsRouter = router({
  create: protectedProcedure
    .input(createSimInput)
    .mutation(async ({ ctx, input }) => {
      const legacy = await assertLegacyOwned(ctx.db, input.legacyId, ctx.session.user.id)
      return createSim(ctx.db, legacy, input)
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      await assertSimOwned(ctx.db, input.id, userId)
      const sim = await ctx.db.sim.findUnique({
        where: { id: input.id },
        include: {
          personalityTraits: { include: { personalityTrait: true } },
          aspirations: { include: { aspiration: true } },
          careers: { include: { career: true } },
          skills: { include: { skill: true } },
          parentsOf: {
            include: { child: { select: { id: true, firstName: true, lastName: true, imageUrl: true } } },
          },
          childOf: {
            include: { parent: { select: { id: true, firstName: true, lastName: true, imageUrl: true, generationNumber: true } } },
          },
          socialRelationshipsA: {
            include: { simB: { select: { id: true, firstName: true, lastName: true, imageUrl: true } } },
          },
          socialRelationshipsB: {
            include: { simA: { select: { id: true, firstName: true, lastName: true, imageUrl: true } } },
          },
        },
      })
      if (!sim) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sim not found' })
      return sim
    }),

  listByLegacy: protectedProcedure
    .input(z.object({ legacyId: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      await assertLegacyOwned(ctx.db, input.legacyId, userId)
      return ctx.db.sim.findMany({
        where: { legacyId: input.legacyId },
        select: { id: true, firstName: true, lastName: true, imageUrl: true },
        orderBy: { firstName: 'asc' },
      })
    }),

  getTreeData: protectedProcedure
    .input(z.object({ legacySlug: z.string().min(1).max(100) }))
    .query(async ({ ctx, input }) => {
      const legacy = await assertLegacyOwnedBySlug(ctx.db, input.legacySlug, ctx.session.user.id)
      return getTreeData(ctx.db, legacy.id, input.legacySlug)
    }),

  getMiniTreeData: protectedProcedure
    .input(z.object({ simId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      await assertSimOwned(ctx.db, input.simId, ctx.session.user.id)
      return getMiniTreeData(ctx.db, input.simId, ctx.session.user.id)
    }),

  update: protectedProcedure
    .input(updateSimInput)
    .mutation(async ({ ctx, input }) => {
      const sim = await assertSimOwned(ctx.db, input.id, ctx.session.user.id)
      return updateSim(ctx.db, sim, input)
    }),

  addTrait: protectedProcedure
    .input(z.object({ simId: z.string(), traitId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const sim = await assertSimOwned(ctx.db, input.simId, ctx.session.user.id)
      return addSimTrait(ctx.db, sim, input.traitId)
    }),

  removeTrait: protectedProcedure
    .input(z.object({ simId: z.string(), traitId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      await assertSimOwned(ctx.db, input.simId, userId)
      return ctx.db.simPersonalityTrait.delete({
        where: {
          simId_personalityTraitId: { simId: input.simId, personalityTraitId: input.traitId },
        },
      })
    }),

  addSkill: protectedProcedure
    .input(z.object({ simId: z.string(), skillId: z.string(), level: z.number().int().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const sim = await assertSimOwned(ctx.db, input.simId, ctx.session.user.id)
      return upsertSimSkill(ctx.db, sim, input.skillId, input.level)
    }),

  setSkillLevel: protectedProcedure
    .input(z.object({ simId: z.string(), skillId: z.string(), level: z.number().int().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const sim = await assertSimOwned(ctx.db, input.simId, ctx.session.user.id)
      return setSimSkillLevel(ctx.db, sim, input.skillId, input.level)
    }),

  removeSkill: protectedProcedure
    .input(z.object({ simId: z.string(), skillId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      await assertSimOwned(ctx.db, input.simId, userId)
      return ctx.db.simSkill.delete({
        where: { simId_skillId: { simId: input.simId, skillId: input.skillId } },
      })
    }),

  addFamilyRelationship: protectedProcedure
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

  removeFamilyRelationship: protectedProcedure
    .input(z.object({ parentId: z.string(), childId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [, child] = await assertSimsOwned(ctx.db, [input.parentId, input.childId], ctx.session.user.id)
      return removeFamilyRelationship(ctx.db, input.parentId, child)
    }),

  addSocialRelationship: protectedProcedure
    .input(
      z.object({
        simAId: z.string(),
        simBId: z.string(),
        romanticStatus: z.nativeEnum(RomanticStatus).default('DATING'),
        // coerce: tRPC's httpBatchLink has no transformer, so a Date arrives as
        // an ISO string over the wire; coerce it back. nullable() short-circuits
        // an explicit null (clear) before coercion runs.
        endedAt: z.coerce.date().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.simAId === input.simBId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'A sim cannot have a relationship with themselves' })
      }
      const [simA, simB] = await assertSimsOwned(ctx.db, [input.simAId, input.simBId], ctx.session.user.id)
      return addSocialRelationship(ctx.db, simA, simB, {
        romanticStatus: input.romanticStatus,
        endedAt: input.endedAt ?? null,
      })
    }),

  updateSocialRelationship: protectedProcedure
    .input(
      z.object({
        simAId: z.string(),
        simBId: z.string(),
        romanticStatus: z.nativeEnum(RomanticStatus),
        // coerce: tRPC's httpBatchLink has no transformer, so a Date arrives as
        // an ISO string over the wire; coerce it back. nullable() short-circuits
        // an explicit null (clear) before coercion runs.
        endedAt: z.coerce.date().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      await assertSimsOwned(ctx.db, [input.simAId, input.simBId], userId)
      const [normalA, normalB] = [input.simAId, input.simBId].sort()
      return ctx.db.socialRelationship.update({
        where: { simAId_simBId: { simAId: normalA, simBId: normalB } },
        data: {
          romanticStatus: input.romanticStatus,
          ...(input.endedAt !== undefined ? { endedAt: input.endedAt } : {}),
        },
      })
    }),

  removeSocialRelationship: protectedProcedure
    .input(z.object({ simAId: z.string(), simBId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      await assertSimsOwned(ctx.db, [input.simAId, input.simBId], userId)
      const [normalA, normalB] = [input.simAId, input.simBId].sort()
      return ctx.db.socialRelationship.delete({
        where: { simAId_simBId: { simAId: normalA, simBId: normalB } },
      })
    }),

  completeAspiration: protectedProcedure
    .input(z.object({ simId: z.string(), aspirationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const sim = await assertSimOwned(ctx.db, input.simId, ctx.session.user.id)
      return completeAspiration(ctx.db, sim, input.aspirationId)
    }),

  endCareer: protectedProcedure
    .input(z.object({ simId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const sim = await assertSimOwned(ctx.db, input.simId, ctx.session.user.id)
      return endCareer(ctx.db, sim)
    }),
})
