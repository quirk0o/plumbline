# Challenges & Trackers — Technical Spec

**Date:** 2026-05-16
**Design spec:** `docs/superpowers/specs/2026-05-16-challenges-trackers-design.md`

---

## Overview

This document covers the technical implementation of the challenges and trackers feature. The feature introduces a two-layer model (reusable templates → live runs), a declarative computation engine that auto-evaluates tracker progress from existing sim data, and tRPC routers for CRUD and progress updates.

**Files created:**
- `prisma/schema.prisma` — new models and Sim field additions
- `prisma/seed.ts` — built-in TrackerType rows
- `src/server/lib/trackerComputation.ts` — computation engine
- `src/server/routers/trackerTypes.ts`
- `src/server/routers/challenges.ts`
- `src/server/routers/challengeRuns.ts`

**Files modified:**
- `src/server/routers/sims.ts` — `recomputeLegacyTrackers` calls added to sim mutations

---

## Schema

### Additions to `Sim`

| Field | Type | Notes |
|---|---|---|
| `generationNumber` | `Int?` | Set at creation: `min(parent.generationNumber) + 1`. Founder = 1. User-overridable. |
| `isHeir` | `Boolean` | `@default(false)`. Multiple sims across generations may each be `true`. |

### Template layer

**`TrackerType`** — global registry of tracker behavior definitions.

| Field | Type | Notes |
|---|---|---|
| `id` | `String` | cuid |
| `name` | `String` | |
| `description` | `String?` | |
| `isBuiltIn` | `Boolean` | True for system-seeded types; prevents user modification |
| `isPublic` | `Boolean` | User-created types can be shared |
| `ownerId` | `String?` | Null for system types |
| `computationSpec` | `Json?` | Null = manual entry |
| `configSchema` | `Json` | JSON Schema for user-provided config parameters |
| `goalSchema` | `Json?` | JSON Schema for goal parameters |
| `valueKind` | `ValueKind` | `BOOLEAN \| NUMERICAL \| THRESHOLD` |

**`Challenge`** — reusable template, owned by a user or system.

| Field | Type |
|---|---|
| `id` | `String` |
| `name`, `description` | `String` |
| `isPublic` | `Boolean` |
| `ownerId` | `String?` |
| `createdAt`, `updatedAt` | `DateTime` |

**`ChallengePhase`** — ordered group of trackers within a challenge.

| Field | Notes |
|---|---|
| `generationNumber: Int?` | Null = applies to the legacy as a whole |
| `title: String?`, `description: String?` | |
| `sortOrder: Int` | |

**`TrackerDefinition`** — a tracker instance within a ChallengePhase.

| Field | Notes |
|---|---|
| `trackerTypeId` | References `TrackerType` |
| `config: Json` | Values satisfying `TrackerType.configSchema` |
| `goalConfig: Json?` | Values satisfying `TrackerType.goalSchema` |
| `sortOrder: Int` | |

### Run layer

Created in full when a challenge is linked to a legacy. Source template can evolve freely after linking.

**`ChallengeRun`**

| Field | Notes |
|---|---|
| `legacyId` | Owner legacy |
| `sourceChallengeId: String?` | Lineage reference; nullable if source is deleted |
| `name`, `description` | Copied from Challenge, then user-editable |
| `startedAt` | Set at link time |
| `completedAt: DateTime?` | Set manually; auto-completion is derived at query time |

**`ChallengeRunPhase`** — copied from `ChallengePhase`, user-editable post-link.

**`ChallengeRunTracker`** — copied from `TrackerDefinition`, user-editable post-link. Preserves `trackerTypeId` so the computation engine can re-evaluate.

**`TrackerProgress`** — one row per `ChallengeRunTracker`, created at link time.

| Field | Notes |
|---|---|
| `value: Json?` | `true/false` for BOOLEAN; raw number for NUMERICAL/THRESHOLD; null until first update |
| `completedAt: DateTime?` | Stamped once when the tracker first evaluates as complete; never cleared |
| `isManual: Boolean` | Frozen at link time from `TrackerType.computationSpec === null` |
| `evaluatedAt: DateTime?` | Last auto-evaluation timestamp |

### Indexes added

```
@@index([legacyId, completedAt])  — ChallengeRun
@@index([challengeRunId])          — ChallengeRunPhase
@@index([challengeRunPhaseId])     — ChallengeRunTracker
@@index([trackerTypeId])           — ChallengeRunTracker, TrackerDefinition
@@index([challengePhaseId])        — TrackerDefinition
@@index([ownerId])                 — Challenge, TrackerType
```

---

## Computation engine

**`src/server/lib/trackerComputation.ts`**

### `ComputationSpec` shape

All specs (including those described in the design as "simple" or "compound") are normalized to a single shape at the engine level:

```ts
interface ComputationSpec {
  simFilter: Record<string, unknown>   // scopes which sims are in play
  conditions: Condition[]              // conditions intersected across the same sim set
  aggregation: { op: AggregationOp; field?: string }
  valueKind: 'BOOLEAN' | 'NUMERICAL' | 'THRESHOLD'
}

interface Condition {
  source: 'skills' | 'aspirations' | 'personalityTraits' | 'careers' | 'traits' | 'sims'
  dataFilter: Record<string, unknown>
}

type AggregationOp = 'any' | 'all' | 'count' | 'countUnique' | 'sum'
```

Multi-condition specs always apply same-sim intersection (every condition must be satisfied by the same sim). The design's `compound`/`sameSimId` distinction is not wired up — the engine always behaves as if `constraint: "sameSimId"` is set.

### Reference tokens

Resolved before evaluation:

| Token | Resolves to |
|---|---|
| `"$phase.generationNumber"` | `ChallengeRunPhase.generationNumber`; if null, spec short-circuits to 0/false |
| `"$config.<key>"` | `ChallengeRunTracker.config[key]` |

Implemented in `resolveFilter()` and `resolveValue()`.

### Virtual filter keywords

These expand at query time inside `simIdsSatisfyingCondition()`:

| Keyword | Source | Expansion |
|---|---|---|
| `maxed: true` | `skills` | `SimSkill.level >= Skill.maxLevel` (requires a `skillId` filter; looks up `maxLevel` from `Skill` table) |
| `minLevel: N` | `skills` | `SimSkill.level >= N` |
| `completed: true` | `aspirations` | `SimAspiration.completedAt IS NOT NULL` |
| `completed: true` | `careers` | `SimCareer.endedAt IS NOT NULL` |

SimFilter keywords:

| Keyword | Expansion |
|---|---|
| `generationNumber: N` | `Sim.generationNumber = N` |
| `isHeir: true` | `Sim.isHeir = true` |

### Aggregation ops

| Op | Returns | Semantics |
|---|---|---|
| `any` | `boolean` | At least one sim in `matchingSet` |
| `all` | `boolean` | All sims in scope satisfy all conditions; returns `false` if scope is empty |
| `count` | `number` | Count of sims in `matchingSet` |
| `countUnique` | `number` | Count of distinct values of `aggregation.field` across scope (currently only `personalityTraitId` on `personalityTraits` source) |
| `sum` | `number` | Not yet implemented; throws |

### `evaluateSpec(db, legacyId, spec, config, phaseGenerationNumber)`

1. Resolve `simFilter` tokens → Prisma `WHERE` clause; short-circuit if `$phase.generationNumber` is null.
2. `getSimIds()` — fetch all sim IDs in legacy matching `simFilter`.
3. Iterate conditions, resolving each `dataFilter`; for each condition call `simIdsSatisfyingCondition()` and intersect into `matchingSet`. Short-circuit to 0/false when set is empty.
4. Apply aggregation op to `matchingSet` and return a `boolean | number`.

This is an O(conditions) query pattern — each condition issues one DB round-trip rather than one per sim.

### `recomputeLegacyTrackers(db, legacyId)`

Called at the end of relevant sim mutations. For each incomplete `ChallengeRun`:
- Iterates all non-manual, auto-spec trackers.
- Calls `evaluateSpec` for each.
- Updates `TrackerProgress.value` and `evaluatedAt`.
- Stamps `completedAt` (one-way) when the tracker first evaluates as complete.

Runs synchronously on the mutation request path inside a single serial loop. **Known performance caveat:** with multiple active runs and many trackers, this adds meaningful latency to sim mutations. See Known Limitations.

---

## Scoring logic

| valueKind | Complete when | Points |
|---|---|---|
| `BOOLEAN` | `value === true` | 1 |
| `NUMERICAL` | `value >= goalConfig.goalValue` | 1 |
| `THRESHOLD` | `value >= goalConfig.goalValue` | 1 (per spec; see Known Limitations) |

`completedAt` is one-way: stamped the first time the tracker evaluates as complete and never cleared, even if the value later drops (e.g. a sim loses a skill via cheats).

Total challenge score = sum of `TrackerProgress` points for the run.

Phase and run completion are **derived at query time** — no stored completion flag. A phase is complete when all its trackers have `completedAt !== null`. A run is complete when all phases are complete (or `ChallengeRun.completedAt` is set explicitly).

---

## tRPC routers

All procedures require authentication (`protectedProcedure`). Auth is enforced via ownership checks — `NOT_FOUND` is returned instead of `FORBIDDEN` when a resource exists but belongs to another user (to avoid leaking existence). FK traversal is used: `tracker.phase.run.legacy.userId`.

### `trackerTypesRouter`

| Procedure | Type | Input | Notes |
|---|---|---|---|
| `list` | query | — | Returns built-in types + caller's own types |
| `create` | mutation | `name, description?, valueKind, isPublic, computationSpec?, configSchema, goalSchema?` | Sets `isBuiltIn: false`, `ownerId: userId` |
| `update` | mutation | `id, name?, description?, isPublic?, goalSchema?` | Blocked on built-in types; cannot change `computationSpec` or `valueKind` post-creation |
| `delete` | mutation | `id` | Blocked on built-in types; FK error if type is in use (bubbles as 500 — see Known Limitations) |

### `challengesRouter`

| Procedure | Type | Input | Notes |
|---|---|---|---|
| `create` | mutation | `name, description?, isPublic` | |
| `list` | query | — | Public challenges + caller's own |
| `getById` | query | `id` | Includes phases → trackers → trackerType |
| `update` | mutation | `id, name?, description?, isPublic?` | Owner only |
| `delete` | mutation | `id` | Owner only |
| `addPhase` | mutation | `challengeId, generationNumber?, title?, description?, sortOrder` | |
| `updatePhase` | mutation | `id, generationNumber?, title?, description?, sortOrder?` | |
| `removePhase` | mutation | `id` | |
| `addTracker` | mutation | `challengePhaseId, trackerTypeId, name, description?, config, goalConfig?, sortOrder` | Validates trackerType is accessible (built-in, public, or caller's) |
| `updateTracker` | mutation | `id, name?, description?, config?, goalConfig?, sortOrder?` | |
| `removeTracker` | mutation | `id` | |

### `challengeRunsRouter`

| Procedure | Type | Input | Notes |
|---|---|---|---|
| `link` | mutation | `legacyId, challengeId, name?` | Wraps entire copy-stamp in `$transaction`; creates `TrackerProgress` rows |
| `listByLegacy` | query | `legacyId` | |
| `getById` | query | `id` | Includes phases → trackers → trackerType + progress |
| `updatePhase` | mutation | `id, title?, description?, generationNumber?` | |
| `updateTracker` | mutation | `id, name?, description?, config?, goalConfig?` | |
| `updateProgress` | mutation | `challengeRunTrackerId, value` | Manual trackers only (`isManual = true`); stamps `completedAt` on first completion |

---

## Data flow

1. **Challenge creation** — user creates a `Challenge`, adds `ChallengePhase`s, adds `TrackerDefinition`s referencing `TrackerType`s with their `config`/`goalConfig` values.

2. **Link to a legacy** (`challengeRuns.link`) — creates a `ChallengeRun`; inside one `$transaction`:
   - For each phase: creates a `ChallengeRunPhase` (copying fields from `ChallengePhase`).
   - For each tracker in the phase: creates `ChallengeRunTracker`s via `createMany`; then fetches them back and creates `TrackerProgress` rows, setting `isManual` from `TrackerType.computationSpec === null`.

3. **Tweaking** — user edits `ChallengeRunPhase`/`ChallengeRunTracker` fields post-link via `updatePhase`/`updateTracker`. Source `Challenge` is unaffected.

4. **Auto progress detection** — `recomputeLegacyTrackers(legacyId)` is called at the end of these mutations in `sims.ts`:
   - `addSkill` / `setSkillLevel`
   - `update` (when `generationNumber`, `lifeStage`, `isHeir`, `causeOfDeath`, or `occultType` changes)

5. **Manual progress** — user calls `challengeRuns.updateProgress` with a new value; the router validates `isManual === true` and stamps `completedAt` on first completion.

6. **Phase / run completion** — derived at query time from `TrackerProgress.completedAt` fields. No stored flag.

---

## Seed data

**`prisma/seed.ts`** — upserted by `name` on each seed run. The `update` block is currently empty, so re-seeding does not refresh `computationSpec`/`configSchema`/`goalSchema` for existing rows.

| Name | valueKind | configSchema keys | computationSpec summary |
|---|---|---|---|
| Skill Maxed | BOOLEAN | `skillId` | `source: skills`, `maxed: true`, `aggregation: any` |
| Skill Level | BOOLEAN | `skillId, targetLevel` | `source: skills`, `minLevel: $config.targetLevel`, `aggregation: any` |
| Aspiration Completed | BOOLEAN | `aspirationId` | `source: aspirations`, `completed: true`, `aggregation: any` |
| Career Completed | BOOLEAN | `careerId` | `source: careers`, `completed: true`, `aggregation: any` |
| Sim Died By Cause | BOOLEAN | `causeOfDeath` | `source: sims`, `dataFilter: causeOfDeath: $config.causeOfDeath`, `aggregation: any` |
| Count Unique Traits | NUMERICAL | `category?` | `source: personalityTraits`, `aggregation: countUnique(personalityTraitId)` |
| Manual Boolean | BOOLEAN | — | `computationSpec: null` |
| Manual Numerical | NUMERICAL | — | `computationSpec: null` |
| Manual Threshold | THRESHOLD | — | `computationSpec: null` |

All built-in types scope to `simFilter: { generationNumber: "$phase.generationNumber" }` except Sim Died By Cause (empty simFilter = all sims in legacy).

---

## Key design decisions

| Decision | Choice | Rationale |
|---|---|---|
| `generationNumber` storage | Stored on `Sim`, set at creation | `min(parent.generationNumber) + 1` — single lookup, no tree traversal |
| `isHeir` storage | `Boolean` flag on `Sim` | Simple; multiple sims across generations can all be heirs |
| Template vs. run separation | Full copy on link | Self-contained run; source template can evolve freely |
| `TrackerType` registry | Open table | New tracker types = new rows, no migrations |
| Computation model | Declarative JSON spec | User-buildable via UI; single interpreter; additive ops |
| Multi-condition evaluation | Always same-sim intersection | Simplifies the engine; see Known Limitations for the trade-off |
| Non-linear scoring | `THRESHOLD` valueKind | Intended for per-milestone scoring; see Known Limitations |
| `completedAt` semantics | One-way, stamped on first completion | Preserves the historical record; consistent with scoring intent |
| Auto-completion trigger | Synchronous in sim mutation | Immediate feedback; no background jobs needed at current scale |
| Multiple runs per legacy | Allowed | Players may pursue several challenges simultaneously |

---

## Known limitations

**THRESHOLD scoring mismatch.** The design spec defines THRESHOLD as "N points where N = count of thresholds where value >= threshold". The current engine evaluates THRESHOLD identically to NUMERICAL (`value >= goalConfig.goalValue`). The seeded `goalSchema` for Manual Threshold includes a `thresholds` array / arithmetic progression shape that the runtime ignores. Needs reconciliation: either implement per-threshold point counting or simplify the spec.

**`compound`/`sameSimId` distinction not implemented.** The engine always intersects conditions on the same sim. Goals of the form "any sim has trait X AND any (possibly different) sim has aspiration Y" are not expressible with the current engine.

**Aspiration Completed / Career Completed trackers cannot auto-fire.** The `recomputeLegacyTrackers` call in `sims.update` is gated on `recomputeFields` which excludes `aspirationId`/`careerId`. More importantly, no mutation in this feature sets `SimAspiration.completedAt` or `SimCareer.endedAt` — those fields exist in the schema but there are no `completeAspiration`/`endCareer` procedures yet.

**`recomputeLegacyTrackers` is synchronous on the request path.** With multiple active challenge runs and many trackers, this adds latency to every relevant sim mutation. Consider fire-and-forget via `after()` or a job queue.

**`TrackerType.delete` propagates FK errors as 500.** If a type is referenced by a `TrackerDefinition` or `ChallengeRunTracker` (neither has `onDelete: Cascade`), the delete throws a Prisma FK constraint error that surfaces as an unhandled 500. Should be caught and returned as `BAD_REQUEST`.

**`link` `isManual` determination is fragile.** `TrackerProgress.isManual` is set by matching created run-tracker rows back to source trackers via `(trackerTypeId, name)` — a non-unique pair. If two trackers in a phase share that pair, one will be mis-classified.

**Collections and household wealth** are not in the data model. Collection-based goals and wealth-based goals must use manual NUMERICAL/THRESHOLD trackers.

**No per-tracker point weights.** All goals contribute equally (1 point each). Weighted scoring can be introduced later with a `pointValue` field on `TrackerDefinition`.
