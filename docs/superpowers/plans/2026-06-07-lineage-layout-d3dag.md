# Lineage Tree Layout on d3-dag — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the buggy hand-rolled lineage-tree position calculation with a d3-dag sugiyama pipeline (pinned generation rows, per-component banding, partner ranking, hanging unions) per the approved spec.

**Architecture:** `computeLineageLayout` keeps its public signature and output shape (extended with `hangingUnions`); internals split into three focused modules (rows, clusters, engine) orchestrated by `layout.ts`. The xyflow adapter (`to-flow-graph.ts`) gains hanging-union nodes, co-parent elbow edges, and the diamond-as-descent-junction rule; the per-parent descent fallback from `fix/tree-descent-split-parents` is superseded (kept only for ≥3-parent sets).

**Tech Stack:** TypeScript, d3-dag ^1.2.1 (new dep), @xyflow/react 12, Vitest, Playwright. VCS via GitButler (`but`) only.

**Spec:** `docs/superpowers/specs/2026-06-07-lineage-layout-redesign-design.md` — read it first.

---

## Project rules that bind every task

- **VCS:** All writes via `but`, never `git add/commit`. Session branch: `feat/lineage-layout-d3dag`. Before every commit run `but status -f`, pick ONLY the file ids belonging to this work (other agents have uncommitted files in the unassigned area — `.claude/...`, `AGENTS.md`; never include those ids). After each commit, verify with `git show --stat HEAD` equivalent (`but show` on the branch) that nothing foreign was absorbed.
- **No suppressions:** `eslint-disable`, `@ts-ignore`, `@ts-expect-error` are illegal. Fix root causes.
- **No `cd`:** run all commands from the repo root with explicit paths.
- **After each task:** `npx tsc --noEmit` and `npm run lint` must both be clean before committing.
- **Test style:** Testing Trophy. Assert observable behavior (positions, emitted nodes/edges, rendered attributes), never internals. The layout modules are genuinely complex isolated logic — focused unit tests on their exported functions are sanctioned.

---

## File map

| File | Action | Responsibility |
| --- | --- | --- |
| `src/components/lineage-tree/layout-shared.ts` | Create | All layout types + constants + `pairKey` (no logic) |
| `src/components/lineage-tree/layout-rows.ts` | Create | Row derivation: generation rows, partner-row placement for null-gen spouses, shelf |
| `src/components/lineage-tree/layout-clusters.ts` | Create | Partner ranking + greedy matching; cluster building |
| `src/components/lineage-tree/layout-engine.ts` | Create | d3-dag sugiyama per component; banding; singleton packing |
| `src/components/lineage-tree/layout.ts` | Rewrite | Orchestrator + hanging unions + viewBox; re-exports shared API |
| `src/components/lineage-tree/to-flow-graph.ts` | Modify | Hanging-union nodes, coParent edges, diamond rule, dashed widowed bonds |
| `src/components/lineage-tree/flow-parts.tsx` | Modify | `UnionNode` diamond variant + `in` handle; `MarriageEdge` line-only/dashed; new `CoParentEdge` |
| `src/components/lineage-tree/lineage-flow.tsx` | Modify | Register `coParent` edge type |
| `src/server/routers/sims.ts` | Modify | `romanticStatus` on partner edges (getTreeData + getMiniTreeData) |
| `src/components/lineage-tree/__tests__/layout.test.ts` | Rewrite | Scenario suite against `computeLineageLayout` |
| `src/components/lineage-tree/__tests__/layout-rows.test.ts` | Create | Row derivation unit tests |
| `src/components/lineage-tree/__tests__/layout-clusters.test.ts` | Create | Matching unit tests |
| `src/components/lineage-tree/__tests__/layout-engine.test.ts` | Create | Banding/positioning unit tests |
| `src/components/lineage-tree/__tests__/to-flow-graph.test.ts` | Modify | Hanging unions, diamond rule, dashed bonds |
| `src/components/lineage-tree/__tests__/flow-parts.test.tsx` | Create | Edge/node component render tests |
| `src/server/routers/sims.test.ts` | Modify | Partner-edge shape assertions |

---

### Task 1: Stack the session branch and install d3-dag

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Stack the branch on the branch it supersedes**

`fix/tree-descent-split-parents` owns the latest commits to `to-flow-graph.ts` / `crest-flow-node.tsx`; committing changes to those files from an unstacked branch causes GitButler dependency locks.

Run: `but move feat/lineage-layout-d3dag fix/tree-descent-split-parents`
Then: `but status -f` — verify `feat/lineage-layout-d3dag` now sits above `fix/tree-descent-split-parents` (which sits above `feat/lineage-tree-xyflow`).

- [ ] **Step 2: Install d3-dag**

Run: `npm install d3-dag`
Expected: `d3-dag` `^1.2.1` added to `dependencies` in `package.json`.

- [ ] **Step 3: Validate and commit**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

Run: `but status -f` — find the ids for `package.json` and `package-lock.json` ONLY, then:
```bash
but commit feat/lineage-layout-d3dag -m "build(deps): add d3-dag for lineage layout" --changes <package.json-id>,<package-lock-id>
```

---

### Task 2: `romanticStatus` on partner edges (API)

**Files:**
- Modify: `src/server/routers/sims.ts` (getTreeData ~line 207-223, getMiniTreeData ~line 254-312)
- Test: `src/server/routers/sims.test.ts`

- [ ] **Step 1: Write the failing tests**

In `src/server/routers/sims.test.ts`, find the existing `getTreeData` describe block (search `getTreeData`). Add to it (adapting to the file's existing fixture helpers — it has helpers that create sims and relationships):

```ts
it('includes romanticStatus on partner edges', async () => {
  // Arrange: reuse the block's existing setup that creates two sims with a
  // social relationship; if the existing tests create a MARRIED pair, assert
  // on that pair. Otherwise create one with the file's helper.
  const caller = authedCaller(userId)
  const data = await caller.sims.getTreeData({ legacySlug })
  expect(data.partnerEdges.length).toBeGreaterThan(0)
  for (const edge of data.partnerEdges) {
    expect(edge).toHaveProperty('romanticStatus')
    expect(edge.romanticStatus).not.toBe('NONE')
  }
})
```

Add the equivalent assertion to the existing `getMiniTreeData` describe block:

```ts
it('includes romanticStatus on mini-tree partner edges', async () => {
  const caller = authedCaller(userId)
  const data = await caller.sims.getMiniTreeData({ simId })
  for (const edge of data.partnerEdges) {
    expect(edge).toHaveProperty('romanticStatus')
  }
})
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npm test -- sims.test`
Expected: the two new tests FAIL (`romanticStatus` missing); existing tests pass.

- [ ] **Step 3: Implement**

In `getTreeData` (sims.ts ~line 207), add `romanticStatus: true` to the socialRelationship select:

```ts
ctx.db.socialRelationship.findMany({
  where: {
    AND: [
      { simA: { legacyId: legacy.id } },
      { simB: { legacyId: legacy.id } },
    ],
    romanticStatus: { not: RomanticStatus.NONE },
  },
  select: { simAId: true, simBId: true, romanticStatus: true },
  orderBy: { simAId: 'asc' },
}),
```

and the mapping (~line 223):

```ts
partnerEdges: partnerEdges.map((e) => ({ simAId: e.simAId, simBId: e.simBId, romanticStatus: e.romanticStatus })),
```

In `getMiniTreeData`, add `romanticStatus: true` to all four `socialRelationshipsA`/`socialRelationshipsB` selects (~lines 254-263 and 275-284), e.g.:

```ts
socialRelationshipsA: {
  where: { romanticStatus: { not: RomanticStatus.NONE } },
  select: { simAId: true, simBId: true, romanticStatus: true },
  orderBy: { simAId: 'asc' },
},
```

Update the accumulator (~lines 295-312):

```ts
const partnerEdges: { simAId: string; simBId: string; romanticStatus: RomanticStatus }[] = []
// ...
function addPartnerEdge(simAId: string, simBId: string, romanticStatus: RomanticStatus) {
  const [a, b] = [simAId, simBId].sort()
  const key = `${a}-${b}`
  if (!partnerEdgeSet.has(key)) { partnerEdgeSet.add(key); partnerEdges.push({ simAId: a, simBId: b, romanticStatus }) }
}
```

and thread the status through every call site in the procedure:

```ts
focusedSim.socialRelationshipsA.forEach((r) => addPartnerEdge(r.simAId, r.simBId, r.romanticStatus))
focusedSim.socialRelationshipsB.forEach((r) => addPartnerEdge(r.simAId, r.simBId, r.romanticStatus))
// and inside the parent loop:
parent.socialRelationshipsA.forEach((r) => addPartnerEdge(r.simAId, r.simBId, r.romanticStatus))
parent.socialRelationshipsB.forEach((r) => addPartnerEdge(r.simAId, r.simBId, r.romanticStatus))
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npm test -- sims.test`
Expected: PASS.

- [ ] **Step 5: Validate and commit**

Run: `npx tsc --noEmit && npm run lint`
Run: `but status -f`, then commit ONLY `src/server/routers/sims.ts` and `src/server/routers/sims.test.ts`:
```bash
but commit feat/lineage-layout-d3dag -m "feat(api): include romanticStatus on lineage partner edges" --changes <id1>,<id2>
```

---

### Task 3: Extract `layout-shared.ts`; require `romanticStatus` on `LineagePartnerEdge`

**Files:**
- Create: `src/components/lineage-tree/layout-shared.ts`
- Modify: `src/components/lineage-tree/layout.ts` (re-export; type moves out)
- Modify: every test fixture using `{ simAId, simBId }` partner edges

- [ ] **Step 1: Create `layout-shared.ts`**

Move ALL types and constants out of `layout.ts` verbatim, add the new ones:

```ts
/**
 * Shared types and constants for the lineage-tree layout pipeline.
 * No logic lives here — only shapes and numbers, so the pipeline modules
 * (rows, clusters, engine) and the orchestrator can all import without cycles.
 */
import type { RomanticStatus } from '@prisma/client'

export type LayoutSim = {
  id: string
  generationNumber: number | null
}

export type LineageFamilyEdge = {
  parentId: string
  childId: string
}

export type LineagePartnerEdge = {
  simAId: string
  simBId: string
  romanticStatus: RomanticStatus
}

/** Node bounding box (matches the design's 140×90 with the Crest medallion). */
export const NODE_WIDTH = 140
export const NODE_HEIGHT = 90

/**
 * Connector anchor offsets within a node's bbox, for the Crest renderer.
 * Lines attach to the medallion edge, not the bbox corners.
 */
export const CREST_ANCHORS = {
  top: 2,
  bottom: 46,
  left: 48,
  right: 92,
  cx: 70,
  cy: 24,
} as const

export type CrestAnchors = typeof CREST_ANCHORS

/** Vertical pitch between generation rows (top edge to top edge). */
export const ROW_PITCH = 160
/** Gap between two partners' adjacent medallion edges (the marriage bond). */
export const MARRIAGE_BOND_GAP = 20
/** Horizontal gap between unrelated sims / couple clusters within a row. */
export const CLUSTER_GAP = 40
/** Horizontal gap between disconnected family-tree components. */
export const COMPONENT_GAP = 96
/** Left gutter reserved for the generation-row labels. */
export const ROW_LABEL_GUTTER = 64
/** Outer padding around the whole tree. */
export const TREE_PADDING = 24

/** Width of a 2-member couple cluster. */
export const COUPLE_WIDTH = NODE_WIDTH * 2 + MARRIAGE_BOND_GAP

/**
 * Hanging unions (descent junctions for non-adjacent co-parents) sit below
 * the parents' row, stacked into lanes so horizontal runs never overlap.
 * Base offset clears the medallion bbox; 4 lanes × 12px stays above the next
 * row's top handles (rowY+160+2).
 */
export const HANGING_UNION_BASE_OFFSET = NODE_HEIGHT + 4
export const HANGING_UNION_LANE_PITCH = 12
export const HANGING_UNION_MAX_LANES = 4

export type PositionedNode = {
  id: string
  x: number
  y: number
}

/** A partner pair the layout placed adjacently, with its bond status. */
export type LineageCouple = {
  a: string
  b: string
  romanticStatus: RomanticStatus
}

/** Descent junction for a non-adjacent co-parent pair with shared children. */
export type HangingUnion = {
  /**
   * pairKey of the two parents — the layout↔adapter join point: the adapter
   * derives the union node id (`union-${key}`) and coParent edge ids from it.
   */
  key: string
  parentA: string
  parentB: string
  /** Junction point (diamond center) in canvas coordinates. */
  x: number
  y: number
}

export type LineageLayout = {
  nodes: PositionedNode[]
  byId: Record<string, PositionedNode>
  rowYs: number[]
  rowGenerations: (number | null)[]
  couples: LineageCouple[]
  hangingUnions: HangingUnion[]
  viewBox: { width: number; height: number }
}

/** A layout unit: a couple (2 members, [lo, hi]) or a single. */
export type Cluster = {
  /** Smallest member id — stable identifier. */
  id: string
  members: string[]
  rowIndex: number
  width: number
}

/** Canonical unordered-pair key. */
export function pairKey(ids: readonly string[]): string {
  return [...ids].sort().join('+')
}

/**
 * Append to a Map-of-arrays entry, creating it on first use. (In-place push,
 * not spread-copy — re-spreading the list on every insertion costs
 * O(degree²) per key.)
 */
export function appendToList<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key)
  if (list) list.push(value)
  else map.set(key, [value])
}
```

- [ ] **Step 2: Re-export from `layout.ts`**

At the top of `layout.ts`, replace the type/constant definitions with:

```ts
export * from './layout-shared'
```

and delete the now-duplicated definitions (keep `computeLineageLayout` and its helpers untouched for now — they compile against the re-exports; the old `LineagePartnerEdge` usage only reads `simAId`/`simBId`, so the added required field doesn't break the algorithm, only fixtures).

- [ ] **Step 3: Fix every fixture**

Run: `grep -rln "simAId" src --include="*.test.ts" --include="*.test.tsx"`

In each hit (`layout.test.ts`, `to-flow-graph.test.ts`, `lineage-flow.test.tsx`, tree-atlas/family-tree-mini tests if present), add `romanticStatus: 'MARRIED'` to every inline partner-edge literal, e.g.:

```ts
const partnerEdges = [{ simAId: 'f1', simBId: 'f2', romanticStatus: 'MARRIED' as const }]
```

(`as const` keeps the literal assignable to the Prisma enum type.)

- [ ] **Step 4: Validate**

Run: `npx tsc --noEmit && npm run lint && npm test -- lineage-tree`
Expected: clean, all existing tests pass (behavior unchanged).

- [ ] **Step 5: Commit**

```bash
but commit feat/lineage-layout-d3dag -m "refactor(lineage-tree): extract layout-shared module; partner edges carry romanticStatus" --changes <ids…>
```

---

### Task 4: `layout-rows.ts` — row derivation

**Files:**
- Create: `src/components/lineage-tree/layout-rows.ts`
- Test: `src/components/lineage-tree/__tests__/layout-rows.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { deriveRows } from '../layout-rows'
import type { LayoutSim, LineagePartnerEdge } from '../layout-shared'

const married = (a: string, b: string): LineagePartnerEdge => ({
  simAId: a, simBId: b, romanticStatus: 'MARRIED',
})

describe('deriveRows', () => {
  it('maps distinct generations to ascending row indices', () => {
    const sims: LayoutSim[] = [
      { id: 'a', generationNumber: 3 },
      { id: 'b', generationNumber: 1 },
      { id: 'c', generationNumber: 1 },
    ]
    const { rowGenerations, rowOf } = deriveRows(sims, [])
    expect(rowGenerations).toEqual([1, 3])
    expect(rowOf.get('b')).toBe(0)
    expect(rowOf.get('a')).toBe(1)
  })

  it('places a null-gen sim in their generation-bearing partner’s row', () => {
    const sims: LayoutSim[] = [
      { id: 'gen2', generationNumber: 2 },
      { id: 'gen1', generationNumber: 1 },
      { id: 'townie', generationNumber: null },
    ]
    const { rowGenerations, rowOf } = deriveRows(sims, [married('townie', 'gen2')])
    expect(rowOf.get('townie')).toBe(rowOf.get('gen2'))
    expect(rowGenerations).toEqual([1, 2]) // no shelf needed
  })

  it('does not chain placement through another null-gen partner', () => {
    // n2 is married to gen-bearing g1 → sits with g1. n1 is married only to
    // n2 (null-gen) → shelf. Partner-only placement is one pass, by design.
    const sims: LayoutSim[] = [
      { id: 'g1', generationNumber: 1 },
      { id: 'n1', generationNumber: null },
      { id: 'n2', generationNumber: null },
    ]
    const { rowGenerations, rowOf } = deriveRows(sims, [married('n1', 'n2'), married('n2', 'g1')])
    expect(rowOf.get('n2')).toBe(0)
    expect(rowGenerations).toEqual([1, null])
    expect(rowOf.get('n1')).toBe(1) // shelf
  })

  it('shelves null-gen sims whose only connections are children or parents', () => {
    // deriveRows no longer sees family edges at all — partner-only placement.
    const sims: LayoutSim[] = [
      { id: 'kid', generationNumber: 2 },
      { id: 'founder', generationNumber: 1 },
      { id: 'mystery', generationNumber: null },
    ]
    const { rowGenerations, rowOf } = deriveRows(sims, [])
    expect(rowGenerations).toEqual([1, 2, null])
    expect(rowOf.get('mystery')).toBe(2)
  })

  it('shelves unconnected null-gen sims in a trailing null row', () => {
    const sims: LayoutSim[] = [
      { id: 'real', generationNumber: 1 },
      { id: 'stray', generationNumber: null },
    ]
    const { rowGenerations, rowOf } = deriveRows(sims, [])
    expect(rowGenerations).toEqual([1, null])
    expect(rowOf.get('stray')).toBe(1)
  })

  it('omits the shelf row when every null-gen sim has a placed partner', () => {
    const sims: LayoutSim[] = [
      { id: 'real', generationNumber: 1 },
      { id: 'spouse', generationNumber: null },
    ]
    const { rowGenerations } = deriveRows(sims, [married('spouse', 'real')])
    expect(rowGenerations).toEqual([1])
  })

  it('shelves everyone when no sim has a generation (no anchor to place from)', () => {
    const sims: LayoutSim[] = [
      { id: 'x', generationNumber: null },
      { id: 'y', generationNumber: null },
    ]
    const { rowGenerations, rowOf } = deriveRows(sims, [married('x', 'y')])
    expect(rowGenerations).toEqual([null])
    expect(rowOf.get('x')).toBe(0)
    expect(rowOf.get('y')).toBe(0)
  })
})
```

- [ ] **Step 2: Run, verify failure**

Run: `npm test -- layout-rows`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `layout-rows.ts`**

```ts
/**
 * Row derivation for the lineage layout.
 *
 * - Each distinct real generation gets one row, ascending.
 * - A null-generation sim partnered with a generation-bearing sim sits in
 *   that partner's row (single pass, partner-only — deliberately no chained
 *   inference and no child/parent fallbacks; the common case is a townie
 *   spouse, and anything murkier belongs on the shelf as a visible nudge to
 *   set the generation in the data).
 * - Every other null-generation sim goes to a trailing shelf row, which
 *   exists only when occupied.
 *
 * Assumes edges are pre-sanitized (no self-references or unknown sim ids) —
 * the orchestrator guarantees this.
 */
import { appendToList, type LayoutSim, type LineagePartnerEdge } from './layout-shared'

export type RowAssignment = {
  rowGenerations: (number | null)[]
  /** simId → 0-based row index. Every sim gets a row. */
  rowOf: Map<string, number>
}

export function deriveRows(
  sims: LayoutSim[],
  partnerEdges: LineagePartnerEdge[],
): RowAssignment {
  const sortedIds = sims.map((s) => s.id).sort()

  const realGens = Array.from(
    new Set(sims.map((s) => s.generationNumber).filter((g): g is number => g !== null)),
  ).sort((a, b) => a - b)
  const rowByGen = new Map(realGens.map((g, i) => [g, i] as const))

  const rowOf = new Map<string, number>()
  for (const s of sims) {
    if (s.generationNumber !== null) rowOf.set(s.id, rowByGen.get(s.generationNumber)!)
  }

  // All partner edges count for co-location, including exes.
  const partnersOf = new Map<string, string[]>()
  for (const { simAId, simBId } of partnerEdges) {
    appendToList(partnersOf, simAId, simBId)
    appendToList(partnersOf, simBId, simAId)
  }

  // Partner-only placement. Collected into a separate map first so the result
  // never depends on iteration order (placements can't see each other).
  const partnerRowOf = new Map<string, number>()
  for (const id of sortedIds) {
    if (rowOf.has(id)) continue
    const partnerRows = (partnersOf.get(id) ?? [])
      .map((other) => rowOf.get(other))
      .filter((r): r is number => r !== undefined)
    if (partnerRows.length > 0) partnerRowOf.set(id, Math.min(...partnerRows))
  }
  for (const [id, row] of partnerRowOf) rowOf.set(id, row)

  const shelfNeeded = sims.some((s) => !rowOf.has(s.id))
  const rowGenerations: (number | null)[] = shelfNeeded ? [...realGens, null] : [...realGens]
  if (shelfNeeded) {
    const shelfRow = realGens.length
    for (const id of sortedIds) {
      if (!rowOf.has(id)) rowOf.set(id, shelfRow)
    }
  }
  return { rowGenerations, rowOf }
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npm test -- layout-rows`
Expected: PASS.

- [ ] **Step 5: Validate and commit**

Run: `npx tsc --noEmit && npm run lint`
```bash
but commit feat/lineage-layout-d3dag -m "feat(lineage-tree): row derivation with partner-row placement and shelf" --changes <ids…>
```

---

### Task 5: `layout-clusters.ts` — partner ranking and matching

**Files:**
- Create: `src/components/lineage-tree/layout-clusters.ts`
- Test: `src/components/lineage-tree/__tests__/layout-clusters.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { matchCouples, buildClusters } from '../layout-clusters'
import { COUPLE_WIDTH, NODE_WIDTH, type LineagePartnerEdge } from '../layout-shared'
import type { RomanticStatus } from '@prisma/client'

const edge = (a: string, b: string, romanticStatus: RomanticStatus): LineagePartnerEdge => ({
  simAId: a, simBId: b, romanticStatus,
})
const row0 = (...ids: string[]) => new Map<string, number>(ids.map((id) => [id, 0]))

describe('matchCouples', () => {
  it('prefers the current spouse over an ex (never "first partner wins")', () => {
    // 'a' < 'b' < 'z': the old algorithm would pair bob with his EX 'a'.
    const couples = matchCouples(
      [edge('bob', 'a', 'EX_PARTNER'), edge('bob', 'z', 'MARRIED')],
      new Set(['a', 'bob', 'z']),
      row0('a', 'bob', 'z'),
    )
    expect(couples).toEqual([{ a: 'bob', b: 'z', romanticStatus: 'MARRIED' }])
  })

  it('ranks MARRIED > ENGAGED > DATING > WIDOWED for the single slot', () => {
    const couples = matchCouples(
      [edge('bob', 'late', 'WIDOWED'), edge('bob', 'new', 'MARRIED')],
      new Set(['bob', 'late', 'new']),
      row0('bob', 'late', 'new'),
    )
    expect(couples).toEqual([{ a: 'bob', b: 'new', romanticStatus: 'MARRIED' }])
  })

  it('keeps a widowed-only pair adjacent', () => {
    const couples = matchCouples(
      [edge('ann', 'joe', 'WIDOWED')],
      new Set(['ann', 'joe']),
      row0('ann', 'joe'),
    )
    expect(couples).toEqual([{ a: 'ann', b: 'joe', romanticStatus: 'WIDOWED' }])
  })

  it('never pairs exes', () => {
    const couples = matchCouples(
      [edge('a', 'b', 'EX_PARTNER')],
      new Set(['a', 'b']),
      row0('a', 'b'),
    )
    expect(couples).toEqual([])
  })

  it('only pairs partners in the same row', () => {
    const rowOf = new Map<string, number>([['a', 0], ['b', 1]])
    const couples = matchCouples([edge('a', 'b', 'MARRIED')], new Set(['a', 'b']), rowOf)
    expect(couples).toEqual([])
  })

  it('gives each sim at most one adjacent partner', () => {
    const couples = matchCouples(
      [edge('hub', 'w1', 'MARRIED'), edge('hub', 'w2', 'DATING')],
      new Set(['hub', 'w1', 'w2']),
      row0('hub', 'w1', 'w2'),
    )
    expect(couples).toHaveLength(1)
    expect(couples[0]).toMatchObject({ romanticStatus: 'MARRIED' })
  })
})

describe('buildClusters', () => {
  it('builds couple clusters (sorted members) and singles, sorted by id', () => {
    const sims = [
      { id: 'c', generationNumber: 1 },
      { id: 'a', generationNumber: 1 },
      { id: 'b', generationNumber: 1 },
    ]
    const rowOf = row0('a', 'b', 'c')
    const clusters = buildClusters(sims, rowOf, [{ a: 'a', b: 'c', romanticStatus: 'MARRIED' }])
    expect(clusters).toEqual([
      { id: 'a', members: ['a', 'c'], rowIndex: 0, width: COUPLE_WIDTH },
      { id: 'b', members: ['b'], rowIndex: 0, width: NODE_WIDTH },
    ])
  })
})
```

- [ ] **Step 2: Run, verify failure**

Run: `npm test -- layout-clusters`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `layout-clusters.ts`**

```ts
/**
 * Partner ranking + greedy maximum matching, and cluster construction.
 *
 * One adjacency slot per sim: partner edges are ranked by how "current" the
 * relationship is, and the top-ranked same-row pair wins. EX_PARTNER never
 * gets adjacency — exes connect only through shared children (hanging
 * unions, see layout.ts).
 */
import type { RomanticStatus } from '@prisma/client'
import {
  COUPLE_WIDTH,
  NODE_WIDTH,
  type Cluster,
  type LayoutSim,
  type LineageCouple,
  type LineagePartnerEdge,
} from './layout-shared'

/** Lower = more current. EX_PARTNER is deliberately absent. */
const ADJACENCY_RANK: Partial<Record<RomanticStatus, number>> = {
  MARRIED: 0,
  ENGAGED: 1,
  DATING: 2,
  WIDOWED: 3,
}

/** Deterministic tiebreak: compare candidate pairs by (lo, hi) sim ids. */
function comparePairIds(a: { lo: string; hi: string }, b: { lo: string; hi: string }): number {
  if (a.lo !== b.lo) return a.lo < b.lo ? -1 : 1
  if (a.hi !== b.hi) return a.hi < b.hi ? -1 : 1
  return 0
}

export function matchCouples(
  partnerEdges: LineagePartnerEdge[],
  idSet: Set<string>,
  rowOf: Map<string, number>,
): LineageCouple[] {
  const candidates = partnerEdges
    .map(({ simAId, simBId, romanticStatus }) => {
      const [lo, hi] = [simAId, simBId].sort()
      return { lo, hi, romanticStatus, rank: ADJACENCY_RANK[romanticStatus] }
    })
    .filter(
      (c): c is typeof c & { rank: number } =>
        c.rank !== undefined &&
        c.lo !== c.hi &&
        idSet.has(c.lo) &&
        idSet.has(c.hi) &&
        rowOf.get(c.lo) !== undefined &&
        rowOf.get(c.lo) === rowOf.get(c.hi),
    )
    .sort((a, b) => a.rank - b.rank || comparePairIds(a, b))

  const matched = new Set<string>()
  const couples: LineageCouple[] = []
  for (const { lo, hi, romanticStatus } of candidates) {
    if (matched.has(lo) || matched.has(hi)) continue
    matched.add(lo)
    matched.add(hi)
    couples.push({ a: lo, b: hi, romanticStatus })
  }
  return couples
}

export function buildClusters(
  sims: LayoutSim[],
  rowOf: Map<string, number>,
  couples: LineageCouple[],
): Cluster[] {
  const coupleOf = new Map<string, LineageCouple>()
  for (const c of couples) {
    coupleOf.set(c.a, c)
    coupleOf.set(c.b, c)
  }
  const sortedIds = sims.map((s) => s.id).sort()
  const placed = new Set<string>()
  const clusters: Cluster[] = []
  for (const id of sortedIds) {
    if (placed.has(id)) continue
    const couple = coupleOf.get(id)
    if (couple) {
      placed.add(couple.a)
      placed.add(couple.b)
      clusters.push({
        id: couple.a,
        members: [couple.a, couple.b],
        rowIndex: rowOf.get(couple.a)!,
        width: COUPLE_WIDTH,
      })
    } else {
      placed.add(id)
      clusters.push({ id, members: [id], rowIndex: rowOf.get(id)!, width: NODE_WIDTH })
    }
  }
  return clusters
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npm test -- layout-clusters`
Expected: PASS.

- [ ] **Step 5: Validate and commit**

Run: `npx tsc --noEmit && npm run lint`
```bash
but commit feat/lineage-layout-d3dag -m "feat(lineage-tree): ranked partner matching and cluster building" --changes <ids…>
```

---

### Task 6: `layout-engine.ts` — d3-dag positioning and banding

**Files:**
- Create: `src/components/lineage-tree/layout-engine.ts`
- Test: `src/components/lineage-tree/__tests__/layout-engine.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { positionClusters } from '../layout-engine'
import { CLUSTER_GAP, COMPONENT_GAP, COUPLE_WIDTH, NODE_WIDTH, type Cluster } from '../layout-shared'

const couple = (id: string, rowIndex: number): Cluster => ({
  id, members: [id, `${id}-partner`], rowIndex, width: COUPLE_WIDTH,
})
const single = (id: string, rowIndex: number): Cluster => ({
  id, members: [id], rowIndex, width: NODE_WIDTH,
})

describe('positionClusters', () => {
  it('positions a child within its parents’ horizontal span', () => {
    const clusters = [couple('p', 0), single('c', 1)]
    const x = positionClusters({
      clusters,
      parentClusterIdsOf: new Map([['c', ['p']]]),
    })
    const parentLeft = x.get('p')!
    const childLeft = x.get('c')!
    expect(childLeft).toBeGreaterThanOrEqual(parentLeft - NODE_WIDTH)
    expect(childLeft).toBeLessThanOrEqual(parentLeft + COUPLE_WIDTH)
  })

  it('never overlaps clusters within a row', () => {
    const clusters = [
      couple('p1', 0), couple('p2', 0),
      single('a', 1), single('b', 1), single('c', 1), single('d', 1),
    ]
    const x = positionClusters({
      clusters,
      parentClusterIdsOf: new Map([
        ['a', ['p1']], ['b', ['p1']], ['c', ['p2']], ['d', ['p2']],
      ]),
    })
    for (const row of [0, 1]) {
      const inRow = clusters
        .filter((c) => c.rowIndex === row)
        .map((c) => ({ left: x.get(c.id)!, right: x.get(c.id)! + c.width }))
        .sort((a, b) => a.left - b.left)
      for (let i = 1; i < inRow.length; i++) {
        expect(inRow[i].left).toBeGreaterThanOrEqual(inRow[i - 1].right)
      }
    }
  })

  it('bands disconnected multi-cluster components left-to-right with COMPONENT_GAP', () => {
    const clusters = [
      couple('fam1', 0), single('kid1', 1),
      couple('fam2', 0), single('kid2', 1),
    ]
    const x = positionClusters({
      clusters,
      parentClusterIdsOf: new Map([['kid1', ['fam1']], ['kid2', ['fam2']]]),
    })
    // Component order: by (min row, min cluster id) → fam1 first. Pin the
    // order explicitly so a tiebreak regression fails with a clear message.
    expect(x.get('fam1')!).toBeLessThan(x.get('fam2')!)
    const fam1Right = Math.max(x.get('fam1')! + COUPLE_WIDTH, x.get('kid1')! + NODE_WIDTH)
    const fam2Left = Math.min(x.get('fam2')!, x.get('kid2')!)
    expect(fam2Left).toBeGreaterThanOrEqual(fam1Right + COMPONENT_GAP)
  })

  it('packs loose clusters (no layout edges) per row after the last component with CLUSTER_GAP', () => {
    const clusters = [couple('fam', 0), single('kid', 1), single('loner1', 0), single('loner2', 0)]
    const x = positionClusters({
      clusters,
      parentClusterIdsOf: new Map([['kid', ['fam']]]),
    })
    const bandRight = Math.max(x.get('fam')! + COUPLE_WIDTH, x.get('kid')! + NODE_WIDTH)
    expect(x.get('loner1')!).toBeGreaterThanOrEqual(bandRight)
    expect(x.get('loner2')!).toBe(x.get('loner1')! + NODE_WIDTH + CLUSTER_GAP)
  })

  it('handles rows the component does not occupy (family starting at row 2)', () => {
    const clusters = [couple('late', 2), single('latekid', 3)]
    const x = positionClusters({
      clusters,
      parentClusterIdsOf: new Map([['latekid', ['late']]]),
    })
    expect(x.get('late')).toBeDefined()
    expect(x.get('latekid')).toBeDefined()
  })

  it('is deterministic', () => {
    const clusters = [
      couple('p1', 0), couple('p2', 0),
      single('a', 1), single('b', 1), single('c', 1),
    ]
    const input = {
      clusters,
      parentClusterIdsOf: new Map([['a', ['p1']], ['b', ['p2']], ['c', ['p1']]]),
    }
    expect(positionClusters(input)).toEqual(positionClusters(input))
  })

  it('returns an empty map for no clusters', () => {
    expect(positionClusters({ clusters: [], parentClusterIdsOf: new Map() }).size).toBe(0)
  })
})
```

- [ ] **Step 2: Run, verify failure**

Run: `npm test -- layout-engine`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `layout-engine.ts`**

```ts
/**
 * Cluster positioning, in three small steps:
 *
 *   splitComponents  — group clusters into connected COMPONENTS plus loose
 *                      clusters (clusters with no layout edges at all)
 *   layoutComponent  — x-positions for ONE component via d3-dag sugiyama,
 *                      with every cluster pinned to its generation row
 *   positionClusters — band components left-to-right, then pack loose
 *                      clusters compactly per row after the last component
 *
 * Only x comes from this module. y always derives from the row index in the
 * orchestrator — that is what keeps generation rows aligned across separate
 * components.
 */
import { graphStratify, sugiyama, decrossTwoLayer, type Graph, type Separation } from 'd3-dag'
import { CLUSTER_GAP, COMPONENT_GAP, appendToList, type Cluster } from './layout-shared'

export type ClusterGraph = {
  clusters: Cluster[]
  /** childClusterId → parent CLUSTER ids; only edges spanning ≥1 row down. */
  parentClusterIdsOf: Map<string, string[]>
}

/**
 * Group clusters into connected components via breadth-first walk over the
 * parent/child edges. A cluster with no edges at all is "loose" — a lone sim
 * or a childless orphan couple; the entire shelf row is loose clusters.
 * Components come back sorted by (topmost row, smallest cluster id); loose
 * clusters by id. Deterministic.
 *
 * (We group components ourselves rather than using d3-dag's graph.split():
 * clusters must be grouped BEFORE any d3-dag graph exists, and we control
 * the deterministic ordering.)
 */
export function splitComponents({ clusters, parentClusterIdsOf }: ClusterGraph): {
  components: Cluster[][]
  loose: Cluster[]
} {
  const byId = new Map(clusters.map((c) => [c.id, c]))
  const neighbors = new Map<string, string[]>()
  for (const [child, parents] of parentClusterIdsOf) {
    for (const parent of parents) {
      appendToList(neighbors, child, parent)
      appendToList(neighbors, parent, child)
    }
  }

  const visited = new Set<string>()
  const components: Cluster[][] = []
  const loose: Cluster[] = []
  for (const cluster of [...clusters].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    if (visited.has(cluster.id)) continue
    if (!neighbors.has(cluster.id)) {
      loose.push(cluster)
      continue
    }
    const component: Cluster[] = []
    const queue = [cluster.id]
    visited.add(cluster.id)
    while (queue.length > 0) {
      const id = queue.shift()!
      component.push(byId.get(id)!)
      for (const next of neighbors.get(id) ?? []) {
        if (!visited.has(next)) {
          visited.add(next)
          queue.push(next)
        }
      }
    }
    components.push(component)
  }

  // Sort keys computed once per component — computing them inside the
  // comparator would redo the min/sort work on every comparison.
  const keyed = components.map((component) => ({
    component,
    minRow: Math.min(...component.map((c) => c.rowIndex)),
    minId: [...component.map((c) => c.id)].sort()[0],
  }))
  keyed.sort((a, b) => a.minRow - b.minRow || (a.minId < b.minId ? -1 : 1))
  return { components: keyed.map((k) => k.component), loose }
}

type ComponentDatum = {
  id: string
  parentIds: string[]
  cluster: Cluster
  normRow: number
}

/**
 * Custom d3-dag layering: every cluster gets the y of its pinned
 * (component-normalized) generation row, instead of deriving layers from
 * edges. The separation callback is honored when computing bounds (it
 * measures node-to-boundary padding in d3-dag's protocol), then all layers
 * shift so the topmost starts at 0. Returns the total layered height — the
 * d3-dag Layering contract requires it.
 */
function pinnedRowLayering<N extends { normRow: number }, L>(
  graph: Graph<N, L>,
  sep: Separation<N, L>,
): number {
  let min = Infinity
  let max = -Infinity
  for (const node of graph.nodes()) {
    node.y = node.data.normRow
    min = Math.min(min, node.y - sep(undefined, node))
    max = Math.max(max, node.y + sep(node, undefined))
  }
  if (min === Infinity) return 0
  for (const node of graph.nodes()) node.y -= min
  return max - min
}

/**
 * X-position one component with d3-dag sugiyama (ordering + coordinates
 * only — the layering is pinned). Returns 0-based left edges and the
 * component's total width.
 */
export function layoutComponent(
  component: Cluster[],
  parentClusterIdsOf: Map<string, string[]>,
): { lefts: Map<string, number>; width: number } {
  const minRow = Math.min(...component.map((c) => c.rowIndex))
  const inComponent = new Set(component.map((c) => c.id))
  const data: ComponentDatum[] = [...component]
    .sort((a, b) => a.rowIndex - b.rowIndex || (a.id < b.id ? -1 : 1))
    .map((cluster) => ({
      id: cluster.id,
      parentIds: (parentClusterIdsOf.get(cluster.id) ?? []).filter((p) => inComponent.has(p)).sort(),
      cluster,
      normRow: cluster.rowIndex - minRow,
    }))

  const graph = graphStratify()(data)
  const layout = sugiyama()
    .layering(pinnedRowLayering)
    .decross(decrossTwoLayer())
    .nodeSize((node) => [node.data.cluster.width + CLUSTER_GAP, 1] as const)
  layout(graph)

  // d3-dag reports centers; convert to left edges, normalized to start at 0.
  let minLeft = Infinity
  for (const node of graph.nodes()) {
    minLeft = Math.min(minLeft, node.x - node.data.cluster.width / 2)
  }
  const lefts = new Map<string, number>()
  let width = 0
  for (const node of graph.nodes()) {
    const left = node.x - node.data.cluster.width / 2 - minLeft
    lefts.set(node.data.id, left)
    width = Math.max(width, left + node.data.cluster.width)
  }
  return { lefts, width }
}

/** Absolute left x per cluster id, 0-based (no gutter/padding). */
export function positionClusters(graph: ClusterGraph): Map<string, number> {
  const { components, loose } = splitComponents(graph)
  const xById = new Map<string, number>()

  // Components band left-to-right, separated by COMPONENT_GAP.
  let offset = 0
  for (const component of components) {
    const { lefts, width } = layoutComponent(component, graph.parentClusterIdsOf)
    for (const [id, left] of lefts) xById.set(id, offset + left)
    offset += width + COMPONENT_GAP
  }

  // Loose clusters pack compactly per row after the last component.
  const cursorByRow = new Map<number, number>()
  for (const c of loose) {
    const cursor = cursorByRow.get(c.rowIndex) ?? offset
    xById.set(c.id, cursor)
    cursorByRow.set(c.rowIndex, cursor + c.width + CLUSTER_GAP)
  }
  return xById
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npm test -- layout-engine`
Expected: PASS. If d3-dag throws on any input shape, debug against the test fixtures — do NOT loosen the assertions.

- [ ] **Step 5: Validate and commit**

Run: `npx tsc --noEmit && npm run lint`
```bash
but commit feat/lineage-layout-d3dag -m "feat(lineage-tree): d3-dag sugiyama cluster positioning with pinned rows and component banding" --changes <ids…>
```

---

### Task 7: `layout.ts` orchestrator + hanging unions; rewrite `layout.test.ts`

**Files:**
- Rewrite: `src/components/lineage-tree/layout.ts`
- Rewrite: `src/components/lineage-tree/__tests__/layout.test.ts`

- [ ] **Step 1: Rewrite `layout.test.ts` as the scenario suite (failing)**

Replace the file's contents entirely:

```ts
import { describe, it, expect } from 'vitest'
import {
  computeLineageLayout,
  CREST_ANCHORS,
  HANGING_UNION_BASE_OFFSET,
  MARRIAGE_BOND_GAP,
  NODE_WIDTH,
  type LayoutSim,
  type LineagePartnerEdge,
} from '../layout'
import type { RomanticStatus } from '@prisma/client'

const edge = (a: string, b: string, romanticStatus: RomanticStatus = 'MARRIED'): LineagePartnerEdge => ({
  simAId: a, simBId: b, romanticStatus,
})
const sim = (id: string, generationNumber: number | null): LayoutSim => ({ id, generationNumber })

/** No two medallions in the same row may overlap. */
function expectNoRowOverlap(layout: ReturnType<typeof computeLineageLayout>) {
  const byRow = new Map<number, number[]>()
  for (const n of layout.nodes) {
    byRow.set(n.y, [...(byRow.get(n.y) ?? []), n.x])
  }
  for (const xs of byRow.values()) {
    const sorted = [...xs].sort((a, b) => a - b)
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i] - sorted[i - 1]).toBeGreaterThanOrEqual(NODE_WIDTH)
    }
  }
}

describe('computeLineageLayout — rows', () => {
  const sims = [sim('f1', 1), sim('f2', 1), sim('c1', 2), sim('c2', 2), sim('stray', null)]
  const familyEdges = [
    { parentId: 'f1', childId: 'c1' },
    { parentId: 'f2', childId: 'c1' },
  ]
  const partnerEdges = [edge('f1', 'f2')]
  const layout = computeLineageLayout(sims, familyEdges, partnerEdges)

  it('places same-generation sims at the same y, later generations lower', () => {
    expect(layout.byId['f1'].y).toBe(layout.byId['f2'].y)
    expect(layout.byId['c1'].y).toBe(layout.byId['c2'].y)
    expect(layout.byId['c1'].y).toBeGreaterThan(layout.byId['f1'].y)
  })

  it('shelves the unconnected null-generation sim in a trailing null row', () => {
    expect(layout.rowGenerations).toEqual([1, 2, null])
    expect(layout.byId['stray'].y).toBeGreaterThan(layout.byId['c1'].y)
  })

  it('places a connected null-generation sim in their partner’s row, not the shelf', () => {
    const l = computeLineageLayout(
      [sim('f1', 1), sim('spouse', null)],
      [],
      [edge('f1', 'spouse')],
    )
    expect(l.byId['spouse'].y).toBe(l.byId['f1'].y)
    expect(l.rowGenerations).toEqual([1])
  })

  it('returns a node for every sim and handles an empty tree', () => {
    expect(layout.nodes.map((n) => n.id).sort()).toEqual(sims.map((s) => s.id).sort())
    const empty = computeLineageLayout([], [], [])
    expect(empty.nodes).toHaveLength(0)
    expect(empty.viewBox.width).toBeGreaterThan(0)
  })
})

describe('computeLineageLayout — couples', () => {
  it('places the matched couple adjacent (one node width + bond gap)', () => {
    const l = computeLineageLayout([sim('f1', 1), sim('f2', 1)], [], [edge('f1', 'f2')])
    expect(Math.abs(l.byId['f1'].x - l.byId['f2'].x)).toBe(NODE_WIDTH + MARRIAGE_BOND_GAP)
    expect(l.couples).toEqual([{ a: 'f1', b: 'f2', romanticStatus: 'MARRIED' }])
  })

  it('prefers the current spouse over an ex for the adjacency slot', () => {
    // alice < bob < dana: id order would pick alice; ranking must pick dana.
    const l = computeLineageLayout(
      [sim('alice', 1), sim('bob', 1), sim('dana', 1)],
      [],
      [edge('alice', 'bob', 'EX_PARTNER'), edge('bob', 'dana', 'MARRIED')],
    )
    expect(l.couples).toEqual([{ a: 'bob', b: 'dana', romanticStatus: 'MARRIED' }])
  })

  it('keeps widowed couples adjacent with their status exposed', () => {
    const l = computeLineageLayout([sim('ann', 1), sim('joe', 1)], [], [edge('ann', 'joe', 'WIDOWED')])
    expect(l.couples).toEqual([{ a: 'ann', b: 'joe', romanticStatus: 'WIDOWED' }])
  })

  it('emits no couple for ex-only pairs', () => {
    const l = computeLineageLayout([sim('a', 1), sim('b', 1)], [], [edge('a', 'b', 'EX_PARTNER')])
    expect(l.couples).toEqual([])
  })
})

describe('computeLineageLayout — hanging unions', () => {
  // Remarriage: alice+bob (exes) have carol; bob married dana; bob+dana have evan.
  const sims = [sim('alice', 1), sim('bob', 1), sim('dana', 1), sim('carol', 2), sim('evan', 2)]
  const familyEdges = [
    { parentId: 'alice', childId: 'carol' },
    { parentId: 'bob', childId: 'carol' },
    { parentId: 'bob', childId: 'evan' },
    { parentId: 'dana', childId: 'evan' },
  ]
  const partnerEdges = [edge('alice', 'bob', 'EX_PARTNER'), edge('bob', 'dana', 'MARRIED')]
  const layout = computeLineageLayout(sims, familyEdges, partnerEdges)

  it('emits one hanging union for the non-adjacent co-parent pair', () => {
    expect(layout.couples).toEqual([{ a: 'bob', b: 'dana', romanticStatus: 'MARRIED' }])
    expect(layout.hangingUnions).toHaveLength(1)
    const [u] = layout.hangingUnions
    expect([u.parentA, u.parentB].sort()).toEqual(['alice', 'bob'])
  })

  it('centers the junction between the parents, below their row', () => {
    const [u] = layout.hangingUnions
    const expectedX =
      (layout.byId['alice'].x + CREST_ANCHORS.cx + layout.byId['bob'].x + CREST_ANCHORS.cx) / 2
    expect(u.x).toBeCloseTo(expectedX, 5)
    expect(u.y).toBe(layout.byId['alice'].y + HANGING_UNION_BASE_OFFSET)
  })

  it('emits no hanging union for childless exes', () => {
    const l = computeLineageLayout(
      [sim('a', 1), sim('b', 1)],
      [],
      [edge('a', 'b', 'EX_PARTNER')],
    )
    expect(l.hangingUnions).toEqual([])
  })

  it('stacks two hanging unions in the same row into different lanes', () => {
    const wide = computeLineageLayout(
      [sim('a', 1), sim('b', 1), sim('c', 1), sim('d', 1), sim('k1', 2), sim('k2', 2)],
      [
        { parentId: 'a', childId: 'k1' },
        { parentId: 'b', childId: 'k1' },
        { parentId: 'c', childId: 'k2' },
        { parentId: 'd', childId: 'k2' },
      ],
      [], // no partner edges at all: both parent pairs are non-adjacent co-parents
    )
    expect(wide.hangingUnions).toHaveLength(2)
    const ys = wide.hangingUnions.map((u) => u.y)
    expect(new Set(ys).size).toBe(2)
  })
})

describe('computeLineageLayout — components and singles', () => {
  // Family A: f1+f2 → c1. Family B: g1 → c2 (separate tree). Pia: unconnected gen-1 sim.
  const sims = [
    sim('f1', 1), sim('f2', 1), sim('c1', 2),
    sim('g1', 1), sim('c2', 2),
    sim('pia', 1),
  ]
  const familyEdges = [
    { parentId: 'f1', childId: 'c1' },
    { parentId: 'f2', childId: 'c1' },
    { parentId: 'g1', childId: 'c2' },
  ]
  const partnerEdges = [edge('f1', 'f2')]
  const layout = computeLineageLayout(sims, familyEdges, partnerEdges)

  it('aligns both components to the same generation rows', () => {
    expect(layout.byId['g1'].y).toBe(layout.byId['f1'].y)
    expect(layout.byId['c2'].y).toBe(layout.byId['c1'].y)
  })

  it('renders the unconnected sim in her generation row', () => {
    expect(layout.byId['pia'].y).toBe(layout.byId['f1'].y)
  })

  it('keeps components horizontally separated', () => {
    const famARight = Math.max(layout.byId['f1'].x, layout.byId['f2'].x, layout.byId['c1'].x) + NODE_WIDTH
    const famBLeft = Math.min(layout.byId['g1'].x, layout.byId['c2'].x)
    expect(famBLeft).toBeGreaterThanOrEqual(famARight)
  })

  it('never overlaps medallions within a row', () => {
    expectNoRowOverlap(layout)
  })

  it('keeps children within their parents’ horizontal span', () => {
    const left = Math.min(layout.byId['f1'].x, layout.byId['f2'].x)
    const right = Math.max(layout.byId['f1'].x, layout.byId['f2'].x) + NODE_WIDTH
    expect(layout.byId['c1'].x + CREST_ANCHORS.cx).toBeGreaterThanOrEqual(left)
    expect(layout.byId['c1'].x + CREST_ANCHORS.cx).toBeLessThanOrEqual(right)
  })
})

describe('computeLineageLayout — determinism and viewBox', () => {
  const sims = [sim('f1', 1), sim('f2', 1), sim('c1', 2), sim('z', null)]
  const familyEdges = [{ parentId: 'f1', childId: 'c1' }]
  const partnerEdges = [edge('f1', 'f2')]

  it('is deterministic across repeated calls', () => {
    const a = computeLineageLayout(sims, familyEdges, partnerEdges)
    const b = computeLineageLayout(sims, familyEdges, partnerEdges)
    expect(b).toEqual(a)
  })

  it('grows the viewBox with content', () => {
    const small = computeLineageLayout([sim('solo', 1)], [], [])
    const large = computeLineageLayout(sims, familyEdges, partnerEdges)
    expect(large.viewBox.width).toBeGreaterThan(small.viewBox.width)
    expect(large.viewBox.height).toBeGreaterThan(small.viewBox.height)
  })

  it('ignores self-edges, unknown-id edges, and same-row parent-child edges without dropping sims', () => {
    const l = computeLineageLayout(
      [sim('a', 1), sim('b', 1)],
      [
        { parentId: 'a', childId: 'a' },
        { parentId: 'ghost', childId: 'a' },
        { parentId: 'a', childId: 'b' }, // same-row parent-child: render-only
      ],
      [edge('a', 'ghost')],
    )
    expect(l.nodes).toHaveLength(2)
    expectNoRowOverlap(l)
  })
})
```

- [ ] **Step 2: Run, verify failure**

Run: `npm test -- lineage-tree/__tests__/layout.test`
Expected: FAIL — `hangingUnions` missing, couples shape mismatch, etc.

- [ ] **Step 3: Rewrite `layout.ts`**

Replace everything below the `export * from './layout-shared'` line:

```ts
/**
 * Lineage-tree layout orchestrator. Pure and deterministic: same input →
 * identical output, all tie-breaks by sim id. Pipeline rationale lives in
 * docs/superpowers/specs/2026-06-07-lineage-layout-redesign-design.md.
 */
export * from './layout-shared'
import {
  CREST_ANCHORS,
  HANGING_UNION_BASE_OFFSET,
  HANGING_UNION_LANE_PITCH,
  HANGING_UNION_MAX_LANES,
  MARRIAGE_BOND_GAP,
  NODE_HEIGHT,
  NODE_WIDTH,
  ROW_LABEL_GUTTER,
  ROW_PITCH,
  TREE_PADDING,
  appendToList,
  pairKey,
  type Cluster,
  type HangingUnion,
  type LayoutSim,
  type LineageCouple,
  type LineageFamilyEdge,
  type LineageLayout,
  type LineagePartnerEdge,
  type PositionedNode,
} from './layout-shared'
import { deriveRows } from './layout-rows'
import { buildClusters, matchCouples } from './layout-clusters'
import { positionClusters, type ClusterGraph } from './layout-engine'

/**
 * The pipeline, one named step per spec section. Each helper below is small,
 * pure, and reads top-to-bottom in the same order as this function.
 */
export function computeLineageLayout(
  sims: LayoutSim[],
  familyEdges: LineageFamilyEdge[],
  partnerEdges: LineagePartnerEdge[],
): LineageLayout {
  const { idSet, cleanFamily, cleanPartners } = sanitizeEdges(sims, familyEdges, partnerEdges)
  const { rowGenerations, rowOf } = deriveRows(sims, cleanPartners)
  const couples = matchCouples(cleanPartners, idSet, rowOf)
  const clusters = buildClusters(sims, rowOf, couples)
  const clusterGraph = buildClusterGraph(clusters, cleanFamily, rowOf)
  const xByCluster = positionClusters(clusterGraph)

  const rowYs = rowGenerations.map((_, i) => TREE_PADDING + i * ROW_PITCH)
  const { nodes, byId } = placeMedallions(clusters, xByCluster, rowYs)
  const hangingUnions = placeHangingUnions({ familyEdges: cleanFamily, couples, byId, rowOf, rowYs })

  return {
    nodes,
    byId,
    rowYs,
    rowGenerations,
    couples,
    hangingUnions,
    viewBox: computeViewBox(nodes, rowYs),
  }
}

/** Drop self-edges and edges referencing unknown sims; dedupe family edges. */
function sanitizeEdges(
  sims: LayoutSim[],
  familyEdges: LineageFamilyEdge[],
  partnerEdges: LineagePartnerEdge[],
): { idSet: Set<string>; cleanFamily: LineageFamilyEdge[]; cleanPartners: LineagePartnerEdge[] } {
  const idSet = new Set(sims.map((s) => s.id))
  const cleanFamily: LineageFamilyEdge[] = []
  const seen = new Set<string>()
  for (const e of familyEdges) {
    if (!idSet.has(e.parentId) || !idSet.has(e.childId) || e.parentId === e.childId) continue
    const key = `${e.parentId}->${e.childId}`
    if (seen.has(key)) continue
    seen.add(key)
    cleanFamily.push(e)
  }
  const cleanPartners = partnerEdges.filter(
    (e) => idSet.has(e.simAId) && idSet.has(e.simBId) && e.simAId !== e.simBId,
  )
  return { idSet, cleanFamily, cleanPartners }
}

/**
 * Lift sim-level family edges to cluster level. Only edges spanning ≥1 row
 * downward constrain the layout — degenerate edges (same-row or inverted,
 * from manually edited generations) still render, they just don't
 * participate here. This also makes engine-level cycles impossible.
 */
function buildClusterGraph(
  clusters: Cluster[],
  familyEdges: LineageFamilyEdge[],
  rowOf: Map<string, number>,
): ClusterGraph {
  const clusterOf = new Map<string, Cluster>()
  for (const c of clusters) {
    for (const m of c.members) clusterOf.set(m, c)
  }
  const parentClusterIdsOf = new Map<string, string[]>()
  for (const { parentId, childId } of familyEdges) {
    if (rowOf.get(parentId)! >= rowOf.get(childId)!) continue
    const parentCluster = clusterOf.get(parentId)!
    const childCluster = clusterOf.get(childId)!
    if (parentCluster.id === childCluster.id) continue
    const list = parentClusterIdsOf.get(childCluster.id) ?? []
    if (!list.includes(parentCluster.id)) list.push(parentCluster.id)
    parentClusterIdsOf.set(childCluster.id, list)
  }
  for (const list of parentClusterIdsOf.values()) list.sort()
  return { clusters, parentClusterIdsOf }
}

/** Absolute medallion positions: engine x + label gutter; y from the row. */
function placeMedallions(
  clusters: Cluster[],
  xByCluster: Map<string, number>,
  rowYs: number[],
): { nodes: PositionedNode[]; byId: Record<string, PositionedNode> } {
  const baseX = ROW_LABEL_GUTTER + TREE_PADDING
  const nodes: PositionedNode[] = []
  const byId: Record<string, PositionedNode> = {}
  for (const cluster of clusters) {
    const left = baseX + (xByCluster.get(cluster.id) ?? 0)
    const y = rowYs[cluster.rowIndex]
    cluster.members.forEach((id, idx) => {
      const node: PositionedNode = {
        id,
        x: idx === 0 ? left : left + NODE_WIDTH + MARRIAGE_BOND_GAP,
        y,
      }
      byId[id] = node
      nodes.push(node)
    })
  }
  return { nodes, byId }
}

/** Two-parent sets that are NOT the adjacent couple, deduped by pair. */
function collectCoParentPairs(
  familyEdges: LineageFamilyEdge[],
  couples: LineageCouple[],
): [string, string][] {
  const coupleKeys = new Set(couples.map((c) => pairKey([c.a, c.b])))
  const parentsOfChild = new Map<string, string[]>()
  for (const { parentId, childId } of familyEdges) {
    const list = parentsOfChild.get(childId) ?? []
    if (!list.includes(parentId)) list.push(parentId)
    parentsOfChild.set(childId, list)
  }
  const pairs: [string, string][] = []
  const seen = new Set<string>()
  for (const parents of parentsOfChild.values()) {
    if (parents.length !== 2) continue
    const key = pairKey(parents)
    if (coupleKeys.has(key) || seen.has(key)) continue
    seen.add(key)
    const [a, b] = [...parents].sort()
    pairs.push([a, b])
  }
  return pairs
}

/**
 * Place a descent junction below the parents' row for every non-adjacent
 * co-parent pair with children. Same-row junctions stack into lanes so
 * their horizontal runs never overlap.
 */
function placeHangingUnions(args: {
  familyEdges: LineageFamilyEdge[]
  couples: LineageCouple[]
  byId: Record<string, PositionedNode>
  rowOf: Map<string, number>
  rowYs: number[]
}): HangingUnion[] {
  const { familyEdges, couples, byId, rowOf, rowYs } = args

  // Position each pair's junction at the parents' center midpoint, grouped
  // by the lower parent's row.
  const byRow = new Map<number, { key: string; parentA: string; parentB: string; x: number }[]>()
  for (const [parentA, parentB] of collectCoParentPairs(familyEdges, couples)) {
    const x = (byId[parentA].x + CREST_ANCHORS.cx + byId[parentB].x + CREST_ANCHORS.cx) / 2
    const rowIndex = Math.max(rowOf.get(parentA)!, rowOf.get(parentB)!)
    const entry = { key: pairKey([parentA, parentB]), parentA, parentB, x }
    appendToList(byRow, rowIndex, entry)
  }

  // Stack same-row junctions into lanes, left to right.
  const hangingUnions: HangingUnion[] = []
  for (const rowIndex of [...byRow.keys()].sort((a, b) => a - b)) {
    const inRow = byRow.get(rowIndex)!.sort((a, b) => a.x - b.x || (a.key < b.key ? -1 : 1))
    inRow.forEach((u, i) => {
      const lane = i % HANGING_UNION_MAX_LANES
      hangingUnions.push({
        ...u,
        y: rowYs[rowIndex] + HANGING_UNION_BASE_OFFSET + lane * HANGING_UNION_LANE_PITCH,
      })
    })
  }
  return hangingUnions
}

/** Width = rightmost medallion + padding; height = last row + medallion + padding. */
function computeViewBox(nodes: PositionedNode[], rowYs: number[]): { width: number; height: number } {
  let widest = ROW_LABEL_GUTTER + NODE_WIDTH + TREE_PADDING * 2
  for (const n of nodes) widest = Math.max(widest, n.x + NODE_WIDTH + TREE_PADDING)
  const lastRowTop = rowYs.length > 0 ? rowYs[rowYs.length - 1] : TREE_PADDING
  return { width: widest, height: lastRowTop + NODE_HEIGHT + TREE_PADDING }
}
```

Delete `centerChildrenUnderParents` and `applyClusterShift` entirely.

- [ ] **Step 4: Run, verify pass**

Run: `npm test -- lineage-tree/__tests__/layout.test`
Expected: PASS. (`to-flow-graph.test.ts` may now fail — that's Task 8's job; confirm the failures are confined to it.)

- [ ] **Step 5: Validate and commit**

Run: `npx tsc --noEmit && npm run lint`
```bash
but commit feat/lineage-layout-d3dag -m "feat(lineage-tree): d3-dag layout pipeline with hanging unions replaces greedy placement" --changes <ids…>
```

---

### Task 8: Adapter — hanging unions, diamond rule, dashed widowed bonds

**Files:**
- Modify: `src/components/lineage-tree/to-flow-graph.ts`
- Modify: `src/components/lineage-tree/__tests__/to-flow-graph.test.ts`

- [ ] **Step 1: Update the test file (failing)**

Update fixtures to ranked statuses (done in Task 3) and REPLACE the `parents not placed as an adjacent couple` describe block plus add diamond-rule tests.

**Scoping:** nest the `marriage edge styling` and `diamond rule` describes INSIDE the existing top-level `describe('toFlowGraph', ...)` block — they reference its shared `graph`/`layout`/`sims` fixtures, which are out of scope at the top level. The `hanging unions` describe builds its own fixtures and stays top-level.

```ts
describe('toFlowGraph — marriage edge styling', () => {
  it('marks widowed bonds dashed', () => {
    const widowSims = [sim('ann', 1), sim('joe', 1)]
    const widowLayout = computeLineageLayout(widowSims, [], [
      { simAId: 'ann', simBId: 'joe', romanticStatus: 'WIDOWED' as const },
    ])
    const g = toFlowGraph(widowLayout, widowSims, [], {})
    const [m] = g.edges.filter((e) => e.type === 'marriage')
    expect(m.data).toMatchObject({ dashed: true })
  })

  it('marks current bonds solid', () => {
    const [m] = graph.edges.filter((e) => e.type === 'marriage')
    expect(m.data).toMatchObject({ dashed: false })
  })
})

describe('toFlowGraph — diamond rule', () => {
  it('gives the couple union a diamond (children descend from it)', () => {
    const unions = graph.nodes.filter((n) => n.type === 'union')
    expect(unions).toHaveLength(1)
    expect(unions[0].data).toMatchObject({ diamond: true })
  })

  it('emits no union node for a childless couple', () => {
    const childlessSims = [sim('a', 1), sim('b', 1)]
    const childlessLayout = computeLineageLayout(childlessSims, [], [
      { simAId: 'a', simBId: 'b', romanticStatus: 'MARRIED' as const },
    ])
    const g = toFlowGraph(childlessLayout, childlessSims, [], {})
    expect(g.nodes.filter((n) => n.type === 'union')).toHaveLength(0)
    expect(g.edges.filter((e) => e.type === 'marriage')).toHaveLength(1)
  })

  it('gives single-parent unions no diamond', () => {
    const soloSims = [sim('p', 1), sim('k', 2)]
    const soloLayout = computeLineageLayout(soloSims, [{ parentId: 'p', childId: 'k' }], [])
    const g = toFlowGraph(soloLayout, soloSims, [{ parentId: 'p', childId: 'k' }], {})
    const [u] = g.nodes.filter((n) => n.type === 'union')
    expect(u.data).toMatchObject({ diamond: false })
  })
})

describe('toFlowGraph — hanging unions (non-adjacent co-parents)', () => {
  // alice+bob exes with carol; bob remarried dana.
  const hSims = [sim('alice', 1), sim('bob', 1), sim('dana', 1), sim('carol', 2)]
  const hFamily = [
    { parentId: 'alice', childId: 'carol' },
    { parentId: 'bob', childId: 'carol' },
  ]
  const hPartners = [
    { simAId: 'alice', simBId: 'bob', romanticStatus: 'EX_PARTNER' as const },
    { simAId: 'bob', simBId: 'dana', romanticStatus: 'MARRIED' as const },
  ]
  const hLayout = computeLineageLayout(hSims, hFamily, hPartners)
  const hGraph = toFlowGraph(hLayout, hSims, hFamily, {})

  it('materialises the hanging union as a 1×1 diamond node at the layout point', () => {
    const [hu] = hLayout.hangingUnions
    const unionNode = hGraph.nodes.find((n) => n.type === 'union' && n.id === `union-${hu.key}`)
    expect(unionNode).toBeDefined()
    expect(unionNode!.position.x + 0.5).toBeCloseTo(hu.x, 5)
    expect(unionNode!.position.y + 1).toBeCloseTo(hu.y, 5)
    expect(unionNode!.data).toMatchObject({ diamond: true })
    expect(unionNode!.measured).toEqual({ width: 1, height: 1 })
  })

  it('connects both parents to the union with coParent elbows', () => {
    const [hu] = hLayout.hangingUnions
    const coParents = hGraph.edges.filter((e) => e.type === 'coParent')
    expect(
      coParents.map((e) => [e.source, e.target]).sort(),
    ).toEqual([
      ['alice', `union-${hu.key}`],
      ['bob', `union-${hu.key}`],
    ])
    for (const e of coParents) {
      expect(e.sourceHandle).toBe('bottom')
      expect(e.targetHandle).toBe('in')
      expect(e.domAttributes?.['aria-hidden']).toBe('true')
    }
  })

  it('descends the child from the hanging union, not from either parent', () => {
    const [hu] = hLayout.hangingUnions
    const descents = hGraph.edges.filter((e) => e.type === 'descent' && e.target === 'carol')
    expect(descents).toHaveLength(1)
    expect(descents[0].source).toBe(`union-${hu.key}`)
  })

  it('falls back to per-parent descent lines for ≥3-parent sets', () => {
    const triSims = [sim('p1', 1), sim('p2', 1), sim('p3', 1), sim('k', 2)]
    const triFamily = [
      { parentId: 'p1', childId: 'k' },
      { parentId: 'p2', childId: 'k' },
      { parentId: 'p3', childId: 'k' },
    ]
    const triLayout = computeLineageLayout(triSims, triFamily, [])
    const g = toFlowGraph(triLayout, triSims, triFamily, {})
    const descents = g.edges.filter((e) => e.type === 'descent' && e.target === 'k')
    expect(descents.map((e) => e.source).sort()).toEqual(['p1', 'p2', 'p3'])
  })
})
```

Also update the pre-existing union-midpoint test: the union node now carries `data: { diamond: true }` instead of `data: {}` — adjust if it asserts on `data`.

- [ ] **Step 2: Run, verify failure**

Run: `npm test -- to-flow-graph`
Expected: new tests FAIL.

- [ ] **Step 3: Implement in `to-flow-graph.ts`**

Changes (keep everything else, including all a11y comments and the 1×1 union rationale):

1. Imports: add `pairKey` and the `HangingUnion` type from `./layout`; delete the local `pairKey` definition.
2. Add a `UnionNodeData` type and export it:

```ts
export type UnionNodeData = { diamond: boolean }
export type MarriageEdgeData = { dashed: boolean }
```

3. Marriage edges (replace the existing block — diamond moves to the union node):

```ts
const marriageEdges: Edge[] = layout.couples.flatMap(({ a, b, romanticStatus }) => {
  const pa = layout.byId[a]
  const pb = layout.byId[b]
  if (!pa || !pb) return []
  if (!simById.has(a) || !simById.has(b)) return []
  const [left, right] = pa.x <= pb.x ? [a, b] : [b, a]
  return [{
    id: `marriage-${a}-${b}`,
    type: 'marriage',
    source: left,
    sourceHandle: 'right',
    target: right,
    targetHandle: 'left',
    focusable: false,
    data: { dashed: romanticStatus === 'WIDOWED' } satisfies MarriageEdgeData,
    ...A11Y_HIDDEN,
  }]
})
```

4. In the per-child union loop, restructure the branch logic:

First, small named builders, so the loop itself only expresses the decision. Declare them inside `toFlowGraph`, immediately after the existing `coupleKeys` declaration; the existing `unionNodes`, `unionIdByKey`, and `descentEdges` declarations stay exactly where they are:

```ts
const hangingByKey = new Map(layout.hangingUnions.map((u) => [u.key, u]))
const coParentEdges: Edge[] = []

/** Shared 1×1 union scaffolding. */
const unionNode = (id: string, position: { x: number; y: number }, diamond: boolean): Node => ({
  id,
  type: 'union',
  position,
  data: { diamond } satisfies UnionNodeData,
  // IMPORTANT: copy the existing ~20-line falsy-zero rationale comment block
  // VERBATIM from the current file (the one explaining why 1×1 and not 0×0 —
  // the nodesInitialized gate and the handleBounds gate). It is load-bearing
  // institutional knowledge and must survive this refactor; reviewers should
  // reject the change if it goes missing.
  width: 1,
  height: 1,
  measured: { width: 1, height: 1 },
  ...STATIC_NODE,
  ...A11Y_HIDDEN,
})

/**
 * The union that sits up IN the row — at the couple's bond midpoint, or at
 * a lone parent's medallion center (contrast hangingUnionNode, which hangs
 * below the row). Diamond rule: only a two-parent junction gets the
 * diamond; a lone parent's union hides behind the medallion.
 */
const rowUnion = (id: string, parentIds: string[]): Node => {
  const placed = parentIds.map((pid) => layout.byId[pid])
  const midX = placed.reduce((sum, p) => sum + p.x + CREST_ANCHORS.cx, 0) / placed.length
  const topY = Math.min(...placed.map((p) => p.y))
  return unionNode(id, { x: midX - 0.5, y: topY + CREST_ANCHORS.cy - 1 }, parentIds.length === 2)
}

/** Union hanging below the row for a non-adjacent co-parent pair. */
const hangingUnionNode = (id: string, hu: HangingUnion): Node =>
  unionNode(id, { x: hu.x - 0.5, y: hu.y - 1 }, true)

/** Elbow from one parent's bottom handle to a hanging union. */
const coParentEdge = (key: string, parentId: string, unionId: string): Edge => ({
  id: `coparent-${key}-${parentId}`,
  type: 'coParent',
  source: parentId,
  sourceHandle: 'bottom',
  target: unionId,
  targetHandle: 'in',
  focusable: false,
  ...A11Y_HIDDEN,
})

const descentEdge = (id: string, source: string, sourceHandle: string, target: string): Edge => ({
  id,
  type: 'descent',
  source,
  sourceHandle,
  target,
  targetHandle: 'top',
  focusable: false,
  ...A11Y_HIDDEN,
})
```

Then the loop — one decision, three named outcomes:

```ts
for (const [childId, parentIds] of parentsByChild) {
  const key = pairKey(parentIds)
  const isAdjacentCouple = parentIds.length === 2 && coupleKeys.has(key)
  const hanging = parentIds.length === 2 && !isAdjacentCouple ? hangingByKey.get(key) : undefined
  const hasUnion = parentIds.length === 1 || isAdjacentCouple || hanging !== undefined

  if (!hasUnion) {
    // ≥3 parents (or a defensive miss): one descent line per parent — the
    // superseded fix/tree-descent-split-parents behavior, kept as fallback.
    for (const parentId of parentIds) {
      descentEdges.push(descentEdge(`descent-${childId}-${parentId}`, parentId, 'bottom', childId))
    }
    continue
  }

  let unionId = unionIdByKey.get(key)
  if (!unionId) {
    unionId = `union-${key}`
    unionIdByKey.set(key, unionId)
    if (hanging) {
      unionNodes.push(hangingUnionNode(unionId, hanging))
      coParentEdges.push(coParentEdge(key, hanging.parentA, unionId))
      coParentEdges.push(coParentEdge(key, hanging.parentB, unionId))
    } else {
      unionNodes.push(rowUnion(unionId, parentIds))
    }
  }
  descentEdges.push(descentEdge(`descent-${childId}`, unionId, 'out', childId))
}
```

5. Return edges as `[...descentEdges, ...coParentEdges, ...marriageEdges]` (descents under everything, bonds on top — preserves the existing ordering test).

- [ ] **Step 4: Run, verify pass**

Run: `npm test -- to-flow-graph`
Expected: PASS.

- [ ] **Step 5: Validate and commit**

Run: `npx tsc --noEmit && npm run lint`
```bash
but commit feat/lineage-layout-d3dag -m "feat(lineage-tree): hanging-union nodes, coParent edges, diamond-as-junction rule in flow adapter" --changes <ids…>
```

---

### Task 9: Flow parts — UnionNode diamond, MarriageEdge variants, CoParentEdge

**Files:**
- Modify: `src/components/lineage-tree/flow-parts.tsx`
- Modify: `src/components/lineage-tree/lineage-flow.tsx` (register `coParent`)
- Create: `src/components/lineage-tree/__tests__/flow-parts.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import type { EdgeProps } from '@xyflow/react'
import { CoParentEdge, MarriageEdge, UnionNode, coParentPath } from '../flow-parts'

const edgeProps = (over: Partial<EdgeProps> = {}): EdgeProps =>
  ({ id: 'e', source: 'a', target: 'b', sourceX: 0, sourceY: 0, targetX: 100, targetY: 50, ...over }) as EdgeProps

describe('coParentPath', () => {
  it('drops from the parent, then runs across to the union', () => {
    expect(coParentPath(70, 70, 175, 118)).toBe('M 70 70 V 118 H 175')
  })
})

describe('MarriageEdge', () => {
  it('renders a solid line without a diamond by default', () => {
    const { container } = render(
      <svg>
        <MarriageEdge {...edgeProps({ data: { dashed: false } })} />
      </svg>,
    )
    const line = container.querySelector('line')
    expect(line).not.toBeNull()
    expect(line).not.toHaveAttribute('stroke-dasharray')
    expect(container.querySelector('rect')).toBeNull()
  })

  it('renders dashed when data.dashed is true', () => {
    const { container } = render(
      <svg>
        <MarriageEdge {...edgeProps({ data: { dashed: true } })} />
      </svg>,
    )
    expect(container.querySelector('line')).toHaveAttribute('stroke-dasharray')
  })
})

describe('UnionNode', () => {
  it('renders an amber diamond when data.diamond is true', () => {
    const { container } = render(
      <ReactFlowProvider>
        <UnionNode data={{ diamond: true }} />
      </ReactFlowProvider>,
    )
    expect(container.querySelector('[data-testid="union-diamond"]')).not.toBeNull()
  })

  it('renders no diamond when data.diamond is false', () => {
    const { container } = render(
      <ReactFlowProvider>
        <UnionNode data={{ diamond: false }} />
      </ReactFlowProvider>,
    )
    expect(container.querySelector('[data-testid="union-diamond"]')).toBeNull()
  })
})

describe('CoParentEdge', () => {
  it('renders the elbow path', () => {
    const { container } = render(
      <svg>
        <CoParentEdge {...edgeProps()} />
      </svg>,
    )
    expect(container.querySelector('path')).toHaveAttribute('d', 'M 0 0 V 50 H 100')
  })
})
```

(If `UnionNode` renders without a provider in the current test setup, drop the `ReactFlowProvider` wrapper — match how `crest-flow-node.test.tsx` renders `Handle`-bearing components.)

- [ ] **Step 2: Run, verify failure**

Run: `npm test -- flow-parts`
Expected: FAIL — `CoParentEdge`/`coParentPath` not exported; UnionNode takes no data.

- [ ] **Step 3: Implement in `flow-parts.tsx`**

Replace `UnionNode` and `MarriageEdge`; add `CoParentEdge`:

```tsx
import type { MarriageEdgeData, UnionNodeData } from './to-flow-graph'

/**
 * Invisible 1×1 anchor where children descend from. For an adjacent couple it
 * sits at the marriage-bond midpoint; for non-adjacent co-parents it hangs
 * below the row (fed by coParent elbows). When the junction joins two parents
 * to children it renders the amber diamond — the diamond ALWAYS means
 * "parents-to-children junction", never "marriage".
 *
 * Must be 1×1, not 0×0 — see to-flow-graph.ts union node comment for the two
 * xyflow falsy-zero pitfalls (nodesInitialized gate and handleBounds gate).
 */
export function UnionNode({ data }: { data: UnionNodeData }) {
  return (
    <div style={{ width: 1, height: 1, background: 'transparent', position: 'relative', overflow: 'visible' }}>
      {data.diamond && (
        <span
          data-testid="union-diamond"
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: -3.5,
            top: -3.5,
            width: 8,
            height: 8,
            background: 'var(--amber)',
            transform: 'rotate(45deg)',
          }}
        />
      )}
      <Handle type="target" id="in" position={Position.Top} className={styles.handle} isConnectable={false} />
      <Handle type="source" id="out" position={Position.Bottom} className={styles.handle} isConnectable={false} />
    </div>
  )
}

/**
 * Elbow from a parent's bottom handle down and across to a hanging union.
 * No trailing vertical: the union sits exactly at targetY, so the horizontal
 * run lands on it (contrast descentPath, which continues down to the child's
 * top handle).
 */
export function coParentPath(sourceX: number, sourceY: number, targetX: number, targetY: number): string {
  return `M ${sourceX} ${sourceY} V ${targetY} H ${targetX}`
}

export function CoParentEdge({ sourceX, sourceY, targetX, targetY }: EdgeProps) {
  return (
    <path
      d={coParentPath(sourceX, sourceY, targetX, targetY)}
      stroke="var(--border-bright)"
      strokeWidth="1.5"
      fill="none"
      strokeLinejoin="round"
      aria-hidden="true"
    />
  )
}

/**
 * Amber bond between adjacent partners. Line only — the descent diamond is
 * rendered by the union node (and only exists when the couple has children).
 * Widowed bonds render dashed and faded.
 */
export function MarriageEdge({ sourceX, sourceY, targetX, targetY, data }: EdgeProps) {
  // xyflow's EdgeProps types data as an open record; narrow it to the
  // adapter's named contract rather than an anonymous inline shape.
  const dashed = (data as MarriageEdgeData | undefined)?.dashed === true
  return (
    <line
      x1={sourceX}
      y1={sourceY}
      x2={targetX}
      y2={targetY}
      stroke="var(--amber)"
      strokeWidth="1.5"
      strokeDasharray={dashed ? '4 3' : undefined}
      opacity={dashed ? 0.7 : undefined}
      aria-hidden="true"
    />
  )
}
```

In `lineage-flow.tsx`, register the new edge type:

```ts
import { CoParentEdge, DescentEdge, GenLabelNode, MarriageEdge, UnionNode } from './flow-parts'

const edgeTypes = { marriage: MarriageEdge, descent: DescentEdge, coParent: CoParentEdge } satisfies EdgeTypes
```

`UnionNode` now takes `{ data }` — if TS rejects it in `nodeTypes`, register it with the same `as NodeTypes[string]` assertion the crest/genLabel entries already use.

- [ ] **Step 4: Run, verify pass**

Run: `npm test -- flow-parts && npm test -- lineage-flow`
Expected: PASS.

- [ ] **Step 5: Validate and commit**

Run: `npx tsc --noEmit && npm run lint`
```bash
but commit feat/lineage-layout-d3dag -m "feat(lineage-tree): union diamond, dashed widowed bonds, coParent elbow edges" --changes <ids…>
```

---

### Task 10: Full validation

- [ ] **Step 1: Type-check and lint the whole repo**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean. Fix any fallout in consumers (`tree-atlas.tsx`, `family-tree-mini.tsx`, `sim-detail-client.tsx`) — these receive partner edges from tRPC outputs, which now include `romanticStatus`, so they should compile without changes; if a local type annotation pins the old shape, update it.

- [ ] **Step 2: Full unit/integration suite**

Run: `npm test`
Expected: all pass. Update any test outside lineage-tree that asserts partner-edge shapes.

- [ ] **Step 3: E2E**

First kill any stray dev server: `lsof -ti :3737 | xargs -r kill` (a leftover server on 3737 gets reused by Playwright against the wrong DB).
Run: `npm run test:e2e`
Expected: all pass. The lineage tree e2e specs assert tree structure/visibility — fix genuine regressions, do not weaken specs.

- [ ] **Step 4: Visual sanity check**

Start the dev server, sign in via the magic-link flow (see AGENTS.md), open a legacy with a multi-generation tree, and verify against the spec's composite mockup: rows, couple bonds, diamonds only above children, hanging unions for re-partnered parents, components side by side, shelf row.

- [ ] **Step 5: Commit any fixups**

```bash
but commit feat/lineage-layout-d3dag -m "fix(lineage-tree): <specific fixup>" --changes <ids…>
```

---

### Task 11: Reviews (required before merge)

- [ ] **Step 1:** Run the `/code-review` skill on the branch; address findings (re-run after large changes).
- [ ] **Step 2:** Run the `design-system-reviewer` agent (UI changed: diamond rendering, dashed bonds) — amber usage must stay within the heir/legacy callout rule; the diamond is a lineage callout, so amber is correct.
- [ ] **Step 3:** Run the `web-qa-tester` agent on the tree pages (legacy Atlas + sim mini-tree), focusing on: remarried-parent scenarios, widowed bonds, two-family legacies, shelf row, keyboard focus-pan still working.
- [ ] **Step 4:** Address all findings; document any false positives and get a second opinion per AGENTS.md.

---

## Self-review notes

- Spec coverage: rows/pinning (Tasks 4, 6, 7), ranking + widowed (5), hanging unions + lanes (7, 8), diamond rule (8, 9), components/banding + singles (6), shelf (4), API romanticStatus (2), determinism (every module test), supersession of per-parent descent (8 — replaced, kept only for ≥3 parents), preserved a11y/1×1 union behavior (8, 9).
- Out of scope honored: no drag, no crest changes, no DB layout storage.
