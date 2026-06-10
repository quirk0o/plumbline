import type { Prisma, PrismaClient } from '@prisma/client'

/** Transaction client accepted by recomputeGenerations (also satisfied by the base client). */
type Db = PrismaClient | Prisma.TransactionClient

/**
 * A derived sim's generation: one greater than the highest parent generation.
 * Callers pass the non-null generations of the sim's parents (at least one).
 */
export function deriveGeneration(parentGenerations: number[]): number {
  if (parentGenerations.length === 0)
    throw new Error('deriveGeneration requires at least one parent generation')
  return Math.max(...parentGenerations) + 1
}

/**
 * Recompute every sim's generation in a legacy and persist the changes.
 *
 * - Root sims (no parent edge) keep their generation; a null root (only seen in
 *   pre-backfill data) takes the legacy's current latest generation, or 1.
 * - Derived sims relax to max(parent generation) + 1, to a fixpoint.
 *
 * The loop is bounded by the number of sims (a family tree is acyclic); a cycle
 * would simply stop relaxing after the bound rather than loop forever.
 *
 * Run inside a transaction so a mid-write failure rolls back the triggering edit.
 */
export async function recomputeGenerations(tx: Db, legacyId: string): Promise<void> {
  const sims = await tx.sim.findMany({
    where: { legacyId },
    select: { id: true, generationNumber: true, isHeir: true },
  })
  const edges = await tx.familyRelationship.findMany({
    where: { parent: { legacyId }, child: { legacyId } },
    select: { parentId: true, childId: true },
  })

  const parentsOf = buildParentMap(edges)
  const legacyLatest = computeLegacyLatest(sims)
  const gen = seedGenerations(sims, parentsOf, legacyLatest)

  relaxDerivedToFixpoint(gen, sims, parentsOf)

  const heirsByGen = new Map<number, number>()
  for (const s of sims) {
    if (!s.isHeir) continue
    const g = gen.get(s.id)
    if (g != null) heirsByGen.set(g, (heirsByGen.get(g) ?? 0) + 1)
  }

  await persistChangedGenerations(tx, sims, gen, heirsByGen)
}

function buildParentMap(edges: { parentId: string; childId: string }[]): Map<string, string[]> {
  const parentsOf = new Map<string, string[]>()
  for (const { parentId, childId } of edges) {
    const list = parentsOf.get(childId) ?? []
    list.push(parentId)
    parentsOf.set(childId, list)
  }
  return parentsOf
}

/**
 * The legacy's current latest generation, used to seed null roots. Intentionally
 * reads the current stored values (including any stale derived values), because a
 * null root adopts the legacy's *current* latest generation per spec.
 */
function computeLegacyLatest(sims: { generationNumber: number | null }[]): number {
  const known = sims.map((s) => s.generationNumber).filter((g): g is number => g !== null)
  return known.length > 0 ? Math.max(...known) : 1
}

/** Roots start fixed (null roots take legacyLatest); derived start from current value. */
function seedGenerations(
  sims: { id: string; generationNumber: number | null }[],
  parentsOf: Map<string, string[]>,
  legacyLatest: number,
): Map<string, number | null> {
  const gen = new Map<string, number | null>()
  for (const s of sims) {
    const isRoot = (parentsOf.get(s.id)?.length ?? 0) === 0
    gen.set(s.id, isRoot ? (s.generationNumber ?? legacyLatest) : s.generationNumber)
  }
  return gen
}

function relaxDerivedToFixpoint(
  gen: Map<string, number | null>,
  sims: { id: string }[],
  parentsOf: Map<string, string[]>,
): void {
  for (let pass = 0; pass <= sims.length; pass++) {
    let changed = false
    for (const s of sims) {
      const parents = parentsOf.get(s.id)
      if (!parents || parents.length === 0) continue // root: fixed
      const parentGens = parents
        .map((pid) => gen.get(pid))
        .filter((g): g is number => g !== null && g !== undefined)
      if (parentGens.length === 0) continue
      const next = deriveGeneration(parentGens)
      if (gen.get(s.id) !== next) {
        gen.set(s.id, next)
        changed = true
      }
    }
    if (!changed) break
  }
}

async function persistChangedGenerations(
  tx: Db,
  sims: { id: string; generationNumber: number | null; isHeir: boolean }[],
  gen: Map<string, number | null>,
  heirsByGen: Map<number, number>,
): Promise<void> {
  for (const s of sims) {
    const next = gen.get(s.id)
    // A sim whose derivation is blocked (all parents null — only possible in
    // pre-backfill data) keeps its existing value rather than being cleared.
    if (next == null || next === s.generationNumber) continue
    // A moved heir whose target generation already holds another heir would
    // violate the one-heir-per-generation index; it has been displaced from its
    // cohort by an ancestor's change, so drop its heir flag. Incumbent heirs
    // (generation unchanged) are never in this loop, so they keep theirs.
    const displacedHeir = s.isHeir && (heirsByGen.get(next) ?? 0) >= 2
    await tx.sim.update({
      where: { id: s.id },
      data: displacedHeir ? { generationNumber: next, isHeir: false } : { generationNumber: next },
    })
  }
}
