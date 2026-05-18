# Challenges & Trackers — Design Spec

**Date:** 2026-05-16

## Context

SimsTrack currently tracks sims, skills, aspirations, careers, traits, and relationships within legacies. It has no concept of challenges — the structured goal-tracking frameworks central to Sims legacy challenges (e.g. the official Legacy Challenge, Rags to Riches). This spec defines the data model covering challenge templates, flexible tracker types with user-configurable computation, run-time linking to legacies, and automated progress detection.

Gap analysis against the official Legacy Challenge confirmed the model covers the main goal types. Additions incorporated: `isHeir` on Sim, `source: "sims"` in computation specs, compound conditions with a same-sim constraint, and a `THRESHOLD` valueKind for non-linear scoring.

---

## Changes to existing models

### Sim
- **`generationNumber: Int?`** — set at creation as `min(parent.generationNumber) + 1`. The founder sim is always generation `1`, set when the legacy is created. User-overridable. No recursive CTE needed — parent's value is already stored.
- **`isHeir: Boolean @default(false)`** — marks the sim carrying the legacy forward. Only one sim per generation per legacy may be heir at a time. When `isHeir = true` is set on a sim in generation N, any other sim with the same `generationNumber` in the same legacy is automatically cleared to `isHeir = false`. Supported as a simFilter keyword in computation specs.

---

## Entity model

### Template layer (reusable, shareable definitions)

**`Challenge`**
- `id`, `name`, `description`
- `isPublic: Boolean`
- `ownerId: String?` — null for system-seeded challenges
- `createdAt`, `updatedAt`

**`ChallengePhase`**
- `id`, `challengeId`
- `generationNumber: Int?` — null = general goals that apply to the legacy as a whole
- `title: String?` — e.g. "The Founder's Tasks"
- `description: String?`
- `sortOrder: Int`

**`TrackerType`** — global registry; both built-ins and user-defined types live here
- `id`, `name`, `description`
- `isBuiltIn: Boolean`
- `isPublic: Boolean` — user-created types can be shared
- `ownerId: String?` — null for system types
- `computationSpec: Json?` — null = manual entry
- `configSchema: Json` — JSON Schema describing parameters the user provides when instantiating
- `goalSchema: Json?` — JSON Schema for goal parameters
- `valueKind: ValueKind` — `BOOLEAN | NUMERICAL | THRESHOLD`

**`TrackerDefinition`** — a tracker instance within a ChallengePhase
- `id`, `challengePhaseId`, `trackerTypeId`
- `name: String`, `description: String?`
- `config: Json` — values matching TrackerType.configSchema
- `goalConfig: Json?` — values matching TrackerType.goalSchema
- `sortOrder: Int`

---

### Run layer (full copy stamped when a challenge is linked to a legacy)

**`ChallengeRun`**
- `id`, `legacyId`
- `sourceChallengeId: String?` — lineage reference to originating Challenge
- `name: String`, `description: String?`
- `startedAt: DateTime`, `completedAt: DateTime?`
- `createdAt`, `updatedAt`

A legacy can have multiple active ChallengeRuns simultaneously.

**`ChallengeRunPhase`** — copied from ChallengePhase at link time, then user-editable
- `id`, `challengeRunId`
- `generationNumber: Int?`, `title: String?`, `description: String?`, `sortOrder: Int`

**`ChallengeRunTracker`** — copied from TrackerDefinition at link time, then user-editable
- `id`, `challengeRunPhaseId`, `trackerTypeId` (preserved for computation)
- `name: String`, `description: String?`
- `config: Json`, `goalConfig: Json?`
- `sortOrder: Int`

**`TrackerProgress`** — one row per ChallengeRunTracker, created at link time
- `id`, `challengeRunTrackerId`
- `value: Json` — `true/false` for BOOLEAN; raw number for NUMERICAL and THRESHOLD
- `completedAt: DateTime?` — stamped when tracker first evaluates as fully complete
- `isManual: Boolean`
- `evaluatedAt: DateTime?`
- `updatedAt: DateTime`

---

## Scoring model

- **BOOLEAN** met (`value = true`) = 1 point
- **NUMERICAL** met (`value >= goalConfig.goalValue`) = 1 point
- **THRESHOLD** = N points where N = count of thresholds where `value >= threshold`; `completedAt` stamped when all thresholds are crossed

Total challenge score = sum of points across all TrackerProgress rows for the run.

---

## Computation spec format

Stored in `TrackerType.computationSpec`. There is a single unified shape for both simple and compound goals:

```json
{
  "simFilter": { "<simField>": "<literal> | $phase.generationNumber | $config.<key>" },
  "conditions": [
    { "source": "skills | aspirations | personalityTraits | careers | traits | sims", "dataFilter": { "<field>": "<literal> | $config.<key>" } }
  ],
  "aggregation": {
    "op": "any | all | count | countUnique | sum",
    "field": "<field — required for countUnique and sum>"
  },
  "valueKind": "BOOLEAN | NUMERICAL | THRESHOLD"
}
```

- `simFilter` scopes which sims are candidates (generation, isHeir, etc.)
- Each entry in `conditions` checks one data source per sim
- A sim "matches" if it satisfies **all** conditions — the same-sim constraint is structural, not a separate keyword
- `aggregation` is applied across matching sims: `any` → at least one; `count` → how many; `countUnique` → distinct values of `field` across all scoped sims

**Single-condition example** (one sim maxed a skill):
```json
{
  "simFilter": { "generationNumber": "$phase.generationNumber" },
  "conditions": [{ "source": "skills", "dataFilter": { "skillId": "$config.skillId", "maxed": true } }],
  "aggregation": { "op": "any" },
  "valueKind": "BOOLEAN"
}
```

**Multi-condition example** (one sim maxed cooking AND gourmet cooking):
```json
{
  "simFilter": { "generationNumber": "$phase.generationNumber" },
  "conditions": [
    { "source": "skills", "dataFilter": { "skillId": "cooking", "maxed": true } },
    { "source": "skills", "dataFilter": { "skillId": "gourmet-cooking", "maxed": true } }
  ],
  "aggregation": { "op": "any" },
  "valueKind": "BOOLEAN"
}
```

When `source: "sims"`, `simFilter` sets the broad scope and `dataFilter` checks additional sim-level properties (occultType, causeOfDeath, gender, lifeStage).

---

### Reference tokens
- `$phase.generationNumber` — resolved to the ChallengeRunPhase's generationNumber at evaluation
- `$config.<key>` — resolved from ChallengeRunTracker.config at evaluation

### Virtual filter / dataFilter keywords
- `"maxed": true` on source `"skills"` → `SimSkill.level >= Skill.maxLevel`
- `"minLevel": N` on source `"skills"` → `SimSkill.level >= N`
- `"completed": true` on source `"aspirations"` → `SimAspiration.completedAt IS NOT NULL`
- `"completed": true` on source `"careers"` → `SimCareer.endedAt IS NOT NULL`
- `"isHeir": true` in `simFilter` → `Sim.isHeir = true`

---

### goalSchema shapes by valueKind

**BOOLEAN** — no goalSchema needed.

**NUMERICAL**
```json
{ "goalValue": "number", "unit": "string?" }
```

**THRESHOLD** — supports regular (arithmetic) or irregular (explicit list) progressions:
```json
{
  "oneOf": [
    { "thresholds": "number[]" },
    { "start": "number", "step": "number", "count": "number" }
  ],
  "unit": "string?"
}
```

Wealth example (10 × §100k): `{ "start": 100000, "step": 100000, "count": 10, "unit": "§" }`
Irregular example (collection milestones at 3, 7, 13): `{ "thresholds": [3, 7, 13], "unit": "collections" }`

---

### Built-in TrackerType seeds

**Skill Maxed** — `BOOLEAN`, `configSchema: { skillId: string }`
```json
{ "simFilter": { "generationNumber": "$phase.generationNumber" }, "conditions": [{ "source": "skills", "dataFilter": { "skillId": "$config.skillId", "maxed": true } }], "aggregation": { "op": "any" }, "valueKind": "BOOLEAN" }
```

**Skill Level** — `BOOLEAN`, `configSchema: { skillId: string, targetLevel: number }`
```json
{ "simFilter": { "generationNumber": "$phase.generationNumber" }, "conditions": [{ "source": "skills", "dataFilter": { "skillId": "$config.skillId", "minLevel": "$config.targetLevel" } }], "aggregation": { "op": "any" }, "valueKind": "BOOLEAN" }
```

**Aspiration Completed** — `BOOLEAN`, `configSchema: { aspirationId: string }`
```json
{ "simFilter": { "generationNumber": "$phase.generationNumber" }, "conditions": [{ "source": "aspirations", "dataFilter": { "aspirationId": "$config.aspirationId", "completed": true } }], "aggregation": { "op": "any" }, "valueKind": "BOOLEAN" }
```

**Career Completed** — `BOOLEAN`, `configSchema: { careerId: string }`
```json
{ "simFilter": { "generationNumber": "$phase.generationNumber" }, "conditions": [{ "source": "careers", "dataFilter": { "careerId": "$config.careerId", "completed": true } }], "aggregation": { "op": "any" }, "valueKind": "BOOLEAN" }
```

**Sim Died By Cause** — `BOOLEAN`, `configSchema: { causeOfDeath: CauseOfDeath }`
```json
{ "simFilter": {}, "conditions": [{ "source": "sims", "dataFilter": { "causeOfDeath": "$config.causeOfDeath" } }], "aggregation": { "op": "any" }, "valueKind": "BOOLEAN" }
```

**Count Unique Traits** — `NUMERICAL`, `configSchema: { category?: TraitCategory }`, `goalSchema: { goalValue: number, unit?: string }`
```json
{ "simFilter": { "generationNumber": "$phase.generationNumber" }, "conditions": [{ "source": "personalityTraits", "dataFilter": { "category": "$config.category" } }], "aggregation": { "op": "countUnique", "field": "personalityTraitId" }, "valueKind": "NUMERICAL" }
```
`countUnique` counts distinct trait IDs across all sims in scope.

**Manual Boolean** — `computationSpec: null`, `valueKind: BOOLEAN`, `configSchema: {}`

**Manual Numerical** — `computationSpec: null`, `valueKind: NUMERICAL`, `configSchema: {}`, `goalSchema: { goalValue: number, unit?: string }`

**Manual Threshold** — `computationSpec: null`, `valueKind: THRESHOLD`, `configSchema: {}`, goalSchema: threshold shape

---

## Data flow

1. **Challenge creation** — user creates a Challenge, adds ChallengePhases (with generationNumber or null), adds TrackerDefinitions referencing TrackerTypes with their config/goalConfig values.

2. **Challenge linking to a legacy** — creates a ChallengeRun; stamps full copies: ChallengePhases → ChallengeRunPhases, TrackerDefinitions → ChallengeRunTrackers. Creates a TrackerProgress row per ChallengeRunTracker.

3. **Tweaking** — user edits ChallengeRunPhase / ChallengeRunTracker fields post-link. Source Challenge is unaffected.

4. **Automatic progress detection** — `recomputeLegacyTrackers(legacyId)` called at the end of every relevant sim mutation:
   - `sims.updateSkill` / `sims.addSkill`
   - `sims.completeAspiration`
   - `sims.endCareer`
   - `sims.update` (for causeOfDeath, occultType, isHeir changes)

5. **Manual progress** — user updates TrackerProgress.value for manual trackers.

6. **Phase / run completion** — derived at query time. No stored flag needed.

---

## Key decisions

| Decision | Choice | Rationale |
|---|---|---|
| Generation storage | Stored on Sim, set at creation | `min(parent.generationNumber) + 1` — single lookup, no tree traversal |
| isHeir storage | Boolean flag on Sim | Simple; multiple sims across generations can all be heirs |
| Template vs. run separation | Full copy on link | Self-contained run; source template can evolve freely |
| Tracker extension point | TrackerType registry (open table) | New tracker types = new rows, no migrations |
| Computation model | Declarative JSON spec | User-buildable via UI; single interpreter; additive ops |
| Compound conditions | `compound` spec type with optional `sameSimId` | Handles "one sim must satisfy all conditions" without a new model layer |
| Non-linear scoring | `THRESHOLD` valueKind | Each threshold crossed = 1 point; arithmetic and irregular progressions supported |
| Scoring model | 1 point per met goal / per met threshold | Simple, uniform; no per-tracker point weights needed initially |
| Auto-completion trigger | Sim mutation handlers | Immediate; no background jobs |
| Multiple runs per legacy | Allowed | User may run several challenges simultaneously |

---

## Known limitations (out of scope for now)

- **Collections** — in-game collections (fossils, crystals, etc.) are not in the data model; collection-based goals require manual NUMERICAL/THRESHOLD trackers
- **Household wealth** — net worth is not tracked in the app; wealth-based goals must be manual THRESHOLD trackers until wealth tracking is added
- **Points weighting** — all goals contribute equally (1 point each); weighted scoring can be introduced later with a `pointValue` field on TrackerDefinition

---

## Files to create / modify

- `prisma/schema.prisma` — add `generationNumber` and `isHeir` to `Sim`; add `Challenge`, `ChallengePhase`, `TrackerType`, `TrackerDefinition`, `ChallengeRun`, `ChallengeRunPhase`, `ChallengeRunTracker`, `TrackerProgress`
- `prisma/seed.ts` — seed built-in TrackerTypes
- `src/server/routers/challenges.ts` — CRUD for Challenge, ChallengePhase, TrackerDefinition
- `src/server/routers/challengeRuns.ts` — link challenge to legacy, query runs, tweak run phases/trackers
- `src/server/routers/trackerTypes.ts` — CRUD for user-created TrackerTypes
- `src/server/lib/trackerComputation.ts` — computation spec interpreter (simple + compound) + `recomputeLegacyTrackers`
- `src/server/routers/sims.ts` — add `recomputeLegacyTrackers` call to skill/aspiration/career/update mutations
