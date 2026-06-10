import type { Gender } from '@prisma/client'
import type { LineageFamilyEdge, LineagePartnerEdge } from './layout-shared'
import { deriveRomanticState, type RomanticState } from '@/lib/romantic-status'

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
  partnerEdges: LineagePartnerEdge[],
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

  // --- Partner layer (applied after blood; never overwrites it) ---
  applyPartnerLabels(focusId, byId, parents, children, partnerEdges, labels)

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
  if (!ord) return 'Distant cousin' // out of the supported 2–4 range: degrade gracefully
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

// --- Partner layer -------------------------------------------------------

type PartnerLink = { otherId: string; state: RomanticState }

/** Index each sim's partner links; state is derived for labelling the OTHER sim. */
function buildPartnersOf(
  byId: Map<string, KinshipSim>,
  partnerEdges: LineagePartnerEdge[],
): Map<string, PartnerLink[]> {
  const map = new Map<string, PartnerLink[]>()
  const push = (ownerId: string, otherId: string, e: LineagePartnerEdge) => {
    const other = byId.get(otherId)
    if (!other) return
    const state = deriveRomanticState(e.romanticStatus, e.endedAt, other.isDeceased)
    if (!state) return
    const list = map.get(ownerId) ?? []
    list.push({ otherId, state })
    map.set(ownerId, list)
  }
  for (const e of partnerEdges) {
    if (!byId.has(e.simAId) || !byId.has(e.simBId)) continue
    push(e.simAId, e.simBId, e)
    push(e.simBId, e.simAId, e)
  }
  return map
}

/** In-laws flow only through a marriage that wasn't deliberately ended. */
function isMarriageBond(state: RomanticState): boolean {
  return state.bond === 'MARRIED' && state.kind !== 'ended'
}

function siblingsOf(
  id: string,
  parents: Map<string, Set<string>>,
  children: Map<string, Set<string>>,
): Set<string> {
  const sibs = new Set<string>()
  for (const p of parents.get(id) ?? []) {
    for (const c of children.get(p) ?? []) {
      if (c !== id) sibs.add(c)
    }
  }
  return sibs
}

function setIfAbsent(labels: Map<string, string>, id: string, focusId: string, term: string): void {
  if (id !== focusId && !labels.has(id)) labels.set(id, term)
}

function applyPartnerLabels(
  focusId: string,
  byId: Map<string, KinshipSim>,
  parents: Map<string, Set<string>>,
  children: Map<string, Set<string>>,
  partnerEdges: LineagePartnerEdge[],
  labels: Map<string, string>,
): void {
  const partnersOf = buildPartnersOf(byId, partnerEdges)
  // The non-null assertion is safe: byId is the source of truth for every id, and
  // the parent/child/partner maps were all built with a `byId.has` guard, so any
  // id reachable through them is guaranteed to be present in byId.
  const genderOf = (id: string): Gender => byId.get(id)!.gender

  // 1. The focus sim's own partners.
  for (const { otherId, state } of partnersOf.get(focusId) ?? []) {
    setIfAbsent(labels, otherId, focusId, partnerTerm(state, genderOf(otherId)))
  }

  // 2a. Through a married spouse: the spouse's parents and siblings.
  for (const { otherId: spouseId, state } of partnersOf.get(focusId) ?? []) {
    if (!isMarriageBond(state)) continue
    for (const pid of parents.get(spouseId) ?? []) {
      setIfAbsent(labels, pid, focusId, pick(genderOf(pid), 'Mother-in-law', 'Father-in-law', 'Parent-in-law'))
    }
    for (const sibId of siblingsOf(spouseId, parents, children)) {
      setIfAbsent(labels, sibId, focusId, pick(genderOf(sibId), 'Sister-in-law', 'Brother-in-law', 'Sibling-in-law'))
    }
  }

  // 2b. The focus's children's and siblings' married spouses.
  for (const childId of children.get(focusId) ?? []) {
    for (const { otherId: spouseId, state } of partnersOf.get(childId) ?? []) {
      if (!isMarriageBond(state)) continue
      setIfAbsent(labels, spouseId, focusId, pick(genderOf(spouseId), 'Daughter-in-law', 'Son-in-law', 'Child-in-law'))
    }
  }
  for (const sibId of siblingsOf(focusId, parents, children)) {
    for (const { otherId: spouseId, state } of partnersOf.get(sibId) ?? []) {
      if (!isMarriageBond(state)) continue
      setIfAbsent(labels, spouseId, focusId, pick(genderOf(spouseId), 'Sister-in-law', 'Brother-in-law', 'Sibling-in-law'))
    }
  }

  // 3. Step relations (a parent's marriage, or the focus's own). Applied last so
  //    blood and in-law labels already in the map win.
  applyStepLabels(focusId, parents, children, partnersOf, genderOf, labels)
}

/**
 * Step relations derive from a parent's (or the focus's own) active/widowed
 * MARRIED bond — never a mere partnership. Applied after blood + in-laws via
 * setIfAbsent, so a sim who is both a step- and a blood relative keeps the
 * blood term. One hop only, matching in-laws.
 */
function applyStepLabels(
  focusId: string,
  parents: Map<string, Set<string>>,
  children: Map<string, Set<string>>,
  partnersOf: Map<string, PartnerLink[]>,
  genderOf: (id: string) => Gender,
  labels: Map<string, string>,
): void {
  const focusParents = parents.get(focusId) ?? new Set<string>()
  const focusChildren = children.get(focusId) ?? new Set<string>()

  // Stepparents: a married spouse of one of F's parents who is not also F's parent.
  const stepparents = new Set<string>()
  for (const parentId of focusParents) {
    for (const { otherId: spouseId, state } of partnersOf.get(parentId) ?? []) {
      if (!isMarriageBond(state)) continue
      if (focusParents.has(spouseId)) continue // an actual parent of F, not a step
      stepparents.add(spouseId)
      setIfAbsent(labels, spouseId, focusId, pick(genderOf(spouseId), 'Stepmother', 'Stepfather', 'Stepparent'))
    }
  }

  // Stepchildren: a married spouse's child that is not also F's own child.
  for (const { otherId: spouseId, state } of partnersOf.get(focusId) ?? []) {
    if (!isMarriageBond(state)) continue
    for (const childId of children.get(spouseId) ?? []) {
      if (focusChildren.has(childId)) continue // F's own child
      setIfAbsent(labels, childId, focusId, pick(genderOf(childId), 'Stepdaughter', 'Stepson', 'Stepchild'))
    }
  }

  // Step-siblings: a stepparent's child that shares no parent with F (a shared
  // parent makes them a half/full sibling, already labelled by the blood pass).
  for (const stepparentId of stepparents) {
    for (const childId of children.get(stepparentId) ?? []) {
      if (childId === focusId) continue
      const childParents = parents.get(childId) ?? new Set<string>()
      const sharesParent = [...focusParents].some((p) => childParents.has(p))
      if (sharesParent) continue
      setIfAbsent(labels, childId, focusId, pick(genderOf(childId), 'Step-sister', 'Step-brother', 'Step-sibling'))
    }
  }
}

function partnerTerm(state: RomanticState, g: Gender): string {
  const { kind, bond } = state
  if (kind === 'active') {
    if (bond === 'MARRIED') return pick(g, 'Wife', 'Husband', 'Spouse')
    if (bond === 'ENGAGED') return pick(g, 'Fiancée', 'Fiancé', 'Fiancé')
    if (bond === 'PARTNER') return 'Partner'
    return pick(g, 'Girlfriend', 'Boyfriend', 'Partner')
  }
  if (kind === 'widowed') {
    if (bond === 'MARRIED') return pick(g, 'Late wife', 'Late husband', 'Late partner')
    if (bond === 'ENGAGED') return pick(g, 'Late fiancée', 'Late fiancé', 'Late partner')
    if (bond === 'PARTNER') return 'Late partner'
    return pick(g, 'Late girlfriend', 'Late boyfriend', 'Late partner')
  }
  if (bond === 'MARRIED') return pick(g, 'Ex-wife', 'Ex-husband', 'Ex-spouse')
  if (bond === 'ENGAGED') return pick(g, 'Ex-fiancée', 'Ex-fiancé', 'Ex-partner')
  if (bond === 'PARTNER') return 'Ex-partner'
  return pick(g, 'Ex-girlfriend', 'Ex-boyfriend', 'Ex-partner')
}
