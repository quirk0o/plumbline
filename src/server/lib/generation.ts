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

  await persistChangedGenerations(tx, sims, gen)
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
): Promise<void> {
  // A sim whose derivation is blocked (all parents null — only possible in
  // pre-backfill data) keeps its existing value rather than being cleared.
  const changed = sims.filter((s) => {
    const next = gen.get(s.id)
    return next != null && next !== s.generationNumber
  })

  // The partial `one heir per (legacy, generation)` index is enforced per write,
  // not at commit, so two heirs shifting through the same generation would trip
  // it transiently even when the final state is valid. Move every changed sim
  // with its heir flag cleared first, then restore heir status afterward only
  // where the new generation has no other heir.
  const incumbentHeirGens = new Set<number>()
  for (const s of sims) {
    const next = gen.get(s.id)
    if (s.isHeir && next != null && next === s.generationNumber) incumbentHeirGens.add(next)
  }

  for (const s of changed) {
    const next = gen.get(s.id)!
    await tx.sim.update({
      where: { id: s.id },
      data: s.isHeir ? { generationNumber: next, isHeir: false } : { generationNumber: next },
    })
  }

  // Restore one heir per generation. A moved heir whose new generation is taken
  // (by an incumbent heir or another moved heir already restored) stays
  // non-heir — it has been displaced from its cohort by an ancestor's change.
  const claimed = new Set<number>(incumbentHeirGens)
  for (const s of changed) {
    if (!s.isHeir) continue
    const next = gen.get(s.id)!
    if (claimed.has(next)) continue
    claimed.add(next)
    await tx.sim.update({ where: { id: s.id }, data: { isHeir: true } })
  }
}
