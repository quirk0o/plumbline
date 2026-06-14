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

## Ownership asserts vs. domain finders

These are two different things; keep them apart.

- An **ownership assert** is a *guard*: it validates that the current user owns
  an entity and **throws** (`NOT_FOUND`, or `FORBIDDEN` when the entity exists
  but belongs to someone else) before any action proceeds. All asserts live
  together in `lib/auth/ownership.ts` as `assert<Entity>Owned(db, id, userId)` —
  add new ones there. They are an auth concern, not a domain concern, which is
  why they share one home regardless of which entity they guard.
- A **finder** is a plain query *utility* that locates an entity and **returns
  it or `null`** — it makes no security promise and never throws on absence.
  Finders belong in their entity's domain (e.g. `lib/legacies/getOwnedLegacy.ts`
  `getOwnedLegacyBySlug` returns `legacy | null` for an RSC page to turn into
  `notFound()`). Do NOT put finders in `lib/auth/ownership.ts`, and do NOT make
  an assert non-throwing — if a caller needs the "or null" shape, that's a
  finder in the domain, not a softened assert.

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
