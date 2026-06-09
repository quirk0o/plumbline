# Editable Sim Generation with a Parent-Derived Floor

**Status:** Approved (design) — 2026-06-09
**Surface:** Sim detail page (`identity-section.tsx`) + `sims` router + schema + data migration

---

## Problem

A sim's `generationNumber` is currently nullable, set only at creation (derived from
parents as `min(parentGens) + 1`), and writable freely through `sims.update` with no
validation. There is no UI to view or change it after creation, the derivation rule
lets a child land in the same or an earlier generation than one of its parents, and
generations can be `null`. Null generations break the lineage tree: `layout-rows.ts`
buckets sims into shelves by `generationNumber` and skips nulls, so a null-generation
child collapses onto its parent's shelf.

We want generation to be a faithful, **always-present (non-null)** function of the
family tree, editable only where it is genuinely a free choice.

---

## Model: roots vs. derived sims

`Sim.generationNumber` becomes **`NOT NULL`**. Every sim is exactly one of:

- **Derived sim** — has at least one parent edge (`childOf`). Its generation is
  **`max(parent generations) + 1`**. Not editable in the UI; recomputed automatically
  whenever the tree or any ancestor's generation changes. "Greater than every parent"
  holds by construction.

- **Root sim** — has no parent edges (a founder, a married-in partner, or the root of
  a separate subtree). Its generation is a **free choice**, editable in the UI. The
  cascade never overwrites a root's chosen generation.

**Root default = `latestGeneration(legacy)` = `max(existing generations in the legacy)`,
or `1` when the legacy is empty.** First sim in an empty legacy → Gen 1 (the founder);
a later parentless sim defaults to the current latest generation — a sensible
"contemporary" placement the user can override.

**Partner adoption:** when a romantic/social relationship is created and exactly one of
the two sims is a **root** while the other is **derived** (a fixed lineage member), the
root adopts the derived sim's generation (then the cascade runs). This preserves today's
behavior — a married-in partner takes their partner's generation — and remains
**overridable** afterward since the partner is a root. If both sims are roots or both
derived, generations are left unchanged.

Root-ness is determined at runtime by asking whether the sim has any parent edges.

---

## Storage decision: materialized, recompute-on-write, column `NOT NULL`

`generationNumber` stays a stored column (Option 1 from analysis). Rationale:

- It is **filtered/aggregated in SQL**, not merely read: `trackerComputation.ts`
  builds `where.generationNumber = N`; `households.ts` runs
  `aggregate _max: { generationNumber }`; `sims.update`'s heir logic does
  `updateMany where generationNumber = target`.
- A DB index `@@index([legacyId, generationNumber])` backs generational queries.
- ~15 UI/lib files read `sim.generationNumber` directly.

Computing on the fly would force every SQL-level consumer to load the whole legacy and
compute in app code, kill the index, and require an N+1 traversal for per-sim reads — a
sprawling, higher-risk refactor. The materialized approach confines new complexity to
one recompute helper.

**The column becomes `NOT NULL`.** Because no sim can be null anymore, the ~15 read
sites that branch on `sim.generationNumber === null` (notably `derive.ts`) become dead
code — and under the no-suppressions rule a `number === null` comparison is a TS/ESLint
error — so this change includes cleaning those branches up (see Component 6). `derive.ts`
is also edited by the in-flight `feat/romantic-status-model` branch, so this work
**stacks on that branch** to manage the overlap; conflicts are resolved with a proper
3-way merge, never `--ours`/`--theirs`.

---

## Components

### 1. Generation helper — `src/server/lib/generation.ts` (new)

Small, single-purpose pure functions (no DB):

- `deriveGeneration(parentGenerations: number[]): number` → `max(parentGenerations) + 1`.

The recompute orchestration (below) is the only place that reads/writes the DB.

### 2. Recompute orchestration — `recomputeGenerations(tx, legacyId)`

Lives next to the helper and runs inside the caller's transaction. Small named steps:

1. Load all sims in the legacy (`id`, `generationNumber`) and all family edges.
2. Build a child→parents adjacency map and compute
   `legacyLatest = max(stored generations)` from the **pre-pass** values (so independent
   roots in a freshly-backfilled legacy resolve independently rather than as a cascade).
3. Process sims in **topological order** (ancestors before descendants):
   - **Root** (no parents): keep its current generation; if it is null (only possible
     for pre-backfill data), assign `legacyLatest`. So recompute is the single source of
     truth the migration's SQL mirrors.
   - **Derived**: `generationNumber = deriveGeneration(effective parent generations)`.
4. Persist only the sims whose value actually changed (batched updates).
5. **Cycle guard:** if a cycle is detected, leave the cycle members unchanged and stop.

The whole-legacy pass is cheap at our scale (tens–low hundreds of sims); start with it.

### 3. Schema + data migration — `Sim.generationNumber Int` (`NOT NULL`)

A single, self-contained Prisma migration (hand-authored SQL file, like the existing
`20260609120000_narrow_romantic_status` one — no interactive `migrate dev`/`reset`
needed), in this order so it is correct on any populated database with no out-of-band
steps:

1. **Backfill (data migration).** A PL/pgSQL block that mirrors `recomputeGenerations`:
   - Set each **null root** (no parent edges) to its legacy's current
     `MAX("generationNumber")`, or `1` if the legacy has none.
   - Then iteratively relax derived sims: `UPDATE` each child to
     `MAX(parent "generationNumber") + 1` while any row still differs, looping until no
     rows change (`EXIT WHEN NOT FOUND`). This handles multiple parents, arbitrary depth,
     and normalizes existing `min`-based values to the new `max` rule in one pass. A
     family tree is acyclic, so the loop terminates.
2. **Constraint.** `ALTER TABLE "sims" ALTER COLUMN "generationNumber" SET NOT NULL;`

`prisma/schema.prisma` drops the `?` on `Sim.generationNumber`. Only `Sim` changes —
`ChallengePhase` etc. stay nullable. No DB default is added; all inserts compute a value.
On fresh/CI/test databases the table is empty, so step 1 is a no-op and step 2 just adds
the constraint. The app-level `recomputeGenerations` (Component 2) keeps the invariant
for all live writes thereafter.

**Also:** remove the existing `backfill:uploads` entry from `package.json` (run it
directly via `tsx scripts/backfill-uploads-to-s3.ts` when needed) and update the
`AGENTS.md` reference to match — per the directive that backfills do not belong in
`package.json` scripts.

### 4. `sims` router changes (`src/server/routers/sims.ts`)

- **`create`** — replace inline `Math.min(...) + 1` with the helper. With `parentIds`,
  the sim is derived (derivation wins). Parentless sim defaults to
  `latestGeneration(legacy)` (founder of an empty legacy → 1). Run
  `recomputeGenerations` inside the transaction after creating edges.
- **`update`** — generation editing valid only for **root** sims:
  - Target **has parents** and `generationNumber` present → `BAD_REQUEST`
    ("Generation is derived from parents and cannot be set directly").
  - **Root** → accept a number ≥ 1 (null no longer accepted by the input schema).
  - After a root's generation changes, run `recomputeGenerations`; keep the existing
    `recomputeLegacyTrackers` trigger.
- **`addFamilyRelationship`** — after creating the edge, replace the "only set when null"
  logic with `recomputeGenerations` (child becomes `max+1`, cascading to descendants,
  overriding any prior value).
- **`removeFamilyRelationship`** — after deleting the edge, call `recomputeGenerations`.
  Needed because removing the highest-generation parent **lowers** the child's generation
  (`max(remaining)+1`), which must cascade to the child's descendants. (Today's code
  re-derives only the direct child, never its descendants — a latent staleness bug that
  this fixes.) A child that loses its *last* parent becomes a root and **keeps its last
  computed value** (not nulled) — for that sub-case the recompute is a no-op.
- **`addSocialRelationship`** — replace the null-based seeding with **partner adoption**:
  if exactly one sim is a root and the other is derived, set the root's generation to the
  derived sim's, then recompute. Overridable later (root is editable).
- **`removeSocialRelationship`** — **no recompute.** Partner adoption is a one-time,
  overridable assignment made on link; removing the bond leaves the adopted generation in
  place (there is no prior value to revert to, and the partner remains an editable root).
- **`getById`** — add `generationNumber` to the `childOf.parent` select so the client can
  tell derived from root.

### 5. Read-site cleanup (remove dead null branches)

With `Sim.generationNumber` non-null, remove the now-impossible null handling for **sim**
generations (leave `ChallengePhase`/milestone generation handling, which stays nullable):

- `src/app/app/legacies/[slug]/lib/derive.ts` — roster grouping's null-gen group;
  heir nulls-last sorting; chronicle milestone-generation inference filters.
- `src/components/lineage-tree/layout-rows.ts` — the null filter / conditional placement.
- `src/app/app/legacies/[slug]/_components/tree-atlas/tree-atlas.tsx` — null filter in
  the generation-filter set.
- `hero.tsx`, `resident-row.tsx`, `sim-inspector.tsx` — `!== null` guards around
  "Gen N" labels.
- `lib/types.ts` — sim-typed `generationNumber: number | null` → `number` (phase/milestone
  types stay `number | null`).
- `src/test/helpers.ts` — `createTestSim` defaults `generationNumber` to a number (e.g. 1),
  not null (the phase helper stays nullable).

Each removal is mechanical; behavior is unchanged because no sim is null after migration.

### 6. Client — sim detail (`sim-detail-client.tsx`, `identity-section.tsx`)

- Thread `generationNumber: number` onto the `sim` type and onto `childOf.parent`; pass
  `generationNumber` and whether the sim has parents into `IdentitySection`.
- In the meta row, next to gender/life-stage/occult chips:
  - **Derived sim** (has parents): generation **read-only** — a chip showing e.g.
    "Gen III" (reuse the roman / `GenerationBadge` styling), no control.
  - **Root sim** (no parents): editable chip-style `Combobox` labelled "Generation",
    options `Gen 1 … Gen max(latestGeneration, current)`, **no "None" option**. Saves via
    `update` with optimistic local state; revert + inline error on failure (same pattern
    as gender/occult chips).

---

## Behavior changes (and the tests they flip)

1. **Multi-parent derivation flips `min` → `max`.** `sims.test.ts` →
   "uses minimum parent gen when multiple parents already exist" (expects 3) → max
   (expects 4); "uses min parent generationNumber when multiple parents" likewise. Rename.
2. **Gaining a parent overrides an existing generation.** `sims.test.ts` → "does not
   override child generationNumber if already set" inverts (child becomes `max+1`).
   Rewrite/rename.
3. **Removing the last parent no longer nulls the generation.** `sims.test.ts` → "clears
   child generationNumber when all parents are removed" → asserts retention.
4. **`update` rejects generation edits on derived sims** — new test.
5. **`addSocialRelationship` partner adoption** — a root partner of a derived sim adopts
   that sim's generation; rewrite the existing null-seeding test accordingly.

---

## Non-goals

- No upward cascade: editing a root never validates against descendants beyond the
  automatic downward recompute.
- The migration normalizes all existing derived sims to the new `max+1` rule in one pass
  (not just null rows), so there is no lingering `min`-based data to self-correct later.

---

## Testing (Testing Trophy)

- **`generation.ts`** — `deriveGeneration` edge cases lightly; mostly exercised via router
  tests.
- **`sims.test.ts` (integration, real DB)** — derivation = max+1; `addFamily` overrides +
  cascades to grandchildren; `removeFamily` re-derives remaining / retains the root value;
  `update` rejects generation on a sim with parents, accepts a number on a root and
  cascades; parentless create defaults to the legacy's latest generation; social link
  partner-adoption.
- **Backfill** — the migration's SQL mirrors `recomputeGenerations`; cover the algorithm
  with a `recomputeGenerations` integration test (seed a null-generation root + derived
  chain, run it, assert every sim ends non-null with `max+1` values). The migration itself
  is exercised by `db:test:setup` applying it on a fresh DB.
- **`identity-section.test.tsx` (jsdom)** — derived sim shows read-only generation (no
  combobox); root sim shows the editable select with options ≥ 1 and no "None"; changing it
  calls `update`. Assert on accessible roles/labels.
- **E2E** — no new journey; covered by existing sim flows.
