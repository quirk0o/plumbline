import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { Prisma, FamilyRelationshipType, RomanticStatus } from '@prisma/client'
import { router, protectedProcedure } from '../trpc'
import { recomputeLegacyTrackers } from '../lib/challenges/trackerComputation'
import { assertLegacyOwned, assertLegacyOwnedBySlug, assertSimOwned, assertSimsOwned } from '../lib/auth/ownership'
import { recomputeGenerations } from '../lib/legacies/generation'
import { createSim, createSimInput } from '../lib/sims/createSim'
import { updateSim, updateSimInput } from '../lib/sims/updateSim'
import { addSimTrait } from '../lib/sims/traits'
import { upsertSimSkill, setSimSkillLevel } from '../lib/sims/skills'

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
      const userId = ctx.session.user.id
      const [parent, child] = await assertSimsOwned(ctx.db, [input.parentId, input.childId], userId)
      if (parent.legacyId !== child.legacyId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Sims must belong to the same legacy' })
      }
      const created = await ctx.db.$transaction(async (tx) => {
        const rel = await tx.familyRelationship.create({
          data: { parentId: input.parentId, childId: input.childId, type: input.type },
        })
        await recomputeGenerations(tx, child.legacyId)
        return rel
      })
      void recomputeLegacyTrackers(ctx.db, child.legacyId)
      return created
    }),

  removeFamilyRelationship: protectedProcedure
    .input(z.object({ parentId: z.string(), childId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const [, child] = await assertSimsOwned(ctx.db, [input.parentId, input.childId], userId)
      await ctx.db.$transaction(async (tx) => {
        await tx.familyRelationship.delete({
          where: { parentId_childId: { parentId: input.parentId, childId: input.childId } },
        })
        await recomputeGenerations(tx, child.legacyId)
      })
      void recomputeLegacyTrackers(ctx.db, child.legacyId)
      return { parentId: input.parentId, childId: input.childId }
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
      const userId = ctx.session.user.id
      const [simA, simB] = await assertSimsOwned(ctx.db, [input.simAId, input.simBId], userId)
      const [normalA, normalB] = [input.simAId, input.simBId].sort()

      const created = await ctx.db.$transaction(async (tx) => {
        const created = await tx.socialRelationship.create({
          data: {
            simAId: normalA,
            simBId: normalB,
            romanticStatus: input.romanticStatus,
            endedAt: input.endedAt ?? null,
            friendshipScore: 0,
            romanceScore: 0,
          },
        })
        // Partner adoption: when exactly one sim is a root (no parents) and the
        // other is derived (has parents), the root adopts the derived sim's
        // generation. Counting inside the transaction closes the TOCTOU window
        // against a concurrent family-edge change. Overridable later via the
        // detail page.
        const [aParents, bParents] = await Promise.all([
          tx.familyRelationship.count({ where: { childId: simA.id } }),
          tx.familyRelationship.count({ where: { childId: simB.id } }),
        ])
        let adopt: { id: string; generationNumber: number } | null = null
        if (aParents === 0 && bParents > 0) adopt = { id: simA.id, generationNumber: simB.generationNumber }
        else if (bParents === 0 && aParents > 0) adopt = { id: simB.id, generationNumber: simA.generationNumber }
        if (adopt) {
          await tx.sim.update({ where: { id: adopt.id }, data: { generationNumber: adopt.generationNumber } })
          await recomputeGenerations(tx, simA.legacyId)
        }
        return { created, adopted: adopt !== null }
      })
      if (created.adopted) void recomputeLegacyTrackers(ctx.db, simA.legacyId)
      return created.created
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
      const userId = ctx.session.user.id
      const sim = await assertSimOwned(ctx.db, input.simId, userId)

      const record = await ctx.db.simAspiration.findUnique({
        where: { simId_aspirationId: { simId: input.simId, aspirationId: input.aspirationId } },
      })
      if (!record) throw new TRPCError({ code: 'NOT_FOUND', message: 'Aspiration not found on this sim' })
      if (record.completedAt) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Aspiration already completed' })

      await ctx.db.simAspiration.update({
        where: { simId_aspirationId: { simId: input.simId, aspirationId: input.aspirationId } },
        data: { completedAt: new Date() },
      })
      void recomputeLegacyTrackers(ctx.db, sim.legacyId)
    }),

  endCareer: protectedProcedure
    .input(z.object({ simId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const sim = await assertSimOwned(ctx.db, input.simId, userId)

      const activeCareer = await ctx.db.simCareer.findFirst({
        where: { simId: input.simId, endedAt: null },
      })
      if (!activeCareer) throw new TRPCError({ code: 'NOT_FOUND', message: 'No active career to end' })

      await ctx.db.simCareer.update({
        where: { id: activeCareer.id },
        data: { endedAt: new Date() },
      })
      void recomputeLegacyTrackers(ctx.db, sim.legacyId)
    }),
})
