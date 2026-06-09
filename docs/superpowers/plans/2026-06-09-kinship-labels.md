# Kinship Labels on the Lineage Tree — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a sim is the focus of the lineage tree (selected in the Tree Atlas, or the page sim in the mini tree), label every other crest with its relationship *to that sim* — "Mother", "Grandfather", "First cousin", "Wife", "Mother-in-law" — instead of its life stage.

**Architecture:** A pure module (`kinship.ts`) computes a `Map<simId, label>` from the focus id, the sims, and the family + partner edges the tree already holds. Blood relations come from a shortest `(up, down)` path to the lowest common ancestor mapped to a gendered vocabulary; partner labels come from the romantic-status redesign's `deriveRomanticState`; in-laws are derived one hop through a marriage. The map flows through `toFlowGraph` → `CrestNodeData.kinshipLabel` and the crest renders `kinshipLabel ?? lifeStage`. No schema or new tRPC procedures — both surfaces already have the data, except a `gender` field added to the tree-data select (Task 1).

**Tech Stack:** Next.js 16 (App Router), tRPC, Prisma 7 + PostgreSQL, `@xyflow/react` lineage tree, Vitest + React Testing Library, GitButler (`but`).

**Spec:** `docs/superpowers/specs/2026-06-07-kinship-labels-design.md`

**Branch:** All work on `feat/kinship-labels`, stacked on top of `feat/romantic-status-model` (now implemented — `deriveRomanticState`, partner-edge `endedAt`, and sim `isDeceased` are in place). Confirm with `but status -fv`; if `feat/kinship-labels` is not stacked above `feat/romantic-status-model`, run `but move feat/kinship-labels feat/romantic-status-model`.

**Project rules (non-negotiable):**
- Never use `cd`; run commands from the repo root with explicit paths.
- No `// eslint-disable`, `// @ts-ignore`, `// @ts-expect-error`, `// @ts-nocheck`. Fix root causes.
- Commit with `but`, never raw `git` writes: `but status -f` for the file CLI IDs, then `but commit feat/kinship-labels -m "<msg>" --changes <id1>,<id2>`. Verify the returned status shows the files committed.
- After every task: `npx tsc --noEmit` and `npm run lint` must both be clean before moving on.

---

## File Structure

**New files**
- `src/components/lineage-tree/kinship.ts` — pure derivation: `KinshipSim`, `computeKinshipLabels`, and private vocabulary/graph helpers. One responsibility: focus id + graph → `Map<simId, label>`. No React, no DOM, no Prisma client calls.
- `src/components/lineage-tree/__tests__/kinship.test.ts` — integration tests over one rich fixture.

**Modified files**
- `src/server/routers/sims.ts` — add `gender` to the `getTreeData` sims select + `miniTreeSimSelect` (Task 1).
- `src/server/routers/sims.test.ts` — assert `gender` on tree-data sims (Task 1).
- `src/components/lineage-tree/to-flow-graph.ts` — `gender` on `LineageFlowSim`; `kinshipLabel` on `CrestNodeData`; `kinshipLabels` on `FlowGraphOptions`; thread it in `crestNode` (Tasks 1, 4).
- `src/components/lineage-tree/crest-flow-node.tsx` — render `kinshipLabel ?? lifeStage` in the caption + accessible name (Task 5).
- `src/components/lineage-tree/lineage-flow.tsx` — compute the label map (focus = `selectedId ?? focusSimId`) and pass it to `toFlowGraph` (Task 6).
- Test fixtures that build `LineageFlowSim` literals — add `gender` (Tasks 1, 4–6): `__tests__/to-flow-graph.test.ts`, `__tests__/lineage-flow.test.tsx`, `__tests__/crest-flow-node.test.tsx`, and the sim-detail/atlas tests if they build sims directly.

**Unchanged on purpose**
- The layout pipeline (`layout.ts`, `layout-*.ts`) — kinship is a labeling concern, independent of placement.
- Step relationships — excluded from tree data upstream; never reach `familyEdges`.

---

## Task 1: Add `gender` to tree data and `LineageFlowSim`

Additive plumbing the gendered vocabulary needs. Green on its own.

**Files:**
- Modify: `src/server/routers/sims.ts`
- Modify: `src/components/lineage-tree/to-flow-graph.ts`
- Test: `src/server/routers/sims.test.ts`

- [ ] **Step 1: Failing server test**

In `src/server/routers/sims.test.ts`, find the `getTreeData` describe block and add (mirror the neighbouring tests' fixture helpers exactly):

```ts
it('getTreeData includes gender on each sim', async () => {
  const caller = authedCaller(/* existing fixture user */)
  // ...create a legacy with one sim whose gender is 'FEMALE'...
  const data = await caller.sims.getTreeData({ legacySlug })
  expect(data.sims[0]).toHaveProperty('gender', 'FEMALE')
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/server/routers/sims.test.ts -t "includes gender"`
Expected: FAIL — `gender` undefined on the returned sim.

- [ ] **Step 3: Add `gender` to both selects**

In `src/server/routers/sims.ts`, add `gender: true` to the `getTreeData` sims `select` (alongside `lifeStage`, `isHeir`, `causeOfDeath`):

```ts
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
```

And add `gender: true` to `miniTreeSimSelect` (top of file):

```ts
const miniTreeSimSelect = {
  id: true, firstName: true, lastName: true, imageUrl: true, generationNumber: true,
  lifeStage: true, isHeir: true, gender: true, causeOfDeath: true,
} as const
```

`gender` passes through the existing `causeOfDeath → isDeceased` mapping untouched (it is spread with the rest of the sim).

- [ ] **Step 4: Add `gender` to `LineageFlowSim`**

In `src/components/lineage-tree/to-flow-graph.ts`, extend the type (import `Gender` alongside the existing `LifeStage` type import from `@prisma/client`):

```ts
import type { Gender, LifeStage } from '@prisma/client'
```

```ts
export type LineageFlowSim = {
  id: string
  firstName: string
  lastName: string
  imageUrl: string | null
  generationNumber: number | null
  lifeStage: LifeStage
  isHeir: boolean
  isDeceased: boolean
  gender: Gender
}
```

- [ ] **Step 5: Fix `LineageFlowSim` fixtures**

`grep -rn "isDeceased:" src/components/lineage-tree/__tests__ src/app/app/legacies` to find `LineageFlowSim` literals and add `gender: 'FEMALE'` (or the gender the test intends). The real callers (`tree-atlas.tsx`, `family-tree-mini.tsx`) spread `getTreeData`/`getMiniTreeData` results, which now include `gender` — no change there.

- [ ] **Step 6: Run tests, typecheck, lint**

Run: `npx vitest run src/server/routers/sims.test.ts -t "includes gender"` → PASS.
Run: `npx vitest run src/components/lineage-tree` → PASS.
Run: `npx tsc --noEmit` and `npm run lint` → clean.

- [ ] **Step 7: Commit**

```bash
but status -f
but commit feat/kinship-labels -m "feat(api): include gender on lineage tree sims" --changes <sims.ts-id>,<sims.test.ts-id>,<to-flow-graph.ts-id>,<fixture-ids...>
```

---

## Task 2: Kinship module — blood relations

The pure module's blood-relation half: ancestors, descendants, and collaterals (siblings, aunts/uncles, cousins) with the gendered vocabulary and compact distant forms. The partner layer is added in Task 3.

**Files:**
- Create: `src/components/lineage-tree/kinship.ts`
- Test: `src/components/lineage-tree/__tests__/kinship.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/components/lineage-tree/__tests__/kinship.test.ts`. The fixture is a 4-generation family; `F` (gen 3, female) is the focus.

```ts
import { describe, it, expect } from 'vitest'
import { computeKinshipLabels, type KinshipSim } from '../kinship'
import type { LineageFamilyEdge, LineagePartnerEdge } from '../layout-shared'

// Genealogy (M=male, F=female):
//   gen1: GF(m) — GM(f)            [F's paternal grandparents]
//   gen2: DAD(m) — MUM(f)          DAD is child of GF+GM; UNCLE(m) is DAD's brother
//   gen3: F(f, focus) — SIB(m, F's full brother, child of DAD+MUM)
//         COUSIN(f) is UNCLE's child
//   gen4: KID(f) is F's child
const sims: KinshipSim[] = [
  { id: 'GF', gender: 'MALE', isDeceased: false },
  { id: 'GM', gender: 'FEMALE', isDeceased: false },
  { id: 'DAD', gender: 'MALE', isDeceased: false },
  { id: 'MUM', gender: 'FEMALE', isDeceased: false },
  { id: 'UNCLE', gender: 'MALE', isDeceased: false },
  { id: 'F', gender: 'FEMALE', isDeceased: false },
  { id: 'SIB', gender: 'MALE', isDeceased: false },
  { id: 'COUSIN', gender: 'FEMALE', isDeceased: false },
  { id: 'KID', gender: 'FEMALE', isDeceased: false },
]
const familyEdges: LineageFamilyEdge[] = [
  { parentId: 'GF', childId: 'DAD' }, { parentId: 'GM', childId: 'DAD' },
  { parentId: 'GF', childId: 'UNCLE' }, { parentId: 'GM', childId: 'UNCLE' },
  { parentId: 'DAD', childId: 'F' }, { parentId: 'MUM', childId: 'F' },
  { parentId: 'DAD', childId: 'SIB' }, { parentId: 'MUM', childId: 'SIB' },
  { parentId: 'UNCLE', childId: 'COUSIN' },
  { parentId: 'F', childId: 'KID' },
]
const noPartners: LineagePartnerEdge[] = []

describe('computeKinshipLabels — blood relations (focus F)', () => {
  const labels = computeKinshipLabels('F', sims, familyEdges, noPartners)

  it('labels direct ancestors with gender', () => {
    expect(labels.get('DAD')).toBe('Father')
    expect(labels.get('MUM')).toBe('Mother')
    expect(labels.get('GF')).toBe('Grandfather')
    expect(labels.get('GM')).toBe('Grandmother')
  })
  it('labels descendants', () => {
    expect(labels.get('KID')).toBe('Daughter')
  })
  it('labels a full sibling, aunt/uncle, and first cousin', () => {
    expect(labels.get('SIB')).toBe('Brother')
    expect(labels.get('UNCLE')).toBe('Uncle')
    expect(labels.get('COUSIN')).toBe('First cousin')
  })
  it('omits the focus sim itself', () => {
    expect(labels.has('F')).toBe(false)
  })
})

describe('half-sibling detection', () => {
  it('labels a half-sibling when only one parent is shared', () => {
    const half: KinshipSim[] = [
      { id: 'DAD', gender: 'MALE', isDeceased: false },
      { id: 'MUM', gender: 'FEMALE', isDeceased: false },
      { id: 'STEPMUM', gender: 'FEMALE', isDeceased: false },
      { id: 'F', gender: 'FEMALE', isDeceased: false },
      { id: 'HALF', gender: 'MALE', isDeceased: false },
    ]
    const edges: LineageFamilyEdge[] = [
      { parentId: 'DAD', childId: 'F' }, { parentId: 'MUM', childId: 'F' },
      { parentId: 'DAD', childId: 'HALF' }, { parentId: 'STEPMUM', childId: 'HALF' },
    ]
    expect(computeKinshipLabels('F', half, edges, []).get('HALF')).toBe('Half-brother')
  })
})

describe('non-binary and distant forms', () => {
  it('uses neutral terms for NON_BINARY sims', () => {
    const s: KinshipSim[] = [
      { id: 'P', gender: 'NON_BINARY', isDeceased: false },
      { id: 'F', gender: 'FEMALE', isDeceased: false },
    ]
    expect(computeKinshipLabels('F', s, [{ parentId: 'P', childId: 'F' }], []).get('P')).toBe('Parent')
  })
  it('compacts deep ancestors and second cousins', () => {
    expect(greatChain(6)).toBe('4× great-grandmother') // up = 6
  })
})

// Helper: a straight maternal line F ← m1 ← m2 ← ... of length `up`, all female.
function greatChain(up: number): string | undefined {
  const sims: KinshipSim[] = [{ id: 'F', gender: 'FEMALE', isDeceased: false }]
  const edges: LineageFamilyEdge[] = []
  let child = 'F'
  for (let i = 1; i <= up; i++) {
    const id = `a${i}`
    sims.push({ id, gender: 'FEMALE', isDeceased: false })
    edges.push({ parentId: id, childId: child })
    child = id
  }
  return computeKinshipLabels('F', sims, edges, []).get(`a${up}`)
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/lineage-tree/__tests__/kinship.test.ts`
Expected: FAIL — cannot resolve `../kinship`.

- [ ] **Step 3: Implement the blood half**

Create `src/components/lineage-tree/kinship.ts`:

```ts
import type { Gender } from '@prisma/client'
import type { LineageFamilyEdge, LineagePartnerEdge } from './layout-shared'

/** Minimal sim shape the labeller needs; LineageFlowSim satisfies it. */
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
  const ord = COUSIN_ORDINALS[lo - 2] // lo=2 → "First"
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/components/lineage-tree/__tests__/kinship.test.ts`
Expected: PASS (all blood-relation tests).

- [ ] **Step 5: Typecheck, lint, commit**

Run: `npx tsc --noEmit` and `npm run lint` → clean.

```bash
but status -f
but commit feat/kinship-labels -m "feat(lineage-tree): kinship blood-relation labelling" --changes <kinship.ts-id>,<kinship.test.ts-id>
```

---

## Task 3: Kinship module — partner layer and in-laws

Adds direct-partner labels (via `deriveRomanticState`) and one-hop, marriage-only in-laws, applied after blood relations and never overwriting them.

**Files:**
- Modify: `src/components/lineage-tree/kinship.ts`
- Test: `src/components/lineage-tree/__tests__/kinship.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `kinship.test.ts`:

```ts
import type { RomanticStatus } from '@prisma/client'

function partner(a: string, b: string, status: RomanticStatus, endedAt: Date | null = null): LineagePartnerEdge {
  const [simAId, simBId] = [a, b].sort()
  return { simAId, simBId, romanticStatus: status, endedAt }
}

describe('partner layer (focus F, female)', () => {
  const base: KinshipSim[] = [
    { id: 'F', gender: 'FEMALE', isDeceased: false },
    { id: 'HUS', gender: 'MALE', isDeceased: false },
    { id: 'GF2', gender: 'FEMALE', isDeceased: false }, // girlfriend (other relationship)
    { id: 'EX', gender: 'MALE', isDeceased: false },
    { id: 'DEAD', gender: 'MALE', isDeceased: true },
  ]

  it('labels the focus current spouse by bond and gender', () => {
    const l = computeKinshipLabels('F', base, [], [partner('F', 'HUS', 'MARRIED')])
    expect(l.get('HUS')).toBe('Husband')
  })
  it('labels a deceased spouse as the late partner', () => {
    const l = computeKinshipLabels('F', base, [], [partner('F', 'DEAD', 'MARRIED')])
    expect(l.get('DEAD')).toBe('Late husband')
  })
  it('distinguishes an ex-spouse (divorce) from a girlfriend break-up', () => {
    const l = computeKinshipLabels('F', base, [], [
      partner('F', 'EX', 'MARRIED', new Date('2026-01-01')),
      partner('F', 'GF2', 'DATING'),
    ])
    expect(l.get('EX')).toBe('Ex-husband')
    expect(l.get('GF2')).toBe('Girlfriend')
  })
})

describe('in-laws (marriage only, one hop)', () => {
  const sims: KinshipSim[] = [
    { id: 'F', gender: 'FEMALE', isDeceased: false },
    { id: 'HUS', gender: 'MALE', isDeceased: false },
    { id: 'HMUM', gender: 'FEMALE', isDeceased: false }, // husband's mother
    { id: 'HSIS', gender: 'FEMALE', isDeceased: false }, // husband's sister
    { id: 'SON', gender: 'MALE', isDeceased: false },     // F's son
    { id: 'SONWIFE', gender: 'FEMALE', isDeceased: false },
    { id: 'BF', gender: 'MALE', isDeceased: false },      // F's fiancé (not a marriage)
    { id: 'BFMUM', gender: 'FEMALE', isDeceased: false },
  ]
  const edges: LineageFamilyEdge[] = [
    { parentId: 'HMUM', childId: 'HUS' },
    { parentId: 'HMUM', childId: 'HSIS' },
    { parentId: 'F', childId: 'SON' },
    { parentId: 'BFMUM', childId: 'BF' },
  ]
  const partners: LineagePartnerEdge[] = [
    partner('F', 'HUS', 'MARRIED'),
    partner('SON', 'SONWIFE', 'MARRIED'),
    partner('F', 'BF', 'ENGAGED'),
  ]
  const l = computeKinshipLabels('F', sims, edges, partners)

  it('derives mother- and sister-in-law through a marriage', () => {
    expect(l.get('HMUM')).toBe('Mother-in-law')
    expect(l.get('HSIS')).toBe('Sister-in-law')
  })
  it('derives a daughter-in-law (child’s spouse)', () => {
    expect(l.get('SONWIFE')).toBe('Daughter-in-law')
  })
  it('does NOT derive in-laws through a non-marriage bond', () => {
    expect(l.get('BF')).toBe('Fiancé')      // direct partner labelled…
    expect(l.has('BFMUM')).toBe(false)       // …but the fiancé's mother is not
  })
  it('blood relations win over in-law derivation', () => {
    expect(l.get('SON')).toBe('Son')         // not relabelled by SONWIFE's marriage
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/components/lineage-tree/__tests__/kinship.test.ts -t "partner|in-law"`
Expected: FAIL — partners/in-laws not yet labelled.

- [ ] **Step 3: Implement the partner layer**

In `src/components/lineage-tree/kinship.ts`, add the import and call, then the helpers.

Add to the imports:

```ts
import { deriveRomanticState, type RomanticState } from '@/lib/romantic-status'
```

Insert the call just before `return labels` in `computeKinshipLabels`:

```ts
  // --- Partner layer (applied after blood; never overwrites it) ---
  applyPartnerLabels(focusId, byId, parents, children, partnerEdges, labels)

  return labels
```

Append these helpers to the module:

```ts
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/components/lineage-tree/__tests__/kinship.test.ts`
Expected: PASS (blood + partner + in-law).

- [ ] **Step 5: Typecheck, lint, commit**

Run: `npx tsc --noEmit` and `npm run lint` → clean.

```bash
but status -f
but commit feat/kinship-labels -m "feat(lineage-tree): kinship partner labels and marriage in-laws" --changes <kinship.ts-id>,<kinship.test.ts-id>
```

---

## Task 4: Thread the label map through `toFlowGraph`

**Files:**
- Modify: `src/components/lineage-tree/to-flow-graph.ts`
- Test: `src/components/lineage-tree/__tests__/to-flow-graph.test.ts`

- [ ] **Step 1: Write the failing test**

In `__tests__/to-flow-graph.test.ts`, add (reuse the suite's existing `layout`/`sims`/`opts` builders; pass a `kinshipLabels` map in `opts`):

```ts
it('puts the kinship label on the crest node data', () => {
  const kinshipLabels = new Map([[/* some sim id in the fixture */ 'sim-b', 'Mother']])
  const { nodes } = toFlowGraph(layout, sims, familyEdges, { ...baseOpts, kinshipLabels })
  const crest = nodes.find((n) => n.id === 'sim-b' && n.type === 'crest')
  expect((crest?.data as { kinshipLabel?: string }).kinshipLabel).toBe('Mother')
})

it('leaves kinshipLabel undefined when no map is supplied', () => {
  const { nodes } = toFlowGraph(layout, sims, familyEdges, baseOpts)
  const crest = nodes.find((n) => n.type === 'crest')
  expect((crest?.data as { kinshipLabel?: string }).kinshipLabel).toBeUndefined()
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/lineage-tree/__tests__/to-flow-graph.test.ts -t "kinship"`
Expected: FAIL — `kinshipLabels` not an accepted option; `kinshipLabel` not on crest data.

- [ ] **Step 3: Add the field to the option and node data types**

In `src/components/lineage-tree/to-flow-graph.ts`:

```ts
export type CrestNodeData = {
  sim: LineageFlowSim
  isFounder: boolean
  isSelected: boolean
  isDimmed: boolean
  isFocused: boolean
  /** Relationship to the current focus sim; replaces the life-stage caption when set. */
  kinshipLabel?: string
  onSelect?: (id: string) => void
  onNodeFocus?: (id: string) => void
}
```

```ts
export type FlowGraphOptions = {
  founderSimId?: string
  focusSimId?: string
  selectedId?: string
  dimmedIds?: Set<string>
  kinshipLabels?: Map<string, string>
  onSelect?: (id: string) => void
  onNodeFocus?: (id: string) => void
}
```

- [ ] **Step 4: Set it in `crestNode`**

In the `crestNode` function's `data` object, add `kinshipLabel`:

```ts
    data: {
      sim,
      isFounder: opts.founderSimId === n.id,
      isSelected: opts.selectedId === n.id,
      isDimmed: opts.dimmedIds?.has(n.id) ?? false,
      isFocused: opts.focusSimId === n.id,
      kinshipLabel: opts.kinshipLabels?.get(n.id),
      onSelect: opts.onSelect,
      onNodeFocus: opts.onNodeFocus,
    },
```

- [ ] **Step 5: Run tests, typecheck, lint**

Run: `npx vitest run src/components/lineage-tree/__tests__/to-flow-graph.test.ts` → PASS.
Run: `npx tsc --noEmit` and `npm run lint` → clean.

- [ ] **Step 6: Commit**

```bash
but status -f
but commit feat/kinship-labels -m "feat(lineage-tree): pass kinship labels through toFlowGraph to crest data" --changes <to-flow-graph.ts-id>,<to-flow-graph.test.ts-id>
```

---

## Task 5: Render the label on the crest

**Files:**
- Modify: `src/components/lineage-tree/crest-flow-node.tsx`
- Test: `src/components/lineage-tree/__tests__/crest-flow-node.test.tsx`

- [ ] **Step 1: Write the failing test**

In `__tests__/crest-flow-node.test.tsx`, add (mirror the existing render setup in that file — it renders `<CrestFlowNode data={...} />` with a hand-built `CrestNodeData`):

```ts
it('shows the kinship label in place of the life stage when present', () => {
  render(<CrestFlowNode data={makeData({ kinshipLabel: 'Mother' })} />)
  expect(screen.getByText('MOTHER')).toBeInTheDocument()
  expect(screen.queryByText(/young adult/i)).not.toBeInTheDocument()
  // Accessible name carries the kinship term, not the life stage.
  expect(screen.getByRole('button')).toHaveAccessibleName(/, Mother$/)
})

it('falls back to the life stage when no kinship label', () => {
  render(<CrestFlowNode data={makeData({ kinshipLabel: undefined })} />)
  expect(screen.getByText(/YOUNG ADULT/i)).toBeInTheDocument()
})
```

If the file has no `makeData` helper, add one mirroring its existing inline `data` object, defaulting `kinshipLabel: undefined` and a `lifeStage: 'YOUNG_ADULT'` sim with `onSelect` provided so the `<button>` renders.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/lineage-tree/__tests__/crest-flow-node.test.tsx -t "kinship"`
Expected: FAIL — caption still shows the life stage.

- [ ] **Step 3: Render `kinshipLabel ?? lifeStage`**

In `src/components/lineage-tree/crest-flow-node.tsx`, destructure `kinshipLabel` and derive the caption + accessible name:

```ts
  const { sim, isFounder, isSelected, isDimmed, isFocused, kinshipLabel, onSelect, onNodeFocus } = data
  const fullName = `${sim.firstName} ${sim.lastName}`.trim()
  const lifeStageLabel = formatLifeStage(sim.lifeStage)
  const caption = kinshipLabel ?? lifeStageLabel
  const accessibleName = `${fullName}, ${caption}`
```

And render `caption` in the stage span:

```tsx
      <span className={styles.stage} aria-hidden="true">
        {caption.toUpperCase()}
      </span>
```

(The `accessibleName` is already used by the `<button aria-label={accessibleName}>`.)

- [ ] **Step 4: Run tests, typecheck, lint**

Run: `npx vitest run src/components/lineage-tree/__tests__/crest-flow-node.test.tsx` → PASS.
Run: `npx tsc --noEmit` and `npm run lint` → clean.

- [ ] **Step 5: Commit**

```bash
but status -f
but commit feat/kinship-labels -m "feat(lineage-tree): crest shows kinship label in place of life stage" --changes <crest-flow-node.tsx-id>,<crest-flow-node.test.tsx-id>
```

---

## Task 6: Compute and pass the map in `LineageFlow`

Wires both surfaces: the Atlas focus is `selectedId`; the mini tree focus is `focusSimId`. When neither is set (Atlas with nothing selected), no labels — crests show life stages.

**Files:**
- Modify: `src/components/lineage-tree/lineage-flow.tsx`
- Test: `src/components/lineage-tree/__tests__/lineage-flow.test.tsx`

- [ ] **Step 1: Write the failing test**

In `__tests__/lineage-flow.test.tsx`, add (mirror the file's existing render helper, which wraps `<LineageFlow>` in `<ReactFlowProvider>` and uses the jsdom xyflow mocks). Use a tiny two-sim parent/child fixture:

```ts
it('labels other crests by relationship when a sim is selected', () => {
  const sims = [
    { id: 'mum', firstName: 'Mum', lastName: 'X', imageUrl: null, generationNumber: 1, lifeStage: 'ADULT', isHeir: false, isDeceased: false, gender: 'FEMALE' },
    { id: 'kid', firstName: 'Kid', lastName: 'X', imageUrl: null, generationNumber: 2, lifeStage: 'CHILD', isHeir: false, isDeceased: false, gender: 'FEMALE' },
  ] as const
  const familyEdges = [{ parentId: 'mum', childId: 'kid' }]

  const { rerender } = renderFlow(
    <LineageFlow sims={[...sims]} familyEdges={familyEdges} partnerEdges={[]} selectedId="kid" />,
  )
  // From kid's perspective, mum is "Mother".
  expect(screen.getByText('MOTHER')).toBeInTheDocument()

  // Deselect → labels revert to life stages.
  rerender(
    <LineageFlow sims={[...sims]} familyEdges={familyEdges} partnerEdges={[]} />,
  )
  expect(screen.queryByText('MOTHER')).not.toBeInTheDocument()
  expect(screen.getByText(/ADULT/i)).toBeInTheDocument()
})
```

(Use the suite's actual render wrapper name; if it inlines `<ReactFlowProvider>` per test, do the same and call `rerender` accordingly.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/lineage-tree/__tests__/lineage-flow.test.tsx -t "relationship"`
Expected: FAIL — no kinship labels computed; crest shows "ADULT".

- [ ] **Step 3: Compute the map and pass it**

In `src/components/lineage-tree/lineage-flow.tsx`:

Add the import:

```ts
import { computeKinshipLabels } from './kinship'
```

After the `layout` memo, compute the labels. The focus is the selection (Atlas) or the page sim (mini tree):

```ts
  const kinshipFocusId = selectedId ?? focusSimId
  const kinshipLabels = useMemo(
    () =>
      kinshipFocusId
        ? computeKinshipLabels(kinshipFocusId, sims, familyEdges, partnerEdges)
        : undefined,
    [kinshipFocusId, sims, familyEdges, partnerEdges],
  )
```

Pass it into `toFlowGraph` and add it to the deps of the nodes/edges memo:

```ts
  const { nodes, edges } = useMemo(
    () =>
      toFlowGraph(layout, sims, familyEdges, {
        founderSimId,
        focusSimId,
        selectedId,
        dimmedIds,
        kinshipLabels,
        onSelect: onSelectSim,
        onNodeFocus: handleNodeFocus,
      }),
    [layout, sims, familyEdges, founderSimId, focusSimId, selectedId, dimmedIds, kinshipLabels, onSelectSim, handleNodeFocus],
  )
```

- [ ] **Step 4: Run tests, typecheck, lint**

Run: `npx vitest run src/components/lineage-tree/__tests__/lineage-flow.test.tsx` → PASS.
Run: `npx tsc --noEmit` and `npm run lint` → clean.

- [ ] **Step 5: Commit**

```bash
but status -f
but commit feat/kinship-labels -m "feat(lineage-tree): label crests relative to the focus/selected sim" --changes <lineage-flow.tsx-id>,<lineage-flow.test.tsx-id>
```

---

## Task 7: Final verification

- [ ] **Full suites green**

Run: `npm test` → all pass.
Run: `npm run test:e2e` → all pass. (Kill any stray `dev:test` server on :3737 first — Playwright reuses it against the wrong DB.)
Run: `npx tsc --noEmit` and `npm run lint` → clean.

- [ ] **Manual smoke (per the spec's manual checks)**

Sign in via the magic-link flow (see AGENTS.md), open a legacy's Tree Atlas, select a sim, and confirm other crests show relationship terms (Mother, Grandfather, First cousin, Wife, Mother-in-law) and revert to life stages on deselect. Open a sim detail page and confirm the mini tree shows relationships relative to that sim, with the page sim itself still showing its life stage.

- [ ] **Spec coverage check**

Confirm each spec section maps to a task: pure module + algorithm (T2–T3), gendered vocabulary + compact distant forms (T2), partner vocabulary via `deriveRomanticState` (T3), marriage-only one-hop in-laws (T3), `gender` data (T1), `toFlowGraph` threading (T4), crest caption + accessible name (T5), both surfaces with focus = `selectedId ?? focusSimId` and the focus sim keeping its life stage (T6). Note search-dimming is orthogonal: dimmed crests still receive labels (no special handling needed — Task 6 computes labels independent of `dimmedIds`).

- [ ] **Reviews (per AGENTS.md)**

Run the `/code-review` skill over the branch. Because this changes UI (crest captions, accessible names), also run the `design-system-reviewer` agent and the `web-qa-tester` agent. Address findings; re-run if changes are large.

- [ ] **Hand off**

`feat/kinship-labels` is the top of the stack (`feat/lineage-layout-d3dag → feat/romantic-status-model → feat/kinship-labels`). When all reviews pass, use the `superpowers:finishing-a-development-branch` skill to decide on merge/PR.
