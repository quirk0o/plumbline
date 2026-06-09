# Editable Sim Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a sim's generation an always-present (`NOT NULL`) function of the family tree — derived (`max(parent)+1`) for sims with parents, freely editable on the detail page for root sims (founders/partners/subtree roots) — enforced on the server and recomputed on every relevant write.

**Architecture:** `generationNumber` stays a materialized column, now `NOT NULL`. A single recompute helper (`recomputeGenerations`) is the source of truth, invoked by `create`/`addFamilyRelationship`/`removeFamilyRelationship`/`addSocialRelationship`/`update`. A Prisma data migration backfills existing rows (mirroring the helper) then sets `NOT NULL`. The detail-page `IdentitySection` renders generation read-only for derived sims and an editable select for roots. The chronicle/lineage rendering layer is untouched: its hand-defined `number | null` types absorb the schema change.

**Tech Stack:** Next.js 16, Prisma 7 (Postgres), tRPC, React Hook Form, Vitest (jsdom + node/DB), React Testing Library.

**Branch:** Work on `feat/editable-sim-generation`, **stacked on `feat/romantic-status-model`** (it edits `sims.ts`/`sims.test.ts`/`derive.ts`, which this plan also touches). Use `but move feat/editable-sim-generation feat/romantic-status-model` to stack. Resolve any conflicts with a 3-way merge — never `--ours`/`--theirs`.

**Pre-flight context (read before starting):**
- `docs/superpowers/specs/2026-06-09-editable-sim-generation-design.md` — the spec.
- The column is `Sim.generationNumber` → DB column `"generationNumber"` in table `"sims"`. Parent→child edges live in `"family_relationships"` (`"parentId"`, `"childId"`).
- Never use `cd`; run commands from the repo root with explicit paths.
- No lint/TS suppressions. After each task run `npx tsc --noEmit` and `npm run lint`.

---

## Task 1: Generation helper + recompute orchestration

**Files:**
- Create: `src/server/lib/generation.ts`
- Create (test): `src/server/lib/generation.test.ts`

This is pure-logic + a DB orchestration mirrored by the migration. Build it first so every later task can call it.

- [ ] **Step 1: Write the failing test**

Create `src/server/lib/generation.test.ts`:

```ts
import { authedCaller } from '@/test/caller'
import { createTestUser, cleanupUser, createTestLegacy, createTestSim } from '@/test/helpers'
import { db } from '@/server/db'
import { FamilyRelationshipType } from '@prisma/client'
import { deriveGeneration, recomputeGenerations } from './generation'

describe('deriveGeneration', () => {
  it('is one greater than the highest parent generation', () => {
    expect(deriveGeneration([1])).toBe(2)
    expect(deriveGeneration([2, 4, 3])).toBe(5)
  })
})

describe('recomputeGenerations', () => {
  let userId: string
  let legacyId: string

  beforeEach(async () => {
    ;({ id: userId } = await createTestUser())
    const legacy = await createTestLegacy(userId)
    legacyId = legacy.id
  })
  afterEach(async () => { await cleanupUser(userId) })

  it('backfills a null root to the legacy latest and derives the chain to max+1', async () => {
    // grandparent (root, gen 3) -> parent (derived) -> child (derived)
    const gp = await createTestSim(legacyId, { firstName: 'GP', generationNumber: 3 })
    const partner = await createTestSim(legacyId, { firstName: 'Partner', generationNumber: null })
    const parent = await createTestSim(legacyId, { firstName: 'Parent', generationNumber: null })
    const child = await createTestSim(legacyId, { firstName: 'Child', generationNumber: null })
    await db.familyRelationship.createMany({
      data: [
        { parentId: gp.id, childId: parent.id, type: FamilyRelationshipType.BIOLOGICAL },
        { parentId: parent.id, childId: child.id, type: FamilyRelationshipType.BIOLOGICAL },
      ],
    })

    await db.$transaction((tx) => recomputeGenerations(tx, legacyId))

    const rows = await db.sim.findMany({ where: { legacyId }, select: { id: true, generationNumber: true } })
    const gen = new Map(rows.map((r) => [r.id, r.generationNumber]))
    expect(gen.get(gp.id)).toBe(3)         // root kept
    expect(gen.get(partner.id)).toBe(3)    // null root -> legacy latest (3)
    expect(gen.get(parent.id)).toBe(4)     // derived: max(3)+1
    expect(gen.get(child.id)).toBe(5)      // derived: max(4)+1
  })

  it('uses the highest parent when parents differ', async () => {
    const p1 = await createTestSim(legacyId, { firstName: 'P1', generationNumber: 2 })
    const p2 = await createTestSim(legacyId, { firstName: 'P2', generationNumber: 4 })
    const child = await createTestSim(legacyId, { firstName: 'C', generationNumber: 99 })
    await db.familyRelationship.createMany({
      data: [
        { parentId: p1.id, childId: child.id, type: FamilyRelationshipType.BIOLOGICAL },
        { parentId: p2.id, childId: child.id, type: FamilyRelationshipType.BIOLOGICAL },
      ],
    })

    await db.$transaction((tx) => recomputeGenerations(tx, legacyId))

    const c = await db.sim.findUnique({ where: { id: child.id } })
    expect(c?.generationNumber).toBe(5) // max(2,4)+1
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/server/lib/generation.test.ts`
Expected: FAIL — `deriveGeneration`/`recomputeGenerations` not exported (module not found).

- [ ] **Step 3: Write the implementation**

Create `src/server/lib/generation.ts`:

```ts
import type { Prisma, PrismaClient } from '@prisma/client'

/** Transaction client accepted by recomputeGenerations (also satisfied by the base client). */
type Tx = Prisma.TransactionClient | PrismaClient

/**
 * A derived sim's generation: one greater than the highest parent generation.
 * Callers pass the non-null generations of the sim's parents (at least one).
 */
export function deriveGeneration(parentGenerations: number[]): number {
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
export async function recomputeGenerations(tx: Tx, legacyId: string): Promise<void> {
  const sims = await tx.sim.findMany({
    where: { legacyId },
    select: { id: true, generationNumber: true },
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
  tx: Tx,
  sims: { id: string; generationNumber: number | null }[],
  gen: Map<string, number | null>,
): Promise<void> {
  for (const s of sims) {
    const next = gen.get(s.id)
    if (next != null && next !== s.generationNumber) {
      await tx.sim.update({ where: { id: s.id }, data: { generationNumber: next } })
    }
  }
}
```

- [ ] **Step 4: Update the test helper so it can seed sims (needed by the test above)**

This is also a forced change for the `NOT NULL` migration. In `src/test/helpers.ts`, `createTestSim` currently inserts `generationNumber: overrides.generationNumber ?? null`. Keep the override (the helper must still be able to seed `null` for recompute/backfill tests, since those run before the column is non-null in their own legacy rows is impossible — instead default to 1). Change so the default is `1` but an explicit `null` override is still passed through:

Replace lines 59 and 66 region:

```ts
    generationNumber?: number | null
  } = {},
) {
  return db.sim.create({
    data: {
      legacyId,
      householdId: overrides.householdId ?? null,
      generationNumber:
        overrides.generationNumber === undefined ? 1 : overrides.generationNumber,
      firstName: overrides.firstName ?? 'Test',
```

> Note: the column is still nullable during Task 1, so seeding `generationNumber: null` works now and exercises the null-root backfill branch of `recomputeGenerations`. Once the column is `NOT NULL` (Task 2), inserting `null` fails at the DB — Task 2 Step 5 updates this one test to seed roots at explicit values, and Task 2 Step 6 covers the null-backfill behavior at the migration level. No action needed here beyond the helper change.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/server/lib/generation.test.ts`
Expected: PASS (both describes).

- [ ] **Step 6: Validate**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
but status -fv
but commit feat/editable-sim-generation -m "feat(sims): generation derivation + recomputeGenerations helper" --changes <ids for generation.ts, generation.test.ts, helpers.ts>
```

---

## Task 2: Schema + data migration — `Sim.generationNumber` → `NOT NULL`

**Files:**
- Modify: `prisma/schema.prisma:400`
- Create: `prisma/migrations/20260609160000_sim_generation_not_null/migration.sql`
- Delete: `prisma/backfill-generations.ts` (superseded; unreferenced; min-based)
- Adjust: `src/server/lib/generation.test.ts` (per Task 1 Step 4 note)

- [ ] **Step 1: Edit the schema**

In `prisma/schema.prisma`, the `Sim` model line 400 is:

```prisma
  generationNumber  Int?
```

Change to:

```prisma
  generationNumber  Int
```

Leave the two other `generationNumber Int?` fields (lines ~573, ~628 — `ChallengePhase` etc.) **unchanged**.

- [ ] **Step 2: Write the migration SQL**

Create `prisma/migrations/20260609160000_sim_generation_not_null/migration.sql`:

```sql
-- Backfill generationNumber so the column can become NOT NULL.
-- Mirrors recomputeGenerations (src/server/lib/generation.ts):
--   roots keep their value (null roots take the legacy's current max, else 1),
--   derived sims relax to max(parent generation) + 1 to a fixpoint.

-- 1. Null roots (sims with no parent edge) -> legacy's current max gen, else 1.
UPDATE "sims" s
SET "generationNumber" = COALESCE(
  (SELECT MAX(s2."generationNumber") FROM "sims" s2 WHERE s2."legacyId" = s."legacyId"),
  1
)
WHERE s."generationNumber" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "family_relationships" f WHERE f."childId" = s."id"
  );

-- 2. Relax derived sims to max(parent generation) + 1, looping to a fixpoint.
--    Also normalizes any historically min-based values to the new max rule.
DO $$
DECLARE
  changed integer;
BEGIN
  LOOP
    UPDATE "sims" c
    SET "generationNumber" = sub.maxgen + 1
    FROM (
      SELECT f."childId" AS child_id, MAX(p."generationNumber") AS maxgen
      FROM "family_relationships" f
      JOIN "sims" p ON p."id" = f."parentId"
      WHERE p."generationNumber" IS NOT NULL
      GROUP BY f."childId"
    ) sub
    WHERE c."id" = sub.child_id
      AND (c."generationNumber" IS NULL OR c."generationNumber" <> sub.maxgen + 1);
    GET DIAGNOSTICS changed = ROW_COUNT;
    EXIT WHEN changed = 0;
  END LOOP;
END $$;

-- 3. Safety net: any sim still null (orphan chain with no resolvable parent) -> 1.
UPDATE "sims" SET "generationNumber" = 1 WHERE "generationNumber" IS NULL;

-- 4. Enforce the invariant.
ALTER TABLE "sims" ALTER COLUMN "generationNumber" SET NOT NULL;
```

- [ ] **Step 3: Delete the superseded backfill script**

Confirm it is unreferenced, then delete:

```bash
grep -rn "backfill-generations" /Users/beatka/Projects/simstrack-526/package.json /Users/beatka/Projects/simstrack-526/AGENTS.md /Users/beatka/Projects/simstrack-526/src /Users/beatka/Projects/simstrack-526/scripts
rm /Users/beatka/Projects/simstrack-526/prisma/backfill-generations.ts
```

Expected: grep prints nothing (unreferenced); file removed.

- [ ] **Step 4: Apply the migration to the dev + test databases**

The test DB is rebuilt by `db:test:setup` (baked consent). Apply and regenerate:

```bash
PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION="Standing user consent to reset the local simstrack_test database via this test-only script (pinned to .env.test)." node --env-file=.env.test ./node_modules/.bin/prisma migrate reset --force
npx prisma generate
```

Expected: migration applies cleanly; client regenerated with `generationNumber: number`.

- [ ] **Step 5: Adjust the Task 1 recompute test for the non-null column**

In `src/server/lib/generation.test.ts`, the first recompute test seeds a null root (`Partner`, `generationNumber: null`). With the column now `NOT NULL`, that insert fails. Change that one sim to an explicit value and assert the derived chain (the null-root backfill is now covered by the migration test in Step 6):

```ts
    const partner = await createTestSim(legacyId, { firstName: 'Partner', generationNumber: 1 })
```
and update its assertion:
```ts
    expect(gen.get(partner.id)).toBe(1)    // root kept
```
Also change `parent` and `child` seeds from `generationNumber: null` to `generationNumber: 1` (any value — recompute overwrites derived sims); their assertions (4 and 5) stay.

- [ ] **Step 6: Write a migration-behavior test (mirrors the SQL on a fresh dataset)**

Because the test DB has no rows, exercise the *algorithm* via a node test that seeds rows then calls `recomputeGenerations` (the SQL mirror). Add to `src/server/lib/generation.test.ts`:

```ts
  it('normalizes a min-based value to max+1 (migration parity)', async () => {
    const p1 = await createTestSim(legacyId, { firstName: 'P1', generationNumber: 1 })
    const p2 = await createTestSim(legacyId, { firstName: 'P2', generationNumber: 3 })
    // Simulate legacy min-based data: child stored as min(1,3)+1 = 2.
    const child = await createTestSim(legacyId, { firstName: 'C', generationNumber: 2 })
    await db.familyRelationship.createMany({
      data: [
        { parentId: p1.id, childId: child.id, type: FamilyRelationshipType.BIOLOGICAL },
        { parentId: p2.id, childId: child.id, type: FamilyRelationshipType.BIOLOGICAL },
      ],
    })
    await db.$transaction((tx) => recomputeGenerations(tx, legacyId))
    expect((await db.sim.findUnique({ where: { id: child.id } }))?.generationNumber).toBe(4)
  })
```

- [ ] **Step 7: Run tests**

Run: `npm test -- src/server/lib/generation.test.ts`
Expected: PASS.

- [ ] **Step 8: Validate**

Run: `npx tsc --noEmit`
Expected: errors ONLY in files handled by Tasks 3–5 (sims.ts router internals, sims.test.ts, trackerComputation.test.ts, scripts/backfill-uploads-to-s3.test.ts). These are expected now and fixed in later tasks. Note them; do not fix here.

- [ ] **Step 9: Commit**

```bash
but commit feat/editable-sim-generation -m "feat(db): make Sim.generationNumber NOT NULL with backfilling data migration

Drops the legacy backfill-generations.ts script (superseded)." --changes <ids for schema.prisma, migration.sql, deleted backfill-generations.ts, generation.test.ts>
```

---

## Task 3: Route generation derivation through recompute in the sims router

**Files:**
- Modify: `src/server/routers/sims.ts` (`create`, `addFamilyRelationship`, `removeFamilyRelationship`, `addSocialRelationship`, `getById`)
- Modify (tests): `src/server/routers/sims.test.ts`

### 3a. `create`

- [ ] **Step 1: Update the failing tests first**

In `src/server/routers/sims.test.ts`, change the multi-parent create test (named **"uses min parent generationNumber when multiple parents"**):

```ts
  it('uses max parent generationNumber when multiple parents', async () => {
    const parent1 = await createTestSim(legacyId, { firstName: 'P1' })
    const parent2 = await createTestSim(legacyId, { firstName: 'P2' })
    await db.sim.update({ where: { id: parent1.id }, data: { generationNumber: 2 } })
    await db.sim.update({ where: { id: parent2.id }, data: { generationNumber: 3 } })
    const result = await authedCaller(userId).sims.create({
      legacyId, firstName: 'Child', lastName: 'Smith', gender: Gender.FEMALE,
      parentIds: [parent1.id, parent2.id],
    })
    const record = await db.sim.findUnique({ where: { id: result.id } })
    expect(record?.generationNumber).toBe(4) // max(2,3)+1
  })
```

Add a test for the parentless-defaults-to-latest behavior:

```ts
  it('a later parentless sim defaults to the legacy latest generation', async () => {
    const caller = authedCaller(userId)
    await caller.sims.create({ legacyId, firstName: 'Founder', lastName: 'X', gender: Gender.FEMALE }) // gen 1
    const heir = await createTestSim(legacyId, { firstName: 'Heir', generationNumber: 3 })
    void heir
    const newcomer = await caller.sims.create({ legacyId, firstName: 'Townie', lastName: 'Y', gender: Gender.MALE })
    const record = await db.sim.findUnique({ where: { id: newcomer.id } })
    expect(record?.generationNumber).toBe(3) // legacy latest
  })
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/server/routers/sims.test.ts -t "max parent"`
Expected: FAIL (current code uses min / no latest default).

- [ ] **Step 3: Implement create changes**

In `src/server/routers/sims.ts`, replace the generation-derivation block (currently lines 59–80, the `let generationNumber = …` through the `willBeFounder` assignment) with:

```ts
      let generationNumber = input.generationNumber ?? null
      let parents: { id: string; generationNumber: number | null }[] = []
      if (input.parentIds?.length) {
        parents = await ctx.db.sim.findMany({
          where: { id: { in: input.parentIds }, legacyId: input.legacyId },
          select: { id: true, generationNumber: true },
        })
        if (parents.length !== input.parentIds.length) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'One or more parentIds do not belong to this legacy' })
        }
        // A sim with parents is derived; derivation always wins.
        const parentGens = parents.map((p) => p.generationNumber).filter((g): g is number => g !== null)
        generationNumber = parentGens.length > 0 ? deriveGeneration(parentGens) : null
      }

      // A legacy with no founder adopts its first parentless sim as the founder.
      const willBeFounder = !legacy.founderSimId && parents.length === 0

      if (generationNumber === null) {
        // Parentless sims (founders, partners, separate subtree roots) are roots:
        // default to the legacy's current latest generation, or 1 when empty.
        const agg = await ctx.db.sim.aggregate({
          where: { legacyId: input.legacyId },
          _max: { generationNumber: true },
        })
        generationNumber = agg._max.generationNumber ?? 1
      }
```

Add the import at the top of the file (merge into existing imports):

```ts
import { deriveGeneration, recomputeGenerations } from '../lib/generation'
```

The `tx.sim.create({ data: { … generationNumber, … } })` call (was line 95) now always passes a non-null number — no other change needed there. Keep the founder-claim block as-is.

- [ ] **Step 4: Run create tests**

Run: `npm test -- src/server/routers/sims.test.ts -t "founder"` and `-t "parent"` and `-t "max parent"`
Expected: PASS (founder gen 1; derived = max+1; parentless newcomer = latest).

### 3b. `addFamilyRelationship`

- [ ] **Step 5: Update the failing tests**

In `sims.test.ts`, rewrite/rename **"does not override child generationNumber if already set"** → it now DOES override (a sim that gains a parent is derived):

```ts
  it('overrides child generationNumber to max+1 when a parent is added', async () => {
    await db.sim.update({ where: { id: parentId }, data: { generationNumber: 1 } })
    await db.sim.update({ where: { id: childId }, data: { generationNumber: 5 } })
    await authedCaller(userId).sims.addFamilyRelationship({
      parentId, childId, type: FamilyRelationshipType.BIOLOGICAL,
    })
    const record = await db.sim.findUnique({ where: { id: childId } })
    expect(record?.generationNumber).toBe(2) // derived: max(1)+1, prior value discarded
  })
```

Rewrite/rename **"uses minimum parent gen when multiple parents already exist"** → max, and assert the cascade reaches a grandchild:

```ts
  it('uses max parent gen and cascades to descendants when a parent is added', async () => {
    const { legacyId } = await db.sim.findUniqueOrThrow({ where: { id: parentId }, select: { legacyId: true } })
    const existingParent = await createTestSim(legacyId, { firstName: 'OtherParent', generationNumber: 3 })
    await db.sim.update({ where: { id: parentId }, data: { generationNumber: 2 } })
    const grandchild = await createTestSim(legacyId, { firstName: 'GC', generationNumber: 99 })
    await db.familyRelationship.createMany({
      data: [
        { parentId: existingParent.id, childId, type: FamilyRelationshipType.BIOLOGICAL },
        { parentId: childId, childId: grandchild.id, type: FamilyRelationshipType.BIOLOGICAL },
      ],
    })
    await authedCaller(userId).sims.addFamilyRelationship({
      parentId, childId, type: FamilyRelationshipType.BIOLOGICAL,
    })
    expect((await db.sim.findUnique({ where: { id: childId } }))?.generationNumber).toBe(4)      // max(2,3)+1
    expect((await db.sim.findUnique({ where: { id: grandchild.id } }))?.generationNumber).toBe(5) // cascaded
  })
```

The existing test **"derives child generationNumber from parent when child has no generationNumber"** stays valid (parent gen 1 → child 2) — leave it, but its setup uses a child whose generation is now non-null (from `createTestSim` default 1). The assertion `toBe(2)` still holds. The transaction-rollback test **"does not persist the relationship when the generation derivation write fails"** stays valid (recompute's `tx.sim.update` triggers the `failingDb('sim','update')` mock). Leave it.

- [ ] **Step 6: Implement addFamilyRelationship**

In `sims.ts`, replace the transaction body of `addFamilyRelationship` (currently the `$transaction` that creates the edge and conditionally derives, lines ~544–566) with:

```ts
      await ctx.db.$transaction(async (tx) => {
        await tx.familyRelationship.create({
          data: { parentId: input.parentId, childId: input.childId, type: input.type },
        })
        await recomputeGenerations(tx, child.legacyId)
      })
      void recomputeLegacyTrackers(ctx.db, child.legacyId)
      return ctx.db.familyRelationship.findUniqueOrThrow({
        where: { parentId_childId: { parentId: input.parentId, childId: input.childId } },
      })
```

(`parent` and `child` are already fetched above via `assertSimsOwned`.) Remove the now-unused `derivedGeneration` logic.

- [ ] **Step 7: Run**

Run: `npm test -- src/server/routers/sims.test.ts -t "parent is added"` and `-t "cascades"`
Expected: PASS.

### 3c. `removeFamilyRelationship`

- [ ] **Step 8: Update the failing tests**

Rewrite/rename **"clears child generationNumber when all parents are removed"** → it now RETAINS the value (becomes a root):

```ts
  it('retains the child generation as a root value when the last parent is removed', async () => {
    await db.sim.update({ where: { id: parentId }, data: { generationNumber: 1 } })
    await db.sim.update({ where: { id: childId }, data: { generationNumber: 2 } })
    await db.familyRelationship.create({
      data: { parentId, childId, type: FamilyRelationshipType.BIOLOGICAL },
    })
    await authedCaller(userId).sims.removeFamilyRelationship({ parentId, childId })
    const record = await db.sim.findUnique({ where: { id: childId } })
    expect(record?.generationNumber).toBe(2) // kept; child is now a root
  })
```

The test **"updates child generationNumber after removing one parent when another remains"** (parents gen 1 & 3, child 2, remove the gen-1 parent) now expects `max(3)+1 = 4`. Verify it already asserts `4` (it does) — leave as-is. The rollback test **"keeps the relationship when the generation recompute write fails on removal"** stays valid — leave it.

- [ ] **Step 9: Implement removeFamilyRelationship**

The procedure already destructures `const [, child] = await assertSimsOwned(ctx.db, [input.parentId, input.childId], userId)`. Replace the `$transaction` body (lines ~576–600) with:

```ts
      await ctx.db.$transaction(async (tx) => {
        await tx.familyRelationship.delete({
          where: { parentId_childId: { parentId: input.parentId, childId: input.childId } },
        })
        await recomputeGenerations(tx, child.legacyId)
      })
      void recomputeLegacyTrackers(ctx.db, child.legacyId)
      return { parentId: input.parentId, childId: input.childId }
```

Remove the old `remainingParents`/`newGen`/null-setting logic (this also resolves the `sims.ts:581` non-null type error). If the procedure's return type is consumed anywhere expecting the deleted row, check callers; the family editor uses the mutation only for cache invalidation, so returning the ids is sufficient. Verify with `npx tsc --noEmit`.

- [ ] **Step 10: Run**

Run: `npm test -- src/server/routers/sims.test.ts -t "removing one parent"` and `-t "retains the child generation"`
Expected: PASS.

### 3d. `addSocialRelationship` (partner adoption)

- [ ] **Step 11: Update the failing test**

The existing **"does not persist the relationship when the partner generation backfill fails"** uses two roots (both `createTestSim`, one set to gen 2). Under partner adoption, adoption fires only when exactly one sim is a root and the other is **derived**. Rewrite it so simB is derived (has a parent) and simA is the root partner whose adoption write fails:

```ts
  it('does not persist the relationship when the partner adoption write fails', async () => {
    // simB is derived (gen 2 via a parent); simA is a root that should adopt gen 2.
    const parent = await createTestSim(
      (await db.sim.findUniqueOrThrow({ where: { id: simBId }, select: { legacyId: true } })).legacyId,
      { firstName: 'ParentOfB', generationNumber: 1 },
    )
    await db.familyRelationship.create({ data: { parentId: parent.id, childId: simBId, type: FamilyRelationshipType.BIOLOGICAL } })
    await db.sim.update({ where: { id: simBId }, data: { generationNumber: 2 } })

    await expect(
      authedCaller(userId, failingDb('sim', 'update')).sims.addSocialRelationship({
        simAId, simBId, romanticStatus: RomanticStatus.DATING,
      })
    ).rejects.toThrow()

    const row = await db.socialRelationship.findUnique({ where: { simAId_simBId: { simAId, simBId } } })
    expect(row).toBeNull()
  })
```

Add a positive adoption test:

```ts
  it('a root partner adopts a derived partner generation', async () => {
    const legacyId = (await db.sim.findUniqueOrThrow({ where: { id: simBId }, select: { legacyId: true } })).legacyId
    const parent = await createTestSim(legacyId, { firstName: 'ParentOfB', generationNumber: 4 })
    await db.familyRelationship.create({ data: { parentId: parent.id, childId: simBId, type: FamilyRelationshipType.BIOLOGICAL } })
    await db.sim.update({ where: { id: simBId }, data: { generationNumber: 5 } })

    await authedCaller(userId).sims.addSocialRelationship({ simAId, simBId, romanticStatus: RomanticStatus.MARRIED })

    expect((await db.sim.findUnique({ where: { id: simAId } }))?.generationNumber).toBe(5)
  })
```

- [ ] **Step 12: Implement addSocialRelationship**

In `sims.ts`, replace the `noGenSim` computation and the in-transaction generation write (lines ~620–642) with parent-aware adoption:

```ts
      const userId = ctx.session.user.id
      const [simA, simB] = await assertSimsOwned(ctx.db, [input.simAId, input.simBId], userId)
      const [normalA, normalB] = [input.simAId, input.simBId].sort()

      // Partner adoption: when exactly one sim is a root (no parents) and the
      // other is derived (has parents), the root adopts the derived sim's
      // generation. Overridable later via the detail page.
      const [aParents, bParents] = await Promise.all([
        ctx.db.familyRelationship.count({ where: { childId: simA.id } }),
        ctx.db.familyRelationship.count({ where: { childId: simB.id } }),
      ])
      const aIsRoot = aParents === 0
      const bIsRoot = bParents === 0
      let adopt: { id: string; generationNumber: number } | null = null
      if (aIsRoot && !bIsRoot) adopt = { id: simA.id, generationNumber: simB.generationNumber }
      else if (bIsRoot && !aIsRoot) adopt = { id: simB.id, generationNumber: simA.generationNumber }

      const created = await ctx.db.$transaction(async (tx) => {
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
        if (adopt) {
          await tx.sim.update({ where: { id: adopt.id }, data: { generationNumber: adopt.generationNumber } })
          await recomputeGenerations(tx, simA.legacyId)
        }
        return created
      })
      if (adopt) void recomputeLegacyTrackers(ctx.db, simA.legacyId)
      return created
```

> `simA.generationNumber`/`simB.generationNumber` are now `number` (non-null), so `adopt.generationNumber` is a clean number — no `!` assertion needed.

- [ ] **Step 13: Run**

Run: `npm test -- src/server/routers/sims.test.ts -t "adopt"`
Expected: PASS.

### 3e. `getById` — expose parent generation to the client

- [ ] **Step 14: Implement**

In `sims.ts` `getById`, the `childOf` include selects parent fields. Add `generationNumber`:

```ts
          childOf: {
            include: { parent: { select: { id: true, firstName: true, lastName: true, imageUrl: true, generationNumber: true } } },
          },
```

- [ ] **Step 15: Validate + commit**

Run: `npx tsc --noEmit && npm run lint && npm test -- src/server/routers/sims.test.ts`
Expected: sims.ts and sims.test.ts clean; remaining tsc errors only in trackerComputation.test.ts / backfill-uploads test (Task 5).

```bash
but commit feat/editable-sim-generation -m "feat(sims): derive generation via recompute on family/social mutations; max+1; partner adoption" --changes <ids for sims.ts, sims.test.ts>
```

---

## Task 4: `sims.update` — guard generation editing to root sims

**Files:**
- Modify: `src/server/routers/sims.ts` (`update` input schema + mutation)
- Modify (tests): `src/server/routers/sims.test.ts`

- [ ] **Step 1: Update the failing tests**

The existing **"sims.update accepts generationNumber override"** uses a parentless sim (root) — it stays valid. Add a guard test and remove the obsolete null tests.

Add:

```ts
  it('sims.update rejects a generation edit on a sim with parents', async () => {
    const parent = await createTestSim(legacyId, { firstName: 'P', generationNumber: 1 })
    const child = await createTestSim(legacyId, { firstName: 'C', generationNumber: 2 })
    await db.familyRelationship.create({ data: { parentId: parent.id, childId: child.id, type: FamilyRelationshipType.BIOLOGICAL } })
    await expect(
      authedCaller(userId).sims.update({ id: child.id, generationNumber: 7 }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('editing a root generation cascades to descendants', async () => {
    const root = await createTestSim(legacyId, { firstName: 'Root', generationNumber: 1 })
    const child = await createTestSim(legacyId, { firstName: 'Child', generationNumber: 2 })
    await db.familyRelationship.create({ data: { parentId: root.id, childId: child.id, type: FamilyRelationshipType.BIOLOGICAL } })
    await authedCaller(userId).sims.update({ id: root.id, generationNumber: 4 })
    expect((await db.sim.findUnique({ where: { id: root.id } }))?.generationNumber).toBe(4)
    expect((await db.sim.findUnique({ where: { id: child.id } }))?.generationNumber).toBe(5)
  })
```

Delete these now-obsolete tests/blocks (the never-null model removes their scenarios):
- `it('does not clear the previous cohort when the sim moves to a null generation', …)`
- `it('allows multiple heirs with no generation (null is not a cohort)', …)`
- the entire `describe('sims — isHeir with null generationNumber', …)` block.

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/server/routers/sims.test.ts -t "rejects a generation edit"`
Expected: FAIL (no guard yet).

- [ ] **Step 3: Implement the input-schema change**

In `sims.ts` `update` input (line ~382), drop `.nullable()`:

```ts
        generationNumber: z.number().int().min(1).optional(),
```

- [ ] **Step 4: Implement the guard + cascade**

In the `update` mutation, after `const sim = await assertSimOwned(...)` and before the transaction, add:

```ts
      if (input.generationNumber !== undefined) {
        const parentCount = await ctx.db.familyRelationship.count({ where: { childId: input.id } })
        if (parentCount > 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Generation is derived from parents and cannot be set directly',
          })
        }
      }
```

After the existing `$transaction(...)` returns `result`, add a cascade when the (root) generation changed. Replace the existing recompute trigger block:

```ts
      const recomputeFields = ['generationNumber', 'lifeStage', 'isHeir', 'causeOfDeath', 'occultType'] as const
      const needsRecompute = recomputeFields.some((f) => input[f] !== undefined)
      if (input.generationNumber !== undefined) {
        await ctx.db.$transaction((tx) => recomputeGenerations(tx, result.legacyId))
      }
      if (needsRecompute) void recomputeLegacyTrackers(ctx.db, result.legacyId)
      return result
```

> The guard ensures only roots reach the `data: fields` write, and the column is non-null so `fields.generationNumber` is `number | undefined` — the `sims.ts:419` type error is resolved by the `.nullable()` removal in Step 3.

- [ ] **Step 5: Run + validate**

Run: `npm test -- src/server/routers/sims.test.ts` then `npx tsc --noEmit && npm run lint`
Expected: all sims.test.ts pass; sims.ts clean.

- [ ] **Step 6: Commit**

```bash
but commit feat/editable-sim-generation -m "feat(sims): update guards generation edits to root sims; cascade on root change" --changes <ids for sims.ts, sims.test.ts>
```

---

## Task 5: Fix remaining test creates for the non-null column

**Files:**
- Modify: `src/server/lib/trackerComputation.test.ts`
- Modify: `scripts/backfill-uploads-to-s3.test.ts`

- [ ] **Step 1: Add generationNumber to trackerComputation.test.ts creates**

Seven `db.sim.create` calls omit `generationNumber` (now required). Add `generationNumber: 1` to each. They are the creates for sims named with `lastName: 'B'` (lines ~106, ~117) and the `firstName: 'A'/'B'` pairs at the relationship/social tests (lines ~519, ~528, ~573, ~574, ~620). Verify the full set with:

```bash
grep -nE "db.sim.create\(\{ data: \{[^}]*\} \}\)" /Users/beatka/Projects/simstrack-526/src/server/lib/trackerComputation.test.ts | grep -v "generationNumber"
```

For each line printed, insert `generationNumber: 1, ` into the `data: { … }` object (e.g. after `lifeStage: 'YOUNG_ADULT'`). Example — change:

```ts
    await db.sim.create({ data: { legacyId, firstName: 'A', lastName: 'B', gender: 'FEMALE', lifeStage: 'YOUNG_ADULT' } })
```
to:
```ts
    await db.sim.create({ data: { legacyId, firstName: 'A', lastName: 'B', gender: 'FEMALE', lifeStage: 'YOUNG_ADULT', generationNumber: 1 } })
```

Re-run the grep; expected: no output (all creates now provide it).

- [ ] **Step 2: Fix the backfill-uploads test create**

In `scripts/backfill-uploads-to-s3.test.ts` (~line 63) the `db.sim.create({ data: { firstName, lastName, legacyId, lifeStage, gender, imageUrl } })` omits `generationNumber`. Add `generationNumber: 1` to the `data` object.

- [ ] **Step 3: Validate**

Run: `npx tsc --noEmit && npm run lint`
Expected: **zero** errors across the whole project.

Run: `npm test -- src/server/lib/trackerComputation.test.ts scripts/backfill-uploads-to-s3.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
but commit feat/editable-sim-generation -m "test: provide generationNumber for non-null Sim column in seed creates" --changes <ids for trackerComputation.test.ts, backfill-uploads-to-s3.test.ts>
```

---

## Task 6: Detail-page generation control (read-only derived, editable root)

**Files:**
- Modify: `src/app/app/legacies/[slug]/sims/[id]/sim-detail-client.tsx` (thread props)
- Modify: `src/app/app/legacies/[slug]/sims/[id]/identity-section.tsx` (the control)
- Create (test): add cases to `src/app/app/legacies/[slug]/sims/[id]/__tests__/identity-section.test.tsx`

- [ ] **Step 1: Thread generation + parent info into the component types**

In `sim-detail-client.tsx`, the `Props.sim` shape needs `generationNumber` and the `childOf.parent` needs `generationNumber`. Update the `sim` type:

```ts
    occultType: string | null
    isHeir: boolean
    generationNumber: number
    causeOfDeath: CauseOfDeath | null
```
and:
```ts
    childOf: { parent: { id: string; firstName: string; lastName: string; imageUrl: string | null; generationNumber: number }; type: string }[]
```

Pass parent count + generation into `IdentitySection`:

```tsx
        <IdentitySection sim={sim} hasParents={sim.childOf.length > 0} onLifeStageChange={setCurrentLifeStage} />
```

- [ ] **Step 2: Write failing component tests**

Add to `src/app/app/legacies/[slug]/sims/[id]/__tests__/identity-section.test.tsx` (follow the file's existing tRPC/router mocks). Two cases:

```tsx
  it('shows generation read-only for a sim with parents', () => {
    render(<IdentitySection sim={{ ...baseSim, generationNumber: 3 }} hasParents />)
    // The read-only label is present; no generation combobox to change it.
    expect(screen.getByText(/Gen III/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Generation/i })).not.toBeInTheDocument()
  })

  it('shows an editable generation select for a root sim', async () => {
    render(<IdentitySection sim={{ ...baseSim, generationNumber: 1 }} hasParents={false} />)
    const trigger = screen.getByRole('button', { name: /Generation/i })
    expect(trigger).toBeInTheDocument()
  })
```

> `baseSim` mirrors the existing test's `SimProp` fixture; add `generationNumber` to it. Use the file's existing `roman` expectations style (`Gen III`). If the existing tests construct `sim` inline, add `generationNumber` to those fixtures too (now required).

- [ ] **Step 3: Run to verify failure**

Run: `npm test -- src/app/app/legacies/[slug]/sims/[id]/__tests__/identity-section.test.tsx`
Expected: FAIL (no generation UI / prop not accepted).

- [ ] **Step 4: Implement the control**

In `identity-section.tsx`:

Extend the `SimProp` interface and component signature:

```ts
interface SimProp {
  id: string
  firstName: string
  lastName: string
  gender: string
  lifeStage: string
  pronounSubject: string | null
  pronounObject: string | null
  pronounPossessive: string | null
  imageUrl: string | null
  occultType: string | null
  isHeir: boolean
  generationNumber: number
}

export function IdentitySection({ sim, hasParents, onLifeStageChange }: { sim: SimProp; hasParents: boolean; onLifeStageChange?: (ls: LifeStage) => void }) {
```

Import the roman helper used elsewhere (match how `sim-inspector.tsx`/`hero.tsx` import `roman` — likely `import { roman } from '<lib>/roman'`; reuse the same path). Add a `GenerationField` to the `metaRow`, after `<HeirToggle … />`:

```tsx
          <GenerationField sim={sim} hasParents={hasParents} onSave={save} />
```

Add the component at the bottom of the file:

```tsx
/**
 * Generation: read-only for derived sims (has parents — value is max(parent)+1
 * and maintained by the server), an editable chip select for root sims.
 */
function GenerationField({
  sim,
  hasParents,
  onSave,
}: {
  sim: SimProp
  hasParents: boolean
  onSave: (fields: { id: string; generationNumber: number }) => Promise<unknown>
}) {
  const [value, setValue] = useState(sim.generationNumber)
  const [error, setError] = useState('')

  if (hasParents) {
    return <span className={styles.genReadOnly}>Gen {roman(sim.generationNumber)}</span>
  }

  const ceiling = Math.max(10, value)
  const options = Array.from({ length: ceiling }, (_, i) => i + 1)

  async function change(next: string) {
    const n = Number(next)
    const prev = value
    setValue(n)
    try {
      await onSave({ id: sim.id, generationNumber: n })
      setError('')
    } catch {
      setValue(prev)
      setError('Failed to save')
    }
  }

  return (
    <span className={styles.genField}>
      <Combobox
        value={String(value)}
        onChange={change}
        variant="chip"
        aria-label="Generation"
      >
        {options.map((g) => (
          <Combobox.Item key={g} value={String(g)}>Gen {roman(g)}</Combobox.Item>
        ))}
      </Combobox>
      {error && <span className={styles.inlineError}>{error}</span>}
    </span>
  )
}
```

Add minimal CSS to `page.module.css` for `.genReadOnly` / `.genField` mirroring the existing chip/meta styles (e.g. reuse `.rowMeta`/chip spacing — match the surrounding `metaRow` items; do not introduce hardcoded colors — use existing tokens). If a suitable class already exists for inline read-only meta, reuse it instead of adding one.

- [ ] **Step 5: Run component tests**

Run: `npm test -- src/app/app/legacies/[slug]/sims/[id]/__tests__/identity-section.test.tsx`
Expected: PASS.

- [ ] **Step 6: Confirm the page passes the new props**

The server component that renders `SimDetailClient` (`src/app/app/legacies/[slug]/sims/[id]/page.tsx`) already passes the full `getById` sim (which now includes `generationNumber` and `childOf[].parent.generationNumber`). Verify `npx tsc --noEmit` is clean; if the page maps the sim explicitly, ensure `generationNumber` flows through.

- [ ] **Step 7: Validate + commit**

Run: `npx tsc --noEmit && npm run lint`

```bash
but commit feat/editable-sim-generation -m "feat(sims): generation control on detail page — read-only derived, editable root" --changes <ids for sim-detail-client.tsx, identity-section.tsx, page.module.css, identity-section.test.tsx>
```

---

## Task 7: Remove `backfill:uploads` from package.json

**Files:**
- Modify: `package.json` (remove the `backfill:uploads` script)
- Modify: `AGENTS.md` (update the documented invocation)

- [ ] **Step 1: Remove the npm script**

In `package.json`, delete the `"backfill:uploads": "tsx scripts/backfill-uploads-to-s3.ts"` line (currently line 23) and remove the trailing comma from the now-last script entry (`"test:e2e:ui": …`) so the JSON stays valid.

- [ ] **Step 2: Update AGENTS.md**

In `AGENTS.md`, the "Local Object Storage" section documents `npm run backfill:uploads`. Replace those invocations with the direct form:

```
tsx scripts/backfill-uploads-to-s3.ts -- --dry-run   # preview
tsx scripts/backfill-uploads-to-s3.ts                # apply
```

- [ ] **Step 3: Validate**

Run: `node -e "require('/Users/beatka/Projects/simstrack-526/package.json')"` (parses → valid JSON) and `npm run lint`.

- [ ] **Step 4: Commit**

```bash
but commit feat/editable-sim-generation -m "chore: drop backfill:uploads npm script; run scripts directly" --changes <ids for package.json, AGENTS.md>
```

---

## Final verification

- [ ] **Full type + lint**

```bash
npx tsc --noEmit
npm run lint
```
Expected: zero errors/warnings.

- [ ] **Full test suite**

```bash
npm test
```
Expected: all pass. Watch for: generation derivation (max+1), update guard, partner adoption, cascade tests, and that the obsolete null-gen tests are gone (not failing).

- [ ] **E2E**

```bash
npm run test:e2e
```
Expected: existing sim journeys pass (no new spec added). If a leftover dev:test server on 3737 interferes, kill it first.

- [ ] **Manual smoke (optional, via the run skill)**

Sign in (magic link), open a sim with parents → generation shows read-only; open a founder/townie (no parents) → generation select is editable and saving persists after reload; add a parent to a root sim → its generation becomes derived (read-only) and equals max(parent)+1.

- [ ] **Reviews before merge**

Run `/code-review`. Because the UI changed, also run the `design-system-reviewer` agent and the `web-qa-tester` agent on the sim detail page. Address findings; re-run if changes are significant.

- [ ] **Stack + integrate**

Ensure `feat/editable-sim-generation` is stacked on `feat/romantic-status-model` (`but move feat/editable-sim-generation feat/romantic-status-model`). Do not push or open a PR unless the user asks.
