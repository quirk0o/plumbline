# Server Folder Refactor — Domain Moves + Sims Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize `src/server/lib/` into per-domain folders, write the server-architecture rule file, and refactor the `sims` God router (714 lines) into thin sub-routers backed by small `lib/sims/` modules.

**Architecture:** Three roles: `routers/<domain>/` (thin tRPC: validate, assert ownership, simple query or single delegate call), `lib/<domain>/` (domain business logic, one file per cohesive action), nothing at `lib/` root. Spec: `docs/superpowers/specs/2026-06-10-server-folder-refactor-design.md`.

**Tech Stack:** Next.js 16, tRPC v11, Prisma, Zod, Vitest (integration tests through `authedCaller`), GitButler for VCS.

---

## Ground rules for every task

- **Version control:** GitButler only — never `git add/commit/checkout`. Invoke the `/but` skill (gitbutler) before GitButler operations. All commits in this plan go on branch **`refactor/server-lib-domains`** (created in Task 1 with `-c`). Before each commit run `but status -fv`, find the CLI IDs of **only the files this task touched**, and commit with `--changes <id1>,<id2>,...`. Other agents have unassigned changes in this workspace — never commit files you didn't touch. Verify with `git show --stat` after committing.
- **Validation:** every task ends with `npx tsc --noEmit` (no errors) and `npm run lint` (no errors/warnings) before its commit step.
- **Tests as harness:** this is a behavior-preserving refactor pinned by existing integration tests. "Red" = existing tests fail after an intentional path change; "green" = they pass again. Run targeted tests with `npm test -- <path>` (this triggers the `pretest` DB setup; plain `npx vitest run` skips it).
- **No suppressions:** `eslint-disable` / `@ts-ignore` / `@ts-expect-error` are illegal. Fix the root cause.
- **Code style:** no semicolons, single quotes, small named step functions instead of long numbered-comment blocks.

## File structure (end state of this plan)

```
.claude/rules/server-architecture.md                  ← new rule file

src/server/lib/
  auth/ownership.ts (+.test.ts)                       ← moved from lib/ownership.ts
  legacies/generation.ts (+.test.ts)                  ← moved from lib/generation.ts
  traits/validate-traits.ts                           ← moved from routers/validate-traits.ts
  challenges/trackerComputation.ts (+.test.ts)        ← moved from lib/
  challenges/challengeBrowse.ts (+.test.ts)           ← moved from lib/
  households/world-options.ts (+.test.ts)             ← moved from lib/
  media/image-url-schema.ts (+.test.ts)               ← moved from lib/
  sims/createSim.ts                                   ← new (from sims.create)
  sims/updateSim.ts                                   ← new (from sims.update)
  sims/traits.ts                                      ← new (from sims.addTrait)
  sims/skills.ts                                      ← new (from sims.addSkill/setSkillLevel)
  sims/family.ts                                      ← new (from sims.add/removeFamilyRelationship)
  sims/social.ts                                      ← new (from sims.addSocialRelationship)
  sims/lifecycle.ts                                   ← new (from completeAspiration/endCareer)
  sims/treeData.ts                                    ← new (from sims.getTreeData)
  sims/buildMiniTree.ts (+.test.ts)                   ← new (from sims.getMiniTreeData)
  sims/pageData.ts (+.test.ts)                        ← new (RSC sim-detail + add-sim page reads)
  legacies/getOwnedLegacy.ts                          ← new (slug→legacy getter for pages; non-throwing)
  households/listHouseholdOptions.ts                  ← new ({id,name}[] options for pages)

src/server/routers/sims/                              ← replaces routers/sims.ts + sims.test.ts
  index.ts  core.ts  tree.ts  lifecycle.ts  skills.ts  traits.ts  family.ts  social.ts
  core.test.ts  tree.test.ts  lifecycle.test.ts  skills.test.ts  traits.test.ts
  family.test.ts  social.test.ts  test-helpers.ts

src/server/trpc.ts                                    ← + export mergeRouters
```

tRPC path changes (everything else keeps its path): `sims.addSkill→sims.skills.add`, `sims.setSkillLevel→sims.skills.setLevel`, `sims.removeSkill→sims.skills.remove`, `sims.addTrait→sims.traits.add`, `sims.removeTrait→sims.traits.remove`, `sims.addFamilyRelationship→sims.family.add`, `sims.removeFamilyRelationship→sims.family.remove`, `sims.addSocialRelationship→sims.social.add`, `sims.updateSocialRelationship→sims.social.update`, `sims.removeSocialRelationship→sims.social.remove`.

RSC pages (this plan): the two **sims** pages stop querying `db` directly and call `lib/` read functions instead — `src/app/app/legacies/[slug]/sims/[id]/page.tsx` and `.../sims/new/page.tsx`. The other 4 inline-query pages are a follow-up plan.

Out of scope (follow-up plans): `challengeRuns.ts`, `challenges.ts`, `households.ts` decomposition; the new `assertRunPhaseOwned`-family asserts; the remaining RSC inline-query pages (`app/page.tsx`, `legacies/[slug]/page.tsx`, `legacies/[slug]/tree/page.tsx`, `challenges/[id]/page.tsx`).

---

### Task 1: Move `lib/ownership.ts` → `lib/auth/ownership.ts`

**Files:**
- Move: `src/server/lib/ownership.ts` → `src/server/lib/auth/ownership.ts`
- Move: `src/server/lib/ownership.test.ts` → `src/server/lib/auth/ownership.test.ts`
- Modify (import line only): `src/server/routers/challengeRuns.ts`, `src/server/routers/households.ts`, `src/server/routers/milestones.ts`, `src/server/routers/sims.ts`, `src/server/routers/sims.test.ts`

- [ ] **Step 1: Move the files**

```bash
mkdir -p src/server/lib/auth
mv src/server/lib/ownership.ts src/server/lib/auth/ownership.ts
mv src/server/lib/ownership.test.ts src/server/lib/auth/ownership.test.ts
```

- [ ] **Step 2: Update every importer**

Find them: `grep -rn "lib/ownership" src --include="*.ts" --include="*.tsx"`

In the four routers, change `'../lib/ownership'` → `'../lib/auth/ownership'`. In test files, change `'@/server/lib/ownership'` → `'@/server/lib/auth/ownership'` (use whatever specifier form grep actually shows; the moved test file may also use a relative `'./ownership'` self-import — it doesn't, but its imports don't change since it moves with the module).

- [ ] **Step 3: Validate**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors. Then `npm test -- src/server/lib/auth/ownership.test.ts` — all pass.

- [ ] **Step 4: Commit (creates the branch)**

`but status -fv`, collect IDs for exactly the files above, then:

```bash
but commit refactor/server-lib-domains -c -m "refactor(server): move ownership asserts to lib/auth domain" --changes <ids>
```

### Task 2: Move `lib/generation.ts` → `lib/legacies/generation.ts`

**Files:**
- Move: `src/server/lib/generation.ts` → `src/server/lib/legacies/generation.ts`
- Move: `src/server/lib/generation.test.ts` → `src/server/lib/legacies/generation.test.ts`
- Modify (import line only): `src/server/routers/sims.ts`, `src/server/routers/sims.test.ts` (no frontend files import this module — `grep -rn "lib/generation" src` is authoritative; files merely containing the string `generationNumber` are not importers)

- [ ] **Step 1: Move both files** (`mkdir -p src/server/lib/legacies` first)
- [ ] **Step 2: Update importers** — `grep -rn "lib/generation" src --include="*.ts" --include="*.tsx"`; replace `server/lib/generation` → `server/lib/legacies/generation` in every hit (alias and relative forms)
- [ ] **Step 3: Validate** — `npx tsc --noEmit && npm run lint`, then `npm test -- src/server/lib/legacies/generation.test.ts`
- [ ] **Step 4: Commit** — `but commit refactor/server-lib-domains -m "refactor(server): move generation lineage logic to lib/legacies domain" --changes <ids>`

### Task 3: Move `routers/validate-traits.ts` → `lib/traits/validate-traits.ts`

**Files:**
- Move: `src/server/routers/validate-traits.ts` → `src/server/lib/traits/validate-traits.ts`
- Modify (import line only): `src/server/routers/legacies.ts` (`'./validate-traits'` → `'../lib/traits/validate-traits'`), `src/server/routers/sims.ts` (same)

- [ ] **Step 1: Move the file** (`mkdir -p src/server/lib/traits`)
- [ ] **Step 2: Update the two importers** (verify with `grep -rn "validate-traits" src`)
- [ ] **Step 3: Validate** — `npx tsc --noEmit && npm run lint`, then `npm test -- src/server/routers/sims.test.ts` (covers the conflict checks)
- [ ] **Step 4: Commit** — `but commit refactor/server-lib-domains -m "refactor(server): move trait-conflict rule out of routers into lib/traits" --changes <ids>`

### Task 4: Move `trackerComputation` + `challengeBrowse` → `lib/challenges/`

**Files:**
- Move: `src/server/lib/trackerComputation.ts` (+`.test.ts`) → `src/server/lib/challenges/`
- Move: `src/server/lib/challengeBrowse.ts` (+`.test.ts`) → `src/server/lib/challenges/`
- Modify (import lines only): `src/server/routers/challengeRuns.ts`, `src/server/routers/challengeRuns.test.ts`, `src/server/routers/sims.ts`, and frontend importers of challengeBrowse: `src/app/app/challenges/page.tsx`, `src/app/app/challenges/[id]/page.tsx`, `src/app/app/challenges/_components/challenge-grid.tsx`

- [ ] **Step 1: Move the four files** (`mkdir -p src/server/lib/challenges`)
- [ ] **Step 2: Update importers** — `grep -rn "lib/trackerComputation\|lib/challengeBrowse" src --include="*.ts" --include="*.tsx"`; insert `challenges/` into each specifier
- [ ] **Step 3: Validate** — `npx tsc --noEmit && npm run lint`, then `npm test -- src/server/lib/challenges/`
- [ ] **Step 4: Commit** — `but commit refactor/server-lib-domains -m "refactor(server): move tracker + challenge browse logic to lib/challenges domain" --changes <ids>`

### Task 5: Move `world-options` → `lib/households/`, `image-url-schema` → `lib/media/`

**Files:**
- Move: `src/server/lib/world-options.ts` (+`.test.ts`) → `src/server/lib/households/`
- Move: `src/server/lib/image-url-schema.ts` (+`.test.ts`) → `src/server/lib/media/`
- Modify (import lines only): `src/app/app/legacies/[slug]/page.tsx` (world-options), `src/server/routers/legacies.ts` and `src/server/routers/sims.ts` (image-url-schema)

- [ ] **Step 1: Move the files** (`mkdir -p src/server/lib/households src/server/lib/media`)
- [ ] **Step 2: Update importers** — `grep -rn "lib/world-options\|lib/image-url-schema" src --include="*.ts" --include="*.tsx"`
- [ ] **Step 3: Confirm `src/server/lib/` root is now empty of `.ts` files** — `ls src/server/lib/*.ts 2>/dev/null` prints nothing
- [ ] **Step 4: Validate** — `npx tsc --noEmit && npm run lint`, then `npm test -- src/server/lib/households/ src/server/lib/media/`
- [ ] **Step 5: Commit** — `but commit refactor/server-lib-domains -m "refactor(server): move world-options and image-url-schema into domain folders" --changes <ids>`

### Task 6: Write `.claude/rules/server-architecture.md`

**Files:**
- Create: `.claude/rules/server-architecture.md`

- [ ] **Step 1: Create the file with exactly this content**

````markdown
---
paths:
  - "src/server/**"
---

# Server Architecture

How to design and place code under `src/server/`. Spec:
`docs/superpowers/specs/2026-06-10-server-folder-refactor-design.md`.

## Layout

```
src/server/
  trpc.ts, db.ts        tRPC + Prisma plumbing — rarely changes
  routers/<domain>/     thin tRPC routers (a small domain may be a single routers/<domain>.ts)
  lib/<domain>/         domain business logic — one file per cohesive action
```

Every `lib` module lives in a domain folder; nothing floats at `lib/` root.
Current domains: `auth` (ownership asserts), `legacies` (lineage/generation),
`sims`, `traits`, `households`, `challenges` (incl. trackers), `media`.

## Routers are thin

A router procedure may only:

1. Parse and validate input with a zod schema (inline, or imported from the
   `lib/<domain>/` module it delegates to).
2. Assert ownership/auth via `lib/auth/ownership.ts`.
3. Run **one simple query**, **one unconditional single-statement write**, or
   make **one call into a `lib/<domain>/` module**.
4. Shape and return the result (`map`/`pick`, no domain branching).

A **simple query** is a single Prisma `find*`/`count`/`aggregate` call whose
result is returned or directly shaped. Throwing `NOT_FOUND` when it comes back
empty is fine.

Move the logic into a `lib/<domain>/` module the moment a procedure needs any
of:

- a transaction
- a second dependent query that feeds a decision
- a conditional or multi-step write
- a derived/computed value (generation numbers, tracker values, scores)
- enforcement of an invariant beyond ownership

## Domain modules (`lib/<domain>/`)

- Take a `db`/`tx` client (`PrismaClient` or `Prisma.TransactionClient`) plus
  typed arguments; entity rows the router already loaded (e.g. from an
  ownership assert) are passed in, not re-fetched.
- One clear purpose per file, named for the action: `createSim.ts`,
  `buildMiniTree.ts`. Soft cap ~200 lines — if a file grows past it, split.
- Throw `TRPCError` directly (matches `lib/auth/ownership.ts`); there is no
  separate domain-error layer.
- Never import from `routers/`.
- Split algorithms into small named step functions, not long comment-numbered
  blocks.
- Colocate a `*.test.ts` only for genuinely complex logic; routine behavior is
  covered by router integration tests through `authedCaller` (Testing Trophy).

## Domain ownership

A module belongs to the domain that owns the **concept**, even when other
domains consume it. Cross-domain *consumption* is fine; cross-domain
*ownership* is not. Examples: `lib/sims/traits.ts` (a sim's trait edits)
imports the pure conflict rule from `lib/traits/validate-traits.ts`;
`lib/sims/*` calls `lib/challenges/trackerComputation.ts` to trigger
recomputes.

Ownership asserts are the exception: they all live together in
`lib/auth/ownership.ts`. Add new `assert<Entity>Owned` functions there.

## Who may consume `lib/<domain>/`

- tRPC routers (`routers/<domain>/`) — the primary consumers.
- **React Server Components** — RSC pages run server-side and read data by
  calling `lib/<domain>/` functions that encapsulate the queries (existing
  examples: `challengeBrowse`, `world-options`). **A page must never call
  `db.*` directly** — no inline queries, not even a single `findFirst`. Every
  database access from a page goes through a named domain function (e.g.
  `getSimDetail(db, simId, userId)`), so the query lives in one testable place
  and the page stays a thin composition of data + markup. Importing `db` into a
  page file is the smell this rule forbids.
- **Client components** (`'use client'`) — never import server code at
  runtime; they talk to the backend exclusively through the tRPC React client
  (`src/trpc/client.ts`). Type-only imports (`import type`) are fine.
- Truly universal pure helpers shared with client code (e.g. `life-stage`,
  `romantic-status`) live in `src/lib/`, not `src/server/lib/` — if a server
  module's pure function is needed in client code, that's the signal to move
  it to `src/lib/`.

## Parallel agents

One file per cohesive action exists so concurrent sessions don't collide:
touch only the module(s) your change owns, never reorganize a domain another
agent is working in, and put new actions in new files rather than growing an
existing one.

## Worked example

Bad — business logic inline in the procedure:

```ts
create: protectedProcedure.input(schema).mutation(async ({ ctx, input }) => {
  const legacy = await assertLegacyOwned(ctx.db, input.legacyId, ctx.session.user.id)
  const parents = await ctx.db.sim.findMany({ where: { id: { in: input.parentIds } } })
  const generationNumber = parents.length ? deriveGeneration(...) : ...
  return ctx.db.$transaction(async (tx) => { /* 50 more lines */ })
})
```

Good — the procedure validates, asserts, delegates:

```ts
create: protectedProcedure.input(createSimInput).mutation(async ({ ctx, input }) => {
  const legacy = await assertLegacyOwned(ctx.db, input.legacyId, ctx.session.user.id)
  return createSim(ctx.db, legacy, input)
})
```
````

- [ ] **Step 2: Commit** — `but commit refactor/server-lib-domains -m "docs(server): add server-architecture rule file" --changes <id>`

### Task 7: Extract `lib/sims/createSim.ts`, rewire `sims.create`

**Files:**
- Create: `src/server/lib/sims/createSim.ts`
- Modify: `src/server/routers/sims.ts` (the `create` procedure, lines ~20–140, and imports)
- Tests: existing `src/server/routers/sims.test.ts` must pass unchanged

- [ ] **Step 1: Create `src/server/lib/sims/createSim.ts`**

```ts
import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import {
  EmploymentType,
  FamilyRelationshipType,
  Gender,
  LifeStage,
  OccultType,
  type Prisma,
  type PrismaClient,
} from '@prisma/client'
import { assertNoTraitConflicts } from '../traits/validate-traits'
import { deriveGeneration } from '../legacies/generation'
import { imageUrlSchema } from '../media/image-url-schema'

export const createSimInput = z.object({
  legacyId: z.string(),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  gender: z.nativeEnum(Gender),
  lifeStage: z.nativeEnum(LifeStage).default('YOUNG_ADULT'),
  pronounSubject: z.string().max(20).optional(),
  pronounObject: z.string().max(20).optional(),
  pronounPossessive: z.string().max(20).optional(),
  imageUrl: imageUrlSchema,
  personalityTraitIds: z.array(z.string()).max(6).optional(),
  aspirationId: z.string().optional(),
  careerId: z.string().optional(),
  occultType: z.nativeEnum(OccultType).optional(),
  generationNumber: z.number().int().min(1).optional(),
  parentIds: z.array(z.string()).optional(),
  householdId: z.string().optional(),
})

export type CreateSimInput = z.infer<typeof createSimInput>

type LegacyForCreate = { id: string; founderSimId: string | null }
type ParentRow = { id: string; generationNumber: number | null }

/**
 * Create a sim in an owned legacy: validate trait/household invariants, derive
 * the generation from parents (or default to the legacy's latest), and
 * atomically insert the sim, its parent edges, and any founder claim.
 */
export async function createSim(db: PrismaClient, legacy: LegacyForCreate, input: CreateSimInput) {
  await assertNoTraitConflicts(db, input.personalityTraitIds ?? [])
  await assertHouseholdInLegacy(db, input)

  const parents = await loadParents(db, input)
  const generationNumber = await resolveGeneration(db, input, parents)

  // A legacy with no founder adopts its first parentless sim as the founder.
  const willBeFounder = !legacy.founderSimId && parents.length === 0

  return db.$transaction(async (tx) => {
    const newSim = await insertSim(tx, input, generationNumber)
    await linkParents(tx, newSim.id, parents)
    if (willBeFounder) await claimFounderSlot(tx, legacy.id, newSim.id)
    return newSim
  })
}

async function assertHouseholdInLegacy(db: PrismaClient, input: CreateSimInput) {
  if (!input.householdId) return
  const household = await db.household.findFirst({
    where: { id: input.householdId, legacyId: input.legacyId },
    select: { id: true },
  })
  if (!household) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Household must belong to this legacy' })
  }
}

async function loadParents(db: PrismaClient, input: CreateSimInput): Promise<ParentRow[]> {
  if (!input.parentIds?.length) return []
  const parents = await db.sim.findMany({
    where: { id: { in: input.parentIds }, legacyId: input.legacyId },
    select: { id: true, generationNumber: true },
  })
  if (parents.length !== input.parentIds.length) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'One or more parentIds do not belong to this legacy' })
  }
  return parents
}

async function resolveGeneration(
  db: PrismaClient,
  input: CreateSimInput,
  parents: ParentRow[],
): Promise<number> {
  if (parents.length > 0) {
    // A sim with parents is derived; derivation always wins over input.
    const parentGens = parents.map((p) => p.generationNumber).filter((g): g is number => g !== null)
    if (parentGens.length > 0) return deriveGeneration(parentGens)
  } else if (input.generationNumber !== undefined) {
    return input.generationNumber
  }
  // Parentless sims (founders, partners, separate subtree roots) are roots:
  // default to the legacy's current latest generation, or 1 when empty.
  const agg = await db.sim.aggregate({
    where: { legacyId: input.legacyId },
    _max: { generationNumber: true },
  })
  return agg._max.generationNumber ?? 1
}

async function insertSim(tx: Prisma.TransactionClient, input: CreateSimInput, generationNumber: number) {
  return tx.sim.create({
    data: {
      legacyId: input.legacyId,
      firstName: input.firstName,
      lastName: input.lastName,
      gender: input.gender,
      lifeStage: input.lifeStage,
      pronounSubject: input.pronounSubject ?? null,
      pronounObject: input.pronounObject ?? null,
      pronounPossessive: input.pronounPossessive ?? null,
      imageUrl: input.imageUrl ?? null,
      occultType: input.occultType ?? null,
      generationNumber,
      householdId: input.householdId ?? null,
      ...(input.personalityTraitIds?.length
        ? { personalityTraits: { create: input.personalityTraitIds.map((id) => ({ personalityTraitId: id })) } }
        : {}),
      ...(input.aspirationId ? { aspirations: { create: { aspirationId: input.aspirationId } } } : {}),
      ...(input.careerId
        ? { careers: { create: { careerId: input.careerId, employmentType: EmploymentType.EMPLOYED, startedAt: new Date() } } }
        : {}),
    },
  })
}

async function linkParents(tx: Prisma.TransactionClient, childId: string, parents: ParentRow[]) {
  if (parents.length === 0) return
  await tx.familyRelationship.createMany({
    data: parents.map((parent) => ({
      parentId: parent.id,
      childId,
      type: FamilyRelationshipType.BIOLOGICAL,
    })),
    skipDuplicates: true,
  })
}

async function claimFounderSlot(tx: Prisma.TransactionClient, legacyId: string, simId: string) {
  // willBeFounder came from a pre-transaction read, so only claim the founder
  // slot if it is still empty; failing here rolls back the whole create
  // instead of silently overwriting a concurrently designated founder.
  const claimed = await tx.legacy.updateMany({
    where: { id: legacyId, founderSimId: null },
    data: { founderSimId: simId },
  })
  if (claimed.count === 0) {
    throw new TRPCError({ code: 'CONFLICT', message: 'Legacy already has a founder' })
  }
}
```

- [ ] **Step 2: Rewire the `create` procedure in `src/server/routers/sims.ts`**

Replace the entire `create:` procedure (input schema + mutation body) with:

```ts
create: protectedProcedure
  .input(createSimInput)
  .mutation(async ({ ctx, input }) => {
    const legacy = await assertLegacyOwned(ctx.db, input.legacyId, ctx.session.user.id)
    return createSim(ctx.db, legacy, input)
  }),
```

Add `import { createSim, createSimInput } from '../lib/sims/createSim'`. Remove now-unused imports from sims.ts (lint will flag them — at this point `assertNoTraitConflicts` is still used by `addTrait`, so only remove what's actually unused, e.g. `deriveGeneration`).

- [ ] **Step 3: Run the pinning tests**

Run: `npm test -- src/server/routers/sims.test.ts`
Expected: ALL PASS unchanged (describes `sims.create`, `sims.create — atomicity`, `sims.create — parentIds validation`, `sims — generationNumber population` are the direct pins).

- [ ] **Step 4: Validate** — `npx tsc --noEmit && npm run lint`
- [ ] **Step 5: Commit** — `but commit refactor/server-lib-domains -m "refactor(sims): extract createSim into lib/sims domain module" --changes <ids>`

### Task 8: Extract `lib/sims/updateSim.ts`, rewire `sims.update`

**Files:**
- Create: `src/server/lib/sims/updateSim.ts`
- Modify: `src/server/routers/sims.ts` (the `update` procedure)

- [ ] **Step 1: Create `src/server/lib/sims/updateSim.ts`**

```ts
import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import {
  CauseOfDeath,
  EmploymentType,
  Gender,
  LifeStage,
  OccultType,
  type Prisma,
  type PrismaClient,
  type Sim,
} from '@prisma/client'
import { recomputeGenerations } from '../legacies/generation'
import { recomputeLegacyTrackers } from '../challenges/trackerComputation'
import { imageUrlSchema } from '../media/image-url-schema'

export const updateSimInput = z.object({
  id: z.string(),
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  gender: z.nativeEnum(Gender).optional(),
  lifeStage: z.nativeEnum(LifeStage).optional(),
  pronounSubject: z.string().max(20).nullable().optional(),
  pronounObject: z.string().max(20).nullable().optional(),
  pronounPossessive: z.string().max(20).nullable().optional(),
  imageUrl: imageUrlSchema.nullable().optional(),
  occultType: z.nativeEnum(OccultType).nullable().optional(),
  causeOfDeath: z.nativeEnum(CauseOfDeath).nullable().optional(),
  aspirationId: z.string().nullable().optional(),
  careerId: z.string().nullable().optional(),
  generationNumber: z.number().int().min(1).optional(),
  isHeir: z.boolean().optional(),
})

export type UpdateSimInput = z.infer<typeof updateSimInput>

const TRACKER_RECOMPUTE_FIELDS = ['generationNumber', 'lifeStage', 'isHeir', 'causeOfDeath', 'occultType'] as const

/**
 * Update a sim: swap the active aspiration/career, keep one heir per
 * generation, and recompute generations/trackers when lineage-relevant
 * fields change.
 */
export async function updateSim(db: PrismaClient, sim: Sim, input: UpdateSimInput) {
  await assertGenerationEditable(db, input)

  const { id, aspirationId, careerId, ...fields } = input
  const result = await db.$transaction(async (tx) => {
    if (aspirationId !== undefined) await replaceActiveAspiration(tx, id, aspirationId)
    if (careerId !== undefined) await replaceActiveCareer(tx, id, careerId)
    if (input.isHeir === true) await clearHeirCohort(tx, sim.legacyId, input)
    const updated = await tx.sim.update({ where: { id }, data: fields })
    if (input.generationNumber !== undefined) await recomputeGenerations(tx, updated.legacyId)
    return updated
  })

  if (TRACKER_RECOMPUTE_FIELDS.some((f) => input[f] !== undefined)) {
    void recomputeLegacyTrackers(db, result.legacyId)
  }
  return result
}

async function assertGenerationEditable(db: PrismaClient, input: UpdateSimInput) {
  if (input.generationNumber === undefined) return
  const parentCount = await db.familyRelationship.count({ where: { childId: input.id } })
  if (parentCount > 0) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Generation is derived from parents and cannot be set directly',
    })
  }
}

async function replaceActiveAspiration(tx: Prisma.TransactionClient, simId: string, aspirationId: string | null) {
  await tx.simAspiration.deleteMany({ where: { simId, completedAt: null } })
  if (aspirationId) await tx.simAspiration.create({ data: { simId, aspirationId } })
}

async function replaceActiveCareer(tx: Prisma.TransactionClient, simId: string, careerId: string | null) {
  await tx.simCareer.deleteMany({ where: { simId, endedAt: null } })
  if (careerId) {
    await tx.simCareer.create({
      data: { simId, careerId, employmentType: EmploymentType.EMPLOYED, startedAt: new Date() },
    })
  }
}

async function clearHeirCohort(tx: Prisma.TransactionClient, legacyId: string, input: UpdateSimInput) {
  // Clear heirs in the generation the sim ends up in: an explicit
  // generationNumber in this update wins; otherwise re-read the current value
  // inside the transaction so a concurrent generation change cannot make us
  // clear a stale cohort.
  const targetGeneration =
    input.generationNumber !== undefined
      ? input.generationNumber
      : (
          await tx.sim.findUniqueOrThrow({
            where: { id: input.id },
            select: { generationNumber: true },
          })
        ).generationNumber
  await tx.sim.updateMany({
    where: { legacyId, generationNumber: targetGeneration, isHeir: true, NOT: { id: input.id } },
    data: { isHeir: false },
  })
}
```

- [ ] **Step 2: Rewire the `update` procedure**

```ts
update: protectedProcedure
  .input(updateSimInput)
  .mutation(async ({ ctx, input }) => {
    const sim = await assertSimOwned(ctx.db, input.id, ctx.session.user.id)
    return updateSim(ctx.db, sim, input)
  }),
```

Add `import { updateSim, updateSimInput } from '../lib/sims/updateSim'`; prune imports that became unused.

- [ ] **Step 3: Run the pinning tests** — `npm test -- src/server/routers/sims.test.ts` (direct pins: `sims.update`, `sims.update — heir cohort`, `one heir per generation — database constraint`, `recomputeLegacyTrackers — triggered by sim mutations`). Expected: ALL PASS.
- [ ] **Step 4: Validate** — `npx tsc --noEmit && npm run lint`
- [ ] **Step 5: Commit** — `but commit refactor/server-lib-domains -m "refactor(sims): extract updateSim into lib/sims domain module" --changes <ids>`

### Task 9: Extract `lib/sims/traits.ts` + `lib/sims/skills.ts`, rewire trait/skill procedures

**Files:**
- Create: `src/server/lib/sims/traits.ts`, `src/server/lib/sims/skills.ts`
- Modify: `src/server/routers/sims.ts` (`addTrait`, `addSkill`, `setSkillLevel` — `removeTrait`/`removeSkill` are single-statement deletes and stay inline per the rule)

- [ ] **Step 1: Create `src/server/lib/sims/traits.ts`**

```ts
import { TRPCError } from '@trpc/server'
import type { PrismaClient, Sim } from '@prisma/client'
import { assertNoTraitConflicts } from '../traits/validate-traits'
import { isLifeStageInRange } from '@/lib/life-stage'

const MAX_PERSONALITY_TRAITS = 6

/** Add a personality trait to a sim, enforcing life-stage range, the slot cap, and conflict rules. */
export async function addSimTrait(db: PrismaClient, sim: Sim, traitId: string) {
  const [trait, currentTraits] = await Promise.all([
    db.personalityTrait.findUnique({
      where: { id: traitId },
      select: { minLifeStage: true, maxLifeStage: true },
    }),
    db.simPersonalityTrait.findMany({
      where: { simId: sim.id },
      select: { personalityTraitId: true },
    }),
  ])
  if (!trait) throw new TRPCError({ code: 'NOT_FOUND', message: 'Trait not found' })
  if (!isLifeStageInRange(sim.lifeStage, trait.minLifeStage, trait.maxLifeStage))
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Trait not available for this life stage' })
  if (currentTraits.length >= MAX_PERSONALITY_TRAITS)
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Maximum 6 traits allowed' })
  await assertNoTraitConflicts(db, [...currentTraits.map((t) => t.personalityTraitId), traitId])
  return db.simPersonalityTrait.create({
    data: { simId: sim.id, personalityTraitId: traitId },
  })
}
```

- [ ] **Step 2: Create `src/server/lib/sims/skills.ts`**

```ts
import { TRPCError } from '@trpc/server'
import type { PrismaClient, Sim } from '@prisma/client'
import { recomputeLegacyTrackers } from '../challenges/trackerComputation'

/** Create or update a sim's skill at the given level, then recompute trackers. */
export async function upsertSimSkill(db: PrismaClient, sim: Sim, skillId: string, level: number) {
  await assertLevelWithinCap(db, skillId, level)
  const result = await db.simSkill.upsert({
    where: { simId_skillId: { simId: sim.id, skillId } },
    create: { simId: sim.id, skillId, level },
    update: { level },
  })
  await recomputeLegacyTrackers(db, sim.legacyId)
  return result
}

/** Set the level of an existing sim skill, then recompute trackers. */
export async function setSimSkillLevel(db: PrismaClient, sim: Sim, skillId: string, level: number) {
  await assertLevelWithinCap(db, skillId, level)
  const result = await db.simSkill.update({
    where: { simId_skillId: { simId: sim.id, skillId } },
    data: { level },
  })
  await recomputeLegacyTrackers(db, sim.legacyId)
  return result
}

async function assertLevelWithinCap(db: PrismaClient, skillId: string, level: number) {
  const skill = await db.skill.findUnique({ where: { id: skillId } })
  if (!skill) throw new TRPCError({ code: 'NOT_FOUND', message: 'Skill not found' })
  if (level > skill.maxLevel)
    throw new TRPCError({ code: 'BAD_REQUEST', message: `Level cannot exceed ${skill.maxLevel}` })
}
```

- [ ] **Step 3: Rewire the four procedures in `sims.ts`**

```ts
addTrait: protectedProcedure
  .input(z.object({ simId: z.string(), traitId: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const sim = await assertSimOwned(ctx.db, input.simId, ctx.session.user.id)
    return addSimTrait(ctx.db, sim, input.traitId)
  }),

addSkill: protectedProcedure
  .input(z.object({ simId: z.string(), skillId: z.string(), level: z.number().int().min(1) }))
  .mutation(async ({ ctx, input }) => {
    const sim = await assertSimOwned(ctx.db, input.simId, ctx.session.user.id)
    return upsertSimSkill(ctx.db, sim, input.skillId, input.level)
  }),

setSkillLevel: protectedProcedure
  .input(z.object({ simId: z.string(), skillId: z.string(), level: z.number().int().min(1) }))
  .mutation(async ({ ctx, input }) => {
    const sim = await assertSimOwned(ctx.db, input.simId, ctx.session.user.id)
    return setSimSkillLevel(ctx.db, sim, input.skillId, input.level)
  }),
```

`removeTrait` and `removeSkill` keep their current bodies (assert + single delete). Add imports for `addSimTrait`, `upsertSimSkill`, `setSimSkillLevel`; prune unused (`isLifeStageInRange`, `assertNoTraitConflicts` if nothing else uses them in sims.ts).

- [ ] **Step 4: Run pinning tests** — `npm test -- src/server/routers/sims.test.ts` (pins: `sims.addTrait / sims.removeTrait`, `sims.addSkill / sims.setSkillLevel / sims.removeSkill`). Expected: ALL PASS.
- [ ] **Step 5: Validate** — `npx tsc --noEmit && npm run lint`
- [ ] **Step 6: Commit** — `but commit refactor/server-lib-domains -m "refactor(sims): extract trait/skill logic into lib/sims modules" --changes <ids>`

### Task 10: Extract `lib/sims/family.ts` + `lib/sims/social.ts`, rewire relationship procedures

**Files:**
- Create: `src/server/lib/sims/family.ts`, `src/server/lib/sims/social.ts`
- Modify: `src/server/routers/sims.ts` (`addFamilyRelationship`, `removeFamilyRelationship`, `addSocialRelationship` — `updateSocialRelationship`/`removeSocialRelationship` are single-statement writes and stay inline)

- [ ] **Step 1: Create `src/server/lib/sims/family.ts`**

```ts
import { TRPCError } from '@trpc/server'
import type { FamilyRelationshipType, PrismaClient, Sim } from '@prisma/client'
import { recomputeGenerations } from '../legacies/generation'
import { recomputeLegacyTrackers } from '../challenges/trackerComputation'

/** Create a parent-child edge between same-legacy sims; recompute generations and trackers. */
export async function addFamilyRelationship(
  db: PrismaClient,
  parent: Sim,
  child: Sim,
  type: FamilyRelationshipType,
) {
  if (parent.legacyId !== child.legacyId) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Sims must belong to the same legacy' })
  }
  const created = await db.$transaction(async (tx) => {
    const rel = await tx.familyRelationship.create({
      data: { parentId: parent.id, childId: child.id, type },
    })
    await recomputeGenerations(tx, child.legacyId)
    return rel
  })
  void recomputeLegacyTrackers(db, child.legacyId)
  return created
}

/** Delete a parent-child edge; recompute generations and trackers. */
export async function removeFamilyRelationship(db: PrismaClient, parentId: string, child: Sim) {
  await db.$transaction(async (tx) => {
    await tx.familyRelationship.delete({
      where: { parentId_childId: { parentId, childId: child.id } },
    })
    await recomputeGenerations(tx, child.legacyId)
  })
  void recomputeLegacyTrackers(db, child.legacyId)
  return { parentId, childId: child.id }
}
```

- [ ] **Step 2: Create `src/server/lib/sims/social.ts`**

```ts
import type { Prisma, PrismaClient, RomanticStatus, Sim } from '@prisma/client'
import { recomputeGenerations } from '../legacies/generation'
import { recomputeLegacyTrackers } from '../challenges/trackerComputation'

interface AddSocialRelationshipArgs {
  romanticStatus: RomanticStatus
  endedAt: Date | null
}

/**
 * Create a social relationship between two owned sims. When exactly one sim
 * is a root (no parents) and the other is derived, the root adopts the
 * derived sim's generation ("partner adoption").
 */
export async function addSocialRelationship(
  db: PrismaClient,
  simA: Sim,
  simB: Sim,
  args: AddSocialRelationshipArgs,
) {
  const [normalA, normalB] = [simA.id, simB.id].sort()
  const result = await db.$transaction(async (tx) => {
    const created = await tx.socialRelationship.create({
      data: {
        simAId: normalA,
        simBId: normalB,
        romanticStatus: args.romanticStatus,
        endedAt: args.endedAt,
        friendshipScore: 0,
        romanceScore: 0,
      },
    })
    const adopted = await adoptPartnerGeneration(tx, simA, simB)
    return { created, adopted }
  })
  if (result.adopted) void recomputeLegacyTrackers(db, simA.legacyId)
  return result.created
}

// Counting inside the transaction closes the TOCTOU window against a
// concurrent family-edge change. Overridable later via the detail page.
async function adoptPartnerGeneration(tx: Prisma.TransactionClient, simA: Sim, simB: Sim): Promise<boolean> {
  const [aParents, bParents] = await Promise.all([
    tx.familyRelationship.count({ where: { childId: simA.id } }),
    tx.familyRelationship.count({ where: { childId: simB.id } }),
  ])
  let adopt: { id: string; generationNumber: number } | null = null
  if (aParents === 0 && bParents > 0) adopt = { id: simA.id, generationNumber: simB.generationNumber }
  else if (bParents === 0 && aParents > 0) adopt = { id: simB.id, generationNumber: simA.generationNumber }
  if (!adopt) return false
  await tx.sim.update({ where: { id: adopt.id }, data: { generationNumber: adopt.generationNumber } })
  await recomputeGenerations(tx, simA.legacyId)
  return true
}
```

(If `Sim['generationNumber']` is nullable in the Prisma client, mirror whatever the current inline code at `sims.ts:629-635` compiles with — it assigns `simB.generationNumber` into a `number` field, so the schema field is non-nullable.)

- [ ] **Step 3: Rewire the three procedures**

```ts
addFamilyRelationship: protectedProcedure
  .input(
    z.object({
      parentId: z.string(),
      childId: z.string(),
      type: z.nativeEnum(FamilyRelationshipType),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    if (input.parentId === input.childId) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'A sim cannot be their own parent' })
    }
    const [parent, child] = await assertSimsOwned(ctx.db, [input.parentId, input.childId], ctx.session.user.id)
    return addFamilyRelationship(ctx.db, parent, child, input.type)
  }),

removeFamilyRelationship: protectedProcedure
  .input(z.object({ parentId: z.string(), childId: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const [, child] = await assertSimsOwned(ctx.db, [input.parentId, input.childId], ctx.session.user.id)
    return removeFamilyRelationship(ctx.db, input.parentId, child)
  }),

addSocialRelationship: protectedProcedure
  .input(
    z.object({
      simAId: z.string(),
      simBId: z.string(),
      romanticStatus: z.nativeEnum(RomanticStatus).default('DATING'),
      // coerce: tRPC's httpBatchLink has no transformer, so a Date arrives as
      // an ISO string over the wire; coerce it back. nullable() short-circuits
      // an explicit null (clear) before coercion runs.
      endedAt: z.coerce.date().nullable().optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    if (input.simAId === input.simBId) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'A sim cannot have a relationship with themselves' })
    }
    const [simA, simB] = await assertSimsOwned(ctx.db, [input.simAId, input.simBId], ctx.session.user.id)
    return addSocialRelationship(ctx.db, simA, simB, {
      romanticStatus: input.romanticStatus,
      endedAt: input.endedAt ?? null,
    })
  }),
```

The self-reference checks stay in the router: they're input validation, and moving them behind the ownership assert would change error precedence (`BAD_REQUEST` vs `NOT_FOUND`) that tests pin. `updateSocialRelationship` and `removeSocialRelationship` keep their current bodies. Watch the name shadowing: the router property and the lib function share names — import the lib functions as-is and reference them inside the handlers (property key vs identifier; TS resolves this fine since router procedures are object values, not bindings).

- [ ] **Step 4: Run pinning tests** — `npm test -- src/server/routers/sims.test.ts` (pins: the two relationship describes, `social relationship cross-tenant ownership`, `RomanticStatus narrowing`). Expected: ALL PASS.
- [ ] **Step 5: Validate** — `npx tsc --noEmit && npm run lint`
- [ ] **Step 6: Commit** — `but commit refactor/server-lib-domains -m "refactor(sims): extract family/social relationship logic into lib/sims" --changes <ids>`

### Task 11: Extract `lib/sims/lifecycle.ts`, rewire `completeAspiration` + `endCareer`

**Files:**
- Create: `src/server/lib/sims/lifecycle.ts`
- Modify: `src/server/routers/sims.ts`

- [ ] **Step 1: Create `src/server/lib/sims/lifecycle.ts`**

```ts
import { TRPCError } from '@trpc/server'
import type { PrismaClient, Sim } from '@prisma/client'
import { recomputeLegacyTrackers } from '../challenges/trackerComputation'

/** Mark a sim's aspiration as completed, then recompute trackers. */
export async function completeAspiration(db: PrismaClient, sim: Sim, aspirationId: string) {
  const record = await db.simAspiration.findUnique({
    where: { simId_aspirationId: { simId: sim.id, aspirationId } },
  })
  if (!record) throw new TRPCError({ code: 'NOT_FOUND', message: 'Aspiration not found on this sim' })
  if (record.completedAt) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Aspiration already completed' })

  await db.simAspiration.update({
    where: { simId_aspirationId: { simId: sim.id, aspirationId } },
    data: { completedAt: new Date() },
  })
  void recomputeLegacyTrackers(db, sim.legacyId)
}

/** End a sim's active career, then recompute trackers. */
export async function endCareer(db: PrismaClient, sim: Sim) {
  const activeCareer = await db.simCareer.findFirst({
    where: { simId: sim.id, endedAt: null },
  })
  if (!activeCareer) throw new TRPCError({ code: 'NOT_FOUND', message: 'No active career to end' })

  await db.simCareer.update({
    where: { id: activeCareer.id },
    data: { endedAt: new Date() },
  })
  void recomputeLegacyTrackers(db, sim.legacyId)
}
```

- [ ] **Step 2: Rewire both procedures**

```ts
completeAspiration: protectedProcedure
  .input(z.object({ simId: z.string(), aspirationId: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const sim = await assertSimOwned(ctx.db, input.simId, ctx.session.user.id)
    return completeAspiration(ctx.db, sim, input.aspirationId)
  }),

endCareer: protectedProcedure
  .input(z.object({ simId: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const sim = await assertSimOwned(ctx.db, input.simId, ctx.session.user.id)
    return endCareer(ctx.db, sim)
  }),
```

- [ ] **Step 3: Run pinning tests** — `npm test -- src/server/routers/sims.test.ts` (pins: `sims.completeAspiration`, `sims.endCareer`). Expected: ALL PASS.
- [ ] **Step 4: Validate** — `npx tsc --noEmit && npm run lint`
- [ ] **Step 5: Commit** — `but commit refactor/server-lib-domains -m "refactor(sims): extract aspiration/career lifecycle into lib/sims" --changes <ids>`

### Task 12: Extract `lib/sims/treeData.ts` + `lib/sims/buildMiniTree.ts`, rewire tree queries

**Files:**
- Create: `src/server/lib/sims/treeData.ts`, `src/server/lib/sims/buildMiniTree.ts`, `src/server/lib/sims/buildMiniTree.test.ts`
- Modify: `src/server/routers/sims.ts` (`getTreeData`, `getMiniTreeData`, delete `miniTreeSimSelect`/`MiniTreeSimData` from the router — nothing outside the router imports the type, verified by grep)

- [ ] **Step 1: Create `src/server/lib/sims/treeData.ts`** — port the body of `getTreeData` (sims.ts:184-242) verbatim with parameters replacing `legacy.id`/`input.legacySlug`:

```ts
import { FamilyRelationshipType, RomanticStatus, type PrismaClient } from '@prisma/client'

/** Fetch a legacy's full tree: sims, parent-child edges, and romantic partner edges. */
export async function getTreeData(db: PrismaClient, legacyId: string, legacySlug: string) {
  const [sims, familyEdges, partnerEdges] = await Promise.all([
    db.sim.findMany({
      where: { legacyId },
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
      orderBy: { id: 'asc' },
    }),
    db.familyRelationship.findMany({
      where: {
        parent: { legacyId },
        child: { legacyId },
        type: { in: [FamilyRelationshipType.BIOLOGICAL, FamilyRelationshipType.ADOPTIVE] },
      },
      select: { parentId: true, childId: true },
      orderBy: { parentId: 'asc' },
    }),
    db.socialRelationship.findMany({
      where: {
        AND: [{ simA: { legacyId } }, { simB: { legacyId } }],
        romanticStatus: { not: RomanticStatus.NONE },
      },
      select: { simAId: true, simBId: true, romanticStatus: true, endedAt: true },
      orderBy: { simAId: 'asc' },
    }),
  ])

  return {
    sims: sims.map(({ causeOfDeath, ...s }) => ({
      ...s,
      isDeceased: causeOfDeath !== null,
      href: `/app/legacies/${legacySlug}/sims/${s.id}`,
    })),
    familyEdges: familyEdges.map((e) => ({ parentId: e.parentId, childId: e.childId })),
    partnerEdges: partnerEdges.map((e) => ({
      simAId: e.simAId,
      simBId: e.simBId,
      romanticStatus: e.romanticStatus,
      endedAt: e.endedAt,
    })),
  }
}
```

- [ ] **Step 2: Create `src/server/lib/sims/buildMiniTree.ts`** — structure: `miniTreeSimSelect` + `MiniTreeSimData` move here from the router top; `loadFocusedSim(db, simId)` holds the big nested `findUnique` **copied verbatim** from sims.ts:250-303 (don't consolidate the repeated relationship selects into a shared const — Prisma's payload inference is literal-sensitive; keep the copy exact); `assembleMiniTree(focusedSim)` holds the pure graph assembly; `appendMissingPartners(db, graph, userId)` holds the follow-up partner fetch with its ownership-filter comment; `getMiniTreeData(db, simId, userId)` orchestrates.

```ts
import { TRPCError } from '@trpc/server'
import {
  FamilyRelationshipType,
  RomanticStatus,
  type Prisma,
  type PrismaClient,
} from '@prisma/client'

export const miniTreeSimSelect = {
  id: true, firstName: true, lastName: true, imageUrl: true, generationNumber: true,
  lifeStage: true, isHeir: true, gender: true, causeOfDeath: true,
} as const

export type MiniTreeSimData = Prisma.SimGetPayload<{ select: typeof miniTreeSimSelect }>

type PartnerEdge = { simAId: string; simBId: string; romanticStatus: RomanticStatus; endedAt: Date | null }

export type MiniTreeGraph = {
  // Partner hrefs are built under the focused sim's legacy slug, even for
  // partners from another legacy — existing behavior, preserved.
  legacySlug: string
  simMap: Map<string, MiniTreeSimData & { href: string }>
  familyEdges: { parentId: string; childId: string }[]
  partnerEdges: PartnerEdge[]
}

/** Three-generation mini tree around one sim: parents (+their parents and partners), children, partners. */
export async function getMiniTreeData(db: PrismaClient, simId: string, userId: string) {
  const focusedSim = await loadFocusedSim(db, simId)
  if (!focusedSim) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sim not found' })

  const graph = assembleMiniTree(focusedSim)
  await appendMissingPartners(db, graph, userId)

  return {
    sims: Array.from(graph.simMap.values()).map(({ causeOfDeath, ...s }) => ({
      ...s,
      isDeceased: causeOfDeath !== null,
    })),
    familyEdges: graph.familyEdges,
    partnerEdges: graph.partnerEdges,
  }
}

async function loadFocusedSim(db: PrismaClient, simId: string) {
  return db.sim.findUnique({
    where: { id: simId },
    select: {
      // ⟨copy the entire select object from sims.ts getMiniTreeData verbatim:
      //  ...miniTreeSimSelect, legacy.slug, childOf (parents w/ their childOf +
      //  both social sides), parentsOf (children), both social sides⟩
    },
  })
}

export type FocusedSim = NonNullable<Awaited<ReturnType<typeof loadFocusedSim>>>

export function assembleMiniTree(focusedSim: FocusedSim): MiniTreeGraph {
  const legacySlug = focusedSim.legacy.slug
  const graph: MiniTreeGraph = { legacySlug, simMap: new Map(), familyEdges: [], partnerEdges: [] }
  const familyEdgeSet = new Set<string>()
  const partnerEdgeSet = new Set<string>()

  function addSim(s: MiniTreeSimData) {
    if (!graph.simMap.has(s.id)) {
      graph.simMap.set(s.id, { ...s, href: `/app/legacies/${legacySlug}/sims/${s.id}` })
    }
  }
  function addFamilyEdge(parentId: string, childId: string) {
    const key = `${parentId}-${childId}`
    if (familyEdgeSet.has(key)) return
    familyEdgeSet.add(key)
    graph.familyEdges.push({ parentId, childId })
  }
  function addPartnerEdge(simAId: string, simBId: string, romanticStatus: RomanticStatus, endedAt: Date | null) {
    const [a, b] = [simAId, simBId].sort()
    const key = `${a}-${b}`
    if (partnerEdgeSet.has(key)) return
    partnerEdgeSet.add(key)
    graph.partnerEdges.push({ simAId: a, simBId: b, romanticStatus, endedAt })
  }

  addSim(focusedSim)
  focusedSim.socialRelationshipsA.forEach((r) => addPartnerEdge(r.simAId, r.simBId, r.romanticStatus, r.endedAt))
  focusedSim.socialRelationshipsB.forEach((r) => addPartnerEdge(r.simAId, r.simBId, r.romanticStatus, r.endedAt))

  for (const parentRel of focusedSim.childOf) {
    const parent = parentRel.parent
    addSim(parent)
    addFamilyEdge(parent.id, focusedSim.id)
    parent.socialRelationshipsA.forEach((r) => addPartnerEdge(r.simAId, r.simBId, r.romanticStatus, r.endedAt))
    parent.socialRelationshipsB.forEach((r) => addPartnerEdge(r.simAId, r.simBId, r.romanticStatus, r.endedAt))
    for (const gpRel of parent.childOf) {
      addSim(gpRel.parent)
      addFamilyEdge(gpRel.parent.id, parent.id)
    }
  }

  for (const childRel of focusedSim.parentsOf) {
    addSim(childRel.child)
    addFamilyEdge(focusedSim.id, childRel.child.id)
  }

  return graph
}

async function appendMissingPartners(db: PrismaClient, graph: MiniTreeGraph, userId: string) {
  const missingPartnerIds = [...new Set(
    graph.partnerEdges.flatMap((e) => [e.simAId, e.simBId]).filter((id) => !graph.simMap.has(id)),
  )]
  if (missingPartnerIds.length === 0) return
  // Ownership *filter*, not a guard: partner sims outside the user's legacies
  // are intentionally omitted from the mini tree. This is the one sanctioned
  // inline ownership condition outside src/server/lib/auth/ownership.ts.
  const partnerSims = await db.sim.findMany({
    where: { id: { in: missingPartnerIds }, legacy: { userId } },
    select: miniTreeSimSelect,
    orderBy: { id: 'asc' },
  })
  for (const partnerSim of partnerSims) {
    if (!graph.simMap.has(partnerSim.id)) {
      graph.simMap.set(partnerSim.id, {
        ...partnerSim,
        href: `/app/legacies/${graph.legacySlug}/sims/${partnerSim.id}`,
      })
    }
  }
}
```

- [ ] **Step 3: Write the focused unit test `src/server/lib/sims/buildMiniTree.test.ts`** for `assembleMiniTree` only (the DB-touching paths stay covered by the existing `sims.getMiniTreeData` integration describe). Two behaviors worth pinning at unit level: partner-edge normalization/dedup and family-edge dedup:

```ts
import { describe, it, expect } from 'vitest'
import { Gender, LifeStage, RomanticStatus } from '@prisma/client'
import { assembleMiniTree, type FocusedSim } from './buildMiniTree'

function simStub(id: string) {
  return {
    id,
    firstName: id,
    lastName: 'Test',
    imageUrl: null,
    generationNumber: 1,
    lifeStage: LifeStage.YOUNG_ADULT,
    isHeir: false,
    gender: Gender.FEMALE,
    causeOfDeath: null,
  }
}

function rel(simAId: string, simBId: string) {
  return { simAId, simBId, romanticStatus: RomanticStatus.MARRIED, endedAt: null }
}

describe('assembleMiniTree', () => {
  it('normalizes partner edges to sorted id order and dedupes the two relationship sides', () => {
    const focused: FocusedSim = {
      ...simStub('b'),
      legacy: { slug: 'test-legacy' },
      childOf: [],
      parentsOf: [],
      socialRelationshipsA: [rel('b', 'a')],
      socialRelationshipsB: [rel('b', 'a')],
    }
    const graph = assembleMiniTree(focused)
    expect(graph.partnerEdges).toEqual([
      { simAId: 'a', simBId: 'b', romanticStatus: RomanticStatus.MARRIED, endedAt: null },
    ])
  })

  it('dedupes a shared grandparent reached through both parents and keeps hrefs on the focused legacy', () => {
    const grandparent = { ...simStub('gp') }
    const parentOf = (parentId: string) => ({
      parentId,
      parent: {
        ...simStub(parentId),
        childOf: [{ parentId: 'gp', parent: grandparent }],
        socialRelationshipsA: [],
        socialRelationshipsB: [],
      },
    })
    const focused: FocusedSim = {
      ...simStub('child'),
      legacy: { slug: 'test-legacy' },
      childOf: [parentOf('p1'), parentOf('p2')],
      parentsOf: [],
      socialRelationshipsA: [],
      socialRelationshipsB: [],
    }
    const graph = assembleMiniTree(focused)
    expect([...graph.simMap.keys()].sort()).toEqual(['child', 'gp', 'p1', 'p2'])
    expect(graph.familyEdges).toContainEqual({ parentId: 'gp', childId: 'p1' })
    expect(graph.familyEdges).toContainEqual({ parentId: 'gp', childId: 'p2' })
    expect(graph.simMap.get('gp')?.href).toBe('/app/legacies/test-legacy/sims/gp')
  })
})
```

If the `FocusedSim` structural type rejects the stubs (extra/missing fields from the verbatim select), fix the **stubs** to match the select shape — never widen the type.

- [ ] **Step 4: Run the new unit test** — `npm test -- src/server/lib/sims/buildMiniTree.test.ts`. Expected: PASS (write it after the module so it pins the ported code; if it fails, the port diverged — fix the port, not the test).
- [ ] **Step 5: Rewire the two procedures in `sims.ts`**

```ts
getTreeData: protectedProcedure
  .input(z.object({ legacySlug: z.string().min(1).max(100) }))
  .query(async ({ ctx, input }) => {
    const legacy = await assertLegacyOwnedBySlug(ctx.db, input.legacySlug, ctx.session.user.id)
    return getTreeData(ctx.db, legacy.id, input.legacySlug)
  }),

getMiniTreeData: protectedProcedure
  .input(z.object({ simId: z.string().cuid() }))
  .query(async ({ ctx, input }) => {
    await assertSimOwned(ctx.db, input.simId, ctx.session.user.id)
    return getMiniTreeData(ctx.db, input.simId, ctx.session.user.id)
  }),
```

Delete `miniTreeSimSelect` and `export type MiniTreeSimData` from sims.ts (no external importers — re-export from the lib module is unnecessary). Prune unused imports.

- [ ] **Step 6: Run pinning tests** — `npm test -- src/server/routers/sims.test.ts` (pins: `sims.getTreeData`, `sims.getMiniTreeData`). Expected: ALL PASS.
- [ ] **Step 7: Validate** — `npx tsc --noEmit && npm run lint`
- [ ] **Step 8: Commit** — `but commit refactor/server-lib-domains -m "refactor(sims): extract tree queries into lib/sims modules" --changes <ids>`

### Task 13: Encapsulate the two sims RSC pages' DB queries (no direct `db` in pages)

The rule "RSC pages never call `db.*` directly" makes `sims/[id]/page.tsx` and `sims/new/page.tsx` non-compliant. Move their queries into `lib/` read functions and have the pages call those. This is independent of the tRPC paths (pages don't use tRPC for these reads), so it stays green throughout.

**Files:**
- Create: `src/server/lib/sims/pageData.ts`, `src/server/lib/sims/pageData.test.ts`
- Create: `src/server/lib/legacies/getOwnedLegacy.ts`, `src/server/lib/households/listHouseholdOptions.ts`
- Modify: `src/app/app/legacies/[slug]/sims/[id]/page.tsx`, `src/app/app/legacies/[slug]/sims/new/page.tsx`

- [ ] **Step 1: Create `src/server/lib/sims/pageData.ts`** — the two sim-domain reads from the detail page, moved verbatim (same `where`/`include`/`select`/`orderBy`), exposed as named functions returning the Prisma-inferred payloads:

```ts
import type { PrismaClient } from '@prisma/client'

/** The sim detail row with all relations the detail page renders, scoped to the owning user + legacy slug. Null when not found/owned. */
export async function getSimDetail(db: PrismaClient, slug: string, simId: string, userId: string) {
  return db.sim.findFirst({
    where: { id: simId, legacy: { slug, userId } },
    include: {
      personalityTraits: { include: { personalityTrait: true } },
      aspirations: { include: { aspiration: true } },
      careers: { include: { career: true } },
      skills: { include: { skill: true } },
      parentsOf: {
        include: { child: { select: { id: true, firstName: true, lastName: true, imageUrl: true } } },
      },
      childOf: {
        include: { parent: { select: { id: true, firstName: true, lastName: true, imageUrl: true, generationNumber: true } } },
      },
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
    },
  })
}

/** Minimal {id,firstName,lastName,imageUrl} list of every sim in the legacy, for relationship pickers. */
export async function listLegacySimsBySlug(db: PrismaClient, slug: string, userId: string) {
  return db.sim.findMany({
    where: { legacy: { slug, userId } },
    select: { id: true, firstName: true, lastName: true, imageUrl: true },
    orderBy: { firstName: 'asc' },
  })
}
```

- [ ] **Step 2: Create `src/server/lib/legacies/getOwnedLegacy.ts`**

```ts
import type { PrismaClient } from '@prisma/client'

/**
 * Fetch a user's legacy by slug, or null. Non-throwing on purpose: RSC pages
 * turn the null into Next's notFound(), which the throwing
 * assertLegacyOwnedBySlug (TRPCError, for routers) cannot express.
 */
export async function getOwnedLegacyBySlug(db: PrismaClient, slug: string, userId: string) {
  return db.legacy.findFirst({ where: { slug, userId } })
}
```

- [ ] **Step 3: Create `src/server/lib/households/listHouseholdOptions.ts`**

```ts
import type { PrismaClient } from '@prisma/client'

/** {id,name} options for a legacy's households, oldest first — for selects/pickers. */
export async function listHouseholdOptions(db: PrismaClient, legacyId: string) {
  return db.household.findMany({
    where: { legacyId },
    select: { id: true, name: true },
    orderBy: { createdAt: 'asc' },
  })
}
```

- [ ] **Step 4: Rewrite `sims/[id]/page.tsx` to compose the functions** (the `Promise.all` keeps its concurrency; reference-data fetches are already-encapsulated `@/lib/reference-data` helpers and stay):

```tsx
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { db } from '@/server/db'
import { fetchTraitsWithConflicts, fetchAspirations, fetchCareers, fetchSkills } from '@/lib/reference-data'
import { getSimDetail, listLegacySimsBySlug } from '@/server/lib/sims/pageData'
import { SimDetailClient } from './sim-detail-client'

interface Props {
  params: Promise<{ slug: string; id: string }>
}

export default async function SimDetailPage({ params }: Props) {
  const { slug, id } = await params
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin')
  const userId = session.user.id

  const [sim, legacySims, traits, aspirations, careers, skills] = await Promise.all([
    getSimDetail(db, slug, id, userId),
    listLegacySimsBySlug(db, slug, userId),
    fetchTraitsWithConflicts(userId),
    fetchAspirations(userId),
    fetchCareers(userId),
    fetchSkills(userId),
  ])

  if (!sim) notFound()

  return (
    <SimDetailClient
      sim={sim}
      slug={slug}
      legacySims={legacySims}
      traits={traits}
      aspirations={aspirations}
      careers={careers}
      skills={skills}
    />
  )
}
```

If `tsc` reports the `sim` prop no longer matches `SimDetailClient`'s `Props.sim`, the moved query diverged from the original include shape — diff it against the original and fix the **function**, not the client's prop type.

- [ ] **Step 5: Rewrite `sims/new/page.tsx` to compose the functions:**

```tsx
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { db } from '@/server/db'
import { AddSimClient } from './add-sim-client'
import { fetchTraitsWithConflicts, fetchAspirations, fetchCareers } from '@/lib/reference-data'
import { getOwnedLegacyBySlug } from '@/server/lib/legacies/getOwnedLegacy'
import { listHouseholdOptions } from '@/server/lib/households/listHouseholdOptions'
import styles from './page.module.css'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function AddSimPage({ params }: Props) {
  const { slug } = await params
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin')
  const userId = session.user.id

  const legacy = await getOwnedLegacyBySlug(db, slug, userId)
  if (!legacy) notFound()

  const [traits, aspirations, careers, households] = await Promise.all([
    fetchTraitsWithConflicts(userId),
    fetchAspirations(userId),
    fetchCareers(userId),
    listHouseholdOptions(db, legacy.id),
  ])

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Add Sim to {legacy.name}</h1>
      <div className={styles.card}>
        <AddSimClient
          legacyId={legacy.id}
          slug={slug}
          traits={traits}
          aspirations={aspirations}
          careers={careers}
          households={households}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Write `src/server/lib/sims/pageData.test.ts`** — one security-relevant behavior worth pinning: cross-tenant scoping (another user's sim is invisible). Routine field-by-field selection is covered by existing e2e.

```ts
import { describe, it, expect } from 'vitest'
import { authedCaller } from '@/test/caller' // not used directly; see note
import { db } from '@/server/db'
import { getSimDetail, listLegacySimsBySlug } from './pageData'
import { createTestUser, cleanupUser, createTestLegacy, createTestSim } from '@/test/helpers'
import { test } from '@/test/test'

describe('sims/pageData', () => {
  test('getSimDetail returns null for a sim in another user\'s legacy', async () => {
    const owner = await createTestUser()
    const intruder = await createTestUser()
    try {
      const legacy = await createTestLegacy(owner.id, { slug: 'owned-legacy' })
      const sim = await createTestSim(legacy.id)
      // Correct owner + slug resolves the sim.
      expect(await getSimDetail(db, 'owned-legacy', sim.id, owner.id)).not.toBeNull()
      // Different user, same slug/sim id → not found.
      expect(await getSimDetail(db, 'owned-legacy', sim.id, intruder.id)).toBeNull()
      // listLegacySimsBySlug is likewise tenant-scoped.
      expect(await listLegacySimsBySlug(db, 'owned-legacy', intruder.id)).toHaveLength(0)
    } finally {
      await cleanupUser(owner.id)
      await cleanupUser(intruder.id)
    }
  })
})
```

Check `@/test/helpers` for the exact `createTestUser`/`createTestLegacy`/`createTestSim` signatures (the existing `sims.test.ts` is the reference for how they're called — e.g. whether `createTestLegacy` accepts a `{ slug }` override; if not, read back the created legacy's slug and pass that instead of the literal). Remove the unused `authedCaller` import — it's listed only to flag that this file does **not** go through the router; if a future reviewer expects caller-based tests, the comment explains why these are direct.

- [ ] **Step 7: Run the new test + validate** — `npm test -- src/server/lib/sims/pageData.test.ts`, then `npx tsc --noEmit && npm run lint`. Expected: PASS, clean.
- [ ] **Step 8: Confirm the pages no longer import `db`** — `grep -n "server/db" src/app/app/legacies/\[slug\]/sims/\[id\]/page.tsx src/app/app/legacies/\[slug\]/sims/new/page.tsx` → no hits.
- [ ] **Step 9: Commit** — `but commit refactor/server-lib-domains -m "refactor(sims): encapsulate RSC sim pages' queries in lib read functions" --changes <ids>`

### Task 14: Split `routers/sims.ts` into `routers/sims/` with nested sub-routers (tests lead)

This is the pivot task: tRPC paths change, so the test split (with new paths) comes first as the red state, the router split turns it green, and the client + commit land together. **Do not commit mid-task** — other agents run tests against the merged workspace, so the tree must only ever be committed green.

**Files:**
- Modify: `src/server/trpc.ts` (add one line: `export const mergeRouters = t.mergeRouters`)
- Create: `src/server/routers/sims/test-helpers.ts` and the 7 test files listed below (content relocated from `sims.test.ts`)
- Delete: `src/server/routers/sims.test.ts`, then `src/server/routers/sims.ts`
- Create: `src/server/routers/sims/{index,core,tree,lifecycle,skills,traits,family,social}.ts`
- Modify: `src/app/app/legacies/[slug]/sims/[id]/skill-editor.tsx`, `.../trait-editor.tsx`, `.../relationships-editor.tsx`
- Unchanged: `src/server/routers/index.ts` (`'./sims'` resolves to the new `sims/index.ts` once `sims.ts` is deleted — verify no duplicate-resolution while both exist by deleting `sims.ts` in the same step the directory's `index.ts` lands)

- [ ] **Step 1: Add `mergeRouters` to `src/server/trpc.ts`**

```ts
export const mergeRouters = t.mergeRouters
```

- [ ] **Step 2: Extract shared test setup into `src/server/routers/sims/test-helpers.ts`**

Move the `failingDb` helper (sims.test.ts:~28-45) and any other module-level helpers/fixtures defined between the imports and the first `describe` into this file and export them. Keep the doc comments. Each split test file imports what it needs from `'./test-helpers'` plus the existing shared modules (`@/test/caller`, `@/test/helpers`, `@/test/test`, `@/server/db`, `@prisma/client` enums).

- [ ] **Step 3: Split `sims.test.ts` into 7 files by this exact describe mapping** (move blocks verbatim, then apply the path renames):

| New file | Describe blocks (current titles) |
|---|---|
| `core.test.ts` | `sims.create`, `sims.create — atomicity`, `sims.create — parentIds validation`, `sims.getById`, `sims.listByLegacy`, `sims.update`, `sims — generationNumber population`, `sims.update — heir cohort`, `one heir per generation — database constraint`, `recomputeLegacyTrackers — triggered by sim mutations` |
| `tree.test.ts` | `sims.getTreeData`, `sims.getMiniTreeData` |
| `skills.test.ts` | `sims.addSkill / sims.setSkillLevel / sims.removeSkill` |
| `traits.test.ts` | `sims.addTrait / sims.removeTrait` |
| `family.test.ts` | `sims.addFamilyRelationship / sims.removeFamilyRelationship` |
| `social.test.ts` | `sims.addSocialRelationship / sims.updateSocialRelationship / sims.removeSocialRelationship`, `RomanticStatus narrowing — migrated rows derive correctly`, `social relationship cross-tenant ownership` |
| `lifecycle.test.ts` | `sims.completeAspiration`, `sims.endCareer` |

In every moved block apply these caller-path renames (`grep -n "sims\.\(add\|set\|remove\|update\)" <file>` to catch all):

```
.sims.addSkill(            → .sims.skills.add(
.sims.setSkillLevel(       → .sims.skills.setLevel(
.sims.removeSkill(         → .sims.skills.remove(
.sims.addTrait(            → .sims.traits.add(
.sims.removeTrait(         → .sims.traits.remove(
.sims.addFamilyRelationship(    → .sims.family.add(
.sims.removeFamilyRelationship( → .sims.family.remove(
.sims.addSocialRelationship(    → .sims.social.add(
.sims.updateSocialRelationship( → .sims.social.update(
.sims.removeSocialRelationship( → .sims.social.remove(
```

Note: `core.test.ts`'s `recomputeLegacyTrackers — triggered by sim mutations` describe calls skill/career mutations — its call sites get the renames too. Update describe titles to match new paths (e.g. `sims.skills.add / sims.skills.setLevel / sims.skills.remove`). Delete the old `src/server/routers/sims.test.ts` once all blocks are moved. Trim unused imports per file (lint enforces this).

- [ ] **Step 4: Run the split tests to verify the red state**

Run: `npm test -- src/server/routers/sims/`
Expected: FAIL — every renamed path errors (procedure not found on the old flat router); old-path describes (create/update/tree/lifecycle) still pass.

- [ ] **Step 5: Create the 8 router files and delete `routers/sims.ts`**

`src/server/routers/sims/core.ts` — `create`, `getById`, `listByLegacy`, `update` exactly as they exist in sims.ts after Tasks 7–12 (already thin):

```ts
import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../../trpc'
import { assertLegacyOwned, assertSimOwned } from '../../lib/auth/ownership'
import { createSim, createSimInput } from '../../lib/sims/createSim'
import { updateSim, updateSimInput } from '../../lib/sims/updateSim'

export const simsCoreRouter = router({
  create: protectedProcedure
    .input(createSimInput)
    .mutation(async ({ ctx, input }) => {
      const legacy = await assertLegacyOwned(ctx.db, input.legacyId, ctx.session.user.id)
      return createSim(ctx.db, legacy, input)
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      // ⟨move current getById body verbatim — single findUnique + NOT_FOUND⟩
    }),

  listByLegacy: protectedProcedure
    .input(z.object({ legacyId: z.string() }))
    .query(async ({ ctx, input }) => {
      // ⟨move current listByLegacy body verbatim⟩
    }),

  update: protectedProcedure
    .input(updateSimInput)
    .mutation(async ({ ctx, input }) => {
      const sim = await assertSimOwned(ctx.db, input.id, ctx.session.user.id)
      return updateSim(ctx.db, sim, input)
    }),
})
```

`src/server/routers/sims/tree.ts`:

```ts
import { z } from 'zod'
import { router, protectedProcedure } from '../../trpc'
import { assertLegacyOwnedBySlug, assertSimOwned } from '../../lib/auth/ownership'
import { getTreeData } from '../../lib/sims/treeData'
import { getMiniTreeData } from '../../lib/sims/buildMiniTree'

export const simsTreeRouter = router({
  getTreeData: protectedProcedure
    .input(z.object({ legacySlug: z.string().min(1).max(100) }))
    .query(async ({ ctx, input }) => {
      const legacy = await assertLegacyOwnedBySlug(ctx.db, input.legacySlug, ctx.session.user.id)
      return getTreeData(ctx.db, legacy.id, input.legacySlug)
    }),

  getMiniTreeData: protectedProcedure
    .input(z.object({ simId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      await assertSimOwned(ctx.db, input.simId, ctx.session.user.id)
      return getMiniTreeData(ctx.db, input.simId, ctx.session.user.id)
    }),
})
```

`src/server/routers/sims/lifecycle.ts`:

```ts
import { z } from 'zod'
import { router, protectedProcedure } from '../../trpc'
import { assertSimOwned } from '../../lib/auth/ownership'
import { completeAspiration, endCareer } from '../../lib/sims/lifecycle'

export const simsLifecycleRouter = router({
  completeAspiration: protectedProcedure
    .input(z.object({ simId: z.string(), aspirationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const sim = await assertSimOwned(ctx.db, input.simId, ctx.session.user.id)
      return completeAspiration(ctx.db, sim, input.aspirationId)
    }),

  endCareer: protectedProcedure
    .input(z.object({ simId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const sim = await assertSimOwned(ctx.db, input.simId, ctx.session.user.id)
      return endCareer(ctx.db, sim)
    }),
})
```

`src/server/routers/sims/skills.ts` (renamed procedures):

```ts
import { z } from 'zod'
import { router, protectedProcedure } from '../../trpc'
import { assertSimOwned } from '../../lib/auth/ownership'
import { upsertSimSkill, setSimSkillLevel } from '../../lib/sims/skills'

const skillLevelInput = z.object({ simId: z.string(), skillId: z.string(), level: z.number().int().min(1) })

export const simSkillsRouter = router({
  add: protectedProcedure.input(skillLevelInput).mutation(async ({ ctx, input }) => {
    const sim = await assertSimOwned(ctx.db, input.simId, ctx.session.user.id)
    return upsertSimSkill(ctx.db, sim, input.skillId, input.level)
  }),

  setLevel: protectedProcedure.input(skillLevelInput).mutation(async ({ ctx, input }) => {
    const sim = await assertSimOwned(ctx.db, input.simId, ctx.session.user.id)
    return setSimSkillLevel(ctx.db, sim, input.skillId, input.level)
  }),

  remove: protectedProcedure
    .input(z.object({ simId: z.string(), skillId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertSimOwned(ctx.db, input.simId, ctx.session.user.id)
      return ctx.db.simSkill.delete({
        where: { simId_skillId: { simId: input.simId, skillId: input.skillId } },
      })
    }),
})
```

`src/server/routers/sims/traits.ts`:

```ts
import { z } from 'zod'
import { router, protectedProcedure } from '../../trpc'
import { assertSimOwned } from '../../lib/auth/ownership'
import { addSimTrait } from '../../lib/sims/traits'

export const simTraitsRouter = router({
  add: protectedProcedure
    .input(z.object({ simId: z.string(), traitId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const sim = await assertSimOwned(ctx.db, input.simId, ctx.session.user.id)
      return addSimTrait(ctx.db, sim, input.traitId)
    }),

  remove: protectedProcedure
    .input(z.object({ simId: z.string(), traitId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertSimOwned(ctx.db, input.simId, ctx.session.user.id)
      return ctx.db.simPersonalityTrait.delete({
        where: { simId_personalityTraitId: { simId: input.simId, personalityTraitId: input.traitId } },
      })
    }),
})
```

`src/server/routers/sims/family.ts`:

```ts
import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { FamilyRelationshipType } from '@prisma/client'
import { router, protectedProcedure } from '../../trpc'
import { assertSimsOwned } from '../../lib/auth/ownership'
import { addFamilyRelationship, removeFamilyRelationship } from '../../lib/sims/family'

export const simFamilyRouter = router({
  add: protectedProcedure
    .input(
      z.object({
        parentId: z.string(),
        childId: z.string(),
        type: z.nativeEnum(FamilyRelationshipType),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.parentId === input.childId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'A sim cannot be their own parent' })
      }
      const [parent, child] = await assertSimsOwned(ctx.db, [input.parentId, input.childId], ctx.session.user.id)
      return addFamilyRelationship(ctx.db, parent, child, input.type)
    }),

  remove: protectedProcedure
    .input(z.object({ parentId: z.string(), childId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [, child] = await assertSimsOwned(ctx.db, [input.parentId, input.childId], ctx.session.user.id)
      return removeFamilyRelationship(ctx.db, input.parentId, child)
    }),
})
```

`src/server/routers/sims/social.ts`:

```ts
import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { RomanticStatus } from '@prisma/client'
import { router, protectedProcedure } from '../../trpc'
import { assertSimsOwned } from '../../lib/auth/ownership'
import { addSocialRelationship } from '../../lib/sims/social'

export const simSocialRouter = router({
  add: protectedProcedure
    .input(
      z.object({
        simAId: z.string(),
        simBId: z.string(),
        romanticStatus: z.nativeEnum(RomanticStatus).default('DATING'),
        // coerce: tRPC's httpBatchLink has no transformer, so a Date arrives as
        // an ISO string over the wire; coerce it back. nullable() short-circuits
        // an explicit null (clear) before coercion runs.
        endedAt: z.coerce.date().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.simAId === input.simBId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'A sim cannot have a relationship with themselves' })
      }
      const [simA, simB] = await assertSimsOwned(ctx.db, [input.simAId, input.simBId], ctx.session.user.id)
      return addSocialRelationship(ctx.db, simA, simB, {
        romanticStatus: input.romanticStatus,
        endedAt: input.endedAt ?? null,
      })
    }),

  update: protectedProcedure
    .input(
      z.object({
        simAId: z.string(),
        simBId: z.string(),
        romanticStatus: z.nativeEnum(RomanticStatus),
        // (same coercion comment as above)
        endedAt: z.coerce.date().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertSimsOwned(ctx.db, [input.simAId, input.simBId], ctx.session.user.id)
      const [normalA, normalB] = [input.simAId, input.simBId].sort()
      return ctx.db.socialRelationship.update({
        where: { simAId_simBId: { simAId: normalA, simBId: normalB } },
        data: {
          romanticStatus: input.romanticStatus,
          ...(input.endedAt !== undefined ? { endedAt: input.endedAt } : {}),
        },
      })
    }),

  remove: protectedProcedure
    .input(z.object({ simAId: z.string(), simBId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertSimsOwned(ctx.db, [input.simAId, input.simBId], ctx.session.user.id)
      const [normalA, normalB] = [input.simAId, input.simBId].sort()
      return ctx.db.socialRelationship.delete({
        where: { simAId_simBId: { simAId: normalA, simBId: normalB } },
      })
    }),
})
```

`src/server/routers/sims/index.ts`:

```ts
import { mergeRouters, router } from '../../trpc'
import { simsCoreRouter } from './core'
import { simsTreeRouter } from './tree'
import { simsLifecycleRouter } from './lifecycle'
import { simSkillsRouter } from './skills'
import { simTraitsRouter } from './traits'
import { simFamilyRouter } from './family'
import { simSocialRouter } from './social'

export const simsRouter = mergeRouters(
  simsCoreRouter,
  simsTreeRouter,
  simsLifecycleRouter,
  router({
    skills: simSkillsRouter,
    traits: simTraitsRouter,
    family: simFamilyRouter,
    social: simSocialRouter,
  }),
)
```

Delete `src/server/routers/sims.ts` in this same step.

- [ ] **Step 6: Run the split tests — green**

Run: `npm test -- src/server/routers/sims/ src/server/lib/sims/`
Expected: ALL PASS.

- [ ] **Step 7: Update the three client editors**

Apply the same renames from Step 3's table (`.useMutation` call sites):
- `src/app/app/legacies/[slug]/sims/[id]/skill-editor.tsx` — `sims.addSkill`→`sims.skills.add`, `sims.setSkillLevel`→`sims.skills.setLevel`, `sims.removeSkill`→`sims.skills.remove`
- `src/app/app/legacies/[slug]/sims/[id]/trait-editor.tsx` — `sims.addTrait`→`sims.traits.add`, `sims.removeTrait`→`sims.traits.remove`
- `src/app/app/legacies/[slug]/sims/[id]/relationships-editor.tsx` — the five relationship renames

Then verify nothing referencing the old paths remains anywhere:
`grep -rn "addSkill\|setSkillLevel\|removeSkill\|addTrait\|removeTrait\|addFamilyRelationship\|removeFamilyRelationship\|addSocialRelationship\|updateSocialRelationship\|removeSocialRelationship" src --include="*.tsx" --include="*.ts" | grep -v "lib/sims" | grep -v "routers/sims"` — expect no hits.

- [ ] **Step 8: Validate** — `npx tsc --noEmit && npm run lint`
- [ ] **Step 9: Full unit/integration suite** — `npm test`. Expected: ALL PASS.
- [ ] **Step 10: Commit (single commit for the whole pivot)** — `but commit refactor/server-lib-domains -m "refactor(sims)!: split sims router into nested sub-routers (skills/traits/family/social paths change)" --changes <ids>` (the `!` marks the breaking tRPC-path change per Conventional Commits).

### Task 15: Final validation and reviews

- [ ] **Step 1: Full test suite** — `npm test`. Expected: ALL PASS.
- [ ] **Step 2: E2E** — kill any stray dev:test server on port 3737 first (`lsof -ti:3737 | xargs kill` if any), then `npm run test:e2e`. Expected: ALL PASS. (Heads-up: e2e runs against the merged workspace of all agents' branches — if a failure looks unrelated to `src/server` or the three editors, check whether it reproduces without this branch before debugging it as ours.)
- [ ] **Step 3: Code review** — run the `/code-review` skill on the branch. Address findings; document reasoning for any false positives.
- [ ] **Step 4: UI sanity** — UI-facing changes: the three editors' tRPC paths (Task 14) and the two sims pages' server-side data wiring (Task 13). No visual change intended in either. Run the web-qa-tester agent against the **sim detail page** (traits, skills, relationships add/edit/remove) and the **add-sim page** (form loads with trait/aspiration/career/household options; creating a sim works) to confirm both still render and function.
- [ ] **Step 5: Report completion** — summarize what moved, the new tRPC paths, and link the rule file. Do not merge or push; the user decides integration (superpowers:finishing-a-development-branch).

---

## Follow-up plans (not this plan)

1. `challengeRuns.ts` → `lib/challenges/linkChallenge.ts` + `applyProgress.ts`, traversal asserts into `lib/auth/ownership.ts`, nested `phases`/`trackers`/`progress` sub-routers.
2. `challenges.ts` → `challenges.phases.*` / `challenges.trackers.*` sub-routers.
3. `households.ts` → `lib/households/createHousehold.ts`, `assertWorldExists` placement.
4. **Remaining RSC pages → `lib/` read functions** (enforce "no direct `db` in pages" everywhere). Each page's inline queries move to a domain read function, mirroring Task 13: `app/page.tsx` (dashboard — `userPack.count`, `legacy.findMany`), `legacies/[slug]/page.tsx` (4 queries — legacy overview + social/family/milestones; the biggest), `legacies/[slug]/tree/page.tsx` (`legacy.findFirst` — reuse `getOwnedLegacyBySlug`), `challenges/[id]/page.tsx` (`legacy.findMany`). Reuse `getOwnedLegacyBySlug`/`listHouseholdOptions` from this plan where they fit.
