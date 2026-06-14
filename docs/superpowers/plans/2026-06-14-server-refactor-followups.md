# Server Refactor — Follow-up Roadmap

**Date:** 2026-06-14
**Status:** Planning (the sims pilot is complete + fully validated; this roadmap covers the remaining work it deferred)
**Context:** Spec `docs/superpowers/specs/2026-06-10-server-folder-refactor-design.md`; rule `.claude/rules/server-architecture.md`; pilot plan `docs/superpowers/plans/2026-06-12-server-folder-refactor-sims-pilot.md`.

## Where we are

The `sims` pilot established and proved the pattern across the whole server folder:
thin routers under `routers/<domain>/`, business logic in `lib/<domain>/`, RSC pages
reading through `lib/` functions, ownership in `lib/auth/`. **No `src/server` file now
exceeds 300 lines** (the new `typescript-style.md` god-file threshold is satisfied for
the server folder). All tests pass: tsc 0 · lint clean · 829 unit/integration · 14 e2e.

What remains is **not about file size** — the three secondary routers are already
<300 lines — it's about the **router/domain boundary**: they still perform business
logic (transactions, derived values, ownership-by-traversal) inline, which the
`server-architecture` rule forbids. Plus two small correctness/cleanup items and the
rest of the RSC pages.

## Follow-up items (prioritized)

### A — Cross-legacy social-relationship guard *(P1, correctness, XS)*

`lib/sims/social.ts` `addSocialRelationship` has no same-legacy check, unlike
`lib/sims/family.ts` `addFamilyRelationship`. A user owning two legacies can create a
social edge across them; partner-adoption then recomputes only `simA.legacyId`.
Pre-existing (preserved as-is to keep the pilot behavior-neutral) and same-user-only (no
cross-tenant leak), but a real data-integrity gap.

- **Change:** add `if (simA.legacyId !== simB.legacyId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Sims must belong to the same legacy' })` at the top of `addSocialRelationship`.
- **Test:** an integration test that two same-user sims in different legacies are rejected.
- **Risk:** behavior change — confirm no existing test/e2e relies on cross-legacy social. (None found in the pilot.)

### B — Shared ownership asserts in `lib/auth/ownership.ts` *(P1, unblocks C+D, S)*

`challengeRuns.ts` and `challenges.ts` both validate ownership by traversing
`progress → tracker → phase → run → legacy.userId` (and `phase → challenge → ownerId`)
inline, throwing `FORBIDDEN`. Consolidate into named asserts so the routers stay thin
and the traversal lives in one place.

- **Add to `lib/auth/ownership.ts`:** `assertRunPhaseOwned`, `assertRunTrackerOwned`, `assertProgressOwned` (challengeRuns side), and `assertChallengePhaseOwned`, `assertChallengeTrackerOwned` (challenges side).
- **Preserve error codes exactly.** The run-side traversal currently throws **`FORBIDDEN`** (not `NOT_FOUND` like the entity asserts) — keep `FORBIDDEN` so behavior is unchanged. Note this asymmetry in a comment; reconciling NOT_FOUND vs FORBIDDEN across asserts is explicitly out of scope (behavior-preserving).
- **Fold in item G** (below) while in this file.

### C — `challengeRuns.ts` decomposition *(P2, L — its own plan)*

228 lines, 6 procedures, the most inline logic of the three.

- **Extract to `lib/challenges/`:** `linkChallenge` (the template→run deep copy in `link`, ~50 lines of nested creates); `applyProgress` (the BOOLEAN/THRESHOLD/NUMERICAL value computation in `updateProgress`, reusing `resolveThresholds`/`countThresholdsCrossed`); optionally a `summarizeRun`/phase-completion helper for `getById`'s derived `isComplete` flags.
- **Router:** use the B asserts; nest sub-routers `challengeRuns.phases.*`, `challengeRuns.trackers.*`, `challengeRuns.progress.*` (path changes → update clients + tests, mirroring the pilot's T14). `link`/`listByLegacy`/`getById` stay top-level.
- **Tests:** split `challengeRuns.test.ts` (605 lines) per sub-router; preserve count.
- **Depends on:** B.

### D — `challenges.ts` decomposition *(P2, L — its own plan)*

234 lines, 11 procedures (challenge CRUD + phase CRUD + tracker CRUD).

- **Router:** nest `challenges.phases.{add,update,remove}` and `challenges.trackers.{add,update,remove}` sub-routers; `create`/`list`/`getById`/`update`/`delete` stay top-level. Use the B asserts for the phase/tracker ownership traversal.
- **Extract:** any non-trivial logic (the tracker `config`/`goalConfig` JSON handling in `addTracker`/`updateTracker`) into `lib/challenges/` if it grows; most procedures are simple writes that can stay inline once ownership is asserted.
- **Tests:** split `challenges.test.ts` (131 lines) per sub-router.
- **Depends on:** B.

### E — `households.ts` decomposition *(P3, M — its own plan)*

147 lines, 5 procedures.

- **Extract to `lib/households/`:** `createHousehold` (the `foundedGeneration` aggregate + the `$transaction` that creates the household, moves sims, and claims `activeHouseholdId`); move `assertWorldExists` into a `lib/households/` (or `lib/worlds/`) helper.
- **Router:** procedures become thin delegates; likely no path changes (no editor-group nesting needed — 5 flat procedures).
- **Tests:** `households.test.ts` (247 lines) stays one file or splits lightly.
- **Depends on:** nothing (independent).

### F — Remaining RSC pages → `lib/` read functions *(P3, M — its own plan)*

Six pages still import `db` directly, violating the no-direct-db rule: `app/page.tsx`
(dashboard), `legacies/[slug]/page.tsx` (4 queries — the biggest), `legacies/[slug]/tree/page.tsx`,
`challenges/[id]/page.tsx`, plus `settings/packs/page.tsx` and `onboarding/packs/page.tsx`
(these import `db` but delegate it — confirm and either pass through a lib function or
drop the import).

- **Approach:** mirror the pilot's T13 — one read function per page in the owning
  `lib/<domain>/`, page becomes a thin compose. Reuse `getOwnedLegacyBySlug` (post-G)
  and `listHouseholdOptions` where they fit.
- **Depends on:** G (so the legacy-by-slug getter is canonical first).

### G — Consolidate `getOwnedLegacyBySlug` *(P4, XS — batch with B)*

`lib/legacies/getOwnedLegacy.ts` duplicates the query in `assertLegacyOwnedBySlug`
(`lib/auth/ownership.ts`), differing only in throw-vs-null. Speculative divergence risk
(e.g. a future soft-delete filter applied to one but not the other).

- **Change:** add a non-throwing `findOwnedLegacyBySlug` (returns `legacy | null`) to
  `lib/auth/ownership.ts` next to its throwing sibling; have `assertLegacyOwnedBySlug`
  call it; repoint the page; delete `lib/legacies/getOwnedLegacy.ts`.
- **Judgment call:** alternatively keep the legacy-domain home and accept the 1-line
  dup — decide deliberately. Low stakes either way.

## Suggested sequence

1. **Cleanup PR:** A + B + G together (all small; B+G share `lib/auth/ownership.ts`; A is independent but tiny). One branch, one review.
2. **C** (`challengeRuns`) — its own plan + branch (largest logic payoff; exercises the B asserts).
3. **D** (`challenges`) — its own plan + branch (reuses B).
4. **E** (`households`) — its own plan + branch (independent; can run in parallel with C/D since different files).
5. **F** (RSC pages) — its own plan + branch (after G).

Each of C–F is a pilot-shaped effort: extract logic → thin the router (+ nest sub-routers
where editor groups exist) → split tests preserving count → update callers → validate
tsc/lint/test(/e2e). Run each as its own `writing-plans` plan executed task-by-task, so
behavior stays pinned by the existing tests at every step.

## Multi-agent / GitButler note

These can run as parallel GitButler branches **except where they share a file**: A+B+G
all touch `lib/auth/ownership.ts` / `lib/sims/social.ts` (do them as one branch), and
C+D both consume the B asserts (sequence B before C/D). E and F touch disjoint files and
can run in parallel with the others. Watch the same merged-workspace materialization seen
in the pilot (other branches resurrecting deleted files) at integration time — resolve
with a proper 3-way merge, never `--ours/--theirs`.
