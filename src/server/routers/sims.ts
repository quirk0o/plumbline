import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { Prisma, FamilyRelationshipType, RomanticStatus } from '@prisma/client'
import { router, protectedProcedure } from '../trpc'
import { assertLegacyOwned, assertLegacyOwnedBySlug, assertSimOwned, assertSimsOwned } from '../lib/auth/ownership'
import { createSim, createSimInput } from '../lib/sims/createSim'
import { updateSim, updateSimInput } from '../lib/sims/updateSim'
import { addSimTrait } from '../lib/sims/traits'
import { upsertSimSkill, setSimSkillLevel } from '../lib/sims/skills'
import { addFamilyRelationship, removeFamilyRelationship } from '../lib/sims/family'
import { addSocialRelationship } from '../lib/sims/social'
import { completeAspiration, endCareer } from '../lib/sims/lifecycle'

const miniTreeSimSelect = {
  id: true, firstName: true, lastName: true, imageUrl: true, generationNumber: true,
  lifeStage: true, isHeir: true, gender: true, causeOfDeath: true,
} as const

export type MiniTreeSimData = Prisma.SimGetPayload<{ select: typeof miniTreeSimSelect }>

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
      const userId = ctx.session.user.id
      const legacy = await assertLegacyOwnedBySlug(ctx.db, input.legacySlug, userId)

      const [sims, familyEdges, partnerEdges] = await Promise.all([
        ctx.db.sim.findMany({
          where: { legacyId: legacy.id },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            imageUrl: true,
            generationNumber: true,
            lifeStage: true,
            isHeir: true,
            gender: true,
            causeOfDeath: true,
          },
          orderBy: { id: 'asc' },
        }),
        ctx.db.familyRelationship.findMany({
          where: {
            parent: { legacyId: legacy.id },
            child: { legacyId: legacy.id },
            type: { in: [FamilyRelationshipType.BIOLOGICAL, FamilyRelationshipType.ADOPTIVE] },
          },
          select: { parentId: true, childId: true },
          orderBy: { parentId: 'asc' },
        }),
        ctx.db.socialRelationship.findMany({
          where: {
            AND: [
              { simA: { legacyId: legacy.id } },
              { simB: { legacyId: legacy.id } },
            ],
            romanticStatus: { not: RomanticStatus.NONE },
          },
          select: { simAId: true, simBId: true, romanticStatus: true, endedAt: true },
          orderBy: { simAId: 'asc' },
        }),
      ])

      return {
        sims: sims.map(({ causeOfDeath, ...s }) => ({
          ...s,
          isDeceased: causeOfDeath !== null,
          href: `/app/legacies/${input.legacySlug}/sims/${s.id}`,
        })),
        familyEdges: familyEdges.map((e) => ({ parentId: e.parentId, childId: e.childId })),
        partnerEdges: partnerEdges.map((e) => ({
          simAId: e.simAId,
          simBId: e.simBId,
          romanticStatus: e.romanticStatus,
          endedAt: e.endedAt,
        })),
      }
    }),

  getMiniTreeData: protectedProcedure
    .input(z.object({ simId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      await assertSimOwned(ctx.db, input.simId, userId)

      const focusedSim = await ctx.db.sim.findUnique({
        where: { id: input.simId },
        select: {
          ...miniTreeSimSelect,
          legacy: { select: { slug: true } },
          childOf: {
            where: { type: { in: [FamilyRelationshipType.BIOLOGICAL, FamilyRelationshipType.ADOPTIVE] } },
            select: {
              parentId: true,
              parent: {
                select: {
                  ...miniTreeSimSelect,
                  childOf: {
                    where: { type: { in: [FamilyRelationshipType.BIOLOGICAL, FamilyRelationshipType.ADOPTIVE] } },
                    select: {
                      parentId: true,
                      parent: {
                        select: miniTreeSimSelect,
                      },
                    },
                  },
                  socialRelationshipsA: {
                    where: { romanticStatus: { not: RomanticStatus.NONE } },
                    select: { simAId: true, simBId: true, romanticStatus: true, endedAt: true },
                    orderBy: { simAId: 'asc' },
                  },
                  socialRelationshipsB: {
                    where: { romanticStatus: { not: RomanticStatus.NONE } },
                    select: { simAId: true, simBId: true, romanticStatus: true, endedAt: true },
                    orderBy: { simAId: 'asc' },
                  },
                },
              },
            },
          },
          parentsOf: {
            where: { type: { in: [FamilyRelationshipType.BIOLOGICAL, FamilyRelationshipType.ADOPTIVE] } },
            select: {
              childId: true,
              child: { select: miniTreeSimSelect },
            },
          },
          socialRelationshipsA: {
            where: { romanticStatus: { not: RomanticStatus.NONE } },
            select: { simAId: true, simBId: true, romanticStatus: true, endedAt: true },
            orderBy: { simAId: 'asc' },
          },
          socialRelationshipsB: {
            where: { romanticStatus: { not: RomanticStatus.NONE } },
            select: { simAId: true, simBId: true, romanticStatus: true, endedAt: true },
            orderBy: { simAId: 'asc' },
          },
        },
      })
      if (!focusedSim) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sim not found' })

      const legacySlug = focusedSim.legacy.slug

      const simMap = new Map<string, MiniTreeSimData & { href: string }>()
      const familyEdgeSet = new Set<string>()
      const partnerEdgeSet = new Set<string>()
      const familyEdges: { parentId: string; childId: string }[] = []
      const partnerEdges: { simAId: string; simBId: string; romanticStatus: RomanticStatus; endedAt: Date | null }[] = []

      function addSim(s: MiniTreeSimData) {
        if (!simMap.has(s.id)) simMap.set(s.id, { ...s, href: `/app/legacies/${legacySlug}/sims/${s.id}` })
      }
      function addFamilyEdge(parentId: string, childId: string) {
        const key = `${parentId}-${childId}`
        if (!familyEdgeSet.has(key)) { familyEdgeSet.add(key); familyEdges.push({ parentId, childId }) }
      }
      function addPartnerEdge(simAId: string, simBId: string, romanticStatus: RomanticStatus, endedAt: Date | null) {
        const [a, b] = [simAId, simBId].sort()
        const key = `${a}-${b}`
        if (!partnerEdgeSet.has(key)) { partnerEdgeSet.add(key); partnerEdges.push({ simAId: a, simBId: b, romanticStatus, endedAt }) }
      }

      addSim(focusedSim)
      focusedSim.socialRelationshipsA.forEach((r) => addPartnerEdge(r.simAId, r.simBId, r.romanticStatus, r.endedAt))
      focusedSim.socialRelationshipsB.forEach((r) => addPartnerEdge(r.simAId, r.simBId, r.romanticStatus, r.endedAt))

      for (const parentRel of focusedSim.childOf) {
        const parent = parentRel.parent
        addSim(parent)
        addFamilyEdge(parent.id, focusedSim.id)
        parent.socialRelationshipsA.forEach((r) => addPartnerEdge(r.simAId, r.simBId, r.romanticStatus, r.endedAt))
        parent.socialRelationshipsB.forEach((r) => addPartnerEdge(r.simAId, r.simBId, r.romanticStatus, r.endedAt))
        for (const gpRel of parent.childOf) {
          addSim(gpRel.parent)
          addFamilyEdge(gpRel.parent.id, parent.id)
        }
      }

      for (const childRel of focusedSim.parentsOf) {
        addSim(childRel.child)
        addFamilyEdge(focusedSim.id, childRel.child.id)
      }

      // Fetch any partner sims not yet in the map
      const missingPartnerIds = [...new Set(
        partnerEdges
          .flatMap((e) => [e.simAId, e.simBId])
          .filter((id) => !simMap.has(id))
      )]
      if (missingPartnerIds.length > 0) {
        // Ownership *filter*, not a guard: partner sims outside the user's
        // legacies are intentionally omitted from the mini tree. This is the
        // one sanctioned inline ownership condition outside src/server/lib/auth/ownership.ts.
        const partnerSims = await ctx.db.sim.findMany({
          where: { id: { in: missingPartnerIds }, legacy: { userId } },
          select: miniTreeSimSelect,
          orderBy: { id: 'asc' },
        })
        partnerSims.forEach(addSim)
      }

      return {
        sims: Array.from(simMap.values()).map(({ causeOfDeath, ...s }) => ({ ...s, isDeceased: causeOfDeath !== null })),
        familyEdges,
        partnerEdges,
      }
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
