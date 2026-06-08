# Romantic Status Model Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `SocialRelationship.romanticStatus` into a bond-only enum plus an `endedAt` timestamp so that "divorced", "broke up", and "widowed" are *derived* from the data (bond + deliberate end + partner death) instead of stored, hand-set values.

**Architecture:** Expand/contract (parallel-change) migration. First add the `endedAt` column and a pure `deriveRomanticState` helper; thread `endedAt` + a per-sim `isDeceased` signal through the tree-data queries, mutations, and layout; move every consumer off the `EX_PARTNER`/`WIDOWED` enum values; and only then (contract) narrow the enum with a data-remapping migration. Every commit keeps `tsc` and tests green; the destructive enum migration lands last, after the final reference to the dropped values is gone.

**Tech Stack:** Next.js 16 (App Router), tRPC, Prisma 7 + PostgreSQL, Zod, Vitest + React Testing Library, `@xyflow/react` lineage tree, GitButler (`but`) for VCS.

**Spec:** `docs/superpowers/specs/2026-06-08-romantic-status-model-design.md`

**Branch:** All work goes on `feat/romantic-status-model`, stacked on top of `feat/lineage-layout-d3dag` (which this plan modifies). Confirm with `but status -fv` that `feat/romantic-status-model` is stacked above `feat/lineage-layout-d3dag` before starting; if not, `but move feat/romantic-status-model feat/lineage-layout-d3dag`.

**Pre-existing `PARTNER` bond:** A committed-but-unmarried `PARTNER` value was already added to the `RomanticStatus` enum (migration `20260608120000_add_partner_romantic_status`). It is a real bond and is **kept** throughout: it joins DATING/ENGAGED/MARRIED everywhere a bond is enumerated, and the Task 7 contract migration removes only the two *derived* values `EX_PARTNER` and `WIDOWED`, leaving five (`NONE, DATING, PARTNER, ENGAGED, MARRIED`). Bond ordering (weakest → strongest): DATING < PARTNER < ENGAGED < MARRIED.

**Project rules (non-negotiable):**
- Never use `cd`; run commands from the repo root with explicit paths.
- No `// eslint-disable`, `// @ts-ignore`, `// @ts-expect-error`, `// @ts-nocheck`. Fix root causes.
- Commit with `but`, never raw `git` writes. Commit recipe: `but status -f` to get the file CLI IDs, then `but commit feat/romantic-status-model -m "<msg>" --changes <id1>,<id2>`. Verify the returned status shows the files committed (not left in `unassignedChanges`).
- After every task: `npx tsc --noEmit` and `npm run lint` must both be clean before moving on.

---

## File Structure

**New files**
- `src/lib/romantic-status.ts` — pure derivation: `RomanticBond` (DATING, PARTNER, ENGAGED, MARRIED), `RomanticState`, `deriveRomanticState`, `romanticStateBadge`. One responsibility: turn stored fields into a display state. No React, no Prisma client calls.
- `src/lib/romantic-status.test.ts` — exhaustive table tests for the helper.
- `prisma/migrations/<ts>_add_social_relationship_ended_at/migration.sql` — additive `endedAt` column (Task 1, Prisma-generated).
- `prisma/migrations/<ts>_narrow_romantic_status/migration.sql` — hand-written remap + enum narrowing (Task 7).

**Modified files**
- `prisma/schema.prisma` — add `endedAt` (Task 1); narrow `RomanticStatus` enum (Task 7).
- `src/server/routers/sims.ts` — `endedAt` on partner edges + `isDeceased` on tree sims in `getTreeData`/`getMiniTreeData`; `endedAt` input on `addSocialRelationship`/`updateSocialRelationship` (Task 3).
- `src/server/routers/sims.test.ts` — cover the new input/output fields (Task 3) and the enum narrowing (Task 7).
- `src/components/lineage-tree/layout-shared.ts` — `endedAt` on `LineagePartnerEdge` (Task 3).
- `src/components/lineage-tree/layout-clusters.ts` — exes (ended) never adjacent; drop the `WIDOWED` rank (Task 4).
- `src/components/lineage-tree/to-flow-graph.ts` — `isDeceased` on `LineageFlowSim`; derive the dashed (widowed) bond (Task 4).
- `src/components/lineage-tree/__tests__/to-flow-graph.test.ts`, `__tests__/layout-clusters.test.ts` — update fixtures/assertions (Tasks 3–4).
- `src/app/app/legacies/[slug]/sims/[id]/page.tsx` — partner `endedAt` + partner-sim `causeOfDeath` in the editor select (Task 5).
- `src/app/app/legacies/[slug]/sims/[id]/relationships-editor.tsx` — drop the two options, add the end/reopen control + derived badge (Task 5).
- `src/app/app/legacies/[slug]/sims/[id]/add-relationship-modal.tsx` — drop the two options (Task 5).
- `src/app/app/legacies/[slug]/_components/tree-atlas/sim-inspector.tsx` — drop `WIDOWED` from `PARTNER_STATUSES` (Task 5).
- `src/app/app/legacies/[slug]/lib/derive.ts` — add Divorce and Break-up milestones from ended relationships (Task 6).
- `src/app/app/legacies/[slug]/lib/types.ts` — `endedAt` on `FetchedSocialRelationship`; add `'Divorce' | 'Breakup'` to the milestone `kind` union (Task 6).
- `src/app/app/legacies/[slug]/page.tsx` — the chronicle legacy fetch selects `endedAt` on social relationships (Task 6).
- `src/app/app/legacies/[slug]/lib/__tests__/derive.test.ts` — cover the new milestones (Task 6).

**Unchanged on purpose**
- Marriage milestones stay keyed on `romanticStatus === 'MARRIED'`. A couple that later divorced is `MARRIED` + `endedAt`, so the wedding milestone still fires *and* a separate Divorce milestone is added — both events are true and both appear on the timeline.
- The milestone `kind` is rendered as plain text in `milestone-row.tsx` (no per-kind icon/color switch), so new kinds need no rendering change.

---

## Task 1: Add the `endedAt` column (additive migration)

**Files:**
- Modify: `prisma/schema.prisma` (the `SocialRelationship` model)
- Create: `prisma/migrations/<timestamp>_add_social_relationship_ended_at/migration.sql` (Prisma-generated)

- [ ] **Step 1: Add the field to the schema**

In `prisma/schema.prisma`, in `model SocialRelationship`, add `endedAt` directly under `romanticStatus`:

```prisma
  romanticStatus  RomanticStatus
  endedAt         DateTime?      // non-null = bond deliberately ended (break-up / divorce) while both alive; widowhood is derived from partner death, never stored here
```

- [ ] **Step 2: Generate the migration and client**

Run: `npx prisma migrate dev --name add_social_relationship_ended_at`
Expected: creates `prisma/migrations/<ts>_add_social_relationship_ended_at/migration.sql` containing `ALTER TABLE "social_relationships" ADD COLUMN "endedAt" TIMESTAMP(3);`, applies it, and regenerates the client with no errors.

Note: Prisma 7's AI-consent guard blocks destructive ops, but adding a nullable column is non-destructive. If the test DB needs the consent wiring, it is already baked into `db:test:setup` (runs via the pretest hook).

- [ ] **Step 3: Verify migrations are in sync and types compile**

Run: `npx prisma migrate status`
Expected: "Database schema is up to date!" — the new migration is applied and recorded.
Run: `npx prisma validate`
Expected: "The schema is valid".
Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
but status -f   # note the CLI IDs for schema.prisma and the new migration.sql
but commit feat/romantic-status-model -m "feat(db): add SocialRelationship.endedAt for deliberate relationship ends" --changes <schema-id>,<migration-id>
```

---

## Task 2: Pure derivation helper (`deriveRomanticState`)

**Files:**
- Create: `src/lib/romantic-status.ts`
- Test: `src/lib/romantic-status.test.ts`

The bond guard (`bond !== 'DATING' && …`) covers `NONE` and — during the expand phase — the not-yet-removed `EX_PARTNER`/`WIDOWED` values, *without naming them*, so nothing here breaks when Task 7 drops them.

- [ ] **Step 1: Write the failing test**

Create `src/lib/romantic-status.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { deriveRomanticState, romanticStateBadge } from './romantic-status'

const DAY = new Date('2026-01-01T00:00:00Z')

describe('deriveRomanticState', () => {
  it('returns null for non-romantic bonds', () => {
    expect(deriveRomanticState('NONE', null, false)).toBeNull()
  })

  it('active when together and both alive', () => {
    expect(deriveRomanticState('MARRIED', null, false)).toEqual({ kind: 'active', bond: 'MARRIED' })
    expect(deriveRomanticState('PARTNER', null, false)).toEqual({ kind: 'active', bond: 'PARTNER' })
    expect(deriveRomanticState('DATING', null, false)).toEqual({ kind: 'active', bond: 'DATING' })
  })

  it('widowed when a partner is deceased and the bond was not deliberately ended', () => {
    expect(deriveRomanticState('MARRIED', null, true)).toEqual({ kind: 'widowed', bond: 'MARRIED' })
    expect(deriveRomanticState('ENGAGED', null, true)).toEqual({ kind: 'widowed', bond: 'ENGAGED' })
  })

  it('ended when deliberately ended, regardless of bond', () => {
    expect(deriveRomanticState('MARRIED', DAY, false)).toEqual({ kind: 'ended', bond: 'MARRIED' })
    expect(deriveRomanticState('DATING', DAY, false)).toEqual({ kind: 'ended', bond: 'DATING' })
  })

  it('a deliberate end beats death (divorced-then-deceased stays ended)', () => {
    expect(deriveRomanticState('MARRIED', DAY, true)).toEqual({ kind: 'ended', bond: 'MARRIED' })
  })
})

describe('romanticStateBadge', () => {
  it('labels active bonds by commitment', () => {
    expect(romanticStateBadge({ kind: 'active', bond: 'MARRIED' })).toBe('Married')
    expect(romanticStateBadge({ kind: 'active', bond: 'DATING' })).toBe('Dating')
  })
  it('labels widowhood', () => {
    expect(romanticStateBadge({ kind: 'widowed', bond: 'MARRIED' })).toBe('Widowed')
  })
  it('distinguishes divorce, separation, and a break-up by bond', () => {
    expect(romanticStateBadge({ kind: 'ended', bond: 'MARRIED' })).toBe('Divorced')
    expect(romanticStateBadge({ kind: 'ended', bond: 'ENGAGED' })).toBe('Engagement ended')
    expect(romanticStateBadge({ kind: 'ended', bond: 'PARTNER' })).toBe('Separated')
    expect(romanticStateBadge({ kind: 'ended', bond: 'DATING' })).toBe('Broke up')
  })
  it('labels an active partnership', () => {
    expect(romanticStateBadge({ kind: 'active', bond: 'PARTNER' })).toBe('Partner')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/romantic-status.test.ts`
Expected: FAIL — cannot resolve `./romantic-status`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/romantic-status.ts`:

```ts
import type { RomanticStatus } from '@prisma/client'

/** The commitment bonds that survive the model redesign (weakest → strongest). */
export type RomanticBond = 'DATING' | 'PARTNER' | 'ENGAGED' | 'MARRIED'

/**
 * Display-relevant relationship state, derived from stored fields:
 * - active:  together, both alive
 * - ended:   deliberately ended while alive (break-up / divorce)
 * - widowed: a partner is deceased and the bond was not deliberately ended
 */
export type RomanticState =
  | { kind: 'active'; bond: RomanticBond }
  | { kind: 'ended'; bond: RomanticBond }
  | { kind: 'widowed'; bond: RomanticBond }

/**
 * Derive the relationship state from the stored bond, the deliberate-end
 * timestamp, and whether the *other* partner is deceased.
 *
 * Precedence: a deliberate end beats death (a couple who divorced and then one
 * ex died stays `ended`, not `widowed`). Non-romantic bonds → null. The bond
 * guard also absorbs the legacy EX_PARTNER/WIDOWED values during the
 * expand-phase migration without naming them.
 */
export function deriveRomanticState(
  bond: RomanticStatus,
  endedAt: Date | null,
  partnerDeceased: boolean,
): RomanticState | null {
  if (bond !== 'DATING' && bond !== 'PARTNER' && bond !== 'ENGAGED' && bond !== 'MARRIED') return null
  if (endedAt !== null) return { kind: 'ended', bond }
  if (partnerDeceased) return { kind: 'widowed', bond }
  return { kind: 'active', bond }
}

/** Non-gendered badge text for the relationships editor and sim inspector. */
export function romanticStateBadge(state: RomanticState): string {
  const bondWord =
    state.bond === 'MARRIED' ? 'Married'
    : state.bond === 'ENGAGED' ? 'Engaged'
    : state.bond === 'PARTNER' ? 'Partner'
    : 'Dating'
  switch (state.kind) {
    case 'active':
      return bondWord
    case 'widowed':
      return 'Widowed'
    case 'ended':
      switch (state.bond) {
        case 'MARRIED':
          return 'Divorced'
        case 'ENGAGED':
          return 'Engagement ended'
        case 'PARTNER':
          return 'Separated'
        case 'DATING':
          return 'Broke up'
      }
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/romantic-status.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Typecheck, lint, commit**

Run: `npx tsc --noEmit` then `npm run lint` — both clean.

```bash
but status -f
but commit feat/romantic-status-model -m "feat(lib): deriveRomanticState helper (active/ended/widowed)" --changes <romantic-status.ts-id>,<romantic-status.test.ts-id>
```

---

## Task 3: Thread `endedAt` + `isDeceased` through tree data and mutations

This is additive and references only surviving enum values, so it stays green while the enum still has all six values. It supplies the fields Tasks 4–5 consume.

**Files:**
- Modify: `src/server/routers/sims.ts`
- Modify: `src/components/lineage-tree/layout-shared.ts`
- Test: `src/server/routers/sims.test.ts`

- [ ] **Step 1: Write failing server tests**

In `src/server/routers/sims.test.ts`, add tests asserting the new shape. Find the existing `getTreeData`/`addSocialRelationship` describe blocks and add:

```ts
it('getTreeData returns endedAt on partner edges and isDeceased on sims', async () => {
  // Arrange: a legacy with two sims, one deceased, in an ended marriage.
  // (Reuse the suite's existing legacy/sim factory helpers.)
  const caller = authedCaller(/* existing fixture user */)
  // ...create legacy, simA (alive), simB (causeOfDeath: 'OLD_AGE'),
  //    social rel MARRIED with endedAt set...

  const data = await caller.sims.getTreeData({ legacySlug })

  const edge = data.partnerEdges.find((e) => e.simAId === idA || e.simBId === idA)
  expect(edge?.endedAt).toBeInstanceOf(Date)
  expect(data.sims.find((s) => s.id === idB)?.isDeceased).toBe(true)
  expect(data.sims.find((s) => s.id === idA)?.isDeceased).toBe(false)
})

it('addSocialRelationship persists endedAt when provided', async () => {
  const caller = authedCaller(/* user */)
  const when = new Date('2026-02-02T00:00:00Z')
  const rel = await caller.sims.addSocialRelationship({
    simAId, simBId, romanticStatus: 'MARRIED', endedAt: when,
  })
  expect(rel.endedAt?.toISOString()).toBe(when.toISOString())
})

it('updateSocialRelationship can set and clear endedAt', async () => {
  const caller = authedCaller(/* user */)
  await caller.sims.addSocialRelationship({ simAId, simBId, romanticStatus: 'MARRIED' })
  const when = new Date('2026-03-03T00:00:00Z')
  const ended = await caller.sims.updateSocialRelationship({ simAId, simBId, romanticStatus: 'MARRIED', endedAt: when })
  expect(ended.endedAt?.toISOString()).toBe(when.toISOString())
  const reopened = await caller.sims.updateSocialRelationship({ simAId, simBId, romanticStatus: 'MARRIED', endedAt: null })
  expect(reopened.endedAt).toBeNull()
})
```

Match the file's existing helpers for creating users/legacies/sims and the `authedCaller` signature — read neighbouring tests in the same file first and mirror them exactly (factory names, await style, cleanup).

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/server/routers/sims.test.ts -t "endedAt"`
Expected: FAIL — `endedAt`/`isDeceased` undefined; `addSocialRelationship` rejects the unknown `endedAt` input.

- [ ] **Step 3: Add `endedAt` + `isDeceased` to `getTreeData`**

In `src/server/routers/sims.ts`, in `getTreeData`, extend the sims `select` and the partner-edge `select` + mappings:

```ts
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
```

```ts
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
```

And the return mapping — convert `causeOfDeath` to a boolean `isDeceased` and pass `endedAt` through:

```ts
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
```

- [ ] **Step 4: Add `endedAt` + `isDeceased` to `getMiniTreeData`**

In `src/server/routers/sims.ts`, update `miniTreeSimSelect` (top of file) to include `causeOfDeath`:

```ts
const miniTreeSimSelect = {
  id: true, firstName: true, lastName: true, imageUrl: true, generationNumber: true,
  lifeStage: true, isHeir: true, causeOfDeath: true,
} as const
```

Add `endedAt: true` to every `socialRelationshipsA`/`socialRelationshipsB` select inside `getMiniTreeData` (there are four — the focused sim's two and the parent's two). Each becomes:

```ts
            select: { simAId: true, simBId: true, romanticStatus: true, endedAt: true },
```

Update the `partnerEdges` local type, the `addPartnerEdge` helper, and the calls to carry `endedAt`:

```ts
      const partnerEdges: { simAId: string; simBId: string; romanticStatus: RomanticStatus; endedAt: Date | null }[] = []
```

```ts
      function addPartnerEdge(simAId: string, simBId: string, romanticStatus: RomanticStatus, endedAt: Date | null) {
        const [a, b] = [simAId, simBId].sort()
        const key = `${a}-${b}`
        if (!partnerEdgeSet.has(key)) { partnerEdgeSet.add(key); partnerEdges.push({ simAId: a, simBId: b, romanticStatus, endedAt }) }
      }
```

Update all six `addPartnerEdge(r.simAId, r.simBId, r.romanticStatus)` call sites to pass `r.endedAt`. Finally, map `causeOfDeath → isDeceased` in the returned sims. `MiniTreeSimData` now includes `causeOfDeath`; strip it in the return:

```ts
      return {
        sims: Array.from(simMap.values()).map(({ causeOfDeath, ...s }) => ({ ...s, isDeceased: causeOfDeath !== null })),
        familyEdges,
        partnerEdges,
      }
```

(Adjust the `simMap`/`MiniTreeSimData & { href }` typing as needed so the mapped result keeps `href`. If TS complains about the destructure, type the map callback parameter as `MiniTreeSimData & { href: string }`.)

- [ ] **Step 5: Add the `endedAt` input to the mutations**

In `addSocialRelationship`, extend the input and the `create` data:

```ts
      z.object({
        simAId: z.string(),
        simBId: z.string(),
        romanticStatus: z.nativeEnum(RomanticStatus).default('DATING'),
        endedAt: z.date().nullable().optional(),
      }),
```

```ts
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
```

In `updateSocialRelationship`, extend the input and the `update` data. Use a partial so omitting `endedAt` leaves it untouched, but allow explicit `null` to clear it:

```ts
      z.object({
        simAId: z.string(),
        simBId: z.string(),
        romanticStatus: z.nativeEnum(RomanticStatus),
        endedAt: z.date().nullable().optional(),
      }),
```

```ts
      return ctx.db.socialRelationship.update({
        where: { simAId_simBId: { simAId: normalA, simBId: normalB } },
        data: {
          romanticStatus: input.romanticStatus,
          ...(input.endedAt !== undefined ? { endedAt: input.endedAt } : {}),
        },
      })
```

- [ ] **Step 6: Add `endedAt` to the layout partner-edge type**

In `src/components/lineage-tree/layout-shared.ts`, extend `LineagePartnerEdge`:

```ts
export type LineagePartnerEdge = {
  simAId: string
  simBId: string
  romanticStatus: RomanticStatus
  endedAt: Date | null
}
```

This will surface type errors in any test fixture or caller that builds a `LineagePartnerEdge` without `endedAt`. Fix each by adding `endedAt: null` (the tree's `getTreeData`/`getMiniTreeData` now supply it for real). Search: `grep -rn "romanticStatus:" src/components/lineage-tree src/app/app/legacies` and add `endedAt: null` to every partner-edge literal in tests/fixtures.

- [ ] **Step 7: Run tests, typecheck, lint**

Run: `npx vitest run src/server/routers/sims.test.ts -t "endedAt"` → PASS.
Run: `npx vitest run src/components/lineage-tree` → PASS (fixtures updated).
Run: `npx tsc --noEmit` and `npm run lint` → clean.

- [ ] **Step 8: Commit**

```bash
but status -f
but commit feat/romantic-status-model -m "feat(api): thread endedAt + isDeceased through tree data and social mutations" --changes <sims.ts-id>,<sims.test.ts-id>,<layout-shared.ts-id>,<fixture-ids...>
```

---

## Task 4: Derive ex/widowed in the layout (stop reading the doomed values)

After this task, `src/components/lineage-tree` no longer references `EX_PARTNER` or `WIDOWED`. Behaviour is preserved: widowed couples (now `MARRIED` + a deceased partner) stay adjacent and their bond dashes; exes (`endedAt != null`) are never adjacent.

**Files:**
- Modify: `src/components/lineage-tree/layout-clusters.ts`
- Modify: `src/components/lineage-tree/to-flow-graph.ts`
- Test: `src/components/lineage-tree/__tests__/layout-clusters.test.ts`, `src/components/lineage-tree/__tests__/to-flow-graph.test.ts`

- [ ] **Step 1: Update the cluster tests**

In `__tests__/layout-clusters.test.ts`, replace any case that relied on `EX_PARTNER`/`WIDOWED`:
- An edge with `endedAt` set (any bond) must NOT produce an adjacent couple.
- A `MARRIED` edge with `endedAt: null` whose partner is deceased MUST still be adjacent (widowed couples stay together).

```ts
it('an ended relationship never claims an adjacency slot', () => {
  const couples = matchCouples(
    [{ simAId: 'a', simBId: 'b', romanticStatus: 'MARRIED', endedAt: new Date('2026-01-01') }],
    new Set(['a', 'b']),
    new Map([['a', 0], ['b', 0]]),
  )
  expect(couples).toEqual([])
})

it('a current married couple is adjacent', () => {
  const couples = matchCouples(
    [{ simAId: 'a', simBId: 'b', romanticStatus: 'MARRIED', endedAt: null }],
    new Set(['a', 'b']),
    new Map([['a', 0], ['b', 0]]),
  )
  expect(couples).toEqual([{ a: 'a', b: 'b', romanticStatus: 'MARRIED' }])
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/components/lineage-tree/__tests__/layout-clusters.test.ts`
Expected: FAIL — the ended edge currently still ranks/matches (no `endedAt` filter yet).

- [ ] **Step 3: Filter ended edges and drop the WIDOWED rank**

In `src/components/lineage-tree/layout-clusters.ts`:

Change the rank table comment + entries (remove `WIDOWED`):

```ts
/** Lower = stronger bond wins the adjacency slot. Ended bonds are filtered out before ranking. */
const ADJACENCY_RANK: Partial<Record<RomanticStatus, number>> = {
  MARRIED: 0,
  ENGAGED: 1,
  PARTNER: 2,
  DATING: 3,
}
```

In `listRankedCandidates`, carry `endedAt` and exclude ended edges from adjacency:

```ts
  return partnerEdges
    .map(({ simAId, simBId, romanticStatus, endedAt }) => {
      const [lo, hi] = [simAId, simBId].sort()
      return { lo, hi, romanticStatus, endedAt, rank: ADJACENCY_RANK[romanticStatus] }
    })
    .filter(
      (c): c is RankedCandidate =>
        c.rank !== undefined &&
        c.endedAt === null &&
        c.lo !== c.hi &&
        idSet.has(c.lo) &&
        idSet.has(c.hi) &&
        rowOf.get(c.lo) !== undefined &&
        rowOf.get(c.lo) === rowOf.get(c.hi),
    )
    .sort((a, b) => a.rank - b.rank || comparePairIds(a, b))
```

Add `endedAt` to the `RankedCandidate` type:

```ts
type RankedCandidate = {
  lo: string
  hi: string
  romanticStatus: RomanticStatus
  endedAt: Date | null
  rank: number
}
```

Update the module header comment: replace the `EX_PARTNER never gets adjacency` wording with `ended bonds (endedAt set) never get adjacency`.

- [ ] **Step 4: Update the to-flow-graph test for the dashed bond**

In `__tests__/to-flow-graph.test.ts`, replace the `WIDOWED → dashed` case. The dashed flag is now derived from a deceased partner on a current marriage. The adapter reads `isDeceased` off the sims it is given:

```ts
it('dashes a marriage bond when a partner is deceased', () => {
  // build a layout with couple {a,b}, romanticStatus MARRIED, b deceased
  const { edges } = toFlowGraph(layout, sims /* b has isDeceased: true */, familyEdges, opts)
  const marriage = edges.find((e) => e.type === 'marriage')
  expect(marriage?.data).toMatchObject({ dashed: true })
})

it('does not dash a marriage bond when both partners are alive', () => {
  const { edges } = toFlowGraph(layout, sims /* both alive */, familyEdges, opts)
  expect(edges.find((e) => e.type === 'marriage')?.data).toMatchObject({ dashed: false })
})
```

Update the suite's sim fixtures to include `isDeceased` (see Step 5).

- [ ] **Step 5: Add `isDeceased` to `LineageFlowSim` and derive the dashed bond**

In `src/components/lineage-tree/to-flow-graph.ts`, add the field to `LineageFlowSim`:

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
}
```

Replace the marriage-edge `dashed` derivation (currently `couple.romanticStatus === 'WIDOWED'`). The couples passed here are always current (Task 4 keeps ended edges out of adjacency), so dashing means an adjacent couple — any bond, including `PARTNER` — with a deceased partner (i.e. a widowed bond):

```ts
    data: {
      dashed:
        simById.get(couple.a)?.isDeceased === true ||
        simById.get(couple.b)?.isDeceased === true,
    } satisfies MarriageEdgeData,
```

(`simById` already exists in this function — it maps couple members to sims. Confirm the variable name from the surrounding code and reuse it.)

- [ ] **Step 6: Fix remaining fixtures**

`grep -rn "isHeir:" src/components/lineage-tree src/app/app/legacies/[slug]/sims/[id]/__tests__` to find `LineageFlowSim` literals and add `isDeceased: false` (or `true` where the test intends it). The real callers (`tree-atlas.tsx`, `family-tree-mini.tsx`) receive `isDeceased` from `getTreeData`/`getMiniTreeData` (Task 3) — confirm they pass the sims straight through; no change needed if they spread the query result.

- [ ] **Step 7: Run tests, typecheck, lint**

Run: `npx vitest run src/components/lineage-tree` → PASS.
Run: `npx tsc --noEmit` and `npm run lint` → clean.
Confirm zero references remain: `grep -rn "EX_PARTNER\|WIDOWED" src/components/lineage-tree` → no output.

- [ ] **Step 8: Commit**

```bash
but status -f
but commit feat/romantic-status-model -m "refactor(lineage-tree): derive ex/widowed from endedAt + deceased, drop stored-status reads" --changes <layout-clusters.ts-id>,<to-flow-graph.ts-id>,<test-ids...>
```

---

## Task 5: Relationships editor, add-modal, and inspector

Drops `EX_PARTNER`/`WIDOWED` from the option lists (last references to the doomed values), adds the end/reopen control + derived badge, and feeds the editor the data it needs (`endedAt` + partner `causeOfDeath`).

**Files:**
- Modify: `src/app/app/legacies/[slug]/sims/[id]/page.tsx`
- Modify: `src/app/app/legacies/[slug]/sims/[id]/relationships-editor.tsx`
- Modify: `src/app/app/legacies/[slug]/sims/[id]/add-relationship-modal.tsx`
- Modify: `src/app/app/legacies/[slug]/_components/tree-atlas/sim-inspector.tsx`
- Test: `src/app/app/legacies/[slug]/sims/[id]/__tests__/relationships-editor.test.tsx` (create if absent; otherwise extend)

- [ ] **Step 1: Feed `endedAt` + partner death into the editor select**

In `page.tsx`, extend the `socialRelationshipsA`/`socialRelationshipsB` includes so each relationship carries `endedAt` and each partner sim carries `causeOfDeath`:

```ts
        socialRelationshipsA: {
          select: {
            simAId: true, simBId: true, romanticStatus: true, endedAt: true,
            simB: { select: { id: true, firstName: true, lastName: true, imageUrl: true, causeOfDeath: true } },
          },
        },
        socialRelationshipsB: {
          select: {
            simAId: true, simBId: true, romanticStatus: true, endedAt: true,
            simA: { select: { id: true, firstName: true, lastName: true, imageUrl: true, causeOfDeath: true } },
          },
        },
```

(Switching `include` → `select` here also lets us pick `simAId`/`simBId` directly. If other code on the sim-detail page depended on the previous `include` returning extra social fields, keep them by adding the needed columns to this `select`.)

- [ ] **Step 2: Write the failing editor test**

Create/extend `__tests__/relationships-editor.test.tsx`. Mock the tRPC mutation hooks the way neighbouring tests in this folder do (read an existing `*.test.tsx` here first and mirror the mock setup), then assert:

```ts
it('ending a marriage calls updateSocialRelationship with a non-null endedAt and shows a Divorced badge', async () => {
  // render <RelationshipsEditor> with one MARRIED partner, endedAt: null, partner alive
  // click the "Divorce" control
  await user.click(screen.getByRole('button', { name: /divorce/i }))
  expect(updateSocialMock).toHaveBeenCalledWith(
    expect.objectContaining({ romanticStatus: 'MARRIED', endedAt: expect.any(Date) }),
    expect.anything(),
  )
  expect(screen.getByText('Divorced')).toBeInTheDocument()
})

it('shows a derived Widowed badge with no control when the partner is deceased', () => {
  // render with MARRIED partner, endedAt: null, partner causeOfDeath: 'OLD_AGE'
  expect(screen.getByText('Widowed')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /divorce/i })).not.toBeInTheDocument()
})
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run src/app/app/legacies/[slug]/sims/[id]/__tests__/relationships-editor.test.tsx`
Expected: FAIL — no end control / badge yet.

- [ ] **Step 4: Update `relationships-editor.tsx`**

1. Trim the options to the surviving bonds (keep `PARTNER`):

```ts
const ROMANTIC_STATUS_OPTIONS: RomanticStatus[] = [
  RomanticStatus.DATING,
  RomanticStatus.PARTNER,
  RomanticStatus.ENGAGED,
  RomanticStatus.MARRIED,
]
```

2. Carry `endedAt` and the partner's deceased flag on `SocialRel`, and read them from the new select shape:

```ts
interface SocialRel {
  sim: SimMini
  romanticStatus: RomanticStatus
  endedAt: Date | null
  partnerDeceased: boolean
  simAId: string
  simBId: string
}
```

Update `SimProp.socialRelationshipsA/B` types and the `useState` initialisers to include `endedAt: r.endedAt` and `partnerDeceased: r.simB.causeOfDeath !== null` (resp. `r.simA.causeOfDeath !== null`).

3. Import the helper and render a derived badge + end/reopen control. Replace the static `Partner` badge / status combobox block with:

```tsx
import { deriveRomanticState, romanticStateBadge } from '@/lib/romantic-status'
```

```tsx
{(() => {
  const state = deriveRomanticState(rel.romanticStatus, rel.endedAt, rel.partnerDeceased)
  const badge = state ? romanticStateBadge(state) : 'Partner'
  const canEnd = state?.kind === 'active'
  const isEnded = state?.kind === 'ended'
  return (
    <>
      <span className={styles.partnerBadge} aria-hidden="true">{badge}</span>
      {/* bond picker stays for active/widowed; hidden once ended to avoid implying a live bond */}
      {!isEnded && (
        <div onClick={(e) => e.stopPropagation()}>
          <Combobox
            value={rel.romanticStatus}
            onChange={(v) => handleStatusChange(rel, v as RomanticStatus)}
            size="sm"
            aria-label={`Romantic status with ${rel.sim.firstName}`}
          >
            {ROMANTIC_STATUS_OPTIONS.map((s) => (
              <Combobox.Item key={s} value={s}>{formatStatus(s)}</Combobox.Item>
            ))}
          </Combobox>
        </div>
      )}
      {canEnd && (
        <button
          type="button"
          className={styles.endRelBtn}
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleEndChange(rel, new Date()) }}
        >
          {rel.romanticStatus === 'MARRIED' ? 'Divorce' : 'End relationship'}
        </button>
      )}
      {isEnded && (
        <button
          type="button"
          className={styles.endRelBtn}
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleEndChange(rel, null) }}
        >
          Reopen
        </button>
      )}
    </>
  )
})()}
```

4. Add the `handleEndChange` handler (mirrors `handleStatusChange`, optimistic + rollback):

```tsx
function handleEndChange(rel: SocialRel, endedAt: Date | null) {
  const previous = rel.endedAt
  setPartners((prev) => prev.map((r) => (r.sim.id === rel.sim.id ? { ...r, endedAt } : r)))
  updateSocial.mutate(
    { simAId: rel.simAId, simBId: rel.simBId, romanticStatus: rel.romanticStatus, endedAt },
    { onError: () => setPartners((prev) => prev.map((r) => (r.sim.id === rel.sim.id ? { ...r, endedAt: previous } : r))) },
  )
}
```

5. Add a `.endRelBtn` class to `page.module.css` styled per the Parchment & Forest tokens (small ghost button: `var(--green)` text, `var(--border)`, no neon). Match the existing chip/button patterns already in that file (e.g. `.editableChip`).

- [ ] **Step 5: Update `add-relationship-modal.tsx`**

Trim its `ROMANTIC_STATUS_OPTIONS` to the same four bonds (`DATING`, `PARTNER`, `ENGAGED`, `MARRIED`). New partners are always added without an `endedAt` (the `onAddPartner` signature is unchanged; `addSocialRelationship` defaults `endedAt` to null). No other change.

- [ ] **Step 6: Update `sim-inspector.tsx`**

Remove `RomanticStatus.WIDOWED` from `PARTNER_STATUSES` and add `RomanticStatus.PARTNER`, so it lists the four bonds strongest-first: `MARRIED`, `ENGAGED`, `PARTNER`, `DATING`. The inspector surfaces a current partner; a widowed spouse is now a `MARRIED` row (deceased partner) and still appears, while an ended bond ranks out (it is not in the list). Update the doc comment to "current bonds, strongest first".

- [ ] **Step 7: Run tests, typecheck, lint**

Run: `npx vitest run src/app/app/legacies/[slug]/sims/[id]` → PASS.
Run: `npx tsc --noEmit` and `npm run lint` → clean.
Confirm the doomed values are gone from app code: `grep -rn "EX_PARTNER\|WIDOWED" src` → only matches should be in `prisma/` (the not-yet-removed enum) and possibly the spec docs. There must be **zero** matches under `src/`.

- [ ] **Step 8: Commit**

```bash
but status -f
but commit feat/romantic-status-model -m "feat(relationships): end/reopen control + derived divorced/widowed badges; drop stored ex/widowed options" --changes <page.tsx-id>,<relationships-editor.tsx-id>,<page.module.css-id>,<add-relationship-modal.tsx-id>,<sim-inspector.tsx-id>,<test-id>
```

---

## Task 6: Divorce and break-up milestones

Adds two derived chronicle milestones from ended relationships: **Divorce** (an ended `MARRIED` bond) and **Break-up** (an ended `DATING` or `ENGAGED` bond). Sorted by `endedAt`. Only needs the `endedAt` column (Task 1) and surviving enum values, so it is independent of the contract migration.

**Files:**
- Modify: `src/app/app/legacies/[slug]/lib/types.ts`
- Modify: `src/app/app/legacies/[slug]/lib/derive.ts`
- Modify: `src/app/app/legacies/[slug]/page.tsx`
- Test: `src/app/app/legacies/[slug]/lib/__tests__/derive.test.ts`

- [ ] **Step 1: Extend the types**

In `src/app/app/legacies/[slug]/lib/types.ts`:

Add `endedAt` to the fetched social row:

```ts
/** Minimal social-relationship row (bond + deliberate-end timestamp). */
export interface FetchedSocialRelationship {
  id: string
  simAId: string
  simBId: string
  romanticStatus: RomanticStatus
  endedAt: Date | null
  createdAt: Date
}
```

Add the two kinds to the milestone union (line ~139):

```ts
  kind: 'Founding' | 'Birth' | 'Marriage' | 'Divorce' | 'Breakup' | 'Death' | 'Note'
```

(Also update the `FetchedLegacy.socialRelationships` doc comment, which currently says only `MARRIED` rows are used — now ended rows of any bond are used too.)

- [ ] **Step 2: Write the failing derivation tests**

In `src/app/app/legacies/[slug]/lib/__tests__/derive.test.ts`, add to the `deriveMilestones` describe block. Mirror the existing marriage-milestone fixtures (same sim/legacy factory shape used around line 230) and add `endedAt` to the social rows:

```ts
it('derives a Divorce milestone from an ended marriage, sorted by endedAt', () => {
  const legacy = makeLegacy({
    sims: [makeSim({ id: 'sim-a', firstName: 'Ada', generationNumber: 1 }), makeSim({ id: 'sim-b', firstName: 'Ben', generationNumber: 1 })],
    socialRelationships: [
      { id: 'r1', simAId: 'sim-a', simBId: 'sim-b', romanticStatus: 'MARRIED', endedAt: new Date('2026-05-01'), createdAt: new Date('2020-01-01') },
    ],
  })
  const rows = deriveMilestones(legacy)
  const divorce = rows.find((m) => m.kind === 'Divorce')
  expect(divorce).toMatchObject({
    id: 'divorce-sim-a-sim-b',
    kind: 'Divorce',
    gen: 1,
    simIds: ['sim-a', 'sim-b'],
    title: 'Ada and Ben divorce',
    sortOrder: new Date('2026-05-01').getTime(),
  })
  // The wedding milestone is still present.
  expect(rows.some((m) => m.kind === 'Marriage' && m.id === 'marriage-sim-a-sim-b')).toBe(true)
})

it('derives a Break-up milestone from an ended dating or engaged bond', () => {
  const legacy = makeLegacy({
    sims: [makeSim({ id: 'sim-a', firstName: 'Ada', generationNumber: 2 }), makeSim({ id: 'sim-c', firstName: 'Cy', generationNumber: 2 })],
    socialRelationships: [
      { id: 'r2', simAId: 'sim-a', simBId: 'sim-c', romanticStatus: 'DATING', endedAt: new Date('2026-06-01'), createdAt: new Date('2025-01-01') },
    ],
  })
  const breakup = deriveMilestones(legacy).find((m) => m.kind === 'Breakup')
  expect(breakup).toMatchObject({
    id: 'breakup-sim-a-sim-c',
    kind: 'Breakup',
    title: 'Ada and Cy break up',
    sortOrder: new Date('2026-06-01').getTime(),
  })
})

it('does not derive divorce/break-up milestones for current (endedAt: null) bonds', () => {
  const legacy = makeLegacy({
    sims: [makeSim({ id: 'sim-a' }), makeSim({ id: 'sim-b' })],
    socialRelationships: [
      { id: 'r3', simAId: 'sim-a', simBId: 'sim-b', romanticStatus: 'MARRIED', endedAt: null, createdAt: new Date('2020-01-01') },
    ],
  })
  const rows = deriveMilestones(legacy)
  expect(rows.some((m) => m.kind === 'Divorce' || m.kind === 'Breakup')).toBe(false)
})
```

Use whatever the suite's actual fixture builders are named — read the top of `derive.test.ts` and reuse the existing `makeLegacy`/`makeSim` (or inline-object) pattern verbatim; don't introduce new helpers.

- [ ] **Step 3: Run to verify they fail**

Run: `npx vitest run src/app/app/legacies/[slug]/lib/__tests__/derive.test.ts -t "Divorce|Break"`
Expected: FAIL — no Divorce/Breakup rows emitted; `endedAt` missing on fixtures' type.

- [ ] **Step 4: Emit the milestones in `deriveMilestones`**

In `src/app/app/legacies/[slug]/lib/derive.ts`, immediately after the marriages loop (the `for (const rel of legacy.socialRelationships)` block that ends near line 357), add an ended-relationships loop. It reuses the same canonical-pair de-dup and gen logic:

```ts
  // --- Divorces & break-ups: one per unique unordered ended pair ---
  const seenEnded = new Set<string>()
  for (const rel of legacy.socialRelationships) {
    if (rel.endedAt === null) continue
    if (
      rel.romanticStatus !== 'MARRIED' &&
      rel.romanticStatus !== 'ENGAGED' &&
      rel.romanticStatus !== 'PARTNER' &&
      rel.romanticStatus !== 'DATING'
    ) continue
    const [idA, idB] = [rel.simAId, rel.simBId].sort()
    const pairKey = `${idA}:${idB}`
    if (seenEnded.has(pairKey)) continue
    seenEnded.add(pairKey)

    const simA = simMap.get(idA)
    const simB = simMap.get(idB)
    const aName = [simA?.firstName ?? 'Unknown', simA?.lastName ?? ''].filter(Boolean).join(' ')
    const bName = [simB?.firstName ?? 'Unknown', simB?.lastName ?? ''].filter(Boolean).join(' ')
    const gens = [simA?.generationNumber, simB?.generationNumber].filter(
      (g): g is number => g !== null && g !== undefined,
    )
    const gen: number | null = gens.length > 0 ? Math.min(...gens) : null

    const isDivorce = rel.romanticStatus === 'MARRIED'
    entries.push({
      id: `${isDivorce ? 'divorce' : 'breakup'}-${idA}-${idB}`,
      kind: isDivorce ? 'Divorce' : 'Breakup',
      gen,
      simIds: [idA, idB],
      title: `${aName} ${isDivorce ? 'and' : 'and'} ${bName} ${isDivorce ? 'divorce' : 'break up'}`,
      blurb: null,
      userAuthored: false,
      sortOrder: rel.endedAt.getTime(),
    })
  }
```

(The two ternaries on `and`/`and` collapse to a literal `and`; written this way only to keep the divorce/break-up verbs adjacent. Simplify to `${aName} and ${bName} ${isDivorce ? 'divorce' : 'break up'}` if preferred — confirm the test titles match exactly.)

The existing final `entries.sort(...)` already orders everything newest-first by `sortOrder` then `id`; no change needed.

- [ ] **Step 5: Select `endedAt` in the chronicle fetch**

In `src/app/app/legacies/[slug]/page.tsx`, add `endedAt` to the `socialRelationships` select (around line 94):

```ts
    select: {
      id: true,
      simAId: true,
      simBId: true,
      romanticStatus: true,
      endedAt: true,
      createdAt: true,
    },
```

- [ ] **Step 6: Run tests, typecheck, lint**

Run: `npx vitest run src/app/app/legacies/[slug]/lib/__tests__/derive.test.ts` → PASS.
Run: `npx tsc --noEmit` and `npm run lint` → clean.

- [ ] **Step 7: Commit**

```bash
but status -f
but commit feat/romantic-status-model -m "feat(chronicle): derive Divorce and Break-up milestones from ended relationships" --changes <types.ts-id>,<derive.ts-id>,<page.tsx-id>,<derive.test.ts-id>
```

---

## Task 7: Contract — narrow the `RomanticStatus` enum (migration + backfill)

Lands last: with no `src/` reference to `EX_PARTNER`/`WIDOWED` remaining, the generated client can drop them safely. Only those two values are removed — `PARTNER` is a real bond and stays, so the narrowed enum has five values. The migration also backfills existing rows (plain best-effort remap — no inference, no report; see spec).

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<ts>_narrow_romantic_status/migration.sql` (hand-written)
- Test: `src/server/routers/sims.test.ts` (migration/backfill assertion)

- [ ] **Step 1: Narrow the enum in the schema**

In `prisma/schema.prisma`:

```prisma
enum RomanticStatus {
  NONE
  DATING
  PARTNER
  ENGAGED
  MARRIED
}
```

- [ ] **Step 2: Scaffold the migration without applying it**

Run: `npx prisma migrate dev --name narrow_romantic_status --create-only`
Expected: creates `prisma/migrations/<ts>_narrow_romantic_status/migration.sql` with Prisma's naive enum-swap SQL. It will NOT handle existing `EX_PARTNER`/`WIDOWED` rows — you replace it next.

- [ ] **Step 3: Replace the migration SQL with the remap + type swap**

Overwrite `prisma/migrations/<ts>_narrow_romantic_status/migration.sql` with:

```sql
-- Backfill existing rows off the values being removed (plain best-effort remap).
-- EX_PARTNER: prior bond is unrecoverable -> generic break-up (DATING + ended).
UPDATE "social_relationships"
  SET "romanticStatus" = 'DATING', "endedAt" = "updatedAt"
  WHERE "romanticStatus" = 'EX_PARTNER';
-- WIDOWED: becomes a marriage; widowhood now derives from the partner's death.
UPDATE "social_relationships"
  SET "romanticStatus" = 'MARRIED'
  WHERE "romanticStatus" = 'WIDOWED';

-- Narrow the enum: Postgres cannot drop a value in place, so swap the type.
-- Only EX_PARTNER and WIDOWED are dropped; PARTNER survives.
ALTER TYPE "RomanticStatus" RENAME TO "RomanticStatus_old";
CREATE TYPE "RomanticStatus" AS ENUM ('NONE', 'DATING', 'PARTNER', 'ENGAGED', 'MARRIED');
ALTER TABLE "social_relationships"
  ALTER COLUMN "romanticStatus" TYPE "RomanticStatus"
  USING ("romanticStatus"::text::"RomanticStatus");
DROP TYPE "RomanticStatus_old";
```

- [ ] **Step 4: Apply the migration and regenerate the client**

Run: `npx prisma migrate dev`
Expected: applies the pending migration (no new one created) and regenerates the client. `RomanticStatus` now has four members.

If Prisma's AI-consent guard blocks the apply (enum drop is destructive), use the test-DB consent path already wired into `db:test:setup` for the test database, and run the dev apply per the project's documented Prisma workflow. Do **not** add suppressions or hand-edit the consent guard.

- [ ] **Step 5: Add the backfill assertion test**

In `src/server/routers/sims.test.ts`, add a test that seeds rows with the *new* shape that the backfill produces and pins the intended end state (the suite runs against the migrated test DB, so assert the post-migration contract rather than re-running SQL):

```ts
it('migrated ex-partners read as an ended dating bond; migrated widows as a current marriage', () => {
  // A DATING row with a non-null endedAt derives to an ended/broke-up state.
  expect(deriveRomanticState('DATING', new Date('2026-01-01'), false)).toEqual({ kind: 'ended', bond: 'DATING' })
  // A MARRIED row with a deceased partner derives to widowed (no stored WIDOWED needed).
  expect(deriveRomanticState('MARRIED', null, true)).toEqual({ kind: 'widowed', bond: 'MARRIED' })
})
```

(If the suite has infrastructure to run raw migration SQL against seeded `EX_PARTNER`/`WIDOWED` rows, prefer a true end-to-end assertion there. Otherwise this guards the contract the migration targets.)

- [ ] **Step 6: Verify migrations are in sync, full typecheck, lint**

Run: `npx prisma migrate status` → "Database schema is up to date!".
Run: `npx prisma validate` → "The schema is valid".
Run: `npx tsc --noEmit` → no errors (the client no longer exports the dropped members; nothing references them).
Run: `npm run lint` → clean.
Run: `grep -rn "EX_PARTNER\|WIDOWED" src prisma/schema.prisma` → no matches.

- [ ] **Step 7: Commit**

```bash
but status -f
but commit feat/romantic-status-model -m "feat(db): narrow RomanticStatus to bond-only; backfill ex/widowed rows" --changes <schema-id>,<migration-id>,<sims.test.ts-id>
```

---

## Final verification

- [ ] **Full suites green**

Run: `npm test` → all pass.
Run: `npm run test:e2e` → all pass. (If a stray `dev:test` server is on :3737, kill it first — Playwright reuses it against the wrong DB.)
Run: `npx tsc --noEmit` and `npm run lint` → clean.

- [ ] **Spec coverage check**

Confirm each spec section is implemented: bond-only enum (T7), `endedAt` (T1), `deriveRomanticState` precedence (T2), migration + plain best-effort backfill with the accepted widow caveat (T7), server queries/mutations (T3), editor end/reopen + derived badge (T5), layout ranking/dashing moved onto derived state (T4), inspector (T5), Divorce/Break-up chronicle milestones (T6). Note the documented caveat: legacy `WIDOWED` rows whose partner isn't marked deceased now read as active marriages until the death is recorded.

- [ ] **Reviews (per AGENTS.md)**

Run the `/code-review` skill over the branch. Because Task 5 changes UI, also run the `design-system-reviewer` agent and the `web-qa-tester` agent. Address findings; re-run if changes are large.

- [ ] **Hand off**

The kinship-labels work (`feat/kinship-labels`) stacks on top of this branch and consumes `deriveRomanticState`, the partner-edge `endedAt`, and the sim `isDeceased` signal. Confirm the stack order with `but status -fv` before starting it.
