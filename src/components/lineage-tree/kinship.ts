import type { Gender } from '@prisma/client'
import type { LineageFamilyEdge, LineagePartnerEdge } from './layout-shared'

/**
 * Minimal sim shape the labeller needs; LineageFlowSim satisfies it.
 * `isDeceased` feeds the partner layer (Task 3) to derive widowhood
 * (e.g. "Late husband"); it is not read by the blood-relation half.
 */
export type KinshipSim = { id: string; gender: Gender; isDeceased: boolean }

/**
 * Label every sim by its relationship to `focusId`. Absent from the map = no
 * derivable relationship (the crest keeps showing its life stage). The focus
 * sim is never in the map (it keeps its own life stage). Pure & deterministic.
 */
export function computeKinshipLabels(
  focusId: string,
  sims: KinshipSim[],
  familyEdges: LineageFamilyEdge[],
  _partnerEdges: LineagePartnerEdge[],
): Map<string, string> {
  const byId = new Map(sims.map((s) => [s.id, s]))
  const labels = new Map<string, string>()
  if (!byId.has(focusId)) return labels

  const parents = new Map<string, Set<string>>()
  const children = new Map<string, Set<string>>()
  for (const { parentId, childId } of familyEdges) {
    if (!byId.has(parentId) || !byId.has(childId)) continue
    addToSet(parents, childId, parentId)
    addToSet(children, parentId, childId)
  }

  // --- Blood relations: shortest (up, down) to the lowest common ancestor ---
  const focusAnc = ancestorDistances(focusId, parents)
  for (const x of sims) {
    if (x.id === focusId) continue
    const rel = bloodRelation(focusId, x.id, parents, focusAnc)
    if (rel) labels.set(x.id, bloodTerm(rel.up, rel.down, x.gender, rel.isHalf))
  }

  return labels
}

// --- graph helpers -------------------------------------------------------

function addToSet(map: Map<string, Set<string>>, key: string, value: string): void {
  const set = map.get(key) ?? new Set<string>()
  set.add(value)
  map.set(key, set)
}

/** BFS up the parent edges; returns each ancestor's min distance, focus at 0. */
function ancestorDistances(start: string, parents: Map<string, Set<string>>): Map<string, number> {
  const dist = new Map<string, number>([[start, 0]])
  let frontier = [start]
  let d = 0
  while (frontier.length > 0) {
    d++
    const next: string[] = []
    for (const id of frontier) {
      for (const p of parents.get(id) ?? []) {
        if (!dist.has(p)) { dist.set(p, d); next.push(p) }
      }
    }
    frontier = next
  }
  return dist
}

type Blood = { up: number; down: number; isHalf: boolean }

/**
 * Best (up, down) to x: minimise up+down over common ancestors, tie-broken by
 * the more balanced path. `up` = generations from focus up to the common
 * ancestor; `down` = generations from there down to x.
 */
function bloodRelation(
  focusId: string,
  xId: string,
  parents: Map<string, Set<string>>,
  focusAnc: Map<string, number>,
): Blood | null {
  const xAnc = ancestorDistances(xId, parents)
  let best: { up: number; down: number } | null = null
  for (const [ancestor, down] of xAnc) {
    const up = focusAnc.get(ancestor)
    if (up === undefined) continue
    if (
      best === null ||
      up + down < best.up + best.down ||
      (up + down === best.up + best.down && Math.abs(up - down) < Math.abs(best.up - best.down))
    ) {
      best = { up, down }
    }
  }
  if (best === null) return null
  let isHalf = false
  if (best.up === 1 && best.down === 1) {
    // Fewer than two shared parents ⇒ half-sibling. A sim with only one
    // recorded parent is therefore treated as a half-sibling (we can't prove
    // the second parent is shared).
    const xParents = parents.get(xId) ?? new Set<string>()
    const shared = [...(parents.get(focusId) ?? [])].filter((p) => xParents.has(p))
    isHalf = shared.length < 2
  }
  return { ...best, isHalf }
}

// --- vocabulary ----------------------------------------------------------

function pick(g: Gender, female: string, male: string, neutral: string): string {
  return g === 'FEMALE' ? female : g === 'MALE' ? male : neutral
}

function ancestorTerm(up: number, g: Gender): string {
  if (up === 1) return pick(g, 'Mother', 'Father', 'Parent')
  if (up === 2) return pick(g, 'Grandmother', 'Grandfather', 'Grandparent')
  if (up === 3) return pick(g, 'Great-grandmother', 'Great-grandfather', 'Great-grandparent')
  return `${up - 2}× great-${pick(g, 'grandmother', 'grandfather', 'grandparent')}`
}

function descendantTerm(down: number, g: Gender): string {
  if (down === 1) return pick(g, 'Daughter', 'Son', 'Child')
  if (down === 2) return pick(g, 'Granddaughter', 'Grandson', 'Grandchild')
  if (down === 3) return pick(g, 'Great-granddaughter', 'Great-grandson', 'Great-grandchild')
  return `${down - 2}× great-${pick(g, 'granddaughter', 'grandson', 'grandchild')}`
}

function siblingTerm(g: Gender, isHalf: boolean): string {
  if (isHalf) return pick(g, 'Half-sister', 'Half-brother', 'Half-sibling')
  return pick(g, 'Sister', 'Brother', 'Sibling')
}

const COUSIN_ORDINALS = ['First', 'Second', 'Third']

function cousinTerm(lo: number, diff: number): string {
  // lo=2 (parents are siblings) → "First"; lo=3 → "Second"; lo=4 → "Third".
  const ord = COUSIN_ORDINALS[lo - 2]
  if (diff === 0) return `${ord} cousin`
  return `${ord} cousin ${diff === 1 ? 'once' : 'twice'} removed`
}

/** Map an (up, down) pair to a relationship term. */
function bloodTerm(up: number, down: number, g: Gender, isHalf: boolean): string {
  if (down === 0) return ancestorTerm(up, g)
  if (up === 0) return descendantTerm(down, g)
  if (up === 1 && down === 1) return siblingTerm(g, isHalf)
  const lo = Math.min(up, down)
  const diff = Math.max(up, down) - lo
  if (lo === 1) {
    if (up > down) {
      if (up === 2) return pick(g, 'Aunt', 'Uncle', "Parent's sibling")
      if (up === 3) return pick(g, 'Great-aunt', 'Great-uncle', "Grandparent's sibling")
      return 'Distant relative'
    }
    if (down === 2) return pick(g, 'Niece', 'Nephew', "Sibling's child")
    if (down === 3) return pick(g, 'Great-niece', 'Great-nephew', "Sibling's grandchild")
    return 'Distant relative'
  }
  if (lo <= 4 && diff <= 2) return cousinTerm(lo, diff)
  return 'Distant cousin'
}
