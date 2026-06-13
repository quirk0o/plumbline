import { TRPCError } from '@trpc/server'
import {
  FamilyRelationshipType,
  RomanticStatus,
  type Prisma,
  type PrismaClient,
} from '@prisma/client'

export const miniTreeSimSelect = {
  id: true, firstName: true, lastName: true, imageUrl: true, generationNumber: true,
  lifeStage: true, isHeir: true, gender: true, causeOfDeath: true,
} as const

export type MiniTreeSimData = Prisma.SimGetPayload<{ select: typeof miniTreeSimSelect }>

type PartnerEdge = { simAId: string; simBId: string; romanticStatus: RomanticStatus; endedAt: Date | null }

export type MiniTreeGraph = {
  // Partner hrefs are built under the focused sim's legacy slug, even for
  // partners from another legacy — existing behavior, preserved.
  legacySlug: string
  simMap: Map<string, MiniTreeSimData & { href: string }>
  familyEdges: { parentId: string; childId: string }[]
  partnerEdges: PartnerEdge[]
}

/** Three-generation mini tree around one sim: parents (+their parents and partners), children, partners. */
export async function getMiniTreeData(db: PrismaClient, simId: string, userId: string) {
  const focusedSim = await loadFocusedSim(db, simId)
  if (!focusedSim) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sim not found' })

  const graph = assembleMiniTree(focusedSim)
  await appendMissingPartners(db, graph, userId)

  return {
    sims: Array.from(graph.simMap.values()).map(({ causeOfDeath, ...s }) => ({
      ...s,
      isDeceased: causeOfDeath !== null,
    })),
    familyEdges: graph.familyEdges,
    partnerEdges: graph.partnerEdges,
  }
}

async function loadFocusedSim(db: PrismaClient, simId: string) {
  return db.sim.findUnique({
    where: { id: simId },
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
}

export type FocusedSim = NonNullable<Awaited<ReturnType<typeof loadFocusedSim>>>

export function assembleMiniTree(focusedSim: FocusedSim): MiniTreeGraph {
  const legacySlug = focusedSim.legacy.slug
  const graph: MiniTreeGraph = { legacySlug, simMap: new Map(), familyEdges: [], partnerEdges: [] }
  const familyEdgeSet = new Set<string>()
  const partnerEdgeSet = new Set<string>()

  function addSim(s: MiniTreeSimData) {
    if (!graph.simMap.has(s.id)) {
      graph.simMap.set(s.id, { ...s, href: `/app/legacies/${legacySlug}/sims/${s.id}` })
    }
  }
  function addFamilyEdge(parentId: string, childId: string) {
    const key = `${parentId}-${childId}`
    if (familyEdgeSet.has(key)) return
    familyEdgeSet.add(key)
    graph.familyEdges.push({ parentId, childId })
  }
  function addPartnerEdge(simAId: string, simBId: string, romanticStatus: RomanticStatus, endedAt: Date | null) {
    const [a, b] = [simAId, simBId].sort()
    const key = `${a}-${b}`
    if (partnerEdgeSet.has(key)) return
    partnerEdgeSet.add(key)
    graph.partnerEdges.push({ simAId: a, simBId: b, romanticStatus, endedAt })
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

  return graph
}

async function appendMissingPartners(db: PrismaClient, graph: MiniTreeGraph, userId: string) {
  const missingPartnerIds = [...new Set(
    graph.partnerEdges.flatMap((e) => [e.simAId, e.simBId]).filter((id) => !graph.simMap.has(id)),
  )]
  if (missingPartnerIds.length === 0) return
  // Ownership *filter*, not a guard: partner sims outside the user's legacies
  // are intentionally omitted from the mini tree. This is the one sanctioned
  // inline ownership condition outside src/server/lib/auth/ownership.ts.
  const partnerSims = await db.sim.findMany({
    where: { id: { in: missingPartnerIds }, legacy: { userId } },
    select: miniTreeSimSelect,
    orderBy: { id: 'asc' },
  })
  for (const partnerSim of partnerSims) {
    graph.simMap.set(partnerSim.id, {
      ...partnerSim,
      href: `/app/legacies/${graph.legacySlug}/sims/${partnerSim.id}`,
    })
  }
}
