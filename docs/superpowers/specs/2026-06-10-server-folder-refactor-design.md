# Server Folder Refactor — Design

**Date:** 2026-06-10
**Status:** Approved (design)
**Scope:** `src/server/**`

## Problem

The tRPC server folder has grown God files. `routers/sims.ts` is 714 lines with 18
procedures, most carrying substantial inline business logic: generation derivation,
founder/partner adoption, heir-cohort clearing, and multi-step transactions. Secondary
offenders mix logic into procedures too — `challengeRuns.ts` (228), `challenges.ts`
(234), `households.ts` (147). The test files mirror this (`sims.test.ts` is 1957 lines).

This causes three problems:

1. Router files are hard to read and hold too much at once.
2. Business logic is entangled with transport concerns (input parsing, auth), so it
   can't be read or tested in isolation.
3. Parallel agents editing the same domain collide in one large file.

## Goals

1. Router files become small and focused.
2. Router procedures perform **no business logic**. A procedure only: parses/validates
   input, asserts ownership/auth, runs a *simple* query **or** delegates to a domain
   module, and returns.
3. Domain logic lives in small, single-purpose modules that are testable in isolation,
   so parallel agents working on different actions touch different files.
4. A rule file documents how to design new code in this folder.

This pattern already exists in miniature — `lib/ownership.ts`, `lib/generation.ts`,
`lib/trackerComputation.ts` are small, separately-tested modules taking a `db`/`tx`
client. The refactor extends that pattern across the folder and pulls the routers down
to it.

## Target architecture

Three roles, three homes:

```
src/server/
  routers/<domain>/      thin tRPC: validate, assert ownership, simple query, delegate
  lib/<domain>/          domain business logic — one file per cohesive action
  routers/index.ts       merges domain routers into appRouter
```

Every module lives in a domain folder under `lib/`. Nothing floats at `lib/` root.

### The router / domain boundary

A **router procedure** is allowed to:

- Parse and validate input with a zod schema.
- Assert ownership / auth via `lib/auth/ownership.ts`.
- Run **one simple query** *or* call **one domain module**.
- Shape and return the result.

A **simple query** is a single Prisma call (`find*` / `count` / `aggregate`) whose
result is returned or directly shaped (`map` / `pick`), with no domain branching.

The moment a procedure needs any of the following, the logic moves to a `lib/<domain>/`
module:

- a transaction;
- a second dependent query that feeds a decision;
- a conditional or multi-step write;
- a derived / computed value (generation numbers, tracker values, scores);
- enforcement of an invariant beyond ownership.

### Domain modules

A domain module:

- takes a `db` / `tx` client plus typed arguments;
- has one clear purpose and a descriptive name (`createSim`, `linkChallenge`,
  `buildMiniTree`);
- throws `TRPCError` directly, matching the existing `ownership.ts` /
  `validate-traits.ts` convention — there is no separate domain-error→HTTP translation
  layer to maintain;
- imports no tRPC router;
- has a colocated test (`*.test.ts`) for genuinely meaningful logic.

**Ownership principle:** a module belongs to the domain that owns the *concept*, even
when other domains consume it. Cross-domain *consumption* is fine and expected;
cross-domain *ownership* is not. For example, `lib/sims/traits.ts` handles a sim's trait
edits (life-stage gating, max-6) and imports the pure conflict rule from
`lib/traits/validate-traits.ts`; `lib/sims/*` calls `lib/challenges/trackerComputation`
to fire a recompute after a sim mutation.

## Domain decomposition

| Domain folder | Residents (existing → moved, plus new modules) |
|---|---|
| `lib/auth/` | `ownership.ts` — the authz boundary, kept whole, outside the feature domains |
| `lib/legacies/` | `generation.ts` (lineage derive/recompute) + legacy-management logic |
| `lib/sims/` | `createSim`, `updateSim`, `family`, `social`, `skills`, `traits` (sim-on-trait orchestration), `buildMiniTree` |
| `lib/traits/` | `validate-traits.ts` (moved from `routers/`) — the pure trait-conflict rule |
| `lib/households/` | `world-options.ts`, `createHousehold` |
| `lib/challenges/` | `challengeBrowse.ts`, `trackerComputation.ts`, `linkChallenge`, `applyProgress` |
| `lib/media/` | `image-url-schema.ts` — shared media-reference validation |

**Out of scope:** the actual upload/storage surface lives outside the server folder
(`src/app/api/upload/route.ts`, `src/app/media/[...key]/route.ts`, `src/lib/storage.ts`).
No `uploads` domain is created under `lib/` — it would have no residents.

## Router decomposition

### sims (the pilot)

`routers/sims.ts` (714) → `routers/sims/`:

```
routers/sims/
  index.ts        merges the sub-routers
  core.ts         create, getById, listByLegacy, update      (paths unchanged: sims.create …)
  tree.ts         getTreeData, getMiniTreeData                (unchanged)
  skills.ts       sims.skills.{add,setLevel,remove}           ← path change
  traits.ts       sims.traits.{add,remove}                    ← path change
  family.ts       sims.family.{add,remove}                    ← path change
  social.ts       sims.social.{add,update,remove}             ← path change
  lifecycle.ts    sims.completeAspiration, sims.endCareer
```

Core CRUD and the tree queries stay top-level on `sims` (no path change). The grouped
editors become nested sub-routers, accepting the path change. The split follows the
existing client components exactly, so client churn is bounded to three files:
`skill-editor.tsx`, `trait-editor.tsx`, `relationships-editor.tsx`.

Logic moves to `lib/sims/`: `createSim` (generation pre-reads, founder-claim
transaction), `updateSim` (heir-cohort clearing, aspiration/career swap, recompute
trigger), `family` / `social` (relationship writes + partner adoption + generation
recompute), `skills` (cap validation + recompute), `traits` (life-stage range + max-6 +
delegated conflict check), `buildMiniTree` (the dense graph-assembly block — gets a
focused unit test).

### Secondary God files

- **`challengeRuns.ts`** — extract `link` (template→run deep copy) → `lib/challenges/linkChallenge.ts`;
  extract `updateProgress` value computation → `lib/challenges/applyProgress.ts` (reusing
  `trackerComputation`). The inline ownership-by-traversal
  (`progress → tracker → phase → run → legacy`) becomes `assertRunPhaseOwned` /
  `assertRunTrackerOwned` / `assertProgressOwned` in `lib/auth/ownership.ts`. Sub-routers:
  `challengeRuns.phases.*`, `challengeRuns.trackers.*`, `challengeRuns.progress.*`.
- **`challenges.ts`** — split `challenges.phases.*` and `challenges.trackers.*`
  sub-routers; extract any non-trivial logic to `lib/challenges/`.
- **`households.ts`** — extract founder-generation computation + create transaction →
  `lib/households/createHousehold.ts`; move `assertWorldExists` to a domain helper.

The already-small, clean routers (`packs`, `traits`, `aspirations`, `careers`,
`milestones`, `trackerTypes`, `legacies`) are left alone except where a module they use
moves (e.g. `legacies` re-imports `generation` and `image-url-schema` from their new
homes).

## Testing

- Split `sims.test.ts` (1957) into per-sub-router test files mirroring the seams,
  **keeping the integration-through-`authedCaller` style** — tests assert observable
  behavior (Testing Trophy), not internals. They exercise the router, which exercises
  the domain modules.
- Add focused colocated unit tests only for genuinely complex pure logic (e.g.
  `buildMiniTree`). The existing `generation` and `trackerComputation` tests move with
  their modules.

## Migration

Refactor **one domain at a time**, each on its own GitButler branch, starting with
`sims` as the pilot, then `challengeRuns` / `challenges` / `households`. The new file
layout is exactly what makes this parallel-safe: distinct domains and distinct actions
live in distinct files. After each domain: `npx tsc --noEmit` and `npm run lint` clean;
full `npm test` / `npm run test:e2e` at the end.

## The rule file

`.claude/rules/server-architecture.md`, with `paths: ["src/server/**"]` frontmatter so
it auto-attaches when editing the server. It documents:

- the router / domain / `lib` responsibilities;
- the "simple query" definition and the list of triggers that force logic into a module;
- the domain-module contract (signature, throws `TRPCError`, colocated test, no router
  import);
- the ownership principle (own by concept, consume across domains);
- folder and sub-router naming conventions; ownership asserts live in `lib/auth/`;
- a ~200-line soft smell-cap on any single file;
- a parallel-agent etiquette note (one file per cohesive action);
- a short before/after worked example from `sims`.
