import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { Prisma, Gender, LifeStage, OccultType, EmploymentType, CauseOfDeath, FamilyRelationshipType, RomanticStatus } from '@prisma/client'
import { router, protectedProcedure } from '../trpc'
import { assertNoTraitConflicts } from './validate-traits'
import { recomputeLegacyTrackers } from '../lib/trackerComputation'

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

const miniTreeSimSelect = {
  id: true, firstName: true, lastName: true, imageUrl: true, generationNumber: true,
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
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const legacy = await ctx.db.legacy.findFirst({ where: { id: input.legacyId, userId } })
      if (!legacy) throw new TRPCError({ code: 'NOT_FOUND', message: 'Legacy not found' })

      const traitIds = input.personalityTraitIds ?? []
      await assertNoTraitConflicts(ctx.db, traitIds)

      let household = await ctx.db.household.findFirst({ where: { legacyId: input.legacyId } })
      if (!household) {
        household = await ctx.db.household.create({
          data: { name: 'Household 1', legacyId: input.legacyId },
        })
      }

      const { legacyId: _legacyId, personalityTraitIds, aspirationId, careerId, parentIds: _parentIds, generationNumber: _gen, ...simFields } = input

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
        if (!generationNumber) {
          const parentGens = parents.map((p) => p.generationNumber).filter((g): g is number => g !== null)
          if (parentGens.length > 0) generationNumber = Math.min(...parentGens) + 1
        }
      }

      const newSim = await ctx.db.sim.create({
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
          householdId: household.id,
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
        await ctx.db.familyRelationship.createMany({
          data: parents.map((parent) => ({
            parentId: parent.id,
            childId: newSim.id,
            type: FamilyRelationshipType.BIOLOGICAL,
          })),
          skipDuplicates: true,
        })
      }

      return newSim
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const sim = await ctx.db.sim.findFirst({
        where: { id: input.id, legacy: { userId } },
        include: {
          personalityTraits: { include: { personalityTrait: true } },
          aspirations: { include: { aspiration: true } },
          careers: { include: { career: true } },
          skills: { include: { skill: true } },
          parentsOf: {
            include: { child: { select: { id: true, firstName: true, lastName: true, imageUrl: true } } },
          },
          childOf: {
            include: { parent: { select: { id: true, firstName: true, lastName: true, imageUrl: true } } },
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
      const legacy = await ctx.db.legacy.findFirst({ where: { id: input.legacyId, userId } })
      if (!legacy) throw new TRPCError({ code: 'NOT_FOUND', message: 'Legacy not found' })
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
      const legacy = await ctx.db.legacy.findFirst({
        where: { slug: input.legacySlug, userId },
      })
      if (!legacy) throw new TRPCError({ code: 'NOT_FOUND', message: 'Legacy not found' })

      const [sims, familyEdges, partnerEdges] = await Promise.all([
        ctx.db.sim.findMany({
          where: { legacyId: legacy.id },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            imageUrl: true,
            generationNumber: true,
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
          select: { simAId: true, simBId: true },
          orderBy: { simAId: 'asc' },
        }),
      ])

      return {
        sims: sims.map((s) => ({ ...s, href: `/app/legacies/${input.legacySlug}/sims/${s.id}` })),
        familyEdges: familyEdges.map((e) => ({ parentId: e.parentId, childId: e.childId })),
        partnerEdges: partnerEdges.map((e) => ({ simAId: e.simAId, simBId: e.simBId })),
      }
    }),

  getMiniTreeData: protectedProcedure
    .input(z.object({ simId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id

      const focusedSim = await ctx.db.sim.findFirst({
        where: { id: input.simId, legacy: { userId } },
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
                    select: { simAId: true, simBId: true },
                    orderBy: { simAId: 'asc' },
                  },
                  socialRelationshipsB: {
                    where: { romanticStatus: { not: RomanticStatus.NONE } },
                    select: { simAId: true, simBId: true },
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
            select: { simAId: true, simBId: true },
            orderBy: { simAId: 'asc' },
          },
          socialRelationshipsB: {
            where: { romanticStatus: { not: RomanticStatus.NONE } },
            select: { simAId: true, simBId: true },
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
      const partnerEdges: { simAId: string; simBId: string }[] = []

      function addSim(s: MiniTreeSimData) {
        if (!simMap.has(s.id)) simMap.set(s.id, { ...s, href: `/app/legacies/${legacySlug}/sims/${s.id}` })
      }
      function addFamilyEdge(parentId: string, childId: string) {
        const key = `${parentId}-${childId}`
        if (!familyEdgeSet.has(key)) { familyEdgeSet.add(key); familyEdges.push({ parentId, childId }) }
      }
      function addPartnerEdge(simAId: string, simBId: string) {
        const [a, b] = [simAId, simBId].sort()
        const key = `${a}-${b}`
        if (!partnerEdgeSet.has(key)) { partnerEdgeSet.add(key); partnerEdges.push({ simAId: a, simBId: b }) }
      }

      addSim(focusedSim)
      focusedSim.socialRelationshipsA.forEach((r) => addPartnerEdge(r.simAId, r.simBId))
      focusedSim.socialRelationshipsB.forEach((r) => addPartnerEdge(r.simAId, r.simBId))

      for (const parentRel of focusedSim.childOf) {
        const parent = parentRel.parent
        addSim(parent)
        addFamilyEdge(parent.id, focusedSim.id)
        parent.socialRelationshipsA.forEach((r) => addPartnerEdge(r.simAId, r.simBId))
        parent.socialRelationshipsB.forEach((r) => addPartnerEdge(r.simAId, r.simBId))
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
        const partnerSims = await ctx.db.sim.findMany({
          where: { id: { in: missingPartnerIds }, legacy: { userId } },
          select: miniTreeSimSelect,
          orderBy: { id: 'asc' },
        })
        partnerSims.forEach(addSim)
      }

      return { sims: Array.from(simMap.values()), familyEdges, partnerEdges }
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
        generationNumber: z.number().int().min(1).nullable().optional(),
        isHeir: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const sim = await ctx.db.sim.findFirst({ where: { id: input.id, legacy: { userId } } })
      if (!sim) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sim not found' })

      const { id, aspirationId, careerId, ...fields } = input

      if (aspirationId !== undefined) {
        await ctx.db.simAspiration.deleteMany({ where: { simId: id, completedAt: null } })
        if (aspirationId) await ctx.db.simAspiration.create({ data: { simId: id, aspirationId } })
      }

      if (careerId !== undefined) {
        await ctx.db.simCareer.deleteMany({ where: { simId: id, endedAt: null } })
        if (careerId) {
          await ctx.db.simCareer.create({
            data: { simId: id, careerId, employmentType: EmploymentType.EMPLOYED, startedAt: new Date() },
          })
        }
      }

      let result: Awaited<ReturnType<typeof ctx.db.sim.update>>
      if (input.isHeir === true) {
        if (sim.generationNumber !== null && sim.generationNumber !== undefined) {
          result = await ctx.db.$transaction(async (tx) => {
            await tx.sim.updateMany({
              where: {
                legacyId: sim.legacyId,
                generationNumber: sim.generationNumber,
                isHeir: true,
                NOT: { id: input.id },
              },
              data: { isHeir: false },
            })
            return tx.sim.update({ where: { id }, data: fields })
          })
        } else {
          result = await ctx.db.sim.update({ where: { id }, data: fields })
        }
      } else {
        result = await ctx.db.sim.update({ where: { id }, data: fields })
      }

      const recomputeFields = ['generationNumber', 'lifeStage', 'isHeir', 'causeOfDeath', 'occultType'] as const
      const needsRecompute = recomputeFields.some((f) => input[f] !== undefined)
      if (needsRecompute) void recomputeLegacyTrackers(ctx.db, result.legacyId)
      return result
    }),

  addTrait: protectedProcedure
    .input(z.object({ simId: z.string(), traitId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const sim = await ctx.db.sim.findFirst({
        where: { id: input.simId, legacy: { userId } },
        include: { personalityTraits: { select: { personalityTraitId: true } } },
      })
      if (!sim) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sim not found' })
      if (sim.personalityTraits.length >= 6)
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Maximum 6 traits allowed' })
      const currentIds = sim.personalityTraits.map((t) => t.personalityTraitId)
      await assertNoTraitConflicts(ctx.db, [...currentIds, input.traitId])
      return ctx.db.simPersonalityTrait.create({
        data: { simId: input.simId, personalityTraitId: input.traitId },
      })
    }),

  removeTrait: protectedProcedure
    .input(z.object({ simId: z.string(), traitId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const sim = await ctx.db.sim.findFirst({ where: { id: input.simId, legacy: { userId } } })
      if (!sim) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sim not found' })
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
      const sim = await ctx.db.sim.findFirst({ where: { id: input.simId, legacy: { userId } } })
      if (!sim) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sim not found' })
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
      const sim = await ctx.db.sim.findFirst({ where: { id: input.simId, legacy: { userId } } })
      if (!sim) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sim not found' })
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
      const sim = await ctx.db.sim.findFirst({ where: { id: input.simId, legacy: { userId } } })
      if (!sim) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sim not found' })
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
      const [parent, child] = await Promise.all([
        ctx.db.sim.findFirst({ where: { id: input.parentId, legacy: { userId } } }),
        ctx.db.sim.findFirst({ where: { id: input.childId, legacy: { userId } } }),
      ])
      if (!parent || !child) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sim not found' })
      if (parent.legacyId !== child.legacyId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Sims must belong to the same legacy' })
      }
      const created = await ctx.db.familyRelationship.create({
        data: { parentId: input.parentId, childId: input.childId, type: input.type },
      })
      if (child.generationNumber === null) {
        const allParents = await ctx.db.familyRelationship.findMany({
          where: { childId: input.childId },
          select: { parent: { select: { generationNumber: true } } },
        })
        const parentGens = allParents
          .map((r) => r.parent.generationNumber)
          .filter((g): g is number => g !== null)
        if (parentGens.length > 0) {
          await ctx.db.sim.update({
            where: { id: input.childId },
            data: { generationNumber: Math.min(...parentGens) + 1 },
          })
          void recomputeLegacyTrackers(ctx.db, child.legacyId)
        }
      }
      return created
    }),

  removeFamilyRelationship: protectedProcedure
    .input(z.object({ parentId: z.string(), childId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const [parent, child] = await Promise.all([
        ctx.db.sim.findFirst({ where: { id: input.parentId, legacy: { userId } } }),
        ctx.db.sim.findFirst({ where: { id: input.childId, legacy: { userId } } }),
      ])
      if (!parent || !child) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sim not found' })
      const deleted = await ctx.db.familyRelationship.delete({
        where: { parentId_childId: { parentId: input.parentId, childId: input.childId } },
      })
      const remainingParents = await ctx.db.familyRelationship.findMany({
        where: { childId: input.childId },
        select: { parent: { select: { generationNumber: true } } },
      })
      const parentGens = remainingParents
        .map((r) => r.parent.generationNumber)
        .filter((g): g is number => g !== null)
      let newGen: number | null
      if (parentGens.length > 0) {
        newGen = Math.min(...parentGens) + 1
      } else if (remainingParents.length === 0) {
        newGen = null
      } else {
        return deleted
      }
      if (newGen !== child.generationNumber) {
        await ctx.db.sim.update({ where: { id: input.childId }, data: { generationNumber: newGen } })
        void recomputeLegacyTrackers(ctx.db, child.legacyId)
      }
      return deleted
    }),

  addSocialRelationship: protectedProcedure
    .input(
      z.object({
        simAId: z.string(),
        simBId: z.string(),
        romanticStatus: z.nativeEnum(RomanticStatus).default('DATING'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.simAId === input.simBId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'A sim cannot have a relationship with themselves' })
      }
      const userId = ctx.session.user.id
      const [simA, simB] = await Promise.all([
        ctx.db.sim.findFirst({ where: { id: input.simAId, legacy: { userId } } }),
        ctx.db.sim.findFirst({ where: { id: input.simBId, legacy: { userId } } }),
      ])
      if (!simA || !simB) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sim not found' })
      const [normalA, normalB] = [input.simAId, input.simBId].sort()
      const created = await ctx.db.socialRelationship.create({
        data: {
          simAId: normalA,
          simBId: normalB,
          romanticStatus: input.romanticStatus,
          friendshipScore: 0,
          romanceScore: 0,
        },
      })
      const noGenSim =
        simA.generationNumber === null && simB.generationNumber !== null ? simA
        : simB.generationNumber === null && simA.generationNumber !== null ? simB
        : null
      if (noGenSim !== null) {
        const gen = (noGenSim === simA ? simB : simA).generationNumber!
        await ctx.db.sim.update({ where: { id: noGenSim.id }, data: { generationNumber: gen } })
        void recomputeLegacyTrackers(ctx.db, noGenSim.legacyId)
      }
      return created
    }),

  updateSocialRelationship: protectedProcedure
    .input(
      z.object({
        simAId: z.string(),
        simBId: z.string(),
        romanticStatus: z.nativeEnum(RomanticStatus),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const sim = await ctx.db.sim.findFirst({ where: { id: input.simAId, legacy: { userId } } })
      if (!sim) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sim not found' })
      const [normalA, normalB] = [input.simAId, input.simBId].sort()
      return ctx.db.socialRelationship.update({
        where: { simAId_simBId: { simAId: normalA, simBId: normalB } },
        data: { romanticStatus: input.romanticStatus },
      })
    }),

  removeSocialRelationship: protectedProcedure
    .input(z.object({ simAId: z.string(), simBId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const sim = await ctx.db.sim.findFirst({ where: { id: input.simAId, legacy: { userId } } })
      if (!sim) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sim not found' })
      const [normalA, normalB] = [input.simAId, input.simBId].sort()
      return ctx.db.socialRelationship.delete({
        where: { simAId_simBId: { simAId: normalA, simBId: normalB } },
      })
    }),

  completeAspiration: protectedProcedure
    .input(z.object({ simId: z.string(), aspirationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const sim = await ctx.db.sim.findFirst({
        where: { id: input.simId, legacy: { userId } },
        select: { id: true, legacyId: true },
      })
      if (!sim) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sim not found' })

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
      const sim = await ctx.db.sim.findFirst({
        where: { id: input.simId, legacy: { userId } },
        select: { id: true, legacyId: true },
      })
      if (!sim) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sim not found' })

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
