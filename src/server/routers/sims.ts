import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { Prisma, Gender, LifeStage, OccultType, EmploymentType, CauseOfDeath, FamilyRelationshipType, RomanticStatus } from '@prisma/client'
import { router, protectedProcedure } from '../trpc'
import { assertNoTraitConflicts } from './validate-traits'
import { recomputeLegacyTrackers } from '../lib/trackerComputation'
import { imageUrlSchema } from '../lib/image-url-schema'
import { assertLegacyOwned, assertLegacyOwnedBySlug, assertSimOwned, assertSimsOwned } from '../lib/ownership'
import { deriveGeneration, recomputeGenerations } from '../lib/generation'
import { isLifeStageInRange } from '@/lib/life-stage'

const miniTreeSimSelect = {
  id: true, firstName: true, lastName: true, imageUrl: true, generationNumber: true,
  lifeStage: true, isHeir: true, causeOfDeath: true,
} as const

export type MiniTreeSimData = Prisma.SimGetPayload<{ select: typeof miniTreeSimSelect }>

export const simsRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        legacyId: z.string(),
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
        generationNumber: z.number().int().min(1).optional(),
        parentIds: z.array(z.string()).optional(),
        householdId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const legacy = await assertLegacyOwned(ctx.db, input.legacyId, userId)

      const traitIds = input.personalityTraitIds ?? []
      await assertNoTraitConflicts(ctx.db, traitIds)

      if (input.householdId) {
        const household = await ctx.db.household.findFirst({
          where: { id: input.householdId, legacyId: input.legacyId },
          select: { id: true },
        })
        if (!household) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Household must belong to this legacy' })
        }
      }

      const { legacyId: _legacyId, personalityTraitIds, aspirationId, careerId, parentIds: _parentIds, generationNumber: _gen, householdId, ...simFields } = input

      let generationNumber = input.generationNumber ?? null
      let parents: { id: string; generationNumber: number | null }[] = []
      if (input.parentIds?.length) {
        parents = await ctx.db.sim.findMany({
          where: { id: { in: input.parentIds }, legacyId: input.legacyId },
          select: { id: true, generationNumber: true },
        })
        if (parents.length !== input.parentIds.length) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'One or more parentIds do not belong to this legacy' })
        }
        // A sim with parents is derived; derivation always wins.
        const parentGens = parents.map((p) => p.generationNumber).filter((g): g is number => g !== null)
        generationNumber = parentGens.length > 0 ? deriveGeneration(parentGens) : null
      }

      // A legacy with no founder adopts its first parentless sim as the founder.
      const willBeFounder = !legacy.founderSimId && parents.length === 0

      if (generationNumber === null) {
        // Parentless sims (founders, partners, separate subtree roots) are roots:
        // default to the legacy's current latest generation, or 1 when empty.
        const agg = await ctx.db.sim.aggregate({
          where: { legacyId: input.legacyId },
          _max: { generationNumber: true },
        })
        generationNumber = agg._max.generationNumber ?? 1
      }

      return ctx.db.$transaction(async (tx) => {
        const newSim = await tx.sim.create({
          data: {
            legacyId: input.legacyId,
            firstName: simFields.firstName,
            lastName: simFields.lastName,
            gender: simFields.gender,
            lifeStage: simFields.lifeStage,
            pronounSubject: simFields.pronounSubject ?? null,
            pronounObject: simFields.pronounObject ?? null,
            pronounPossessive: simFields.pronounPossessive ?? null,
            imageUrl: simFields.imageUrl ?? null,
            occultType: simFields.occultType ?? null,
            generationNumber,
            householdId: householdId ?? null,
            ...(personalityTraitIds?.length
              ? { personalityTraits: { create: personalityTraitIds.map((id) => ({ personalityTraitId: id })) } }
              : {}),
            ...(aspirationId ? { aspirations: { create: { aspirationId } } } : {}),
            ...(careerId
              ? { careers: { create: { careerId, employmentType: EmploymentType.EMPLOYED, startedAt: new Date() } } }
              : {}),
          },
        })

        if (parents.length > 0) {
          await tx.familyRelationship.createMany({
            data: parents.map((parent) => ({
              parentId: parent.id,
              childId: newSim.id,
              type: FamilyRelationshipType.BIOLOGICAL,
            })),
            skipDuplicates: true,
          })
        }

        if (willBeFounder) {
          // willBeFounder came from a pre-transaction read, so only claim the
          // founder slot if it is still empty; failing here rolls back the
          // whole create instead of silently overwriting a concurrently
          // designated founder.
          const claimed = await tx.legacy.updateMany({
            where: { id: legacy.id, founderSimId: null },
            data: { founderSimId: newSim.id },
          })
          if (claimed.count === 0) {
            throw new TRPCError({ code: 'CONFLICT', message: 'Legacy already has a founder' })
          }
        }

        return newSim
      })
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
        // one sanctioned inline ownership condition outside src/server/lib/ownership.ts.
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
    .input(
      z.object({
        id: z.string(),
        firstName: z.string().min(1).max(50).optional(),
        lastName: z.string().min(1).max(50).optional(),
        gender: z.nativeEnum(Gender).optional(),
        lifeStage: z.nativeEnum(LifeStage).optional(),
        pronounSubject: z.string().max(20).nullable().optional(),
        pronounObject: z.string().max(20).nullable().optional(),
        pronounPossessive: z.string().max(20).nullable().optional(),
        imageUrl: imageUrlSchema.nullable().optional(),
        occultType: z.nativeEnum(OccultType).nullable().optional(),
        causeOfDeath: z.nativeEnum(CauseOfDeath).nullable().optional(),
        aspirationId: z.string().nullable().optional(),
        careerId: z.string().nullable().optional(),
        generationNumber: z.number().int().min(1).optional(),
        isHeir: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const sim = await assertSimOwned(ctx.db, input.id, userId)

      if (input.generationNumber !== undefined) {
        const parentCount = await ctx.db.familyRelationship.count({ where: { childId: input.id } })
        if (parentCount > 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Generation is derived from parents and cannot be set directly',
          })
        }
      }

      const { id, aspirationId, careerId, ...fields } = input

      const result = await ctx.db.$transaction(async (tx) => {
        if (aspirationId !== undefined) {
          await tx.simAspiration.deleteMany({ where: { simId: id, completedAt: null } })
          if (aspirationId) await tx.simAspiration.create({ data: { simId: id, aspirationId } })
        }

        if (careerId !== undefined) {
          await tx.simCareer.deleteMany({ where: { simId: id, endedAt: null } })
          if (careerId) {
            await tx.simCareer.create({
              data: { simId: id, careerId, employmentType: EmploymentType.EMPLOYED, startedAt: new Date() },
            })
          }
        }

        if (input.isHeir === true) {
          // Clear heirs in the generation the sim ends up in: an explicit
          // generationNumber in this update wins; otherwise re-read the current
          // value inside the transaction so a concurrent generation change
          // cannot make us clear a stale cohort.
          const targetGeneration =
            input.generationNumber !== undefined
              ? input.generationNumber
              : (
                  await tx.sim.findUniqueOrThrow({
                    where: { id },
                    select: { generationNumber: true },
                  })
                ).generationNumber
          await tx.sim.updateMany({
            where: {
              legacyId: sim.legacyId,
              generationNumber: targetGeneration,
              isHeir: true,
              NOT: { id: input.id },
            },
            data: { isHeir: false },
          })
        }

        return tx.sim.update({ where: { id }, data: fields })
      })

      const recomputeFields = ['generationNumber', 'lifeStage', 'isHeir', 'causeOfDeath', 'occultType'] as const
      const needsRecompute = recomputeFields.some((f) => input[f] !== undefined)
      if (input.generationNumber !== undefined) {
        await ctx.db.$transaction((tx) => recomputeGenerations(tx, result.legacyId))
      }
      if (needsRecompute) void recomputeLegacyTrackers(ctx.db, result.legacyId)
      return result
    }),

  addTrait: protectedProcedure
    .input(z.object({ simId: z.string(), traitId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const [sim, trait, currentTraits] = await Promise.all([
        assertSimOwned(ctx.db, input.simId, userId),
        ctx.db.personalityTrait.findUnique({
          where: { id: input.traitId },
          select: { minLifeStage: true, maxLifeStage: true },
        }),
        ctx.db.simPersonalityTrait.findMany({
          where: { simId: input.simId },
          select: { personalityTraitId: true },
        }),
      ])
      if (!trait) throw new TRPCError({ code: 'NOT_FOUND', message: 'Trait not found' })
      if (!isLifeStageInRange(sim.lifeStage, trait.minLifeStage, trait.maxLifeStage))
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Trait not available for this life stage' })
      if (currentTraits.length >= 6)
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Maximum 6 traits allowed' })
      const currentIds = currentTraits.map((t) => t.personalityTraitId)
      await assertNoTraitConflicts(ctx.db, [...currentIds, input.traitId])
      return ctx.db.simPersonalityTrait.create({
        data: { simId: input.simId, personalityTraitId: input.traitId },
      })
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
      const userId = ctx.session.user.id
      const sim = await assertSimOwned(ctx.db, input.simId, userId)
      const skill = await ctx.db.skill.findUnique({ where: { id: input.skillId } })
      if (!skill) throw new TRPCError({ code: 'NOT_FOUND', message: 'Skill not found' })
      if (input.level > skill.maxLevel)
        throw new TRPCError({ code: 'BAD_REQUEST', message: `Level cannot exceed ${skill.maxLevel}` })
      const result = await ctx.db.simSkill.upsert({
        where: { simId_skillId: { simId: input.simId, skillId: input.skillId } },
        create: { simId: input.simId, skillId: input.skillId, level: input.level },
        update: { level: input.level },
      })
      await recomputeLegacyTrackers(ctx.db, sim.legacyId)
      return result
    }),

  setSkillLevel: protectedProcedure
    .input(z.object({ simId: z.string(), skillId: z.string(), level: z.number().int().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const sim = await assertSimOwned(ctx.db, input.simId, userId)
      const skill = await ctx.db.skill.findUnique({ where: { id: input.skillId } })
      if (!skill) throw new TRPCError({ code: 'NOT_FOUND', message: 'Skill not found' })
      if (input.level > skill.maxLevel)
        throw new TRPCError({ code: 'BAD_REQUEST', message: `Level cannot exceed ${skill.maxLevel}` })
      const result = await ctx.db.simSkill.update({
        where: { simId_skillId: { simId: input.simId, skillId: input.skillId } },
        data: { level: input.level },
      })
      await recomputeLegacyTrackers(ctx.db, sim.legacyId)
      return result
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
      await ctx.db.$transaction(async (tx) => {
        await tx.familyRelationship.create({
          data: { parentId: input.parentId, childId: input.childId, type: input.type },
        })
        await recomputeGenerations(tx, child.legacyId)
      })
      void recomputeLegacyTrackers(ctx.db, child.legacyId)
      return ctx.db.familyRelationship.findUniqueOrThrow({
        where: { parentId_childId: { parentId: input.parentId, childId: input.childId } },
      })
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

      // Partner adoption: when exactly one sim is a root (no parents) and the
      // other is derived (has parents), the root adopts the derived sim's
      // generation. Overridable later via the detail page.
      const [aParents, bParents] = await Promise.all([
        ctx.db.familyRelationship.count({ where: { childId: simA.id } }),
        ctx.db.familyRelationship.count({ where: { childId: simB.id } }),
      ])
      const aIsRoot = aParents === 0
      const bIsRoot = bParents === 0
      let adopt: { id: string; generationNumber: number } | null = null
      if (aIsRoot && !bIsRoot) adopt = { id: simA.id, generationNumber: simB.generationNumber }
      else if (bIsRoot && !aIsRoot) adopt = { id: simB.id, generationNumber: simA.generationNumber }

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
        if (adopt) {
          await tx.sim.update({ where: { id: adopt.id }, data: { generationNumber: adopt.generationNumber } })
          await recomputeGenerations(tx, simA.legacyId)
        }
        return created
      })
      if (adopt) void recomputeLegacyTrackers(ctx.db, simA.legacyId)
      return created
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
