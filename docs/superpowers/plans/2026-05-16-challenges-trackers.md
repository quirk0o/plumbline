# Challenges & Trackers — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Challenges & Trackers system — challenge templates with per-generation phases, flexible tracker types with declarative computation specs, run-time linking to legacies, and automated progress detection triggered by sim mutations.

**Architecture:** Template/run split — Challenge/ChallengePhase/TrackerDefinition are reusable templates; ChallengeRun/ChallengeRunPhase/ChallengeRunTracker are full copies stamped at link time. TrackerType is a global registry with a JSON computation spec evaluated by a single interpreter. Sim mutations call `recomputeLegacyTrackers` to auto-stamp completedAt on newly-satisfied trackers.

**Tech Stack:** Prisma (PostgreSQL), tRPC (`protectedProcedure`), Zod, Vitest integration tests

**Spec:** `docs/superpowers/specs/2026-05-16-challenges-trackers-design.md`

---

## File map

| File | Action | Responsibility |
|---|---|---|
| `prisma/schema.prisma` | Modify | Add `generationNumber`, `isHeir` to Sim; add 8 new models + `ValueKind` enum; add back-relations to User and Legacy |
| `prisma/seed.ts` | Modify | Seed built-in TrackerTypes |
| `src/server/lib/trackerComputation.ts` | Create | Computation spec interpreter + `recomputeLegacyTrackers` |
| `src/server/lib/trackerComputation.test.ts` | Create | Integration tests for computation engine |
| `src/server/routers/trackerTypes.ts` | Create | CRUD for TrackerType (list, create, update, delete) |
| `src/server/routers/trackerTypes.test.ts` | Create | Integration tests |
| `src/server/routers/challenges.ts` | Create | CRUD for Challenge, ChallengePhase, TrackerDefinition |
| `src/server/routers/challenges.test.ts` | Create | Integration tests |
| `src/server/routers/challengeRuns.ts` | Create | Link challenge→legacy, query, tweak phases/trackers, update progress |
| `src/server/routers/challengeRuns.test.ts` | Create | Integration tests |
| `src/server/routers/sims.ts` | Modify | Auto-populate `generationNumber` on create; call `recomputeLegacyTrackers` in skill/aspiration/career mutations |
| `src/server/routers/sims.test.ts` | Modify | Tests for `generationNumber` population |
| `src/server/routers/index.ts` | Modify | Register three new routers |
| `src/test/helpers.ts` | Modify | Add `createTestTrackerType`, `createTestChallenge`, `createTestChallengeRun` |

---

## Task 1: Schema — Sim fields

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add `generationNumber` and `isHeir` to the Sim model**

In `prisma/schema.prisma`, inside the `model Sim { ... }` block, add after `createdAt DateTime @default(now())`:

```prisma
  generationNumber  Int?
  isHeir            Boolean       @default(false)
```

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name add-sim-generation-fields
```

Expected: migration file created, `Applying migration` logged, no errors.

- [ ] **Step 3: Verify TypeScript sees the new fields**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(schema): add generationNumber and isHeir to Sim"
```

---

## Task 2: Schema — New models

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add `ValueKind` enum**

After the existing enums in `prisma/schema.prisma`, add:

```prisma
enum ValueKind {
  BOOLEAN
  NUMERICAL
  THRESHOLD
}
```

- [ ] **Step 2: Add `TrackerType` model**

```prisma
model TrackerType {
  id              String    @id @default(cuid())
  name            String
  description     String?
  isBuiltIn       Boolean   @default(false)
  isPublic        Boolean   @default(false)
  ownerId         String?
  computationSpec Json?
  configSchema    Json      @default("{}")
  goalSchema      Json?
  valueKind       ValueKind
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  owner       User?                 @relation("UserTrackerTypes", fields: [ownerId], references: [id], onDelete: SetNull)
  trackerDefs TrackerDefinition[]
  runTrackers ChallengeRunTracker[]

  @@map("tracker_types")
}
```

- [ ] **Step 3: Add `Challenge` and `ChallengePhase` models**

```prisma
model Challenge {
  id          String   @id @default(cuid())
  name        String
  description String?
  isPublic    Boolean  @default(false)
  ownerId     String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  owner  User?            @relation("UserChallenges", fields: [ownerId], references: [id], onDelete: SetNull)
  phases ChallengePhase[]
  runs   ChallengeRun[]

  @@map("challenges")
}

model ChallengePhase {
  id               String   @id @default(cuid())
  challengeId      String
  generationNumber Int?
  title            String?
  description      String?
  sortOrder        Int      @default(0)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  challenge Challenge           @relation(fields: [challengeId], references: [id], onDelete: Cascade)
  trackers  TrackerDefinition[]

  @@map("challenge_phases")
}

model TrackerDefinition {
  id               String   @id @default(cuid())
  challengePhaseId String
  trackerTypeId    String
  name             String
  description      String?
  config           Json     @default("{}")
  goalConfig       Json?
  sortOrder        Int      @default(0)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  phase       ChallengePhase @relation(fields: [challengePhaseId], references: [id], onDelete: Cascade)
  trackerType TrackerType    @relation(fields: [trackerTypeId], references: [id])

  @@map("tracker_definitions")
}
```

- [ ] **Step 4: Add run-layer models**

```prisma
model ChallengeRun {
  id                String    @id @default(cuid())
  legacyId          String
  sourceChallengeId String?
  name              String
  description       String?
  startedAt         DateTime  @default(now())
  completedAt       DateTime?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  legacy          Legacy              @relation(fields: [legacyId], references: [id], onDelete: Cascade)
  sourceChallenge Challenge?          @relation(fields: [sourceChallengeId], references: [id], onDelete: SetNull)
  phases          ChallengeRunPhase[]

  @@map("challenge_runs")
}

model ChallengeRunPhase {
  id               String   @id @default(cuid())
  challengeRunId   String
  generationNumber Int?
  title            String?
  description      String?
  sortOrder        Int      @default(0)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  run      ChallengeRun          @relation(fields: [challengeRunId], references: [id], onDelete: Cascade)
  trackers ChallengeRunTracker[]

  @@map("challenge_run_phases")
}

model ChallengeRunTracker {
  id                  String   @id @default(cuid())
  challengeRunPhaseId String
  trackerTypeId       String
  name                String
  description         String?
  config              Json     @default("{}")
  goalConfig          Json?
  sortOrder           Int      @default(0)
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  phase       ChallengeRunPhase @relation(fields: [challengeRunPhaseId], references: [id], onDelete: Cascade)
  trackerType TrackerType       @relation(fields: [trackerTypeId], references: [id])
  progress    TrackerProgress?

  @@map("challenge_run_trackers")
}

model TrackerProgress {
  id                    String    @id @default(cuid())
  challengeRunTrackerId String    @unique
  value                 Json?
  completedAt           DateTime?
  isManual              Boolean   @default(true)
  evaluatedAt           DateTime?
  updatedAt             DateTime  @updatedAt

  tracker ChallengeRunTracker @relation(fields: [challengeRunTrackerId], references: [id], onDelete: Cascade)

  @@map("tracker_progress")
}
```

- [ ] **Step 5: Add back-relations to `User` and `Legacy`**

In the `model User { ... }` block, add:
```prisma
  trackerTypes TrackerType[] @relation("UserTrackerTypes")
  challenges   Challenge[]   @relation("UserChallenges")
```

In the `model Legacy { ... }` block, add:
```prisma
  challengeRuns ChallengeRun[]
```

- [ ] **Step 6: Run migration**

```bash
npx prisma migrate dev --name add-challenges-tracker-models
```

Expected: migration succeeds, all tables created.

- [ ] **Step 7: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(schema): add TrackerType, Challenge, ChallengeRun and related models"
```

---

## Task 3: Test helpers

**Files:**
- Modify: `src/test/helpers.ts`

- [ ] **Step 1: Add imports and three helper functions**

At the bottom of `src/test/helpers.ts`, add:

```typescript
export async function createTestTrackerType(
  overrides: { name?: string; valueKind?: 'BOOLEAN' | 'NUMERICAL' | 'THRESHOLD'; ownerId?: string } = {},
) {
  return db.trackerType.create({
    data: {
      name: overrides.name ?? 'Test Tracker',
      valueKind: overrides.valueKind ?? 'BOOLEAN',
      configSchema: {},
      isBuiltIn: false,
      isPublic: false,
      ownerId: overrides.ownerId ?? null,
    },
  })
}

export async function createTestChallenge(
  ownerId: string,
  overrides: { name?: string; isPublic?: boolean } = {},
) {
  return db.challenge.create({
    data: {
      name: overrides.name ?? 'Test Challenge',
      isPublic: overrides.isPublic ?? false,
      ownerId,
    },
  })
}

export async function createTestChallengePhase(
  challengeId: string,
  overrides: { generationNumber?: number | null; title?: string } = {},
) {
  return db.challengePhase.create({
    data: {
      challengeId,
      generationNumber: overrides.generationNumber ?? null,
      title: overrides.title ?? 'Phase 1',
      sortOrder: 0,
    },
  })
}

export async function createTestChallengeRun(
  legacyId: string,
  overrides: { name?: string; sourceChallengeId?: string } = {},
) {
  return db.challengeRun.create({
    data: {
      legacyId,
      name: overrides.name ?? 'Test Run',
      sourceChallengeId: overrides.sourceChallengeId ?? null,
    },
  })
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/test/helpers.ts
git commit -m "test(helpers): add challenge and tracker type helpers"
```

---

## Task 4: Seed built-in TrackerTypes

**Files:**
- Modify: `prisma/seed.ts`

- [ ] **Step 1: Add TrackerType seeding block at the end of `main()` in `prisma/seed.ts`**

After all existing seeding, before `console.log('Seeding complete.')`, add:

```typescript
  // ── Built-in TrackerTypes ─────────────────────────────────────────────────
  console.log('Seeding built-in tracker types...')

  const builtInTrackerTypes = [
    {
      name: 'Skill Maxed',
      description: 'A sim in the phase generation has maxed a specific skill.',
      valueKind: 'BOOLEAN' as const,
      computationSpec: {
        simFilter: { generationNumber: '$phase.generationNumber' },
        conditions: [{ source: 'skills', dataFilter: { skillId: '$config.skillId', maxed: true } }],
        aggregation: { op: 'any' },
        valueKind: 'BOOLEAN',
      },
      configSchema: { type: 'object', properties: { skillId: { type: 'string' } }, required: ['skillId'] },
    },
    {
      name: 'Skill Level',
      description: 'A sim in the phase generation has reached a target skill level.',
      valueKind: 'BOOLEAN' as const,
      computationSpec: {
        simFilter: { generationNumber: '$phase.generationNumber' },
        conditions: [{ source: 'skills', dataFilter: { skillId: '$config.skillId', minLevel: '$config.targetLevel' } }],
        aggregation: { op: 'any' },
        valueKind: 'BOOLEAN',
      },
      configSchema: {
        type: 'object',
        properties: { skillId: { type: 'string' }, targetLevel: { type: 'number' } },
        required: ['skillId', 'targetLevel'],
      },
    },
    {
      name: 'Aspiration Completed',
      description: 'A sim in the phase generation has completed a specific aspiration.',
      valueKind: 'BOOLEAN' as const,
      computationSpec: {
        simFilter: { generationNumber: '$phase.generationNumber' },
        conditions: [{ source: 'aspirations', dataFilter: { aspirationId: '$config.aspirationId', completed: true } }],
        aggregation: { op: 'any' },
        valueKind: 'BOOLEAN',
      },
      configSchema: { type: 'object', properties: { aspirationId: { type: 'string' } }, required: ['aspirationId'] },
    },
    {
      name: 'Career Completed',
      description: 'A sim in the phase generation has completed a specific career.',
      valueKind: 'BOOLEAN' as const,
      computationSpec: {
        simFilter: { generationNumber: '$phase.generationNumber' },
        conditions: [{ source: 'careers', dataFilter: { careerId: '$config.careerId', completed: true } }],
        aggregation: { op: 'any' },
        valueKind: 'BOOLEAN',
      },
      configSchema: { type: 'object', properties: { careerId: { type: 'string' } }, required: ['careerId'] },
    },
    {
      name: 'Sim Died By Cause',
      description: 'Any legacy sim died by a specific cause.',
      valueKind: 'BOOLEAN' as const,
      computationSpec: {
        simFilter: {},
        conditions: [{ source: 'sims', dataFilter: { causeOfDeath: '$config.causeOfDeath' } }],
        aggregation: { op: 'any' },
        valueKind: 'BOOLEAN',
      },
      configSchema: { type: 'object', properties: { causeOfDeath: { type: 'string' } }, required: ['causeOfDeath'] },
    },
    {
      name: 'Count Unique Traits',
      description: 'Count distinct personality traits across sims in the phase generation.',
      valueKind: 'NUMERICAL' as const,
      computationSpec: {
        simFilter: { generationNumber: '$phase.generationNumber' },
        conditions: [{ source: 'personalityTraits', dataFilter: {} }],
        aggregation: { op: 'countUnique', field: 'personalityTraitId' },
        valueKind: 'NUMERICAL',
      },
      configSchema: { type: 'object', properties: { category: { type: 'string' } } },
      goalSchema: { type: 'object', properties: { goalValue: { type: 'number' }, unit: { type: 'string' } }, required: ['goalValue'] },
    },
    {
      name: 'Manual Goal',
      description: 'A custom goal the user marks complete manually.',
      valueKind: 'BOOLEAN' as const,
      computationSpec: null,
      configSchema: { type: 'object', properties: {} },
    },
    {
      name: 'Manual Numerical Goal',
      description: 'A custom numerical goal the user tracks manually toward a target value.',
      valueKind: 'NUMERICAL' as const,
      computationSpec: null,
      configSchema: { type: 'object', properties: {} },
      goalSchema: { type: 'object', properties: { goalValue: { type: 'number' }, unit: { type: 'string' } }, required: ['goalValue'] },
    },
    {
      name: 'Manual Threshold Goal',
      description: 'A goal with multiple thresholds, each worth one point when crossed.',
      valueKind: 'THRESHOLD' as const,
      computationSpec: null,
      configSchema: { type: 'object', properties: {} },
      goalSchema: {
        type: 'object',
        oneOf: [
          { properties: { thresholds: { type: 'array', items: { type: 'number' } }, unit: { type: 'string' } }, required: ['thresholds'] },
          { properties: { start: { type: 'number' }, step: { type: 'number' }, count: { type: 'number' }, unit: { type: 'string' } }, required: ['start', 'step', 'count'] },
        ],
      },
    },
  ]

  for (const tt of builtInTrackerTypes) {
    await prisma.trackerType.upsert({
      where: { name: tt.name } as never,
      update: {},
      create: {
        ...tt,
        isBuiltIn: true,
        isPublic: true,
        goalSchema: tt.goalSchema ?? null,
      },
    })
  }
```

> Note: the `upsert` uses `name` as the unique key. You'll need to add `@@unique([name])` to the `TrackerType` model (only for built-ins — or just use `name` uniqueness globally). Add `name String @unique` to the TrackerType model in schema.prisma and re-run migration before seeding.

- [ ] **Step 2: Add `@unique` to TrackerType.name in schema**

In `prisma/schema.prisma`, change `name String` on `TrackerType` to:
```prisma
  name String @unique
```

Run:
```bash
npx prisma migrate dev --name tracker-type-unique-name
```

- [ ] **Step 3: Run seed**

```bash
npm run db:seed
```

Expected: `Seeding built-in tracker types...` logged, no errors.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/ prisma/seed.ts
git commit -m "feat(seed): add built-in TrackerTypes"
```

---

## Task 5: Computation engine — evaluateSpec

**Files:**
- Create: `src/server/lib/trackerComputation.ts`
- Create: `src/server/lib/trackerComputation.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/server/lib/trackerComputation.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { db } from '@/server/db'
import { createTestUser, cleanupUser, createTestLegacy } from '@/test/helpers'
import { evaluateSpec } from './trackerComputation'

describe('evaluateSpec — skill maxed (single condition)', () => {
  let userId: string
  let legacyId: string
  let simId: string

  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
    const legacy = await createTestLegacy(userId)
    legacyId = legacy.id
    const sim = await db.sim.create({
      data: { legacyId, firstName: 'Bella', lastName: 'Goth', gender: 'FEMALE', lifeStage: 'YOUNG_ADULT', generationNumber: 1 },
    })
    simId = sim.id
  })

  afterEach(async () => { await cleanupUser(userId) })

  it('returns false when sim has not maxed the skill', async () => {
    const skill = await db.skill.findFirst()
    if (!skill) return
    await db.simSkill.create({ data: { simId, skillId: skill.id, level: 1 } })
    const result = await evaluateSpec(db, legacyId, {
      simFilter: { generationNumber: 1 },
      conditions: [{ source: 'skills', dataFilter: { skillId: skill.id, maxed: true } }],
      aggregation: { op: 'any' },
      valueKind: 'BOOLEAN',
    }, {})
    expect(result).toBe(false)
  })

  it('returns true when sim has maxed the skill', async () => {
    const skill = await db.skill.findFirst()
    if (!skill) return
    await db.simSkill.create({ data: { simId, skillId: skill.id, level: skill.maxLevel } })
    const result = await evaluateSpec(db, legacyId, {
      simFilter: { generationNumber: 1 },
      conditions: [{ source: 'skills', dataFilter: { skillId: skill.id, maxed: true } }],
      aggregation: { op: 'any' },
      valueKind: 'BOOLEAN',
    }, {})
    expect(result).toBe(true)
  })
})

describe('evaluateSpec — aspiration completed (single condition)', () => {
  let userId: string
  let legacyId: string
  let simId: string

  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
    const legacy = await createTestLegacy(userId)
    legacyId = legacy.id
    const sim = await db.sim.create({
      data: { legacyId, firstName: 'Don', lastName: 'Lothario', gender: 'MALE', lifeStage: 'YOUNG_ADULT', generationNumber: 1 },
    })
    simId = sim.id
  })

  afterEach(async () => { await cleanupUser(userId) })

  it('returns false when aspiration not completed', async () => {
    const aspiration = await db.aspiration.findFirst()
    if (!aspiration) return
    await db.simAspiration.create({ data: { simId, aspirationId: aspiration.id } })
    const result = await evaluateSpec(db, legacyId, {
      simFilter: { generationNumber: 1 },
      conditions: [{ source: 'aspirations', dataFilter: { aspirationId: aspiration.id, completed: true } }],
      aggregation: { op: 'any' },
      valueKind: 'BOOLEAN',
    }, {})
    expect(result).toBe(false)
  })

  it('returns true when aspiration is completed', async () => {
    const aspiration = await db.aspiration.findFirst()
    if (!aspiration) return
    await db.simAspiration.create({ data: { simId, aspirationId: aspiration.id, completedAt: new Date() } })
    const result = await evaluateSpec(db, legacyId, {
      simFilter: { generationNumber: 1 },
      conditions: [{ source: 'aspirations', dataFilter: { aspirationId: aspiration.id, completed: true } }],
      aggregation: { op: 'any' },
      valueKind: 'BOOLEAN',
    }, {})
    expect(result).toBe(true)
  })
})

describe('evaluateSpec — source: sims (causeOfDeath)', () => {
  let userId: string
  let legacyId: string

  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
    const legacy = await createTestLegacy(userId)
    legacyId = legacy.id
  })

  afterEach(async () => { await cleanupUser(userId) })

  it('returns false when no sim has died by fire', async () => {
    await db.sim.create({ data: { legacyId, firstName: 'A', lastName: 'B', gender: 'FEMALE', lifeStage: 'YOUNG_ADULT' } })
    const result = await evaluateSpec(db, legacyId, {
      simFilter: {},
      conditions: [{ source: 'sims', dataFilter: { causeOfDeath: 'FIRE' } }],
      aggregation: { op: 'any' },
      valueKind: 'BOOLEAN',
    }, {})
    expect(result).toBe(false)
  })

  it('returns true when a sim died by fire', async () => {
    await db.sim.create({ data: { legacyId, firstName: 'A', lastName: 'B', gender: 'FEMALE', lifeStage: 'ELDER', causeOfDeath: 'FIRE' } })
    const result = await evaluateSpec(db, legacyId, {
      simFilter: {},
      conditions: [{ source: 'sims', dataFilter: { causeOfDeath: 'FIRE' } }],
      aggregation: { op: 'any' },
      valueKind: 'BOOLEAN',
    }, {})
    expect(result).toBe(true)
  })
})

describe('evaluateSpec — countUnique personality traits', () => {
  let userId: string
  let legacyId: string

  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
    const legacy = await createTestLegacy(userId)
    legacyId = legacy.id
  })

  afterEach(async () => { await cleanupUser(userId) })

  it('counts distinct personality traits across generation sims', async () => {
    const traits = await db.personalityTrait.findMany({ take: 3 })
    if (traits.length < 2) return
    const simA = await db.sim.create({ data: { legacyId, firstName: 'A', lastName: 'X', gender: 'FEMALE', lifeStage: 'YOUNG_ADULT', generationNumber: 1 } })
    const simB = await db.sim.create({ data: { legacyId, firstName: 'B', lastName: 'X', gender: 'MALE', lifeStage: 'YOUNG_ADULT', generationNumber: 1 } })
    await db.simPersonalityTrait.create({ data: { simId: simA.id, personalityTraitId: traits[0].id } })
    await db.simPersonalityTrait.create({ data: { simId: simB.id, personalityTraitId: traits[0].id } }) // same — counts once
    await db.simPersonalityTrait.create({ data: { simId: simB.id, personalityTraitId: traits[1].id } })
    const result = await evaluateSpec(db, legacyId, {
      simFilter: { generationNumber: 1 },
      conditions: [{ source: 'personalityTraits', dataFilter: {} }],
      aggregation: { op: 'countUnique', field: 'personalityTraitId' },
      valueKind: 'NUMERICAL',
    }, {})
    expect(result).toBe(2)
  })
})

describe('evaluateSpec — multi-condition (same-sim)', () => {
  let userId: string
  let legacyId: string

  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
    const legacy = await createTestLegacy(userId)
    legacyId = legacy.id
  })

  afterEach(async () => { await cleanupUser(userId) })

  it('returns false when no single sim satisfies all conditions', async () => {
    const skills = await db.skill.findMany({ take: 2 })
    if (skills.length < 2) return
    const simA = await db.sim.create({ data: { legacyId, firstName: 'A', lastName: 'X', gender: 'FEMALE', lifeStage: 'YOUNG_ADULT', generationNumber: 1 } })
    const simB = await db.sim.create({ data: { legacyId, firstName: 'B', lastName: 'X', gender: 'MALE', lifeStage: 'YOUNG_ADULT', generationNumber: 1 } })
    await db.simSkill.create({ data: { simId: simA.id, skillId: skills[0].id, level: skills[0].maxLevel } })
    await db.simSkill.create({ data: { simId: simB.id, skillId: skills[1].id, level: skills[1].maxLevel } })
    const result = await evaluateSpec(db, legacyId, {
      simFilter: { generationNumber: 1 },
      conditions: [
        { source: 'skills', dataFilter: { skillId: skills[0].id, maxed: true } },
        { source: 'skills', dataFilter: { skillId: skills[1].id, maxed: true } },
      ],
      aggregation: { op: 'any' },
      valueKind: 'BOOLEAN',
    }, {})
    expect(result).toBe(false)
  })

  it('returns true when one sim satisfies all conditions', async () => {
    const skills = await db.skill.findMany({ take: 2 })
    if (skills.length < 2) return
    const sim = await db.sim.create({ data: { legacyId, firstName: 'A', lastName: 'X', gender: 'FEMALE', lifeStage: 'YOUNG_ADULT', generationNumber: 1 } })
    await db.simSkill.create({ data: { simId: sim.id, skillId: skills[0].id, level: skills[0].maxLevel } })
    await db.simSkill.create({ data: { simId: sim.id, skillId: skills[1].id, level: skills[1].maxLevel } })
    const result = await evaluateSpec(db, legacyId, {
      simFilter: { generationNumber: 1 },
      conditions: [
        { source: 'skills', dataFilter: { skillId: skills[0].id, maxed: true } },
        { source: 'skills', dataFilter: { skillId: skills[1].id, maxed: true } },
      ],
      aggregation: { op: 'any' },
      valueKind: 'BOOLEAN',
    }, {})
    expect(result).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- trackerComputation
```

Expected: FAIL — `evaluateSpec is not exported`.

- [ ] **Step 3: Implement `src/server/lib/trackerComputation.ts`**

```typescript
import type { PrismaClient } from '@prisma/client'

type AggregationOp = 'any' | 'all' | 'count' | 'countUnique' | 'sum'

export interface Condition {
  source: 'skills' | 'aspirations' | 'personalityTraits' | 'careers' | 'traits' | 'sims'
  dataFilter: Record<string, unknown>
}

export interface ComputationSpec {
  simFilter: Record<string, unknown>
  conditions: Condition[]
  aggregation: { op: AggregationOp; field?: string }
  valueKind: 'BOOLEAN' | 'NUMERICAL' | 'THRESHOLD'
}

function resolveValue(val: unknown, config: Record<string, unknown>): unknown {
  if (typeof val === 'string' && val.startsWith('$config.')) {
    return config[val.slice('$config.'.length)]
  }
  return val
}

function resolveFilter(
  filter: Record<string, unknown>,
  config: Record<string, unknown>,
  phaseGenerationNumber?: number | null,
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(filter)) {
    if (typeof val === 'string' && val === '$phase.generationNumber') {
      resolved[key] = phaseGenerationNumber ?? undefined
    } else {
      resolved[key] = resolveValue(val, config)
    }
  }
  return resolved
}

async function getSimIds(
  db: PrismaClient,
  legacyId: string,
  simFilter: Record<string, unknown>,
): Promise<string[]> {
  const where: Record<string, unknown> = { legacyId }
  if (simFilter.generationNumber !== undefined) where.generationNumber = simFilter.generationNumber
  if (simFilter.isHeir !== undefined) where.isHeir = simFilter.isHeir
  const sims = await db.sim.findMany({ where: where as Parameters<typeof db.sim.findMany>[0]['where'], select: { id: true } })
  return sims.map((s) => s.id)
}

async function simSatisfiesCondition(
  db: PrismaClient,
  simId: string,
  legacyId: string,
  condition: Condition,
  dataFilter: Record<string, unknown>,
): Promise<boolean> {
  if (condition.source === 'sims') {
    const where: Record<string, unknown> = { id: simId, legacyId }
    for (const [k, v] of Object.entries(dataFilter)) where[k] = v
    return (await db.sim.findFirst({ where: where as Parameters<typeof db.sim.findFirst>[0]['where'] })) !== null
  }

  if (condition.source === 'skills') {
    const where: Record<string, unknown> = { simId }
    if (dataFilter.skillId) where.skillId = dataFilter.skillId
    if (dataFilter.maxed === true && dataFilter.skillId) {
      const skill = await db.skill.findUnique({ where: { id: dataFilter.skillId as string } })
      if (!skill) return false
      where.level = { gte: skill.maxLevel }
    } else if (dataFilter.minLevel !== undefined) {
      where.level = { gte: dataFilter.minLevel }
    }
    return (await db.simSkill.findFirst({ where: where as Parameters<typeof db.simSkill.findFirst>[0]['where'] })) !== null
  }

  if (condition.source === 'aspirations') {
    const where: Record<string, unknown> = { simId }
    if (dataFilter.aspirationId) where.aspirationId = dataFilter.aspirationId
    if (dataFilter.completed === true) where.completedAt = { not: null }
    return (await db.simAspiration.findFirst({ where: where as Parameters<typeof db.simAspiration.findFirst>[0]['where'] })) !== null
  }

  if (condition.source === 'careers') {
    const where: Record<string, unknown> = { simId }
    if (dataFilter.careerId) where.careerId = dataFilter.careerId
    if (dataFilter.completed === true) where.endedAt = { not: null }
    return (await db.simCareer.findFirst({ where: where as Parameters<typeof db.simCareer.findFirst>[0]['where'] })) !== null
  }

  if (condition.source === 'personalityTraits') {
    const where: Record<string, unknown> = { simId }
    if (dataFilter.category) where.personalityTrait = { category: dataFilter.category }
    return (await db.simPersonalityTrait.findFirst({ where: where as Parameters<typeof db.simPersonalityTrait.findFirst>[0]['where'] })) !== null
  }

  if (condition.source === 'traits') {
    return (await db.simTrait.findFirst({ where: { simId } as Parameters<typeof db.simTrait.findFirst>[0]['where'] })) !== null
  }

  return false
}

export async function evaluateSpec(
  db: PrismaClient,
  legacyId: string,
  spec: ComputationSpec,
  config: Record<string, unknown>,
  phaseGenerationNumber?: number | null,
): Promise<boolean | number> {
  const resolvedSimFilter = resolveFilter(spec.simFilter, config, phaseGenerationNumber)
  const allSimIds = await getSimIds(db, legacyId, resolvedSimFilter)
  if (allSimIds.length === 0) {
    return spec.aggregation.op === 'any' || spec.aggregation.op === 'all' ? false : 0
  }

  const matchingSimIds: string[] = []
  for (const simId of allSimIds) {
    let allSatisfied = true
    for (const condition of spec.conditions) {
      const dataFilter = resolveFilter(condition.dataFilter, config, phaseGenerationNumber)
      const satisfied = await simSatisfiesCondition(db, simId, legacyId, condition, dataFilter)
      if (!satisfied) { allSatisfied = false; break }
    }
    if (allSatisfied) matchingSimIds.push(simId)
  }

  if (spec.aggregation.op === 'any') return matchingSimIds.length > 0
  if (spec.aggregation.op === 'all') return matchingSimIds.length === allSimIds.length && allSimIds.length > 0
  if (spec.aggregation.op === 'count') return matchingSimIds.length

  if (spec.aggregation.op === 'countUnique' && spec.aggregation.field && spec.conditions[0]) {
    const condition = spec.conditions[0]
    const dataFilter = resolveFilter(condition.dataFilter, config, phaseGenerationNumber)
    if (condition.source === 'personalityTraits') {
      const where: Record<string, unknown> = { simId: { in: allSimIds } }
      if (dataFilter.category) where.personalityTrait = { category: dataFilter.category }
      const groups = await db.simPersonalityTrait.groupBy({
        by: ['personalityTraitId'],
        where: where as Parameters<typeof db.simPersonalityTrait.groupBy>[0]['where'],
      })
      return groups.length
    }
  }

  return matchingSimIds.length
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- trackerComputation
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/server/lib/trackerComputation.ts src/server/lib/trackerComputation.test.ts
git commit -m "feat(computation): implement unified evaluateSpec"
```

---

## Task 6: Computation engine — recomputeLegacyTrackers

**Files:**
- Modify: `src/server/lib/trackerComputation.ts`
- Modify: `src/server/lib/trackerComputation.test.ts`

- [ ] **Step 1: Add `recomputeLegacyTrackers` test to `trackerComputation.test.ts`**

Add at the bottom of `src/server/lib/trackerComputation.test.ts`:

```typescript
import { recomputeLegacyTrackers } from './trackerComputation'
import { createTestChallenge, createTestChallengePhase, createTestChallengeRun } from '@/test/helpers'

describe('recomputeLegacyTrackers', () => {
  let userId: string
  let legacyId: string

  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
    const legacy = await createTestLegacy(userId)
    legacyId = legacy.id
  })

  afterEach(async () => { await cleanupUser(userId) })

  it('stamps completedAt when a built-in tracker becomes satisfied', async () => {
    const skill = await db.skill.findFirst()
    if (!skill) return

    // Build a ChallengeRun with one SKILL_MAXED tracker
    const trackerType = await db.trackerType.findFirst({ where: { name: 'Skill Maxed' } })
    if (!trackerType) return

    const challenge = await createTestChallenge(userId)
    const phase = await createTestChallengePhase(challenge.id, { generationNumber: 1 })
    await db.trackerDefinition.create({
      data: { challengePhaseId: phase.id, trackerTypeId: trackerType.id, name: 'Max Cooking', config: { skillId: skill.id } },
    })
    const run = await createTestChallengeRun(legacyId, { sourceChallengeId: challenge.id })
    const runPhase = await db.challengeRunPhase.create({ data: { challengeRunId: run.id, generationNumber: 1, sortOrder: 0 } })
    const runTracker = await db.challengeRunTracker.create({
      data: { challengeRunPhaseId: runPhase.id, trackerTypeId: trackerType.id, name: 'Max Cooking', config: { skillId: skill.id }, sortOrder: 0 },
    })
    await db.trackerProgress.create({ data: { challengeRunTrackerId: runTracker.id, isManual: false } })

    // Sim has NOT maxed the skill yet
    const sim = await db.sim.create({ data: { legacyId, firstName: 'A', lastName: 'B', gender: 'FEMALE', lifeStage: 'YOUNG_ADULT', generationNumber: 1 } })
    await recomputeLegacyTrackers(db, legacyId)
    const progressBefore = await db.trackerProgress.findUnique({ where: { challengeRunTrackerId: runTracker.id } })
    expect(progressBefore?.completedAt).toBeNull()

    // Now max the skill
    await db.simSkill.create({ data: { simId: sim.id, skillId: skill.id, level: skill.maxLevel } })
    await recomputeLegacyTrackers(db, legacyId)
    const progressAfter = await db.trackerProgress.findUnique({ where: { challengeRunTrackerId: runTracker.id } })
    expect(progressAfter?.completedAt).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run to confirm new tests fail**

```bash
npm test -- trackerComputation
```

Expected: `recomputeLegacyTrackers is not exported`.

- [ ] **Step 3: Add `recomputeLegacyTrackers` to `src/server/lib/trackerComputation.ts`**

Append to the file:

```typescript
export async function recomputeLegacyTrackers(db: PrismaClient, legacyId: string): Promise<void> {
  const runs = await db.challengeRun.findMany({
    where: { legacyId, completedAt: null },
    include: {
      phases: {
        include: {
          trackers: {
            include: {
              trackerType: true,
              progress: true,
            },
          },
        },
      },
    },
  })

  for (const run of runs) {
    for (const phase of run.phases) {
      for (const tracker of phase.trackers) {
        if (!tracker.progress || tracker.progress.isManual) continue
        const spec = tracker.trackerType.computationSpec as ComputationSpec | null
        if (!spec) continue

        const config = tracker.config as Record<string, unknown>
        const rawValue = await evaluateSpec(db, legacyId, spec, config, phase.generationNumber)
        const now = new Date()

        const wasComplete = tracker.progress.completedAt !== null
        const isNowComplete =
          tracker.trackerType.valueKind === 'BOOLEAN'
            ? rawValue === true
            : typeof rawValue === 'number' && rawValue > 0

        await db.trackerProgress.update({
          where: { challengeRunTrackerId: tracker.id },
          data: {
            value: rawValue as never,
            evaluatedAt: now,
            completedAt: !wasComplete && isNowComplete ? now : tracker.progress.completedAt,
          },
        })
      }
    }
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- trackerComputation
```

Expected: all tests pass.

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/server/lib/trackerComputation.ts src/server/lib/trackerComputation.test.ts
git commit -m "feat(computation): add compound spec, THRESHOLD scoring, recomputeLegacyTrackers"
```

---

## Task 7: generationNumber auto-population in sims router

**Files:**
- Modify: `src/server/routers/sims.ts`
- Modify: `src/server/routers/sims.test.ts`

- [ ] **Step 1: Write failing tests — append to `src/server/routers/sims.test.ts`**

```typescript
describe('sims — generationNumber population', () => {
  let userId: string
  let legacyId: string

  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
    const legacy = await createTestLegacy(userId)
    legacyId = legacy.id
  })

  afterEach(async () => { await cleanupUser(userId) })

  it('sets generationNumber from input when provided', async () => {
    const result = await authedCaller(userId).sims.create({
      legacyId,
      firstName: 'Alice',
      lastName: 'Smith',
      gender: Gender.FEMALE,
      generationNumber: 1,
    })
    const record = await db.sim.findUnique({ where: { id: result.id } })
    expect(record?.generationNumber).toBe(1)
  })

  it('derives generationNumber from parent when parentIds provided', async () => {
    const parent = await createTestSim(legacyId, { firstName: 'Parent' })
    await db.sim.update({ where: { id: parent.id }, data: { generationNumber: 1 } })
    const result = await authedCaller(userId).sims.create({
      legacyId,
      firstName: 'Child',
      lastName: 'Smith',
      gender: Gender.FEMALE,
      parentIds: [parent.id],
    })
    const record = await db.sim.findUnique({ where: { id: result.id } })
    expect(record?.generationNumber).toBe(2)
  })

  it('uses min parent generationNumber when multiple parents', async () => {
    const parent1 = await createTestSim(legacyId, { firstName: 'P1' })
    const parent2 = await createTestSim(legacyId, { firstName: 'P2' })
    await db.sim.update({ where: { id: parent1.id }, data: { generationNumber: 2 } })
    await db.sim.update({ where: { id: parent2.id }, data: { generationNumber: 3 } })
    const result = await authedCaller(userId).sims.create({
      legacyId, firstName: 'Child', lastName: 'Smith', gender: Gender.FEMALE,
      parentIds: [parent1.id, parent2.id],
    })
    const record = await db.sim.findUnique({ where: { id: result.id } })
    expect(record?.generationNumber).toBe(3)
  })

  it('sims.update accepts generationNumber override', async () => {
    const sim = await createTestSim(legacyId)
    await authedCaller(userId).sims.update({ id: sim.id, generationNumber: 5 })
    const record = await db.sim.findUnique({ where: { id: sim.id } })
    expect(record?.generationNumber).toBe(5)
  })

  it('sims.update accepts isHeir flag', async () => {
    const sim = await createTestSim(legacyId)
    await authedCaller(userId).sims.update({ id: sim.id, isHeir: true })
    const record = await db.sim.findUnique({ where: { id: sim.id } })
    expect(record?.isHeir).toBe(true)
  })

  it('setting isHeir clears the previous heir in the same generation', async () => {
    const simA = await db.sim.create({
      data: { legacyId, firstName: 'A', lastName: 'X', gender: 'FEMALE', lifeStage: 'YOUNG_ADULT', generationNumber: 2, isHeir: true },
    })
    const simB = await db.sim.create({
      data: { legacyId, firstName: 'B', lastName: 'X', gender: 'MALE', lifeStage: 'YOUNG_ADULT', generationNumber: 2 },
    })
    await authedCaller(userId).sims.update({ id: simB.id, isHeir: true })
    const recordA = await db.sim.findUnique({ where: { id: simA.id } })
    const recordB = await db.sim.findUnique({ where: { id: simB.id } })
    expect(recordA?.isHeir).toBe(false)
    expect(recordB?.isHeir).toBe(true)
  })

  it('setting isHeir does not clear heir in a different generation', async () => {
    const simA = await db.sim.create({
      data: { legacyId, firstName: 'A', lastName: 'X', gender: 'FEMALE', lifeStage: 'YOUNG_ADULT', generationNumber: 1, isHeir: true },
    })
    const simB = await db.sim.create({
      data: { legacyId, firstName: 'B', lastName: 'X', gender: 'MALE', lifeStage: 'YOUNG_ADULT', generationNumber: 2 },
    })
    await authedCaller(userId).sims.update({ id: simB.id, isHeir: true })
    const recordA = await db.sim.findUnique({ where: { id: simA.id } })
    expect(recordA?.isHeir).toBe(true)
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
npm test -- sims.test
```

Expected: FAIL — `parentIds` not in input schema, `generationNumber`/`isHeir` not in update schema, isHeir uniqueness not enforced.

- [ ] **Step 3: Update `sims.create` input and mutation logic in `src/server/routers/sims.ts`**

Add `generationNumber: z.number().int().min(1).optional()` and `parentIds: z.array(z.string()).optional()` to the `.input(...)` of `create`.

Replace the `return ctx.db.sim.create(...)` call in `create` with:

```typescript
      // Derive generationNumber from parents if not explicitly provided
      let generationNumber = input.generationNumber ?? null
      if (!generationNumber && input.parentIds?.length) {
        const parents = await ctx.db.sim.findMany({
          where: { id: { in: input.parentIds }, legacyId: input.legacyId },
          select: { generationNumber: true },
        })
        const parentGens = parents.map((p) => p.generationNumber).filter((g): g is number => g !== null)
        if (parentGens.length > 0) generationNumber = Math.min(...parentGens) + 1
      }

      return ctx.db.sim.create({
        data: {
          legacyId: input.legacyId,
          firstName: simFields.firstName,
          lastName: simFields.lastName,
          gender: simFields.gender,
          lifeStage: simFields.lifeStage,
          pronounSubject: simFields.pronounSubject ?? null,
          pronounObject: simFields.pronounObject ?? null,
          pronounPossessive: simFields.pronounPossessive ?? null,
          imageUrl: simFields.imageUrl ?? null,
          occultType: simFields.occultType ?? null,
          householdId: household.id,
          generationNumber,
          ...(personalityTraitIds?.length
            ? { personalityTraits: { create: personalityTraitIds.map((id) => ({ personalityTraitId: id })) } }
            : {}),
          ...(aspirationId ? { aspirations: { create: { aspirationId } } } : {}),
          ...(careerId
            ? { careers: { create: { careerId, employmentType: EmploymentType.EMPLOYED, startedAt: new Date() } } }
            : {}),
        },
      })
```

Also update the destructuring line to include `parentIds` and `generationNumber`:
```typescript
      const { legacyId: _legacyId, personalityTraitIds, aspirationId, careerId, parentIds: _parentIds, generationNumber: _gen, ...simFields } = input
```

- [ ] **Step 4: Add `generationNumber` and `isHeir` to `sims.update` input and mutation**

Add to the `update` input schema:
```typescript
        generationNumber: z.number().int().min(1).nullable().optional(),
        isHeir: z.boolean().optional(),
```

In the `update` mutation body, before the `ctx.db.sim.update(...)` call, add the isHeir uniqueness enforcement. Find the sim's current state first (needed to know its legacyId and generationNumber), then clear the previous heir in the same generation:

```typescript
      if (input.isHeir === true) {
        const sim = await ctx.db.sim.findFirst({
          where: { id: input.id, legacy: { userId } },
          select: { legacyId: true, generationNumber: true },
        })
        if (sim?.generationNumber !== null && sim?.generationNumber !== undefined) {
          await ctx.db.sim.updateMany({
            where: {
              legacyId: sim.legacyId,
              generationNumber: sim.generationNumber,
              isHeir: true,
              NOT: { id: input.id },
            },
            data: { isHeir: false },
          })
        }
      }
```

This runs inside the existing auth-guard scope (after the `findFirst` that checks legacy ownership). The rest of the update proceeds normally via the existing `ctx.db.sim.update(...)` spread.

- [ ] **Step 5: Run tests**

```bash
npm test -- sims.test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/server/routers/sims.ts src/server/routers/sims.test.ts
git commit -m "feat(sims): auto-populate generationNumber from parents; add isHeir to update"
```

---

## Task 8: TrackerTypes router

**Files:**
- Create: `src/server/routers/trackerTypes.ts`
- Create: `src/server/routers/trackerTypes.test.ts`

- [ ] **Step 1: Write failing tests in `src/server/routers/trackerTypes.test.ts`**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { authedCaller, unauthCaller } from '@/test/caller'
import { createTestUser, cleanupUser } from '@/test/helpers'
import { db } from '@/server/db'

describe('trackerTypes.list', () => {
  let userId: string

  beforeEach(async () => { ({ id: userId } = await createTestUser()) })
  afterEach(async () => { await cleanupUser(userId) })

  it('returns built-in tracker types', async () => {
    const result = await authedCaller(userId).trackerTypes.list()
    expect(result.length).toBeGreaterThan(0)
    expect(result.some((t) => t.isBuiltIn)).toBe(true)
  })

  it('includes user-created types owned by the caller', async () => {
    await db.trackerType.create({
      data: { name: `Custom-${Date.now()}`, valueKind: 'BOOLEAN', configSchema: {}, ownerId: userId, isBuiltIn: false, isPublic: false },
    })
    const result = await authedCaller(userId).trackerTypes.list()
    expect(result.some((t) => t.ownerId === userId)).toBe(true)
  })

  it('throws UNAUTHORIZED without a session', async () => {
    await expect(unauthCaller().trackerTypes.list()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })
})

describe('trackerTypes.create', () => {
  let userId: string

  beforeEach(async () => { ({ id: userId } = await createTestUser()) })
  afterEach(async () => { await cleanupUser(userId) })

  it('creates a manual BOOLEAN tracker type owned by the caller', async () => {
    const result = await authedCaller(userId).trackerTypes.create({
      name: 'My Custom Goal',
      valueKind: 'BOOLEAN',
    })
    expect(result.ownerId).toBe(userId)
    expect(result.isBuiltIn).toBe(false)
    const record = await db.trackerType.findUnique({ where: { id: result.id } })
    expect(record).not.toBeNull()
  })

  it('creates a THRESHOLD type with goalSchema', async () => {
    const result = await authedCaller(userId).trackerTypes.create({
      name: 'Wealth Tracker',
      valueKind: 'THRESHOLD',
      goalSchema: { start: 100000, step: 100000, count: 10, unit: '§' },
    })
    expect(result.valueKind).toBe('THRESHOLD')
  })
})

describe('trackerTypes.delete', () => {
  let userId: string

  beforeEach(async () => { ({ id: userId } = await createTestUser()) })
  afterEach(async () => { await cleanupUser(userId) })

  it('deletes a tracker type owned by the caller', async () => {
    const tt = await db.trackerType.create({
      data: { name: `Del-${Date.now()}`, valueKind: 'BOOLEAN', configSchema: {}, ownerId: userId, isBuiltIn: false, isPublic: false },
    })
    await authedCaller(userId).trackerTypes.delete({ id: tt.id })
    expect(await db.trackerType.findUnique({ where: { id: tt.id } })).toBeNull()
  })

  it('throws FORBIDDEN when deleting another user type', async () => {
    const other = await createTestUser()
    try {
      const tt = await db.trackerType.create({
        data: { name: `Other-${Date.now()}`, valueKind: 'BOOLEAN', configSchema: {}, ownerId: other.id, isBuiltIn: false, isPublic: false },
      })
      await expect(
        authedCaller(userId).trackerTypes.delete({ id: tt.id })
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    } finally {
      await cleanupUser(other.id)
    }
  })

  it('throws FORBIDDEN when deleting a built-in type', async () => {
    const builtIn = await db.trackerType.findFirst({ where: { isBuiltIn: true } })
    if (!builtIn) return
    await expect(
      authedCaller(userId).trackerTypes.delete({ id: builtIn.id })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
npm test -- trackerTypes.test
```

Expected: FAIL — router does not exist.

- [ ] **Step 3: Create `src/server/routers/trackerTypes.ts`**

```typescript
import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc'

export const trackerTypesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id
    return ctx.db.trackerType.findMany({
      where: {
        OR: [{ isPublic: true }, { ownerId: userId }],
      },
      orderBy: [{ isBuiltIn: 'desc' }, { name: 'asc' }],
    })
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().max(500).optional(),
        valueKind: z.enum(['BOOLEAN', 'NUMERICAL', 'THRESHOLD']),
        isPublic: z.boolean().default(false),
        computationSpec: z.record(z.unknown()).optional(),
        configSchema: z.record(z.unknown()).default({}),
        goalSchema: z.record(z.unknown()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      return ctx.db.trackerType.create({
        data: {
          name: input.name,
          description: input.description ?? null,
          valueKind: input.valueKind,
          isPublic: input.isPublic,
          isBuiltIn: false,
          ownerId: userId,
          computationSpec: input.computationSpec ?? null,
          configSchema: input.configSchema,
          goalSchema: input.goalSchema ?? null,
        },
      })
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().max(500).nullable().optional(),
        isPublic: z.boolean().optional(),
        goalSchema: z.record(z.unknown()).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const tt = await ctx.db.trackerType.findUnique({ where: { id: input.id } })
      if (!tt) throw new TRPCError({ code: 'NOT_FOUND' })
      if (tt.ownerId !== userId || tt.isBuiltIn)
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Cannot modify this tracker type' })
      const { id, ...fields } = input
      return ctx.db.trackerType.update({ where: { id }, data: fields })
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const tt = await ctx.db.trackerType.findUnique({ where: { id: input.id } })
      if (!tt) throw new TRPCError({ code: 'NOT_FOUND' })
      if (tt.ownerId !== userId || tt.isBuiltIn)
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Cannot delete this tracker type' })
      return ctx.db.trackerType.delete({ where: { id: input.id } })
    }),
})
```

- [ ] **Step 4: Register the router temporarily for tests**

Add to `src/server/routers/index.ts`:
```typescript
import { trackerTypesRouter } from './trackerTypes'
// inside appRouter:
  trackerTypes: trackerTypesRouter,
```

- [ ] **Step 5: Run tests**

```bash
npm test -- trackerTypes.test
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/server/routers/trackerTypes.ts src/server/routers/trackerTypes.test.ts src/server/routers/index.ts
git commit -m "feat(router): add trackerTypes router"
```

---

## Task 9: Challenges router

**Files:**
- Create: `src/server/routers/challenges.ts`
- Create: `src/server/routers/challenges.test.ts`

- [ ] **Step 1: Write failing tests in `src/server/routers/challenges.test.ts`**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { authedCaller, unauthCaller } from '@/test/caller'
import { createTestUser, cleanupUser, createTestTrackerType } from '@/test/helpers'
import { db } from '@/server/db'

describe('challenges.create', () => {
  let userId: string

  beforeEach(async () => { ({ id: userId } = await createTestUser()) })
  afterEach(async () => { await cleanupUser(userId) })

  it('creates a challenge owned by the caller', async () => {
    const result = await authedCaller(userId).challenges.create({ name: 'My Legacy Challenge' })
    expect(result.ownerId).toBe(userId)
    expect(await db.challenge.findUnique({ where: { id: result.id } })).not.toBeNull()
  })

  it('throws UNAUTHORIZED without a session', async () => {
    await expect(unauthCaller().challenges.create({ name: 'X' })).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })
})

describe('challenges.addPhase', () => {
  let userId: string
  let challengeId: string

  beforeEach(async () => {
    ({ id: userId } = await createTestUser())
    const c = await authedCaller(userId).challenges.create({ name: 'C' })
    challengeId = c.id
  })
  afterEach(async () => { await cleanupUser(userId) })

  it('adds a generation phase to the challenge', async () => {
    const result = await authedCaller(userId).challenges.addPhase({
      challengeId,
      generationNumber: 1,
      title: 'The Founder',
    })
    expect(result.generationNumber).toBe(1)
    expect(result.challengeId).toBe(challengeId)
  })

  it('throws FORBIDDEN when challenge belongs to another user', async () => {
    const other = await createTestUser()
    try {
      await expect(
        authedCaller(other.id).challenges.addPhase({ challengeId, generationNumber: 1 })
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    } finally {
      await cleanupUser(other.id)
    }
  })
})

describe('challenges.addTracker', () => {
  let userId: string
  let challengePhaseId: string
  let trackerTypeId: string

  beforeEach(async () => {
    ({ id: userId } = await createTestUser())
    const c = await authedCaller(userId).challenges.create({ name: 'C' })
    const phase = await authedCaller(userId).challenges.addPhase({ challengeId: c.id, generationNumber: 1 })
    challengePhaseId = phase.id
    const tt = await createTestTrackerType({ ownerId: userId })
    trackerTypeId = tt.id
  })
  afterEach(async () => { await cleanupUser(userId) })

  it('adds a tracker to the phase', async () => {
    const result = await authedCaller(userId).challenges.addTracker({
      challengePhaseId,
      trackerTypeId,
      name: 'Max Cooking',
      config: { skillId: 'abc' },
    })
    expect(result.challengePhaseId).toBe(challengePhaseId)
    expect(result.name).toBe('Max Cooking')
  })
})

describe('challenges.getById', () => {
  let userId: string
  let challengeId: string

  beforeEach(async () => {
    ({ id: userId } = await createTestUser())
    const c = await authedCaller(userId).challenges.create({ name: 'Full Challenge' })
    challengeId = c.id
    await authedCaller(userId).challenges.addPhase({ challengeId, generationNumber: 1, title: 'Gen 1' })
  })
  afterEach(async () => { await cleanupUser(userId) })

  it('returns the challenge with nested phases and trackers', async () => {
    const result = await authedCaller(userId).challenges.getById({ id: challengeId })
    expect(result.id).toBe(challengeId)
    expect(result.phases).toHaveLength(1)
    expect(result.phases[0].title).toBe('Gen 1')
  })

  it('throws NOT_FOUND for a challenge belonging to another user (private)', async () => {
    const other = await createTestUser()
    try {
      await expect(
        authedCaller(other.id).challenges.getById({ id: challengeId })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    } finally {
      await cleanupUser(other.id)
    }
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
npm test -- challenges.test
```

Expected: FAIL — router does not exist.

- [ ] **Step 3: Create `src/server/routers/challenges.ts`**

```typescript
import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc'

export const challengesRouter = router({
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(200),
      description: z.string().max(2000).optional(),
      isPublic: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.challenge.create({
        data: { name: input.name, description: input.description ?? null, isPublic: input.isPublic, ownerId: ctx.session.user.id },
      })
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id
    return ctx.db.challenge.findMany({
      where: { OR: [{ isPublic: true }, { ownerId: userId }] },
      orderBy: { name: 'asc' },
    })
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const challenge = await ctx.db.challenge.findFirst({
        where: { id: input.id, OR: [{ isPublic: true }, { ownerId: userId }] },
        include: { phases: { include: { trackers: { include: { trackerType: true } } }, orderBy: { sortOrder: 'asc' } } },
      })
      if (!challenge) throw new TRPCError({ code: 'NOT_FOUND' })
      return challenge
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).max(200).optional(),
      description: z.string().max(2000).nullable().optional(),
      isPublic: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const challenge = await ctx.db.challenge.findUnique({ where: { id: input.id } })
      if (!challenge || challenge.ownerId !== userId) throw new TRPCError({ code: 'FORBIDDEN' })
      const { id, ...fields } = input
      return ctx.db.challenge.update({ where: { id }, data: fields })
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const challenge = await ctx.db.challenge.findUnique({ where: { id: input.id } })
      if (!challenge || challenge.ownerId !== userId) throw new TRPCError({ code: 'FORBIDDEN' })
      return ctx.db.challenge.delete({ where: { id: input.id } })
    }),

  addPhase: protectedProcedure
    .input(z.object({
      challengeId: z.string(),
      generationNumber: z.number().int().min(1).nullable().optional(),
      title: z.string().max(200).optional(),
      description: z.string().max(2000).optional(),
      sortOrder: z.number().int().default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const challenge = await ctx.db.challenge.findUnique({ where: { id: input.challengeId } })
      if (!challenge || challenge.ownerId !== userId) throw new TRPCError({ code: 'FORBIDDEN' })
      return ctx.db.challengePhase.create({
        data: {
          challengeId: input.challengeId,
          generationNumber: input.generationNumber ?? null,
          title: input.title ?? null,
          description: input.description ?? null,
          sortOrder: input.sortOrder,
        },
      })
    }),

  updatePhase: protectedProcedure
    .input(z.object({
      id: z.string(),
      generationNumber: z.number().int().min(1).nullable().optional(),
      title: z.string().max(200).nullable().optional(),
      description: z.string().max(2000).nullable().optional(),
      sortOrder: z.number().int().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const phase = await ctx.db.challengePhase.findUnique({ where: { id: input.id }, include: { challenge: true } })
      if (!phase || phase.challenge.ownerId !== userId) throw new TRPCError({ code: 'FORBIDDEN' })
      const { id, ...fields } = input
      return ctx.db.challengePhase.update({ where: { id }, data: fields })
    }),

  removePhase: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const phase = await ctx.db.challengePhase.findUnique({ where: { id: input.id }, include: { challenge: true } })
      if (!phase || phase.challenge.ownerId !== userId) throw new TRPCError({ code: 'FORBIDDEN' })
      return ctx.db.challengePhase.delete({ where: { id: input.id } })
    }),

  addTracker: protectedProcedure
    .input(z.object({
      challengePhaseId: z.string(),
      trackerTypeId: z.string(),
      name: z.string().min(1).max(200),
      description: z.string().max(1000).optional(),
      config: z.record(z.unknown()).default({}),
      goalConfig: z.record(z.unknown()).optional(),
      sortOrder: z.number().int().default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const phase = await ctx.db.challengePhase.findUnique({ where: { id: input.challengePhaseId }, include: { challenge: true } })
      if (!phase || phase.challenge.ownerId !== userId) throw new TRPCError({ code: 'FORBIDDEN' })
      return ctx.db.trackerDefinition.create({
        data: {
          challengePhaseId: input.challengePhaseId,
          trackerTypeId: input.trackerTypeId,
          name: input.name,
          description: input.description ?? null,
          config: input.config,
          goalConfig: input.goalConfig ?? null,
          sortOrder: input.sortOrder,
        },
      })
    }),

  updateTracker: protectedProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).max(200).optional(),
      description: z.string().max(1000).nullable().optional(),
      config: z.record(z.unknown()).optional(),
      goalConfig: z.record(z.unknown()).nullable().optional(),
      sortOrder: z.number().int().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const tracker = await ctx.db.trackerDefinition.findUnique({
        where: { id: input.id },
        include: { phase: { include: { challenge: true } } },
      })
      if (!tracker || tracker.phase.challenge.ownerId !== userId) throw new TRPCError({ code: 'FORBIDDEN' })
      const { id, ...fields } = input
      return ctx.db.trackerDefinition.update({ where: { id }, data: fields })
    }),

  removeTracker: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const tracker = await ctx.db.trackerDefinition.findUnique({
        where: { id: input.id },
        include: { phase: { include: { challenge: true } } },
      })
      if (!tracker || tracker.phase.challenge.ownerId !== userId) throw new TRPCError({ code: 'FORBIDDEN' })
      return ctx.db.trackerDefinition.delete({ where: { id: input.id } })
    }),
})
```

- [ ] **Step 4: Register router**

In `src/server/routers/index.ts`:
```typescript
import { challengesRouter } from './challenges'
// inside appRouter:
  challenges: challengesRouter,
```

- [ ] **Step 5: Run tests**

```bash
npm test -- challenges.test
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/server/routers/challenges.ts src/server/routers/challenges.test.ts src/server/routers/index.ts
git commit -m "feat(router): add challenges router"
```

---

## Task 10: ChallengeRuns router

**Files:**
- Create: `src/server/routers/challengeRuns.ts`
- Create: `src/server/routers/challengeRuns.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/server/routers/challengeRuns.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { authedCaller, unauthCaller } from '@/test/caller'
import { createTestUser, cleanupUser, createTestLegacy, createTestTrackerType } from '@/test/helpers'
import { db } from '@/server/db'

async function buildChallengeWithPhaseAndTracker(userId: string, trackerTypeId: string) {
  const challenge = await authedCaller(userId).challenges.create({ name: 'Test Challenge' })
  const phase = await authedCaller(userId).challenges.addPhase({ challengeId: challenge.id, generationNumber: 1, title: 'Gen 1' })
  const tracker = await authedCaller(userId).challenges.addTracker({
    challengePhaseId: phase.id,
    trackerTypeId,
    name: 'Test Tracker',
    config: {},
  })
  return { challenge, phase, tracker }
}

describe('challengeRuns.link', () => {
  let userId: string
  let legacyId: string
  let trackerTypeId: string

  beforeEach(async () => {
    ({ id: userId } = await createTestUser())
    const legacy = await createTestLegacy(userId)
    legacyId = legacy.id
    const tt = await createTestTrackerType({ ownerId: userId })
    trackerTypeId = tt.id
  })
  afterEach(async () => { await cleanupUser(userId) })

  it('creates a ChallengeRun with copied phases and trackers', async () => {
    const { challenge } = await buildChallengeWithPhaseAndTracker(userId, trackerTypeId)
    const run = await authedCaller(userId).challengeRuns.link({ legacyId, challengeId: challenge.id })

    expect(run.legacyId).toBe(legacyId)
    expect(run.sourceChallengeId).toBe(challenge.id)

    const phases = await db.challengeRunPhase.findMany({ where: { challengeRunId: run.id } })
    expect(phases).toHaveLength(1)
    expect(phases[0].generationNumber).toBe(1)

    const trackers = await db.challengeRunTracker.findMany({ where: { challengeRunPhaseId: phases[0].id } })
    expect(trackers).toHaveLength(1)

    const progress = await db.trackerProgress.findMany({ where: { challengeRunTrackerId: trackers[0].id } })
    expect(progress).toHaveLength(1)
  })

  it('marks progress as manual when trackerType has no computationSpec', async () => {
    const { challenge } = await buildChallengeWithPhaseAndTracker(userId, trackerTypeId)
    const run = await authedCaller(userId).challengeRuns.link({ legacyId, challengeId: challenge.id })
    const phases = await db.challengeRunPhase.findMany({ where: { challengeRunId: run.id } })
    const trackers = await db.challengeRunTracker.findMany({ where: { challengeRunPhaseId: phases[0].id } })
    const progress = await db.trackerProgress.findUnique({ where: { challengeRunTrackerId: trackers[0].id } })
    expect(progress?.isManual).toBe(true)
  })

  it('throws NOT_FOUND when the legacy does not belong to caller', async () => {
    const other = await createTestUser()
    const challenge = await authedCaller(userId).challenges.create({ name: 'C' })
    try {
      await expect(
        authedCaller(other.id).challengeRuns.link({ legacyId, challengeId: challenge.id })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    } finally {
      await cleanupUser(other.id)
    }
  })
})

describe('challengeRuns.getById', () => {
  let userId: string
  let legacyId: string

  beforeEach(async () => {
    ({ id: userId } = await createTestUser())
    const legacy = await createTestLegacy(userId)
    legacyId = legacy.id
  })
  afterEach(async () => { await cleanupUser(userId) })

  it('returns run with nested phases, trackers, and progress', async () => {
    const tt = await createTestTrackerType({ ownerId: userId })
    const { challenge } = await buildChallengeWithPhaseAndTracker(userId, tt.id)
    const run = await authedCaller(userId).challengeRuns.link({ legacyId, challengeId: challenge.id })
    const result = await authedCaller(userId).challengeRuns.getById({ id: run.id })
    expect(result.phases).toHaveLength(1)
    expect(result.phases[0].trackers).toHaveLength(1)
    expect(result.phases[0].trackers[0].progress).toBeDefined()
  })
})

describe('challengeRuns.updateProgress', () => {
  let userId: string
  let legacyId: string

  beforeEach(async () => {
    ({ id: userId } = await createTestUser())
    const legacy = await createTestLegacy(userId)
    legacyId = legacy.id
  })
  afterEach(async () => { await cleanupUser(userId) })

  it('updates value on a manual tracker and stamps completedAt for BOOLEAN true', async () => {
    const tt = await createTestTrackerType({ ownerId: userId, valueKind: 'BOOLEAN' })
    const { challenge } = await buildChallengeWithPhaseAndTracker(userId, tt.id)
    const run = await authedCaller(userId).challengeRuns.link({ legacyId, challengeId: challenge.id })
    const phases = await db.challengeRunPhase.findMany({ where: { challengeRunId: run.id } })
    const trackers = await db.challengeRunTracker.findMany({ where: { challengeRunPhaseId: phases[0].id } })

    await authedCaller(userId).challengeRuns.updateProgress({
      challengeRunTrackerId: trackers[0].id,
      value: true,
    })
    const progress = await db.trackerProgress.findUnique({ where: { challengeRunTrackerId: trackers[0].id } })
    expect(progress?.value).toBe(true)
    expect(progress?.completedAt).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
npm test -- challengeRuns.test
```

Expected: FAIL — router does not exist.

- [ ] **Step 3: Create `src/server/routers/challengeRuns.ts`**

```typescript
import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc'

export const challengeRunsRouter = router({
  link: protectedProcedure
    .input(z.object({
      legacyId: z.string(),
      challengeId: z.string(),
      name: z.string().max(200).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const legacy = await ctx.db.legacy.findFirst({ where: { id: input.legacyId, userId } })
      if (!legacy) throw new TRPCError({ code: 'NOT_FOUND', message: 'Legacy not found' })

      const challenge = await ctx.db.challenge.findFirst({
        where: { id: input.challengeId, OR: [{ isPublic: true }, { ownerId: userId }] },
        include: {
          phases: {
            include: { trackers: { include: { trackerType: true } } },
            orderBy: { sortOrder: 'asc' },
          },
        },
      })
      if (!challenge) throw new TRPCError({ code: 'NOT_FOUND', message: 'Challenge not found' })

      const run = await ctx.db.challengeRun.create({
        data: {
          legacyId: input.legacyId,
          sourceChallengeId: input.challengeId,
          name: input.name ?? challenge.name,
        },
      })

      for (const phase of challenge.phases) {
        const runPhase = await ctx.db.challengeRunPhase.create({
          data: {
            challengeRunId: run.id,
            generationNumber: phase.generationNumber,
            title: phase.title,
            description: phase.description,
            sortOrder: phase.sortOrder,
          },
        })

        for (const tracker of phase.trackers) {
          const runTracker = await ctx.db.challengeRunTracker.create({
            data: {
              challengeRunPhaseId: runPhase.id,
              trackerTypeId: tracker.trackerTypeId,
              name: tracker.name,
              description: tracker.description,
              config: tracker.config ?? {},
              goalConfig: tracker.goalConfig,
              sortOrder: tracker.sortOrder,
            },
          })

          await ctx.db.trackerProgress.create({
            data: {
              challengeRunTrackerId: runTracker.id,
              isManual: tracker.trackerType.computationSpec === null,
            },
          })
        }
      }

      return run
    }),

  listByLegacy: protectedProcedure
    .input(z.object({ legacyId: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const legacy = await ctx.db.legacy.findFirst({ where: { id: input.legacyId, userId } })
      if (!legacy) throw new TRPCError({ code: 'NOT_FOUND' })
      return ctx.db.challengeRun.findMany({
        where: { legacyId: input.legacyId },
        orderBy: { startedAt: 'desc' },
      })
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const run = await ctx.db.challengeRun.findFirst({
        where: { id: input.id, legacy: { userId } },
        include: {
          phases: {
            orderBy: { sortOrder: 'asc' },
            include: {
              trackers: {
                orderBy: { sortOrder: 'asc' },
                include: { trackerType: true, progress: true },
              },
            },
          },
        },
      })
      if (!run) throw new TRPCError({ code: 'NOT_FOUND' })
      return run
    }),

  updatePhase: protectedProcedure
    .input(z.object({
      id: z.string(),
      title: z.string().max(200).nullable().optional(),
      description: z.string().max(2000).nullable().optional(),
      generationNumber: z.number().int().min(1).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const phase = await ctx.db.challengeRunPhase.findUnique({
        where: { id: input.id },
        include: { run: { include: { legacy: true } } },
      })
      if (!phase || phase.run.legacy.userId !== userId) throw new TRPCError({ code: 'FORBIDDEN' })
      const { id, ...fields } = input
      return ctx.db.challengeRunPhase.update({ where: { id }, data: fields })
    }),

  updateTracker: protectedProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).max(200).optional(),
      description: z.string().max(1000).nullable().optional(),
      config: z.record(z.unknown()).optional(),
      goalConfig: z.record(z.unknown()).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const tracker = await ctx.db.challengeRunTracker.findUnique({
        where: { id: input.id },
        include: { phase: { include: { run: { include: { legacy: true } } } } },
      })
      if (!tracker || tracker.phase.run.legacy.userId !== userId) throw new TRPCError({ code: 'FORBIDDEN' })
      const { id, ...fields } = input
      return ctx.db.challengeRunTracker.update({ where: { id }, data: fields })
    }),

  updateProgress: protectedProcedure
    .input(z.object({
      challengeRunTrackerId: z.string(),
      value: z.union([z.boolean(), z.number()]),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const progress = await ctx.db.trackerProgress.findUnique({
        where: { challengeRunTrackerId: input.challengeRunTrackerId },
        include: {
          tracker: {
            include: {
              trackerType: true,
              phase: { include: { run: { include: { legacy: true } } } },
            },
          },
        },
      })
      if (!progress) throw new TRPCError({ code: 'NOT_FOUND' })
      if (progress.tracker.phase.run.legacy.userId !== userId) throw new TRPCError({ code: 'FORBIDDEN' })
      if (!progress.isManual) throw new TRPCError({ code: 'BAD_REQUEST', message: 'This tracker is auto-computed' })

      const { valueKind } = progress.tracker.trackerType
      const now = new Date()
      const isComplete =
        valueKind === 'BOOLEAN'
          ? input.value === true
          : valueKind === 'NUMERICAL'
          ? typeof input.value === 'number' && input.value >= (progress.tracker.goalConfig as { goalValue?: number } | null)?.goalValue!
          : false // THRESHOLD completion checked separately

      return ctx.db.trackerProgress.update({
        where: { challengeRunTrackerId: input.challengeRunTrackerId },
        data: {
          value: input.value as never,
          completedAt: !progress.completedAt && isComplete ? now : progress.completedAt,
          updatedAt: now,
        },
      })
    }),
})
```

- [ ] **Step 4: Register router in `src/server/routers/index.ts`**

```typescript
import { challengeRunsRouter } from './challengeRuns'
// inside appRouter:
  challengeRuns: challengeRunsRouter,
```

- [ ] **Step 5: Run tests**

```bash
npm test -- challengeRuns.test
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/server/routers/challengeRuns.ts src/server/routers/challengeRuns.test.ts src/server/routers/index.ts
git commit -m "feat(router): add challengeRuns router with link, query, and progress update"
```

---

## Task 11: Wire recomputeLegacyTrackers into sim mutations

**Files:**
- Modify: `src/server/routers/sims.ts`
- Modify: `src/server/routers/sims.test.ts`

- [ ] **Step 1: Write failing test — append to `src/server/routers/sims.test.ts`**

```typescript
import { createTestChallenge, createTestChallengePhase, createTestChallengeRun } from '@/test/helpers'

describe('recomputeLegacyTrackers — triggered by sim mutations', () => {
  let userId: string
  let legacyId: string

  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
    const legacy = await createTestLegacy(userId)
    legacyId = legacy.id
  })

  afterEach(async () => { await cleanupUser(userId) })

  it('stamps completedAt on SKILL_MAXED tracker when skill is maxed via addSkill', async () => {
    const skill = await db.skill.findFirst()
    if (!skill) return
    const trackerType = await db.trackerType.findFirst({ where: { name: 'Skill Maxed' } })
    if (!trackerType) return

    const challenge = await createTestChallenge(userId)
    const phase = await createTestChallengePhase(challenge.id, { generationNumber: 1 })
    await db.trackerDefinition.create({
      data: { challengePhaseId: phase.id, trackerTypeId: trackerType.id, name: 'Max Skill', config: { skillId: skill.id } },
    })
    const run = await createTestChallengeRun(legacyId, { sourceChallengeId: challenge.id })
    const runPhase = await db.challengeRunPhase.create({ data: { challengeRunId: run.id, generationNumber: 1, sortOrder: 0 } })
    const runTracker = await db.challengeRunTracker.create({
      data: { challengeRunPhaseId: runPhase.id, trackerTypeId: trackerType.id, name: 'Max Skill', config: { skillId: skill.id }, sortOrder: 0 },
    })
    await db.trackerProgress.create({ data: { challengeRunTrackerId: runTracker.id, isManual: false } })

    const sim = await createTestSim(legacyId)
    await db.sim.update({ where: { id: sim.id }, data: { generationNumber: 1 } })

    await authedCaller(userId).sims.addSkill({ simId: sim.id, skillId: skill.id, level: skill.maxLevel })

    const progress = await db.trackerProgress.findUnique({ where: { challengeRunTrackerId: runTracker.id } })
    expect(progress?.completedAt).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
npm test -- sims.test
```

Expected: FAIL — `completedAt` is null (recompute not called yet).

- [ ] **Step 3: Import and wire `recomputeLegacyTrackers` in `src/server/routers/sims.ts`**

At the top of `src/server/routers/sims.ts`, add:
```typescript
import { recomputeLegacyTrackers } from '../lib/trackerComputation'
```

Then add the following call at the **end** of these four mutations, after the DB operation succeeds:

**`addSkill` and `setSkillLevel`** — after `return ctx.db.simSkill.upsert(...)` / `update(...)`:
```typescript
      const result = await ctx.db.simSkill.upsert({ ... })
      await recomputeLegacyTrackers(ctx.db, sim.legacyId)
      return result
```

**`update`** — after `return ctx.db.sim.update(...)`:
```typescript
      const result = await ctx.db.sim.update({ where: { id }, data: fields })
      await recomputeLegacyTrackers(ctx.db, result.legacyId)
      return result
```

For aspirations, inside the `sims.update` handler, after completing `simAspiration` changes (when `aspirationId !== undefined`), the recompute is already covered by the final `sim.update` call's trigger. But we also need it for `SimCareer.endedAt` changes — career completion tracking. Since `sims.update` handles careers, the recompute at the end of `sims.update` covers it.

- [ ] **Step 4: Run tests**

```bash
npm test -- sims.test
```

Expected: all pass including the new recompute test.

- [ ] **Step 5: Commit**

```bash
git add src/server/routers/sims.ts src/server/routers/sims.test.ts
git commit -m "feat(sims): trigger recomputeLegacyTrackers on skill and sim mutations"
```

---

## Task 12: Final validation

- [ ] **Step 1: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors. Fix any type errors before continuing.

- [ ] **Step 2: Lint check**

```bash
npm run lint
```

Expected: no errors or warnings. Fix any issues before continuing.

- [ ] **Step 3: Full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 4: Final commit if any fixes were made**

```bash
git add -p
git commit -m "fix: resolve TypeScript and lint issues in challenges/trackers feature"
```
