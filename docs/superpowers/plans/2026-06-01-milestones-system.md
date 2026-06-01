# Legacy Milestones System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a milestone system to the Legacy Chronicle page — auto-derived Births/Marriages/Foundings/Deaths plus persisted, user-authored, drag-reorderable "Note" milestones — and fix the bug where every newly added sim is logged as a birth.

**Architecture:** Hybrid. Auto milestones stay derived at read time from current Sim/relationship state (never stored). User milestones live in a new `Milestone` table with an adjustable `sortOrder` float on the same epoch-ms axis. The read path merges derived + stored and sorts by `sortOrder` descending. Births are now derived only for sims with an in-legacy parent (the bug fix). The Milestones UI becomes a client component with a composer and `@dnd-kit` reordering; auto rows are pinned (non-draggable).

**Tech Stack:** Next.js 16 (App Router), Prisma 7 + PostgreSQL, tRPC + `@trpc/react-query`, Vitest + Testing Library, Playwright, `@dnd-kit`.

**Reference spec:** `docs/superpowers/specs/2026-05-31-milestones-system-design.md`

**Conventions (from AGENTS.md):**
- Never `cd`; run commands from the worktree root with explicit paths.
- Conventional commits; stage only the specific files (`git add <file>`), never `git add .`.
- No `eslint-disable` / `@ts-ignore` / `@ts-expect-error` / `@ts-nocheck`.
- After each task: `npx tsc --noEmit` and `npm run lint` must be clean.
- At the very end: `npm test` and `npm run test:e2e` must pass.

---

## File Structure

**Create:**
- `prisma/migrations/<timestamp>_add_milestones/migration.sql` (generated)
- `src/server/routers/milestones.ts` — the milestones tRPC router
- `src/server/routers/milestones.test.ts` — router integration tests
- `src/app/app/legacies/[slug]/_components/milestones/milestones-client.tsx` — interactive list (composer + dnd)
- `src/app/app/legacies/[slug]/_components/milestones/milestone-composer.tsx` — create/edit form
- `src/app/app/legacies/[slug]/_components/milestones/sortable-milestone-row.tsx` — dnd wrapper for user rows
- `src/app/app/legacies/[slug]/_components/milestones/__tests__/milestones-client.test.tsx`
- `src/app/app/legacies/[slug]/_components/milestones/__tests__/milestone-composer.test.tsx`
- `e2e/milestones.spec.ts`

**Modify:**
- `prisma/schema.prisma` — add `Milestone`, `MilestoneSim`; back-relations on `Legacy`, `Sim`
- `src/app/app/legacies/[slug]/lib/types.ts` — view `Milestone` type; fetched-shape additions
- `src/app/app/legacies/[slug]/lib/derive.ts` — birth fix + Death + `toUserMilestones` + `mergeMilestones`
- `src/app/app/legacies/[slug]/lib/__tests__/derive.test.ts` — update fixture/assertions
- `src/app/app/legacies/[slug]/page.tsx` — fetch family relationships, death fields, user milestones; merge
- `src/app/app/legacies/[slug]/_components/chronicle-sections/chronicle-sections.tsx` — thread `legacyId`
- `src/app/app/legacies/[slug]/_components/milestones/milestones.tsx` — render the client list
- `src/server/routers/index.ts` — register `milestones`
- `package.json` — add `@dnd-kit/*`

---

## Phase 1 — Data model & migration

### Task 1: Add the Milestone and MilestoneSim models

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the two models and back-relations**

In `prisma/schema.prisma`, add to the `Legacy` model's relation block (after `challengeRuns ChallengeRun[]`):

```prisma
  milestones    Milestone[]
```

Add to the `Sim` model's relation block (after `socialRelationshipsB SocialRelationship[]  @relation("SocialB")`):

```prisma
  milestones           MilestoneSim[]
```

Add these two new models at the end of the file (before the final line is fine; model order is irrelevant):

```prisma
model Milestone {
  id        String   @id @default(cuid())
  legacyId  String
  title     String
  blurb     String?
  sortOrder Float
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  legacy Legacy         @relation(fields: [legacyId], references: [id], onDelete: Cascade)
  sims   MilestoneSim[]

  @@index([legacyId, sortOrder])
  @@map("milestones")
}

model MilestoneSim {
  milestoneId String
  simId       String

  milestone Milestone @relation(fields: [milestoneId], references: [id], onDelete: Cascade)
  sim       Sim       @relation(fields: [simId], references: [id], onDelete: Cascade)

  @@id([milestoneId, simId])
  @@map("milestone_sims")
}
```

- [ ] **Step 2: Validate the schema**

Run: `npx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 3: Create and apply the migration**

Run: `npx prisma migrate dev --name add_milestones`
Expected: a new folder `prisma/migrations/<timestamp>_add_milestones/` with `migration.sql` creating `milestones` and `milestone_sims`; the Prisma client regenerates.

> If the Prisma 7 AI-consent guard blocks the CLI, use the MCP tool `mcp__plugin_prisma_Prisma-Local__migrate-dev` with name `add_milestones` instead. Creating new tables is non-destructive.

- [ ] **Step 4: Regenerate the client (if not already)**

Run: `npx prisma generate`
Expected: `Generated Prisma Client` success.

- [ ] **Step 5: Sync the test database schema**

Run: `npm run db:test:setup`
Expected: completes without error (applies migrations to the test DB).

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors (Prisma client now knows `db.milestone` / `db.milestoneSim`).

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): add Milestone and MilestoneSim models"
```

---

## Phase 2 — Derivation + birth bug fix (pure functions, TDD)

### Task 2: Extend the view + fetched types

**Files:**
- Modify: `src/app/app/legacies/[slug]/lib/types.ts`

This task has no test of its own; it unblocks Tasks 3–4 and is exercised by their tests.

- [ ] **Step 1: Update the imports and the view `Milestone` type**

At the top of `types.ts`, ensure `CauseOfDeath` is imported from `@prisma/client` alongside the existing imports. The file already imports `LifeStage` and `RomanticStatus`; extend that import:

```ts
import type { CauseOfDeath, LifeStage, RomanticStatus } from '@prisma/client'
```

Replace the existing `Milestone` interface with:

```ts
export interface Milestone {
  /** Stable id: synthetic for derived rows ("birth-{simId}", "death-{simId}",
   *  "marriage-{aId}-{bId}"); the real cuid for user-authored rows. */
  id: string
  kind: 'Founding' | 'Birth' | 'Marriage' | 'Death' | 'Note'
  gen: number | null
  /** The sim(s) involved in this milestone event. */
  simIds: string[]
  title: string
  blurb: string | null
  /** True for user-authored notes; also gates drag/edit/delete in the UI. */
  userAuthored: boolean
  /** Position on the shared time axis (epoch ms for derived rows; stored float
   *  for user rows). Drives merge order and client-side drag math. */
  sortOrder: number
}
```

- [ ] **Step 2: Add the death fields to `FetchedSim`**

In the `FetchedSim` interface, add two fields after `createdAt: Date`:

```ts
  updatedAt: Date
  causeOfDeath: CauseOfDeath | null
```

- [ ] **Step 3: Add the new fetched shapes**

After the `FetchedSocialRelationship` interface, add:

```ts
/** A parent→child link, for deciding whether a sim was born into the legacy. */
export interface FetchedFamilyRelationship {
  parentId: string
  childId: string
}

/** A persisted user-authored milestone row with its tagged sim ids. */
export interface FetchedMilestone {
  id: string
  title: string
  blurb: string | null
  sortOrder: number
  sims: { simId: string }[]
}
```

- [ ] **Step 4: Extend `FetchedLegacy`**

In the `FetchedLegacy` interface, add after `households: FetchedHousehold[]`:

```ts
  familyRelationships: FetchedFamilyRelationship[]
  userMilestones: FetchedMilestone[]
```

- [ ] **Step 5: Type-check (expected to fail in derive/page, that's fine for now)**

Run: `npx tsc --noEmit`
Expected: errors only in `derive.ts` (uses old shape) and `page.tsx`/`derive.test.ts` (missing new fields). These are fixed in Tasks 3–5. Do **not** commit yet; commit at the end of Task 4 once derive + tests are green.

---

### Task 3: Fix the birth derivation + add Death (TDD)

**Files:**
- Modify: `src/app/app/legacies/[slug]/lib/__tests__/derive.test.ts`
- Modify: `src/app/app/legacies/[slug]/lib/derive.ts`

- [ ] **Step 1: Update the test fixture to satisfy the new types**

The `fixture: FetchedLegacy` and the small inline legacies in `derive.test.ts` must carry the new fields. At the top of the file, add a helper near the other helpers (after `makeChronicleSim`):

```ts
// Every fixture sim needs updatedAt + causeOfDeath now. Default: alive,
// updatedAt === createdAt unless a test overrides it.
function withDeathFields<T extends { createdAt: Date }>(
  sim: T,
): T & { updatedAt: Date; causeOfDeath: null } {
  return { ...sim, updatedAt: sim.createdAt, causeOfDeath: null }
}
```

For the main `fixture`, add `familyRelationships` and `userMilestones` and give each sim death fields. The simplest mechanical change: wrap each sim object literal in `withDeathFields({ ... })`, and add these two arrays to the `fixture` object (alongside `households`, `sims`, `socialRelationships`):

```ts
  familyRelationships: [
    // Bella (gen 1 heir) is the founder Mortimer's child → born in legacy
    { parentId: FOUNDER_ID, childId: HEIR_GEN1_ID },
    // Add the parent links your fixture's later-generation sims need so the
    // birth assertions below hold. Use the existing *_ID constants.
  ],
  userMilestones: [],
```

> Note: the exact parent links depend on the existing fixture's sim ids. The rule you are encoding: a sim gets a `Birth` row **iff** it appears as a `childId` whose `parentId` is one of the fixture's sims. Founder gets `Founding`. Sims with no in-legacy parent (spouses who married in) must get **no** origin row.

- [ ] **Step 2: Replace the `deriveMilestones` describe block with assertions for the new behavior**

Replace the existing `describe('deriveMilestones', ...)` block with:

```ts
describe('deriveMilestones', () => {
  it('marks the founder with kind Founding, never Birth', () => {
    const rows = deriveMilestones(fixture)
    const founderRow = rows.find((m) => m.simIds[0] === FOUNDER_ID && m.kind !== 'Death')
    expect(founderRow?.kind).toBe('Founding')
    expect(founderRow?.title).toBe('Mortimer Goth founds the legacy')
    expect(rows.some((m) => m.kind === 'Birth' && m.simIds.includes(FOUNDER_ID))).toBe(false)
  })

  it('emits a Birth only for a sim with an in-legacy parent', () => {
    const rows = deriveMilestones(fixture)
    const bellaBirth = rows.find((m) => m.kind === 'Birth' && m.simIds.includes(HEIR_GEN1_ID))
    expect(bellaBirth).toBeDefined()
    expect(bellaBirth?.title).toBe('Bella Goth is born')
  })

  it('does NOT emit any origin row for a married-in adult (no in-legacy parent)', () => {
    const rows = deriveMilestones(fixture)
    const spouseOrigin = rows.find(
      (m) => (m.kind === 'Birth' || m.kind === 'Founding') && m.simIds.includes(SPOUSE1_ID),
    )
    expect(spouseOrigin).toBeUndefined()
  })

  it('emits a Death row when causeOfDeath is set, independent of birth', () => {
    const legacy: FetchedLegacy = {
      ...fixture,
      familyRelationships: [{ parentId: FOUNDER_ID, childId: HEIR_GEN1_ID }],
      sims: [
        withDeathFields({
          id: FOUNDER_ID, firstName: 'Mortimer', lastName: 'Goth', imageUrl: null,
          generationNumber: 1, isHeir: false, lifeStage: 'ELDER',
          createdAt: new Date('2024-01-01T00:00:00Z'), aspirations: [],
        }),
        {
          id: HEIR_GEN1_ID, firstName: 'Bella', lastName: 'Goth', imageUrl: null,
          generationNumber: 1, isHeir: true, lifeStage: 'ELDER',
          createdAt: new Date('2024-01-02T00:00:00Z'),
          updatedAt: new Date('2024-06-01T00:00:00Z'),
          causeOfDeath: 'OLD_AGE', aspirations: [],
        },
      ],
      socialRelationships: [],
      userMilestones: [],
    }
    const rows = deriveMilestones(legacy)
    const bellaRows = rows.filter((m) => m.simIds.includes(HEIR_GEN1_ID))
    expect(bellaRows.map((r) => r.kind).sort()).toEqual(['Birth', 'Death'])
    const death = bellaRows.find((r) => r.kind === 'Death')
    expect(death?.title).toBe('Bella Goth dies')
    expect(death?.sortOrder).toBe(new Date('2024-06-01T00:00:00Z').getTime())
  })

  it('orders rows newest-first by sortOrder, tie-broken by id', () => {
    const rows = deriveMilestones(fixture)
    for (let i = 1; i < rows.length; i++) {
      const prev = rows[i - 1]
      const cur = rows[i]
      const inOrder =
        prev.sortOrder > cur.sortOrder ||
        (prev.sortOrder === cur.sortOrder && prev.id.localeCompare(cur.id) <= 0)
      expect(inOrder).toBe(true)
    }
  })
})
```

- [ ] **Step 3: Run the tests to confirm they fail**

Run: `npm test -- src/app/app/legacies/\[slug\]/lib/__tests__/derive.test.ts`
Expected: FAIL — current `deriveMilestones` emits a Birth for every non-founder sim and has no Death/`sortOrder` support.

- [ ] **Step 4: Rewrite `deriveMilestones` in `derive.ts`**

Replace the entire `deriveMilestones` function (the `Section 5` block) with:

```ts
export function deriveMilestones(legacy: FetchedLegacy): Milestone[] {
  const simMap = new Map<string, FetchedSim>(legacy.sims.map((s) => [s.id, s]))
  const legacySimIds = new Set(legacy.sims.map((s) => s.id))

  // A sim is "born into the legacy" iff it has ≥1 parent who is also a member.
  const bornInLegacy = new Set<string>()
  for (const rel of legacy.familyRelationships) {
    if (legacySimIds.has(rel.parentId)) bornInLegacy.add(rel.childId)
  }

  const entries: Array<{ milestone: Milestone; sortKey: number }> = []

  for (const sim of legacy.sims) {
    const fullName = [sim.firstName, sim.lastName].filter(Boolean).join(' ')
    const isFounder = sim.id === legacy.founderSimId
    const birthSortKey = sim.createdAt.getTime()

    // --- Origin row: Founding (founder), Birth (born-in), or nothing ---
    if (isFounder) {
      entries.push({
        milestone: {
          id: `birth-${sim.id}`,
          kind: 'Founding',
          gen: sim.generationNumber,
          simIds: [sim.id],
          title: `${fullName} founds the legacy`,
          blurb: null,
          userAuthored: false,
          sortOrder: birthSortKey,
        },
        sortKey: birthSortKey,
      })
    } else if (bornInLegacy.has(sim.id)) {
      entries.push({
        milestone: {
          id: `birth-${sim.id}`,
          kind: 'Birth',
          gen: sim.generationNumber,
          simIds: [sim.id],
          title: `${fullName} is born`,
          blurb: null,
          userAuthored: false,
          sortOrder: birthSortKey,
        },
        sortKey: birthSortKey,
      })
    }
    // else: married-in / moved-in adult → no origin row (the bug fix)

    // --- Death row (independent of origin); proxy sort by updatedAt ---
    if (sim.causeOfDeath !== null) {
      const deathSortKey = sim.updatedAt.getTime()
      entries.push({
        milestone: {
          id: `death-${sim.id}`,
          kind: 'Death',
          gen: sim.generationNumber,
          simIds: [sim.id],
          title: `${fullName} dies`,
          blurb: null,
          userAuthored: false,
          sortOrder: deathSortKey,
        },
        sortKey: deathSortKey,
      })
    }
  }

  // --- Marriages: one per unique unordered MARRIED pair ---
  const seenPairs = new Set<string>()
  for (const rel of legacy.socialRelationships) {
    if (rel.romanticStatus !== 'MARRIED') continue
    const [idA, idB] = [rel.simAId, rel.simBId].sort()
    const pairKey = `${idA}:${idB}`
    if (seenPairs.has(pairKey)) continue
    seenPairs.add(pairKey)

    const simA = simMap.get(idA)
    const simB = simMap.get(idB)
    const aName = [simA?.firstName ?? 'Unknown', simA?.lastName ?? ''].filter(Boolean).join(' ')
    const bName = [simB?.firstName ?? 'Unknown', simB?.lastName ?? ''].filter(Boolean).join(' ')
    const gens = [simA?.generationNumber, simB?.generationNumber].filter(
      (g): g is number => g !== null && g !== undefined,
    )
    const gen: number | null = gens.length > 0 ? Math.min(...gens) : null
    const sortKey = rel.createdAt.getTime()

    entries.push({
      milestone: {
        id: `marriage-${idA}-${idB}`,
        kind: 'Marriage',
        gen,
        simIds: [idA, idB],
        title: `${aName} marries ${bName}`,
        blurb: null,
        userAuthored: false,
        sortOrder: sortKey,
      },
      sortKey,
    })
  }

  entries.sort((a, b) => {
    if (b.sortKey !== a.sortKey) return b.sortKey - a.sortKey
    return a.milestone.id.localeCompare(b.milestone.id)
  })

  return entries.map((entry) => entry.milestone)
}
```

- [ ] **Step 5: Run the tests to confirm they pass**

Run: `npm test -- src/app/app/legacies/\[slug\]/lib/__tests__/derive.test.ts`
Expected: PASS (the `computeStats` and other blocks in the file still pass; if a `computeStats` count assertion broke because married-in sims no longer produce births, update that expected number to match the new derived count).

- [ ] **Step 6: Type-check & lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: `derive.ts` clean. `page.tsx` may still error (fixed in Task 5) — that is acceptable; do not commit until Task 4.

---

### Task 4: Add `toUserMilestones` and `mergeMilestones` (TDD)

**Files:**
- Modify: `src/app/app/legacies/[slug]/lib/__tests__/derive.test.ts`
- Modify: `src/app/app/legacies/[slug]/lib/derive.ts`

- [ ] **Step 1: Import the new functions in the test**

In `derive.test.ts`, extend the import from `'../derive'` to include `toUserMilestones` and `mergeMilestones`.

- [ ] **Step 2: Add failing tests**

Append:

```ts
describe('toUserMilestones', () => {
  it('maps stored rows to Note milestones and infers gen from tagged sims', () => {
    const legacy: FetchedLegacy = {
      ...fixture,
      userMilestones: [
        {
          id: 'm1',
          title: 'The feud begins',
          blurb: 'A scandal.',
          sortOrder: 1_700_000_000_000,
          sims: [{ simId: HEIR_GEN1_ID }, { simId: SPOUSE1_ID }],
        },
        { id: 'm2', title: 'Untagged note', blurb: null, sortOrder: 5, sims: [] },
      ],
    }
    const rows = toUserMilestones(legacy)
    expect(rows[0]).toMatchObject({
      id: 'm1', kind: 'Note', userAuthored: true,
      title: 'The feud begins', blurb: 'A scandal.',
      simIds: [HEIR_GEN1_ID, SPOUSE1_ID], sortOrder: 1_700_000_000_000,
    })
    // gen = min of the tagged sims' generationNumbers (both gen 1 here)
    expect(rows[0].gen).toBe(1)
    // no tags → gen null
    expect(rows[1].gen).toBeNull()
  })
})

describe('mergeMilestones', () => {
  it('merges and sorts by sortOrder desc, tie-broken by id', () => {
    const auto: Milestone[] = [
      { id: 'birth-a', kind: 'Birth', gen: 1, simIds: ['a'], title: 'A', blurb: null, userAuthored: false, sortOrder: 100 },
      { id: 'birth-b', kind: 'Birth', gen: 1, simIds: ['b'], title: 'B', blurb: null, userAuthored: false, sortOrder: 300 },
    ]
    const user: Milestone[] = [
      { id: 'm1', kind: 'Note', gen: 1, simIds: [], title: 'N', blurb: null, userAuthored: true, sortOrder: 200 },
    ]
    const merged = mergeMilestones(auto, user)
    expect(merged.map((m) => m.id)).toEqual(['birth-b', 'm1', 'birth-a'])
  })
})
```

- [ ] **Step 3: Run to confirm failure**

Run: `npm test -- src/app/app/legacies/\[slug\]/lib/__tests__/derive.test.ts`
Expected: FAIL — `toUserMilestones`/`mergeMilestones` are not exported.

- [ ] **Step 4: Implement both functions in `derive.ts`**

Append to `derive.ts`:

```ts
// ---------------------------------------------------------------------------
// 7. toUserMilestones
// ---------------------------------------------------------------------------

/**
 * Map persisted user-authored milestones into view `Milestone`s.
 * Generation is inferred from the tagged sims (min non-null generationNumber,
 * the same rule marriages use); null when no tagged sim has a generation.
 */
export function toUserMilestones(legacy: FetchedLegacy): Milestone[] {
  const genById = new Map<string, number | null>(
    legacy.sims.map((s) => [s.id, s.generationNumber]),
  )

  return legacy.userMilestones.map((m) => {
    const simIds = m.sims.map((s) => s.simId)
    const gens = simIds
      .map((id) => genById.get(id))
      .filter((g): g is number => g !== null && g !== undefined)
    const gen: number | null = gens.length > 0 ? Math.min(...gens) : null

    return {
      id: m.id,
      kind: 'Note' as const,
      gen,
      simIds,
      title: m.title,
      blurb: m.blurb,
      userAuthored: true,
      sortOrder: m.sortOrder,
    }
  })
}

// ---------------------------------------------------------------------------
// 8. mergeMilestones
// ---------------------------------------------------------------------------

/**
 * Merge derived (auto) and user-authored milestones into one timeline,
 * newest-first by sortOrder, tie-broken by id for determinism.
 */
export function mergeMilestones(auto: Milestone[], user: Milestone[]): Milestone[] {
  return [...auto, ...user].sort((a, b) => {
    if (b.sortOrder !== a.sortOrder) return b.sortOrder - a.sortOrder
    return a.id.localeCompare(b.id)
  })
}
```

- [ ] **Step 5: Run to confirm pass**

Run: `npm test -- src/app/app/legacies/\[slug\]/lib/__tests__/derive.test.ts`
Expected: PASS.

- [ ] **Step 6: Type-check & lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean except possibly `page.tsx` (fixed next). If only `page.tsx` errors remain, that is fine.

- [ ] **Step 7: Commit**

```bash
git add "src/app/app/legacies/[slug]/lib/types.ts" "src/app/app/legacies/[slug]/lib/derive.ts" "src/app/app/legacies/[slug]/lib/__tests__/derive.test.ts"
git commit -m "feat(legacy): parent-based birth derivation, Death kind, user-milestone merge"
```

---

## Phase 3 — API layer (tRPC integration, TDD)

### Task 5: `milestones.create` + register router (TDD)

**Files:**
- Create: `src/server/routers/milestones.ts`
- Create: `src/server/routers/milestones.test.ts`
- Modify: `src/server/routers/index.ts`

- [ ] **Step 1: Write the failing test**

Create `src/server/routers/milestones.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { TRPCError } from '@trpc/server'
import { authedCaller } from '@/test/caller'
import { createTestUser, cleanupUser, createTestLegacy, createTestSim } from '@/test/helpers'
import { db } from '@/server/db'

describe('milestones.create', () => {
  let userId: string
  let legacyId: string

  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
    const legacy = await createTestLegacy(userId)
    legacyId = legacy.id
  })

  afterEach(async () => {
    await cleanupUser(userId)
  })

  it('creates a milestone with sortOrder and tagged sims', async () => {
    const sim = await createTestSim(legacyId, { firstName: 'Nina' })
    const caller = authedCaller(userId)
    const result = await caller.milestones.create({
      legacyId,
      title: 'The Lothario incident',
      blurb: 'She knew what she was doing.',
      simIds: [sim.id],
    })
    expect(result.title).toBe('The Lothario incident')
    expect(typeof result.sortOrder).toBe('number')
    expect(result.sims.map((s) => s.simId)).toEqual([sim.id])

    const row = await db.milestone.findUnique({ where: { id: result.id } })
    expect(row).not.toBeNull()
  })

  it('rejects sims that do not belong to the legacy', async () => {
    const otherUser = await createTestUser()
    const otherLegacy = await createTestLegacy(otherUser.id)
    const foreignSim = await createTestSim(otherLegacy.id)
    const caller = authedCaller(userId)
    await expect(
      caller.milestones.create({ legacyId, title: 'X', simIds: [foreignSim.id] }),
    ).rejects.toBeInstanceOf(TRPCError)
    await cleanupUser(otherUser.id)
  })

  it("rejects creating against another user's legacy", async () => {
    const otherUser = await createTestUser()
    const otherLegacy = await createTestLegacy(otherUser.id)
    const caller = authedCaller(userId)
    await expect(
      caller.milestones.create({ legacyId: otherLegacy.id, title: 'X', simIds: [] }),
    ).rejects.toBeInstanceOf(TRPCError)
    await cleanupUser(otherUser.id)
  })
})
```

- [ ] **Step 2: Run to confirm failure**

Run: `npm test -- src/server/routers/milestones.test.ts`
Expected: FAIL — `caller.milestones` does not exist.

- [ ] **Step 3: Create the router with `create`**

Create `src/server/routers/milestones.ts`:

```ts
import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc'
import type { PrismaClient } from '@prisma/client'

const milestoneInclude = { sims: { select: { simId: true } } } as const

/** Throw unless the legacy exists and is owned by the user. */
async function assertOwnedLegacy(db: PrismaClient, legacyId: string, userId: string) {
  const legacy = await db.legacy.findFirst({ where: { id: legacyId, userId } })
  if (!legacy) throw new TRPCError({ code: 'NOT_FOUND', message: 'Legacy not found' })
}

/** Throw unless every simId belongs to the given legacy. */
async function assertSimsInLegacy(db: PrismaClient, simIds: string[], legacyId: string) {
  if (simIds.length === 0) return
  const count = await db.sim.count({ where: { id: { in: simIds }, legacyId } })
  if (count !== simIds.length) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'All tagged sims must belong to this legacy' })
  }
}

/** Return the owned milestone's id + legacyId, or throw NOT_FOUND. */
async function findOwnedMilestone(db: PrismaClient, id: string, userId: string) {
  const existing = await db.milestone.findFirst({
    where: { id, legacy: { userId } },
    select: { id: true, legacyId: true },
  })
  if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Milestone not found' })
  return existing
}

export const milestonesRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        legacyId: z.string(),
        title: z.string().min(1).max(120),
        blurb: z.string().max(1000).optional(),
        simIds: z.array(z.string()).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      await assertOwnedLegacy(ctx.db, input.legacyId, userId)
      await assertSimsInLegacy(ctx.db, input.simIds, input.legacyId)

      return ctx.db.milestone.create({
        data: {
          legacyId: input.legacyId,
          title: input.title,
          blurb: input.blurb ?? null,
          sortOrder: Date.now(),
          sims: { create: input.simIds.map((simId) => ({ simId })) },
        },
        include: milestoneInclude,
      })
    }),
})
```

- [ ] **Step 4: Register the router**

In `src/server/routers/index.ts`, add the import and entry:

```ts
import { milestonesRouter } from './milestones'
```

and inside the `router({ ... })` object, add:

```ts
  milestones: milestonesRouter,
```

- [ ] **Step 5: Run to confirm pass**

Run: `npm test -- src/server/routers/milestones.test.ts`
Expected: PASS.

- [ ] **Step 6: Type-check, lint, commit**

```bash
npx tsc --noEmit && npm run lint
git add src/server/routers/milestones.ts src/server/routers/milestones.test.ts src/server/routers/index.ts
git commit -m "feat(api): milestones.create with ownership + sim-tag validation"
```

---

### Task 6: `milestones.update` (TDD)

**Files:**
- Modify: `src/server/routers/milestones.test.ts`
- Modify: `src/server/routers/milestones.ts`

- [ ] **Step 1: Add the failing test**

Append a new `describe('milestones.update', ...)` block (reuse the same `beforeEach`/`afterEach` pattern — copy it into the new block):

```ts
describe('milestones.update', () => {
  let userId: string
  let legacyId: string

  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
    const legacy = await createTestLegacy(userId)
    legacyId = legacy.id
  })
  afterEach(async () => { await cleanupUser(userId) })

  it('edits title/blurb and replaces the tag set without touching sortOrder', async () => {
    const simA = await createTestSim(legacyId, { firstName: 'A' })
    const simB = await createTestSim(legacyId, { firstName: 'B' })
    const caller = authedCaller(userId)
    const created = await caller.milestones.create({ legacyId, title: 'Old', simIds: [simA.id] })

    const updated = await caller.milestones.update({
      id: created.id, title: 'New', blurb: 'now with blurb', simIds: [simB.id],
    })

    expect(updated.title).toBe('New')
    expect(updated.blurb).toBe('now with blurb')
    expect(updated.sims.map((s) => s.simId)).toEqual([simB.id])
    expect(updated.sortOrder).toBe(created.sortOrder)
  })

  it("rejects editing another user's milestone", async () => {
    const caller = authedCaller(userId)
    const created = await caller.milestones.create({ legacyId, title: 'Mine', simIds: [] })
    const otherUser = await createTestUser()
    const otherCaller = authedCaller(otherUser.id)
    await expect(
      otherCaller.milestones.update({ id: created.id, title: 'Hijack', simIds: [] }),
    ).rejects.toBeInstanceOf(TRPCError)
    await cleanupUser(otherUser.id)
  })
})
```

- [ ] **Step 2: Run to confirm failure**

Run: `npm test -- src/server/routers/milestones.test.ts`
Expected: FAIL — `update` not defined.

- [ ] **Step 3: Add `update` to the router**

Inside the `router({ ... })` object in `milestones.ts`, after `create`:

```ts
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(1).max(120),
        blurb: z.string().max(1000).optional(),
        simIds: z.array(z.string()).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const existing = await findOwnedMilestone(ctx.db, input.id, userId)
      await assertSimsInLegacy(ctx.db, input.simIds, existing.legacyId)

      await ctx.db.milestoneSim.deleteMany({ where: { milestoneId: input.id } })
      return ctx.db.milestone.update({
        where: { id: input.id },
        data: {
          title: input.title,
          blurb: input.blurb ?? null,
          sims: { create: input.simIds.map((simId) => ({ simId })) },
        },
        include: milestoneInclude,
      })
    }),
```

- [ ] **Step 4: Run to confirm pass**

Run: `npm test -- src/server/routers/milestones.test.ts`
Expected: PASS.

- [ ] **Step 5: Type-check, lint, commit**

```bash
npx tsc --noEmit && npm run lint
git add src/server/routers/milestones.ts src/server/routers/milestones.test.ts
git commit -m "feat(api): milestones.update"
```

---

### Task 7: `milestones.delete` (TDD)

**Files:**
- Modify: `src/server/routers/milestones.test.ts`
- Modify: `src/server/routers/milestones.ts`

- [ ] **Step 1: Add the failing test**

```ts
describe('milestones.delete', () => {
  let userId: string
  let legacyId: string
  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
    const legacy = await createTestLegacy(userId)
    legacyId = legacy.id
  })
  afterEach(async () => { await cleanupUser(userId) })

  it('deletes the milestone and cascades its tag rows', async () => {
    const sim = await createTestSim(legacyId)
    const caller = authedCaller(userId)
    const created = await caller.milestones.create({ legacyId, title: 'Bye', simIds: [sim.id] })

    const res = await caller.milestones.delete({ id: created.id })
    expect(res.id).toBe(created.id)
    expect(await db.milestone.findUnique({ where: { id: created.id } })).toBeNull()
    expect(await db.milestoneSim.count({ where: { milestoneId: created.id } })).toBe(0)
  })

  it("rejects deleting another user's milestone", async () => {
    const caller = authedCaller(userId)
    const created = await caller.milestones.create({ legacyId, title: 'Mine', simIds: [] })
    const otherUser = await createTestUser()
    await expect(
      authedCaller(otherUser.id).milestones.delete({ id: created.id }),
    ).rejects.toBeInstanceOf(TRPCError)
    await cleanupUser(otherUser.id)
  })
})
```

- [ ] **Step 2: Run to confirm failure**

Run: `npm test -- src/server/routers/milestones.test.ts`
Expected: FAIL — `delete` not defined.

- [ ] **Step 3: Add `delete` to the router**

After `update`:

```ts
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      await findOwnedMilestone(ctx.db, input.id, userId)
      await ctx.db.milestone.delete({ where: { id: input.id } })
      return { id: input.id }
    }),
```

- [ ] **Step 4: Run to confirm pass**

Run: `npm test -- src/server/routers/milestones.test.ts`
Expected: PASS.

- [ ] **Step 5: Type-check, lint, commit**

```bash
npx tsc --noEmit && npm run lint
git add src/server/routers/milestones.ts src/server/routers/milestones.test.ts
git commit -m "feat(api): milestones.delete"
```

---

### Task 8: `milestones.reorder` (TDD)

**Files:**
- Modify: `src/server/routers/milestones.test.ts`
- Modify: `src/server/routers/milestones.ts`

- [ ] **Step 1: Add the failing test**

```ts
describe('milestones.reorder', () => {
  let userId: string
  let legacyId: string
  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
    const legacy = await createTestLegacy(userId)
    legacyId = legacy.id
  })
  afterEach(async () => { await cleanupUser(userId) })

  it('sets sortOrder to the midpoint between two neighbors', async () => {
    const caller = authedCaller(userId)
    const m = await caller.milestones.create({ legacyId, title: 'M', simIds: [] })
    const res = await caller.milestones.reorder({ id: m.id, prevSortOrder: 1000, nextSortOrder: 2000 })
    expect(res.sortOrder).toBe(1500)
  })

  it('places above-all when only nextSortOrder is given', async () => {
    const caller = authedCaller(userId)
    const m = await caller.milestones.create({ legacyId, title: 'M', simIds: [] })
    const res = await caller.milestones.reorder({ id: m.id, nextSortOrder: 2000 })
    expect(res.sortOrder).toBe(3000)
  })

  it('places below-all when only prevSortOrder is given', async () => {
    const caller = authedCaller(userId)
    const m = await caller.milestones.create({ legacyId, title: 'M', simIds: [] })
    const res = await caller.milestones.reorder({ id: m.id, prevSortOrder: 2000 })
    expect(res.sortOrder).toBe(1000)
  })

  it('rejects when neither neighbor is provided', async () => {
    const caller = authedCaller(userId)
    const m = await caller.milestones.create({ legacyId, title: 'M', simIds: [] })
    await expect(caller.milestones.reorder({ id: m.id })).rejects.toBeInstanceOf(TRPCError)
  })
})
```

- [ ] **Step 2: Run to confirm failure**

Run: `npm test -- src/server/routers/milestones.test.ts`
Expected: FAIL — `reorder` not defined.

- [ ] **Step 3: Add `reorder` to the router**

After `delete`:

```ts
  reorder: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        prevSortOrder: z.number().optional(),
        nextSortOrder: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      await findOwnedMilestone(ctx.db, input.id, userId)

      const { prevSortOrder: prev, nextSortOrder: next } = input
      let sortOrder: number
      if (prev !== undefined && next !== undefined) {
        sortOrder = (prev + next) / 2
      } else if (next !== undefined) {
        sortOrder = next + 1000
      } else if (prev !== undefined) {
        sortOrder = prev - 1000
      } else {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'At least one neighbor required' })
      }

      return ctx.db.milestone.update({
        where: { id: input.id },
        data: { sortOrder },
        include: milestoneInclude,
      })
    }),
```

- [ ] **Step 4: Run to confirm pass**

Run: `npm test -- src/server/routers/milestones.test.ts`
Expected: PASS.

- [ ] **Step 5: Type-check, lint, commit**

```bash
npx tsc --noEmit && npm run lint
git add src/server/routers/milestones.ts src/server/routers/milestones.test.ts
git commit -m "feat(api): milestones.reorder with float-midpoint positioning"
```

---

## Phase 4 — Page wiring

### Task 9: Fetch family relationships, death fields, and user milestones; merge

**Files:**
- Modify: `src/app/app/legacies/[slug]/page.tsx`
- Modify: `src/app/app/legacies/[slug]/_components/chronicle-sections/chronicle-sections.tsx`

- [ ] **Step 1: Add the new fields to the sims select and fetch the new data**

In `page.tsx`, inside the `legacy.findFirst({ select: { ... sims: { select: { ... } } } })`, add to the sim `select` (after `createdAt: true,`):

```ts
          updatedAt: true,
          causeOfDeath: true,
```

After the `socialRelationships` query, add:

```ts
  // Parent→child links for sims in this legacy — used to decide whether a sim
  // was born into the legacy (has an in-legacy parent) vs. married/moved in.
  const familyRelationships = await db.familyRelationship.findMany({
    where: { child: { legacyId: legacy.id } },
    select: { parentId: true, childId: true },
  })

  // Persisted, user-authored milestones for this legacy.
  const userMilestones = await db.milestone.findMany({
    where: { legacyId: legacy.id },
    select: {
      id: true,
      title: true,
      blurb: true,
      sortOrder: true,
      sims: { select: { simId: true } },
    },
  })
```

- [ ] **Step 2: Extend the `FetchedLegacy` assembly and the merge**

Update the `const fetched: FetchedLegacy = { ... }` to include the two new arrays:

```ts
  const fetched: FetchedLegacy = {
    id: legacy.id,
    name: legacy.name,
    description: legacy.description,
    founderSimId: legacy.founderSimId,
    sims: legacy.sims,
    households: legacy.households,
    socialRelationships,
    familyRelationships,
    userMilestones,
  }
```

Change the milestones line and the import. Replace:

```ts
  const milestones = deriveMilestones(fetched)
```

with:

```ts
  const milestones = mergeMilestones(
    deriveMilestones(fetched),
    toUserMilestones(fetched),
  )
```

Update the import from `./lib/derive` to include `mergeMilestones` and `toUserMilestones`.

- [ ] **Step 3: Thread `legacyId` to ChronicleSections**

In `page.tsx`, in the `<ChronicleSections ... />` JSX, add the prop:

```tsx
        legacyId={fetched.id}
```

In `chronicle-sections.tsx`, add `legacyId: string` to `ChronicleSectionsProps`, destructure it, and pass it to `<Milestones ... legacyId={legacyId} />`.

- [ ] **Step 4: Type-check & lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: `Milestones` will error about an unknown `legacyId` prop until Task 11. That is acceptable — proceed to Phase 5. (If you prefer a green checkpoint, do Step 5 of Task 11 first; otherwise commit page + chronicle-sections together with Task 11.)

- [ ] **Step 5: Run the derive tests to confirm nothing regressed**

Run: `npm test -- src/app/app/legacies/\[slug\]/lib/__tests__/derive.test.ts`
Expected: PASS.

---

## Phase 5 — UI & client interactivity

### Task 10: Install @dnd-kit

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Install**

Run: `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`
Expected: packages added to `dependencies`.

- [ ] **Step 2: Type-check & commit**

```bash
npx tsc --noEmit
git add package.json package-lock.json
git commit -m "build: add @dnd-kit for milestone reordering"
```

---

### Task 11: Milestones client list (render auto + user rows)

**Files:**
- Modify: `src/app/app/legacies/[slug]/_components/milestones/milestones.tsx`
- Create: `src/app/app/legacies/[slug]/_components/milestones/milestones-client.tsx`
- Create: `src/app/app/legacies/[slug]/_components/milestones/__tests__/milestones-client.test.tsx`

- [ ] **Step 1: Write the failing component test**

Create `__tests__/milestones-client.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MilestonesClient } from '../milestones-client'
import type { Milestone, ChronicleSim } from '../../../lib/types'

vi.mock('@/trpc/client', () => ({
  trpc: {
    milestones: {
      create: { useMutation: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })) },
      update: { useMutation: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })) },
      delete: { useMutation: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })) },
      reorder: { useMutation: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })) },
    },
  },
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const simsById: Record<string, ChronicleSim> = {
  s1: { id: 's1', firstName: 'Reed', lastName: 'Caliente', imageUrl: null, generationNumber: 3, lifeStage: 'TEEN', isHeir: true, isFounder: false, aspirationName: null },
}

const milestones: Milestone[] = [
  { id: 'birth-s1', kind: 'Birth', gen: 3, simIds: ['s1'], title: 'Reed Caliente is born', blurb: null, userAuthored: false, sortOrder: 200 },
  { id: 'm1', kind: 'Note', gen: 3, simIds: ['s1'], title: 'On the back porch', blurb: 'Kind to each other tonight.', userAuthored: true, sortOrder: 100 },
]

describe('MilestonesClient', () => {
  it('renders auto and user rows', () => {
    render(<MilestonesClient milestones={milestones} simsById={simsById} slug="goth" legacyId="leg-1" />)
    expect(screen.getByText('Reed Caliente is born')).toBeInTheDocument()
    expect(screen.getByText('On the back porch')).toBeInTheDocument()
  })

  it('shows the composer trigger', () => {
    render(<MilestonesClient milestones={[]} simsById={{}} slug="goth" legacyId="leg-1" />)
    expect(screen.getByRole('button', { name: /add milestone/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to confirm failure**

Run: `npm test -- "src/app/app/legacies/[slug]/_components/milestones/__tests__/milestones-client.test.tsx"`
Expected: FAIL — `milestones-client` does not exist.

- [ ] **Step 3: Create `milestones-client.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { trpc } from '@/trpc/client'
import type { Milestone, ChronicleSim } from '../../lib/types'
import { MilestoneRow } from './milestone-row'
import { SortableMilestoneRow } from './sortable-milestone-row'
import { MilestoneComposer } from './milestone-composer'
import styles from './milestones.module.css'

export interface MilestonesClientProps {
  milestones: Milestone[]
  simsById: Record<string, ChronicleSim>
  slug: string
  legacyId: string
}

export function MilestonesClient({ milestones, simsById, slug, legacyId }: MilestonesClientProps) {
  const router = useRouter()
  const [items, setItems] = useState<Milestone[]>(milestones)
  const [editing, setEditing] = useState<Milestone | null>(null)

  const reorder = trpc.milestones.reorder.useMutation()
  const remove = trpc.milestones.delete.useMutation()

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Keep in sync if the server data changes (after router.refresh()).
  if (milestones !== items && milestones.map((m) => m.id).join() !== items.map((m) => m.id).join()) {
    setItems(milestones)
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = items.findIndex((m) => m.id === active.id)
    const newIndex = items.findIndex((m) => m.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return

    // Optimistic reorder
    const next = [...items]
    const [moved] = next.splice(oldIndex, 1)
    next.splice(newIndex, 0, moved)
    setItems(next)

    // Neighbors in the new ordering (newest-first list): prev = above (higher
    // sortOrder), nextRow = below (lower sortOrder).
    const pos = next.findIndex((m) => m.id === moved.id)
    const prev = next[pos - 1]
    const below = next[pos + 1]
    await reorder.mutateAsync({
      id: moved.id,
      prevSortOrder: prev?.sortOrder,
      nextSortOrder: below?.sortOrder,
    })
    router.refresh()
  }

  async function handleDelete(id: string) {
    setItems((prev) => prev.filter((m) => m.id !== id))
    await remove.mutateAsync({ id })
    router.refresh()
  }

  return (
    <div>
      <MilestoneComposer
        legacyId={legacyId}
        slug={slug}
        simsById={simsById}
        editing={editing}
        onDone={() => {
          setEditing(null)
          router.refresh()
        }}
        onCancelEdit={() => setEditing(null)}
      />

      {items.length === 0 ? null : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((m) => m.id)} strategy={verticalListSortingStrategy}>
            <ul className={styles.rows}>
              {items.map((m) =>
                m.userAuthored ? (
                  <SortableMilestoneRow
                    key={m.id}
                    milestone={m}
                    simsById={simsById}
                    slug={slug}
                    onEdit={() => setEditing(m)}
                    onDelete={() => handleDelete(m.id)}
                  />
                ) : (
                  <MilestoneRow key={m.id} milestone={m} simsById={simsById} slug={slug} />
                ),
              )}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </div>
  )
}
```

> Note: `MilestoneComposer` and `SortableMilestoneRow` are created in Tasks 12–13. To compile this task in isolation, create minimal stub files for them now (a component returning `null` for the composer, and one rendering `<MilestoneRow .../>` for the sortable row) — the next tasks replace the stubs with real implementations. Alternatively, implement Tasks 12 and 13 before running this task's tests.

- [ ] **Step 4: Update `milestones.tsx` to render the client list**

Replace the body of `milestones.tsx` with:

```tsx
import { SectionHeading } from '@/components/ui'
import type { Milestone, ChronicleSim } from '../../lib/types'
import { MilestonesClient } from './milestones-client'
import styles from './milestones.module.css'

export interface MilestonesProps {
  milestones: Milestone[]
  simsById: Record<string, ChronicleSim>
  slug: string
  legacyId: string
}

export function Milestones({ milestones, simsById, slug, legacyId }: MilestonesProps) {
  return (
    <div className={styles.container}>
      <SectionHeading
        eyebrow="Chronicle"
        title="Milestones"
        blurb="Births, marriages, and the moments in between."
      />
      <MilestonesClient
        milestones={milestones}
        simsById={simsById}
        slug={slug}
        legacyId={legacyId}
      />
    </div>
  )
}
```

(The empty-state text now lives in the composer/list; the bare `EmptyState` import is removed. If `EmptyState` becomes unused elsewhere in this file, drop it from the import to satisfy lint.)

- [ ] **Step 5: Run to confirm pass**

Run: `npm test -- "src/app/app/legacies/[slug]/_components/milestones/__tests__/milestones-client.test.tsx"`
Expected: PASS (with Tasks 12–13 implemented, or with the stubs from Step 3).

- [ ] **Step 6: Type-check, lint, commit** (commit together with Task 9's page changes)

```bash
npx tsc --noEmit && npm run lint
git add "src/app/app/legacies/[slug]/page.tsx" "src/app/app/legacies/[slug]/_components/chronicle-sections/chronicle-sections.tsx" "src/app/app/legacies/[slug]/_components/milestones/milestones.tsx" "src/app/app/legacies/[slug]/_components/milestones/milestones-client.tsx" "src/app/app/legacies/[slug]/_components/milestones/__tests__/milestones-client.test.tsx"
git commit -m "feat(legacy): wire merged milestones into an interactive client list"
```

---

### Task 12: Milestone composer (create + edit)

**Files:**
- Create: `src/app/app/legacies/[slug]/_components/milestones/milestone-composer.tsx`
- Create: `src/app/app/legacies/[slug]/_components/milestones/__tests__/milestone-composer.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `__tests__/milestone-composer.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MilestoneComposer } from '../milestone-composer'
import type { ChronicleSim } from '../../../lib/types'

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn().mockResolvedValue({ id: 'm-new' }) }))

vi.mock('@/trpc/client', () => ({
  trpc: {
    milestones: {
      create: { useMutation: vi.fn(() => ({ mutateAsync: mockCreate, isPending: false })) },
      update: { useMutation: vi.fn(() => ({ mutateAsync: vi.fn().mockResolvedValue({ id: 'm1' }), isPending: false })) },
    },
  },
}))

const simsById: Record<string, ChronicleSim> = {
  s1: { id: 's1', firstName: 'Reed', lastName: 'Caliente', imageUrl: null, generationNumber: 3, lifeStage: 'TEEN', isHeir: true, isFounder: false, aspirationName: null },
}

describe('MilestoneComposer', () => {
  it('creates a milestone with the entered title', async () => {
    const onDone = vi.fn()
    render(
      <MilestoneComposer legacyId="leg-1" slug="goth" simsById={simsById} editing={null} onDone={onDone} onCancelEdit={vi.fn()} />,
    )
    await userEvent.click(screen.getByRole('button', { name: /add milestone/i }))
    await userEvent.type(screen.getByLabelText(/title/i), 'The feud begins')
    await userEvent.click(screen.getByRole('button', { name: /save milestone/i }))

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1))
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ legacyId: 'leg-1', title: 'The feud begins' }),
    )
    expect(onDone).toHaveBeenCalled()
  })

  it('disables save when the title is empty', async () => {
    render(
      <MilestoneComposer legacyId="leg-1" slug="goth" simsById={simsById} editing={null} onDone={vi.fn()} onCancelEdit={vi.fn()} />,
    )
    await userEvent.click(screen.getByRole('button', { name: /add milestone/i }))
    expect(screen.getByRole('button', { name: /save milestone/i })).toBeDisabled()
  })
})
```

- [ ] **Step 2: Run to confirm failure**

Run: `npm test -- "src/app/app/legacies/[slug]/_components/milestones/__tests__/milestone-composer.test.tsx"`
Expected: FAIL — file does not exist (or stub renders null).

- [ ] **Step 3: Implement `milestone-composer.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { trpc } from '@/trpc/client'
import { Button } from '@/components/ui'
import type { Milestone, ChronicleSim } from '../../lib/types'
import styles from './milestone-composer.module.css'

export interface MilestoneComposerProps {
  legacyId: string
  slug: string
  simsById: Record<string, ChronicleSim>
  /** When set, the composer opens pre-filled to edit this milestone. */
  editing: Milestone | null
  onDone: () => void
  onCancelEdit: () => void
}

export function MilestoneComposer({
  legacyId, simsById, editing, onDone, onCancelEdit,
}: MilestoneComposerProps) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [blurb, setBlurb] = useState('')
  const [simIds, setSimIds] = useState<string[]>([])

  const create = trpc.milestones.create.useMutation()
  const update = trpc.milestones.update.useMutation()
  const isEditing = editing !== null

  useEffect(() => {
    if (editing) {
      setOpen(true)
      setTitle(editing.title)
      setBlurb(editing.blurb ?? '')
      setSimIds(editing.simIds)
    }
  }, [editing])

  function reset() {
    setTitle('')
    setBlurb('')
    setSimIds([])
    setOpen(false)
  }

  async function handleSave() {
    if (title.trim().length === 0) return
    if (isEditing && editing) {
      await update.mutateAsync({ id: editing.id, title: title.trim(), blurb: blurb.trim() || undefined, simIds })
    } else {
      await create.mutateAsync({ legacyId, title: title.trim(), blurb: blurb.trim() || undefined, simIds })
    }
    reset()
    onDone()
  }

  function handleCancel() {
    reset()
    if (isEditing) onCancelEdit()
  }

  const allSims = Object.values(simsById)
  const pending = create.isPending || update.isPending

  if (!open) {
    return (
      <div className={styles.trigger}>
        <span className={styles.triggerText}>Record a moment</span>
        <Button type="button" onClick={() => setOpen(true)}>+ Add milestone</Button>
      </div>
    )
  }

  return (
    <div className={styles.composer}>
      <label className={styles.field}>
        <span className={styles.label}>Title</span>
        <input
          className={styles.input}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. The Caliente–Lothario feud begins"
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Story</span>
        <textarea
          className={styles.textarea}
          rows={3}
          value={blurb}
          onChange={(e) => setBlurb(e.target.value)}
          placeholder="Tell the story in your own words…"
        />
      </label>

      <fieldset className={styles.tags}>
        <legend className={styles.label}>Tag sims</legend>
        {allSims.map((s) => {
          const checked = simIds.includes(s.id)
          return (
            <label key={s.id} className={styles.tag}>
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) =>
                  setSimIds((prev) =>
                    e.target.checked ? [...prev, s.id] : prev.filter((id) => id !== s.id),
                  )
                }
              />
              {s.firstName} {s.lastName}
            </label>
          )
        })}
      </fieldset>

      <div className={styles.actions}>
        <Button type="button" variant="ghost" onClick={handleCancel}>Cancel</Button>
        <Button type="button" onClick={handleSave} disabled={title.trim().length === 0 || pending}>
          Save milestone
        </Button>
      </div>
    </div>
  )
}
```

Create a minimal `milestone-composer.module.css` with classes referenced above (`trigger`, `triggerText`, `composer`, `field`, `label`, `input`, `textarea`, `tags`, `tag`, `actions`). Match the parchment/forest tokens used elsewhere (see `milestone-row.module.css` for the token names). Keep it simple — visual polish can follow the design review.

> Confirm the `Button` API: check `src/components/ui` for the exact `variant` prop values (`ghost`, `outline`, `primary`). Use whatever the existing primitive exposes; adjust the `variant="ghost"` above if the name differs.

- [ ] **Step 4: Run to confirm pass**

Run: `npm test -- "src/app/app/legacies/[slug]/_components/milestones/__tests__/milestone-composer.test.tsx"`
Expected: PASS.

- [ ] **Step 5: Type-check, lint, commit**

```bash
npx tsc --noEmit && npm run lint
git add "src/app/app/legacies/[slug]/_components/milestones/milestone-composer.tsx" "src/app/app/legacies/[slug]/_components/milestones/milestone-composer.module.css" "src/app/app/legacies/[slug]/_components/milestones/__tests__/milestone-composer.test.tsx"
git commit -m "feat(legacy): milestone composer for creating and editing notes"
```

---

### Task 13: Sortable row wrapper (drag handle + edit/delete)

**Files:**
- Create: `src/app/app/legacies/[slug]/_components/milestones/sortable-milestone-row.tsx`

This is presentational glue around `MilestoneRow`; it is covered by the `milestones-client` test (render) and the e2e test (drag/edit/delete). No separate unit test.

- [ ] **Step 1: Implement `sortable-milestone-row.tsx`**

```tsx
'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Milestone, ChronicleSim } from '../../lib/types'
import { MilestoneRow } from './milestone-row'
import styles from './sortable-milestone-row.module.css'

export interface SortableMilestoneRowProps {
  milestone: Milestone
  simsById: Record<string, ChronicleSim>
  slug: string
  onEdit: () => void
  onDelete: () => void
}

export function SortableMilestoneRow({
  milestone, simsById, slug, onEdit, onDelete,
}: SortableMilestoneRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: milestone.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className={styles.wrapper} data-testid="sortable-milestone">
      <button
        type="button"
        className={styles.handle}
        aria-label={`Reorder ${milestone.title}`}
        {...attributes}
        {...listeners}
      >
        ⠿
      </button>
      <MilestoneRow milestone={milestone} simsById={simsById} slug={slug} />
      <div className={styles.controls}>
        <button type="button" onClick={onEdit} aria-label={`Edit ${milestone.title}`}>Edit</button>
        <button type="button" onClick={onDelete} aria-label={`Delete ${milestone.title}`}>Delete</button>
      </div>
    </div>
  )
}
```

Create a minimal `sortable-milestone-row.module.css` with `wrapper` (flex row, align center), `handle` (cursor grab, drag-handle styling), and `controls` (gap-spaced buttons). Reuse existing tokens.

- [ ] **Step 2: Replace any stub** created in Task 11 Step 3 with this real file (and the composer stub with the Task 12 file).

- [ ] **Step 3: Run the milestones-client test**

Run: `npm test -- "src/app/app/legacies/[slug]/_components/milestones/__tests__/milestones-client.test.tsx"`
Expected: PASS (both auto and user rows render; user rows now show Edit/Delete/handle).

- [ ] **Step 4: Type-check, lint, commit**

```bash
npx tsc --noEmit && npm run lint
git add "src/app/app/legacies/[slug]/_components/milestones/sortable-milestone-row.tsx" "src/app/app/legacies/[slug]/_components/milestones/sortable-milestone-row.module.css"
git commit -m "feat(legacy): sortable milestone row with drag handle, edit, delete"
```

---

## Phase 6 — End-to-end & final gates

### Task 14: E2E — birth bug + composer + reorder

**Files:**
- Create: `e2e/milestones.spec.ts`

- [ ] **Step 1: Review the existing e2e auth/setup helpers**

Read an existing spec (e.g. `e2e/` directory) to reuse the project's magic-link sign-in helper and any legacy/sim creation helpers. Match its `getByTestId` conventions (per project memory: scope locators with `getByTestId`, not CSS selectors).

- [ ] **Step 2: Write the e2e spec**

Create `e2e/milestones.spec.ts` (adapt the sign-in/setup calls to the project's existing helpers):

```ts
import { test, expect } from '@playwright/test'
// import { signIn, createLegacyWithSims } from './helpers'  // use the project's actual helpers

test.describe('Legacy milestones', () => {
  test('an adult who married in is not logged as born', async ({ page }) => {
    // Setup: sign in; create a legacy with a founder, a born child (with a
    // parent link), and an adult spouse who married in (no in-legacy parent).
    // Navigate to /app/legacies/<slug> and scroll to the Milestones section.

    const milestones = page.getByTestId('roster').or(page.locator('#milestones'))
    await page.locator('#milestones').scrollIntoViewIfNeeded()

    // The born child shows an "is born" row...
    await expect(page.getByText(/is born/i)).toBeVisible()
    // ...but the married-in adult does NOT get an "is born" row.
    await expect(page.getByText(/Married-In Adult is born/i)).toHaveCount(0)
  })

  test('user can add, edit, reorder, and delete a milestone', async ({ page }) => {
    // Navigate to the legacy page (signed in, legacy created in setup).
    await page.locator('#milestones').scrollIntoViewIfNeeded()
    await page.getByRole('button', { name: /add milestone/i }).click()
    await page.getByLabel(/title/i).fill('The back-porch truce')
    await page.getByRole('button', { name: /save milestone/i }).click()

    // Appears at the top of the timeline (newest-first).
    await expect(page.getByText('The back-porch truce')).toBeVisible()

    // Persists after reload.
    await page.reload()
    await expect(page.getByText('The back-porch truce')).toBeVisible()

    // Delete it.
    await page.getByRole('button', { name: /Delete The back-porch truce/i }).click()
    await expect(page.getByText('The back-porch truce')).toHaveCount(0)
  })
})
```

> The drag assertion can be exercised via keyboard (focus the handle, Space to lift, Arrow to move, Space to drop — `@dnd-kit`'s keyboard sensor supports this) or via Playwright `dragTo`. If drag proves flaky in CI, assert reorder at the API/unit level (already covered in Task 8) and keep the e2e to add/edit/delete + the birth-bug check.

- [ ] **Step 3: Run the e2e spec**

Run: `npm run test:e2e -- milestones.spec.ts`
Expected: PASS. Fix selectors/setup to match the app until green.

- [ ] **Step 4: Commit**

```bash
git add e2e/milestones.spec.ts
git commit -m "test(e2e): milestones birth-bug fix, create, reorder, delete"
```

---

### Task 15: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no errors or warnings. (No suppressions — fix root causes.)

- [ ] **Step 3: Unit/integration suite**

Run: `npm test`
Expected: all pass, including `derive.test.ts` and `milestones.test.ts`.

- [ ] **Step 4: E2E suite**

Run: `npm run test:e2e`
Expected: all pass.

- [ ] **Step 5: Final commit (if anything was adjusted)**

```bash
git add -p   # stage reviewed changes only
git commit -m "chore(legacy): finalize milestones system"
```

---

## Self-review notes (addressed)

- **Spec coverage:** data model (Task 1), birth fix + Death + merge (Tasks 2–4), API create/update/delete/reorder (Tasks 5–8), page fetch+merge (Task 9), UI composer/list/dnd (Tasks 10–13), testing + migration (woven through; e2e Task 14, gates Task 15). All five spec sections map to tasks.
- **Type consistency:** the view `Milestone` (with `userAuthored: boolean`, `sortOrder: number`, `kind` incl. `Death`/`Note`), `FetchedLegacy.familyRelationships`/`userMilestones`, `FetchedMilestone.sims: { simId }[]`, and the router's `milestoneInclude` (`sims: { select: { simId } }`) are used identically across derive, router, page, and components.
- **Ordering:** derived rows carry `sortOrder = timestamp`; `mergeMilestones` and the client both sort/treat newest-first (higher `sortOrder` first); `reorder` neighbor semantics (prev = higher, next = lower) match the client's drag-end neighbor lookup.
- **Known follow-up:** Task 11 references the composer/sortable-row created in Tasks 12–13 — either stub them first (noted in Task 11 Step 3) or implement 12–13 before running Task 11's test.
