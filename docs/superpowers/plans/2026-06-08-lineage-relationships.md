# Lineage Relationships — PARTNER status, cross-gen bonds, line hygiene — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a committed `PARTNER` romantic status, draw current partners across generations as an engine-routed bond (replacing today's broken per-parent lines), stop drawing casual `DATING` in the tree, derive a Partnership milestone, and stop descent lines from crossing a sim's own name/stage text.

**Architecture:** Extends the d3-dag lineage pipeline already on `feat/lineage-layout-d3dag`. Same single-level-of-abstraction module style (every function tagged `[high]`/`[low]`/`[constructor]`/`[utility]`). The cross-gen bond reuses d3-dag's multi-row edge routing: a current-partner edge across rows becomes a layered edge whose `link.points` (verified to route around intervening crests) are mapped to canvas coordinates and drawn as an amber bond; the couple's child descends from a diamond at the lower partner.

**Tech Stack:** TypeScript, Prisma 7 (Postgres), d3-dag ^1.2.1, @xyflow/react 12, Vitest, Playwright. VCS via GitButler (`but`).

**Spec:** `docs/superpowers/specs/2026-06-08-lineage-relationships-design.md`. Builds on `2026-06-07-lineage-layout-redesign-design.md`.

---

## Project rules that bind every task

- **VCS:** All writes via `but`, never `git add/commit`. Branch: `feat/lineage-layout-d3dag` (continue on it). Before each commit `but status -f`, pick ONLY this work's file ids (other agents have concurrent files in the unassigned area — never include them). After each commit verify with `git show --stat <sha>` that nothing foreign was absorbed. **The controller commits; implementer subagents leave changes uncommitted.**
- **No suppressions:** `eslint-disable`, `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck` are illegal.
- **No `cd`:** run from repo root `/Users/beatka/Projects/simstrack-526` with explicit paths.
- **After each task:** `npx tsc --noEmit` and `npm run lint` clean before committing.
- **Migrations:** other agents have concurrent migrations; create new ones with a fresh later timestamp and never edit existing migration files.
- **Test style:** Testing Trophy — assert observable behavior (returned values, emitted nodes/edges, rendered attributes), never internals.

## File map

| File | Action | Responsibility |
| --- | --- | --- |
| `prisma/schema.prisma` | Modify | Add `PARTNER` to `RomanticStatus` |
| `prisma/migrations/<ts>_add_partner_romantic_status/migration.sql` | Create | Enum migration |
| `src/app/app/legacies/[slug]/sims/[id]/add-relationship-modal.tsx` | Modify | Add PARTNER dropdown option |
| `src/app/app/legacies/[slug]/sims/[id]/relationships-editor.tsx` | Modify | Add PARTNER dropdown option |
| `src/app/app/legacies/[slug]/_components/tree-atlas/sim-inspector.tsx` | Modify | Include PARTNER in partner-status priority |
| `src/components/lineage-tree/layout-clusters.ts` | Modify | `ADJACENCY_RANK`: add PARTNER, remove DATING |
| `src/app/app/legacies/[slug]/lib/types.ts` | Modify | `Milestone.kind` gains `'Partnership'` |
| `src/app/app/legacies/[slug]/lib/derive.ts` | Modify | Derive Partnership milestones |
| `src/components/lineage-tree/flow-parts.tsx` | Modify | Descent line gap/mask over crest text band |
| `src/components/lineage-tree/layout-shared.ts` | Modify | `BondPath` type; `LineageLayout.bonds`; text-band constants |
| `src/components/lineage-tree/layout-engine.ts` | Modify | Return routed bond paths from cross-gen edges |
| `src/components/lineage-tree/layout.ts` | Modify | Detect cross-gen current pairs; bond edges; re-route child descent |
| `src/components/lineage-tree/to-flow-graph.ts` | Modify | Render bond polylines; cross-gen child diamond |
| Tests alongside each | Create/Modify | Per task |

---

### Task 1: `PARTNER` enum + migration

**Files:** Modify `prisma/schema.prisma`; create migration.

- [ ] **Step 1: Add the enum value.** In `prisma/schema.prisma`, change `enum RomanticStatus` to insert `PARTNER` after `MARRIED`:

```prisma
enum RomanticStatus {
  NONE
  DATING
  ENGAGED
  MARRIED
  PARTNER
  EX_PARTNER
  WIDOWED
}
```

- [ ] **Step 2: Create the migration with a fresh timestamp.** Pick a timestamp later than `20260607103000` (the latest existing). Create
`prisma/migrations/20260608120000_add_partner_romantic_status/migration.sql`:

```sql
-- AlterEnum
ALTER TYPE "RomanticStatus" ADD VALUE 'PARTNER';
```

(Postgres `ADD VALUE` is additive and safe; placement in the type's value order doesn't affect existing rows.)

- [ ] **Step 3: Apply to the dev DB and regenerate the client.**
Run: `npx prisma migrate dev --name add_partner_romantic_status` is the normal path, BUT a migration file already exists from Step 2 — instead run `npx prisma migrate deploy` then `npx prisma generate`. If `migrate deploy` reports drift or the manual file conflicts, delete your hand-written file and use `npx prisma migrate dev --name add_partner_romantic_status` to let Prisma author it. Expected: `RomanticStatus.PARTNER` available on the generated client.
Verify: `node -e "const {RomanticStatus}=require('@prisma/client'); console.log(RomanticStatus.PARTNER)"` prints `PARTNER`.

- [ ] **Step 4: Validate + commit.** `npx tsc --noEmit && npm run lint` clean.
Commit `prisma/schema.prisma` + the new migration dir only:
`but commit feat/lineage-layout-d3dag -m "feat(db): add PARTNER romantic status" --changes <ids>`

---

### Task 2: PARTNER option in the relationship editors + inspector

**Files:** Modify `add-relationship-modal.tsx`, `relationships-editor.tsx`, `sim-inspector.tsx`. Tests: the components' existing test files if present, else a focused render test.

- [ ] **Step 1: Write/extend a failing test.** In `src/app/components/__tests__/` or alongside the editor (match where existing tests for these live — search `add-relationship-modal` test first). Add a jsdom test asserting the romantic-status dropdown offers a "Partner" option:

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
// ...mount AddRelationshipModal on the "partner" tab (mirror existing test setup)...
// Assert an option labeled "Partner" exists in the Romantic status combobox.
expect(screen.getByRole('option', { name: 'Partner' })).toBeInTheDocument()
```

If no component test infrastructure exists for these modals, instead add a unit assertion that `ROMANTIC_STATUS_OPTIONS` includes `RomanticStatus.PARTNER` by exporting the array and testing it. Prefer the rendered-option test.

- [ ] **Step 2: Run, verify fail.** `npm test -- add-relationship` → FAIL (no Partner option).

- [ ] **Step 3: Add the option.** In BOTH `add-relationship-modal.tsx` and `relationships-editor.tsx`, add `RomanticStatus.PARTNER` to `ROMANTIC_STATUS_OPTIONS` (place after `MARRIED`):

```ts
const ROMANTIC_STATUS_OPTIONS: RomanticStatus[] = [
  RomanticStatus.DATING,
  RomanticStatus.ENGAGED,
  RomanticStatus.MARRIED,
  RomanticStatus.PARTNER,
  RomanticStatus.EX_PARTNER,
  RomanticStatus.WIDOWED,
]
```

The existing local `formatStatus` (`s.replace(/_/g,' ').replace(/\b\w/g, c=>c.toUpperCase())`) already renders `PARTNER` → "Partner" — no change needed.

In `sim-inspector.tsx`, add `RomanticStatus.PARTNER` to the `PARTNER_STATUSES` priority array (after `ENGAGED`, before `DATING` — committed outranks casual):

```ts
const PARTNER_STATUSES: RomanticStatus[] = [
  RomanticStatus.MARRIED,
  RomanticStatus.ENGAGED,
  RomanticStatus.PARTNER,
  RomanticStatus.DATING,
  RomanticStatus.WIDOWED,
]
```

- [ ] **Step 4: Run, verify pass.** `npm test -- add-relationship relationships` → PASS. `npx tsc --noEmit && npm run lint` clean.

- [ ] **Step 5: Commit** the three component files + test.

---

### Task 3: Adjacency — add PARTNER, drop DATING

**Files:** Modify `src/components/lineage-tree/layout-clusters.ts`. Test: `__tests__/layout-clusters.test.ts`.

- [ ] **Step 1: Write failing tests.** Append to `layout-clusters.test.ts`:

```ts
it('treats PARTNER as a current partner that can be adjacent', () => {
  const couples = matchCouples([edge('a', 'b', 'PARTNER')], new Set(['a', 'b']), row0('a', 'b'))
  expect(couples).toEqual([{ a: 'a', b: 'b', romanticStatus: 'PARTNER' }])
})

it('ranks PARTNER above WIDOWED but below ENGAGED', () => {
  const couples = matchCouples(
    [edge('bob', 'wid', 'WIDOWED'), edge('bob', 'par', 'PARTNER')],
    new Set(['bob', 'wid', 'par']),
    row0('bob', 'wid', 'par'),
  )
  expect(couples).toEqual([{ a: 'bob', b: 'par', romanticStatus: 'PARTNER' }])
})

it('does not draw a bond for casual DATING (not an adjacency candidate)', () => {
  const couples = matchCouples([edge('a', 'b', 'DATING')], new Set(['a', 'b']), row0('a', 'b'))
  expect(couples).toEqual([])
})
```

- [ ] **Step 2: Run, verify fail.** `npm test -- layout-clusters` → the PARTNER tests fail (PARTNER unranked); the DATING test fails (DATING currently ranked).

- [ ] **Step 3: Update `ADJACENCY_RANK`.** In `layout-clusters.ts`:

```ts
/** Lower = more current. DATING (casual) and EX_PARTNER are deliberately absent. */
const ADJACENCY_RANK: Partial<Record<RomanticStatus, number>> = {
  MARRIED: 0,
  ENGAGED: 1,
  PARTNER: 2,
  WIDOWED: 3,
}
```

- [ ] **Step 4: Run, verify pass.** `npm test -- layout-clusters` → PASS. Also `npm test -- lineage-tree` to catch any fixture that relied on a DATING bond (update such fixtures to PARTNER/MARRIED as appropriate). `npx tsc --noEmit && npm run lint` clean.

- [ ] **Step 5: Commit.**

---

### Task 4: Partnership milestone

**Files:** Modify `src/app/app/legacies/[slug]/lib/types.ts`, `src/app/app/legacies/[slug]/lib/derive.ts`. Test: `lib/__tests__/derive.test.ts`.

- [ ] **Step 1: Write failing tests.** In `derive.test.ts`, mirror the existing marriage-milestone test. Add a legacy fixture with a `PARTNER` social relationship between two sims and assert:

```ts
it('derives one Partnership milestone per unique PARTNER pair', () => {
  const result = deriveMilestones(legacyWithPartnerPair) // use the file's existing derive entrypoint/name
  const partnerships = result.filter((m) => m.kind === 'Partnership')
  expect(partnerships).toHaveLength(1)
  expect(partnerships[0]).toMatchObject({
    kind: 'Partnership',
    simIds: expect.arrayContaining([idA, idB]),
    title: `${aName} partners with ${bName}`,
  })
})

it('still derives Marriage (not Partnership) for MARRIED pairs', () => {
  const result = deriveMilestones(legacyWithMarriedPair)
  expect(result.some((m) => m.kind === 'Marriage')).toBe(true)
  expect(result.some((m) => m.kind === 'Partnership')).toBe(false)
})
```

Match the actual derive function name/signature and fixture shape used by the existing marriage test in this file (read it first).

- [ ] **Step 2: Run, verify fail.** `npm test -- derive` → FAIL (`'Partnership'` not a kind / no entry).

- [ ] **Step 3a: Extend the type.** In `lib/types.ts`:

```ts
kind: 'Founding' | 'Birth' | 'Marriage' | 'Partnership' | 'Death' | 'Note'
```

- [ ] **Step 3b: Derive Partnership milestones.** In `derive.ts`, immediately after the marriage block (the `// --- Marriages` loop), add a parallel block:

```ts
// --- Partnerships: one per unique unordered PARTNER pair ---
const seenPartnerPairs = new Set<string>()
for (const rel of legacy.socialRelationships) {
  if (rel.romanticStatus !== 'PARTNER') continue
  const [idA, idB] = [rel.simAId, rel.simBId].sort()
  const pairKey = `${idA}:${idB}`
  if (seenPartnerPairs.has(pairKey)) continue
  seenPartnerPairs.add(pairKey)

  const simA = simMap.get(idA)
  const simB = simMap.get(idB)
  const aName = [simA?.firstName ?? 'Unknown', simA?.lastName ?? ''].filter(Boolean).join(' ')
  const bName = [simB?.firstName ?? 'Unknown', simB?.lastName ?? ''].filter(Boolean).join(' ')
  const gens = [simA?.generationNumber, simB?.generationNumber].filter(
    (g): g is number => g !== null && g !== undefined,
  )
  const gen: number | null = gens.length > 0 ? Math.min(...gens) : null

  entries.push({
    id: `partnership-${idA}-${idB}`,
    kind: 'Partnership',
    gen,
    simIds: [idA, idB],
    title: `${aName} partners with ${bName}`,
    blurb: null,
    userAuthored: false,
    sortOrder: rel.createdAt.getTime(),
  })
}
```

(Match the exact variable names in `derive.ts` — `simMap`, `entries`, `legacy.socialRelationships` — confirmed present in the marriage block.)

- [ ] **Step 3c: Handle the new kind in any milestone UI switch.** Grep for milestone `kind` switches (`grep -rn "kind ===" src/app/app/legacies` and milestone icon/label maps). Add a `'Partnership'` case; reuse the Marriage icon/label treatment unless a distinct one is trivial. If a `kind`-keyed icon map exists, add `Partnership`.

- [ ] **Step 4: Run, verify pass.** `npm test -- derive` → PASS. `npx tsc --noEmit && npm run lint` clean (the lint/tsc will flag any unhandled `kind` switch — fix those).

- [ ] **Step 5: Commit.**

---

### Task 5: Descent line gap over the crest text band

**Files:** Modify `src/components/lineage-tree/layout-shared.ts` (constants), `src/components/lineage-tree/flow-parts.tsx`. Test: `__tests__/flow-parts.test.tsx`.

Mechanism: the descent path is `M sx sy V midY H tx V ty`. When the source is a crest (line originates at a portrait and drops through its own text band), split the vertical run so nothing is painted across the band's y-range. The band is a fixed offset within the 90px crest. We pass the source's text-band y-range to the edge via edge `data`.

- [ ] **Step 1: Add band constants.** In `layout-shared.ts`:

```ts
/** Crest name/life-stage text band, as y-offsets from the node's top edge.
 *  The descent line is not painted across this band so it never crosses the
 *  sim's own text. Values track crest-flow-node.module.css's label block. */
export const CREST_TEXT_BAND_TOP = 50
export const CREST_TEXT_BAND_BOTTOM = NODE_HEIGHT
```

(Verify against `crest-flow-node.module.css` / `crest-flow-node.tsx`: the medallion occupies ~the top 48px; name+stage occupy below it to the node bottom. Adjust the two numbers so the band exactly covers the name+stage text; read the CSS first.)

- [ ] **Step 2: Write failing tests.** In `flow-parts.test.tsx`:

```ts
import { descentPath, descentPathWithGap } from '../flow-parts'

describe('descentPathWithGap', () => {
  it('omits the segment crossing the crest text band, resuming below it', () => {
    // source at top of a crest, gap band from gapTop..gapBottom in canvas coords
    const d = descentPathWithGap(100, 24, 100, 300, 74, 114)
    // Two vertical runs: 24->74 (above/into band top) and 114->... then across+down.
    expect(d).toContain('M 100 24 V 74') // stops at band top
    expect(d).toContain('M 100 114')      // resumes below band bottom
    expect(d).not.toContain('V 90')        // nothing painted inside 74..114 (sample)
  })
  it('falls back to the plain descent path when no gap band is given', () => {
    expect(descentPathWithGap(100, 50, 240, 170)).toBe(descentPath(100, 50, 240, 170))
  })
})
```

- [ ] **Step 3: Run, verify fail.** `npm test -- flow-parts` → FAIL (`descentPathWithGap` not exported).

- [ ] **Step 4: Implement.** In `flow-parts.tsx` add a `[low]` helper and use it in `DescentEdge` when a gap band is supplied via `data`:

```ts
/**
 * [low] Descent path that skips a horizontal band (the source crest's text
 * band) so the line never paints across the sim's own name/stage. Two
 * sub-paths: source down to the band top, then band bottom down-across-down to
 * the target. No band → identical to descentPath.
 */
export function descentPathWithGap(
  sourceX: number, sourceY: number, targetX: number, targetY: number,
  gapTop?: number, gapBottom?: number,
): string {
  // No band supplied (e.g. couple bond routed in the gap between medallions):
  // plain descent, nothing to skip.
  if (gapTop === undefined || gapBottom === undefined) {
    return descentPath(sourceX, sourceY, targetX, targetY)
  }
  // Two sub-paths with a transparent gap across [gapTop, gapBottom]: source
  // down to the band top, then band bottom down-across-down to the target.
  const midY = (gapBottom + targetY) / 2
  return `M ${sourceX} ${sourceY} V ${gapTop} M ${sourceX} ${gapBottom} V ${midY} H ${targetX} V ${targetY}`
}
```

Then in `DescentEdge`, read optional `gapTop`/`gapBottom` from `data` and call `descentPathWithGap`. Define and export `DescentEdgeData = { gapTop?: number; gapBottom?: number }` from `to-flow-graph.ts`; the adapter sets it only for descents whose source is a crest (lone-parent / cross-gen), computing `gapTop = sourceNode.y + CREST_TEXT_BAND_TOP`, `gapBottom = sourceNode.y + CREST_TEXT_BAND_BOTTOM`. For union-sourced descents (couple bond in the gap) leave `data` undefined → plain path.

- [ ] **Step 5: Run, verify pass.** `npm test -- flow-parts && npm test -- lineage-tree` → PASS. `npx tsc --noEmit && npm run lint` clean.

- [ ] **Step 6: Commit.**

---

### Task 6: Cross-generation routed bond

The headline feature. A current-partner pair (MARRIED/ENGAGED/PARTNER/WIDOWED) in **different rows** is drawn as an amber bond routed by the engine; their child descends from a diamond at the lower partner. Verified d3-dag fact: adding the pair as a layered edge yields `link.points` routed around intervening crests (e.g. Gen I→Gen III bond returned `[[362,0.5],[362,2.5],[362,4.5]]`, a clear lane right of the Gen II crests).

**Files:** `layout-shared.ts`, `layout-clusters.ts`, `layout-engine.ts`, `layout.ts`, `to-flow-graph.ts`, and their tests.

- [ ] **Step 1: Spike — calibrate the engine-point → canvas transform (no commit).** Write a throwaway script (or a temporary test) that builds a 3-row component with one cross-row edge, runs the existing `layoutComponent`, and logs both node lefts and the cross-row link's `points`. Determine the exact mapping from a link point `[ex, ey]` (engine space) to canvas: x uses the SAME normalization as node lefts (`ex - minLeft`, then `+ offset + baseX`); y maps engine layer → `rowYs[componentMinRow + round(ey - 0.5)]` for endpoints and interpolates for mid-waypoints. Record the formula in a comment. Delete the script. **This step produces the constants/formula used in Step 4; do not skip it — the y mapping in particular must be confirmed empirically.**

- [ ] **Step 2: Types + matching (failing tests).** In `layout-shared.ts` add:

```ts
/** A current-partner bond drawn as a routed polyline (cross-generation). */
export type BondPath = {
  a: string
  b: string
  romanticStatus: RomanticStatus
  /** Canvas-space waypoints from the engine, top→bottom. */
  points: { x: number; y: number }[]
}
```

and add `bonds: BondPath[]` to `LineageLayout`.

In `layout-clusters.ts`, export a `[low]` `crossGenCurrentPairs(partnerEdges, idSet, rowOf): LineageCouple[]` that returns current-partner (ranked statuses) pairs whose two sims are in DIFFERENT rows (the complement of `matchCouples`' same-row pairs). Test in `layout-clusters.test.ts`:

```ts
it('identifies current-partner pairs that span generations', () => {
  const rowOf = new Map<string, number>([['sol', 0], ['bex', 1]])
  const pairs = crossGenCurrentPairs([edge('sol', 'bex', 'PARTNER')], new Set(['sol','bex']), rowOf)
  expect(pairs).toEqual([{ a: 'bex', b: 'sol', romanticStatus: 'PARTNER' }]) // sorted ids
})
it('excludes DATING and EX from cross-gen bonds', () => {
  const rowOf = new Map<string, number>([['a', 0], ['b', 1]])
  expect(crossGenCurrentPairs([edge('a','b','DATING')], new Set(['a','b']), rowOf)).toEqual([])
  expect(crossGenCurrentPairs([edge('a','b','EX_PARTNER')], new Set(['a','b']), rowOf)).toEqual([])
})
```

- [ ] **Step 3: Engine returns routed bond paths (failing test).** Extend `positionClusters` to accept optional bond edges and return their routed canvas points. Plan-B style: `ClusterGraph` gains `bondEdges: { a: string; b: string; romanticStatus: RomanticStatus }[]` (cluster ids = the partners' single-cluster ids). In `layoutComponent`, feed bond edges into the same graph (as additional `parentIds` entries on the lower cluster, tagged so they're not treated as descent), then after layout read `graph.links()` for the tagged links and map `link.points` to canvas via the Step-1 formula; return `{ lefts, width, bondPaths }`. `positionClusters` collects bondPaths across components into the absolute frame. Add `layout-engine.test.ts` cases:

```ts
it('returns a routed bond path for a cross-row partner edge that clears intervening crests', () => {
  const clusters = [single('sol', 0), single('ivy', 1), single('rex', 1), single('bex', 2)]
  const { bondPaths } = positionClustersWithBonds({
    clusters,
    parentClusterIdsOf: new Map(),
    bondEdges: [{ a: 'bex', b: 'sol', romanticStatus: 'PARTNER' }],
  })
  expect(bondPaths).toHaveLength(1)
  const xs = bondPaths[0].points.map((p) => p.x)
  // all waypoints share one lane x; lane avoids ivy/rex (asserted via no-overlap with their cluster x-spans)
  expect(new Set(xs).size).toBe(1)
})
```

(Name the bond-aware entrypoint to match the engine's API once shaped during the spike; keep `positionClusters` working for callers that pass no bonds.)

- [ ] **Step 4: Orchestrator wiring (failing scenario test).** In `layout.ts`:
  - Compute `crossGenCurrentPairs`; build `bondEdges` for the cluster graph; pass through `positionClusters`; put returned paths on `LineageLayout.bonds`.
  - **Child re-routing:** for a child whose two parents are exactly a cross-gen current pair, descend from the LOWER partner with a couple-diamond (set its parent set to the lower partner only in `buildClusterGraph`, and mark it so the adapter draws the diamond). Suppress the per-parent fallback for that pair.
  - Add `layout.test.ts` scenarios:

```ts
it('draws a cross-gen current couple as a bond, not per-parent lines', () => {
  const l = computeLineageLayout(
    [sim('sol', 1), sim('bex', 2), sim('pip', 3)],
    [{ parentId: 'sol', childId: 'pip' }, { parentId: 'bex', childId: 'pip' }],
    [{ simAId: 'sol', simBId: 'bex', romanticStatus: 'PARTNER' }],
  )
  expect(l.bonds).toHaveLength(1)
  expect(l.bonds[0].points.length).toBeGreaterThanOrEqual(2)
})
```

- [ ] **Step 5: Adapter renders the bond + diamond (failing test).** In `to-flow-graph.ts`, emit the bond as a routed edge/polyline (a new `bond` edge type or a node carrying the polyline — choose the simpler given xyflow; a custom edge with a path built from `points` is preferred), amber, dashed if WIDOWED, `aria-hidden`. Render the cross-gen couple's child descent from a diamond union at the lower partner. `flow-parts.tsx` gets a `BondEdge`/`BondLayer` that draws `points` as a polyline; register it in `lineage-flow.tsx`. Tests in `to-flow-graph.test.ts`:

```ts
it('emits a routed bond polyline for a cross-gen current couple, dashed only if widowed', () => { /* ... */ })
it('descends the cross-gen couple’s child from a single diamond, not per-parent lines', () => { /* ... */ })
```

- [ ] **Step 6: Validate + commit.** `npm test -- lineage-tree`, `npx tsc --noEmit`, `npm run lint` all clean. Commit the cross-gen bond work.

---

### Task 7: Full validation

- [ ] **Step 1:** `npx tsc --noEmit && npm run lint` repo-wide — clean.
- [ ] **Step 2:** `npm test` — all pass; update any consumer/test relying on DATING bonds or the old milestone-kind union.
- [ ] **Step 3:** `npm run db:test:setup` (applies the new migration to the test DB) then `npm test` again if router/integration tests touch romantic status.
- [ ] **Step 4:** kill stray 3737 server, `npm run test:e2e` — all pass; add/extend a relationship-editor journey that selects "Partner".
- [ ] **Step 5:** Visual check via dev server + magic link: a cross-gen partner renders a clean routed bond (no crossing), child descends from its diamond; descent lines no longer cross crest text; "Partner" selectable; partnership milestone shows on the chronicle timeline.
- [ ] **Step 6:** Commit any fixups.

---

### Task 8: Reviews before merge

- [ ] `/code-review` (high) on the branch; address findings.
- [ ] `design-system-reviewer` agent — amber bond continuity, dashed widowed, the new routed polyline, milestone icon.
- [ ] `web-qa-tester` agent — cross-gen bond rendering, Partner status end to end, partnership milestone, line-behind-text, regression on existing tree.
- [ ] Address findings; re-run reviews after large changes.

---

## Self-review notes

- **Spec coverage:** PARTNER enum/migration (T1); editor + inspector option (T2); tree bond set + rank, Dating dropped (T3); Partnership milestone + kind (T4); descent line gap over text (T5); cross-gen routed bond + child diamond (T6); validation + reviews (T7, T8). All spec decisions mapped.
- **Risk:** T6 is the only high-uncertainty task; its Step-1 spike de-risks the engine-point→canvas transform before any committed code. The d3-dag routing itself is already verified (link.points reserve a lane around crests).
- **Out of scope honored:** EX unchanged; same-row hanging-union midpoint limitation untouched; no DB-stored positions.
