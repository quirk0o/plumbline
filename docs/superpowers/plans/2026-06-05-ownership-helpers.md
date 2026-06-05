# Shared Ownership Assertion Helpers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every copy-pasted inline ownership check (`ctx.db.sim.findFirst({ where: { id, legacy: { userId } } })` and friends) with shared, tested helpers in `src/server/lib/ownership.ts`, and fix the one place the convention has already drifted (`updateSocialRelationship` / `removeSocialRelationship` check only `simAId`).

**Architecture:** A new `src/server/lib/ownership.ts` module exports seven assertion helpers that return the owned row or throw `TRPCError NOT_FOUND`. Every procedure follows **assert-then-fetch**: an ownership assert opens the procedure, and any data fetch afterwards queries by plain id. After migration, exactly **one** inline ownership filter remains in the routers (the `getMiniTreeData` partner-sim *filter*, which silently omits foreign sims by design) — making "no ownership filters outside `ownership.ts`" a greppable invariant.

**Tech Stack:** tRPC v11, Prisma, Vitest integration tests (real PostgreSQL via `src/test/helpers.ts`), GitButler (`but`) for version control.

---

## Background (read before starting)

This addresses tech-debt finding **H1: Authorization by copy-paste convention**. Every protected procedure re-implements ownership inline. The mechanism already drifted once: `sims.updateSocialRelationship` and `sims.removeSocialRelationship` check ownership of **only `simAId`**, while `addSocialRelationship` checks both sims. That is not exploitable today only because `add` validates both sides so cross-user rows can't exist — an accident, not a guarantee. If a cross-tenant `SocialRelationship` row ever came to exist, an attacker owning one side could update or delete it.

### Scope decisions (locked in — do not relitigate during execution)

1. **Assert-then-fetch everywhere** (user's explicit choice). Read procedures whose ownership filter was embedded in the data fetch (`sims.getById`, `sims.getMiniTreeData`, `challengeRuns.getById`) gain a leading assert and fetch by plain id. The extra query is a single indexed point lookup (~1ms) on three single-entity page loads — accepted cost for a uniform, greppable authorization layer. The second fetch keeps a `NOT_FOUND` check (the row can vanish between assert and fetch; that must surface as 404, not 500).
2. **One intentional exception:** the `missingPartnerIds` lookup in `sims.getMiniTreeData` is an ownership *filter*, not a guard — partner sims outside the user's legacies are silently omitted from the mini tree (existing tests assert this). It stays inline with an explanatory comment.
3. **All ownership assertions live in `ownership.ts`** — including the previously-local `households.ts#findOwnedHousehold` and `milestones.ts#findOwnedMilestone`, which become `assertHouseholdOwned` / `assertMilestoneOwned`, plus a new `assertChallengeRunOwned`. This is what makes the grep invariant hold.
4. **Out of scope:** `challenges.ts` and `trackerTypes.ts` use a different authorization model (`ownerId` + `isPublic` visibility with a NOT_FOUND/FORBIDDEN distinction) — untouched. The deep-chain guards in `challengeRuns.updatePhase/updateTracker/updateProgress` (`phase.run.legacy.userId !== userId → FORBIDDEN`, with existing tests asserting FORBIDDEN) — untouched. `milestones.ts#assertSimsInLegacy` is a legacy-*membership* check (BAD_REQUEST), not user-ownership — stays local. List filters like `where: { userId: ctx.session.user.id }` in `legacies.getAll`, `aspirations`, `careers`, `traits`, `packs` are scoping filters, not guards — untouched.
5. **The drift fix is a behavior change on purpose:** `updateSocialRelationship`/`removeSocialRelationship` will require ownership of **both** sims, matching `addSocialRelationship`. For legitimate users nothing changes (both sims are theirs). For the latent cross-tenant case, the procedures now throw a clean `NOT_FOUND` instead of mutating.

### Conventions you must follow

- **No `// eslint-disable`, `// @ts-ignore`, `// @ts-expect-error` — ever.** Fix root causes.
- **Never use `cd`.** Run all commands from the repo root with explicit paths.
- **Version control via GitButler (`but`), never `git add/commit/push`.** Before every commit: `but status -fv`, find the CLI IDs of the files you changed, then `but commit server-ownership-helpers -m "<msg>" --changes <id1>,<id2>`.
- Integration tests need PostgreSQL running and `DATABASE_URL` in `.env` (the Vitest setup file loads it), with a seeded DB.
- After each task: `npx tsc --noEmit` and `npm run lint` must both be clean.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/server/lib/ownership.ts` | Create | The seven shared ownership assertions — the single place the "does this user own this row" decision lives |
| `src/server/lib/ownership.test.ts` | Create | Integration tests for the helpers (real DB) |
| `src/server/routers/sims.ts` | Modify | Replace all inline guards/read filters with helper calls; fix the social-relationship drift |
| `src/server/routers/sims.test.ts` | Modify | Add cross-tenant regression tests for `updateSocialRelationship`/`removeSocialRelationship` |
| `src/server/routers/households.ts` | Modify | Drop local `assertOwnedLegacy`/`findOwnedHousehold`, use shared helpers |
| `src/server/routers/milestones.ts` | Modify | Drop local `assertOwnedLegacy`/`findOwnedMilestone`, use shared helpers |
| `src/server/routers/challengeRuns.ts` | Modify | `link`/`listByLegacy` use `assertLegacyOwned`; `getById` becomes assert-then-fetch |

---

### Task 1: Session branch

**Files:** none (version control only)

- [ ] **Step 1: Inspect workspace state**

Run: `but status -fv`
Expected: clean workspace (or unrelated branches from other agents — leave them alone).

- [ ] **Step 2: Create the session branch**

Run: `but branch new server-ownership-helpers`
Expected: branch created and applied to the workspace.

---

### Task 2: `assertLegacyOwned` + `assertLegacyOwnedBySlug`

**Files:**
- Create: `src/server/lib/ownership.test.ts`
- Create: `src/server/lib/ownership.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/server/lib/ownership.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { db } from '@/server/db'
import { createTestUser, cleanupUser, createTestLegacy } from '@/test/helpers'
import { assertLegacyOwned, assertLegacyOwnedBySlug } from './ownership'

describe('assertLegacyOwned', () => {
  let userId: string
  let otherUserId: string
  beforeEach(async () => {
    ;({ id: userId } = await createTestUser())
    ;({ id: otherUserId } = await createTestUser())
  })
  afterEach(async () => {
    await cleanupUser(userId)
    await cleanupUser(otherUserId)
  })

  it('returns the legacy when the user owns it', async () => {
    const legacy = await createTestLegacy(userId)
    const result = await assertLegacyOwned(db, legacy.id, userId)
    expect(result.id).toBe(legacy.id)
    expect(result.userId).toBe(userId)
  })

  it("throws NOT_FOUND for another user's legacy", async () => {
    const legacy = await createTestLegacy(otherUserId)
    await expect(assertLegacyOwned(db, legacy.id, userId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('throws NOT_FOUND for a nonexistent legacy', async () => {
    await expect(assertLegacyOwned(db, 'nonexistent-id', userId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })
})

describe('assertLegacyOwnedBySlug', () => {
  let userId: string
  let otherUserId: string
  beforeEach(async () => {
    ;({ id: userId } = await createTestUser())
    ;({ id: otherUserId } = await createTestUser())
  })
  afterEach(async () => {
    await cleanupUser(userId)
    await cleanupUser(otherUserId)
  })

  it('returns the legacy when the user owns it', async () => {
    const legacy = await createTestLegacy(userId)
    const result = await assertLegacyOwnedBySlug(db, legacy.slug, userId)
    expect(result.id).toBe(legacy.id)
  })

  it("throws NOT_FOUND for another user's legacy slug", async () => {
    const legacy = await createTestLegacy(otherUserId)
    await expect(assertLegacyOwnedBySlug(db, legacy.slug, userId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/server/lib/ownership.test.ts`
Expected: FAIL — cannot resolve `./ownership` (module does not exist yet).

- [ ] **Step 3: Write the implementation**

Create `src/server/lib/ownership.ts`:

```ts
import { TRPCError } from '@trpc/server'
import type { PrismaClient } from '@prisma/client'

/** Return the legacy if it exists and is owned by the user, else throw NOT_FOUND. */
export async function assertLegacyOwned(db: PrismaClient, legacyId: string, userId: string) {
  const legacy = await db.legacy.findFirst({ where: { id: legacyId, userId } })
  if (!legacy) throw new TRPCError({ code: 'NOT_FOUND', message: 'Legacy not found' })
  return legacy
}

/** Slug-keyed variant of assertLegacyOwned. */
export async function assertLegacyOwnedBySlug(db: PrismaClient, slug: string, userId: string) {
  const legacy = await db.legacy.findFirst({ where: { slug, userId } })
  if (!legacy) throw new TRPCError({ code: 'NOT_FOUND', message: 'Legacy not found' })
  return legacy
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/server/lib/ownership.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Validate and commit**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors, no warnings.

Run: `but status -fv`, find the CLI IDs for `src/server/lib/ownership.ts` and `src/server/lib/ownership.test.ts`, then:

```bash
but commit server-ownership-helpers -m "feat(server): add shared assertLegacyOwned ownership helpers" --changes <id1>,<id2>
```

---

### Task 3: `assertSimOwned`

**Files:**
- Modify: `src/server/lib/ownership.test.ts`
- Modify: `src/server/lib/ownership.ts`

- [ ] **Step 1: Write the failing tests**

In `src/server/lib/ownership.test.ts`, extend the imports:

```ts
import { createTestUser, cleanupUser, createTestLegacy, createTestSim } from '@/test/helpers'
import {
  assertLegacyOwned,
  assertLegacyOwnedBySlug,
  assertSimOwned,
} from './ownership'
```

Append:

```ts
describe('assertSimOwned', () => {
  let userId: string
  let otherUserId: string
  beforeEach(async () => {
    ;({ id: userId } = await createTestUser())
    ;({ id: otherUserId } = await createTestUser())
  })
  afterEach(async () => {
    await cleanupUser(userId)
    await cleanupUser(otherUserId)
  })

  it("returns the sim when it belongs to the user's legacy", async () => {
    const legacy = await createTestLegacy(userId)
    const sim = await createTestSim(legacy.id)
    const result = await assertSimOwned(db, sim.id, userId)
    expect(result.id).toBe(sim.id)
    expect(result.legacyId).toBe(legacy.id)
  })

  it("throws NOT_FOUND for a sim in another user's legacy", async () => {
    const otherLegacy = await createTestLegacy(otherUserId)
    const sim = await createTestSim(otherLegacy.id)
    await expect(assertSimOwned(db, sim.id, userId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('throws NOT_FOUND for a nonexistent sim', async () => {
    await expect(assertSimOwned(db, 'nonexistent-id', userId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/server/lib/ownership.test.ts`
Expected: FAIL — `assertSimOwned` is not exported.

- [ ] **Step 3: Write the implementation**

Append to `src/server/lib/ownership.ts`:

```ts
/** Return the sim if it belongs to a legacy owned by the user, else throw NOT_FOUND. */
export async function assertSimOwned(db: PrismaClient, simId: string, userId: string) {
  const sim = await db.sim.findFirst({ where: { id: simId, legacy: { userId } } })
  if (!sim) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sim not found' })
  return sim
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/server/lib/ownership.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Validate and commit**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

Run: `but status -fv`, then:

```bash
but commit server-ownership-helpers -m "feat(server): add assertSimOwned ownership helper" --changes <id1>,<id2>
```

---

### Task 4: `assertSimsOwned`

**Files:**
- Modify: `src/server/lib/ownership.test.ts`
- Modify: `src/server/lib/ownership.ts`

- [ ] **Step 1: Write the failing tests**

Extend the ownership import in `src/server/lib/ownership.test.ts`:

```ts
import {
  assertLegacyOwned,
  assertLegacyOwnedBySlug,
  assertSimOwned,
  assertSimsOwned,
} from './ownership'
```

Append:

```ts
describe('assertSimsOwned', () => {
  let userId: string
  let otherUserId: string
  beforeEach(async () => {
    ;({ id: userId } = await createTestUser())
    ;({ id: otherUserId } = await createTestUser())
  })
  afterEach(async () => {
    await cleanupUser(userId)
    await cleanupUser(otherUserId)
  })

  it('returns the sims in input order when all are owned', async () => {
    const legacy = await createTestLegacy(userId)
    const simA = await createTestSim(legacy.id, { firstName: 'A' })
    const simB = await createTestSim(legacy.id, { firstName: 'B' })
    const result = await assertSimsOwned(db, [simB.id, simA.id], userId)
    expect(result.map((s) => s.id)).toEqual([simB.id, simA.id])
  })

  it('handles duplicate ids without throwing', async () => {
    const legacy = await createTestLegacy(userId)
    const sim = await createTestSim(legacy.id)
    const result = await assertSimsOwned(db, [sim.id, sim.id], userId)
    expect(result.map((s) => s.id)).toEqual([sim.id, sim.id])
  })

  it('throws NOT_FOUND when any sim belongs to another user', async () => {
    const legacy = await createTestLegacy(userId)
    const mine = await createTestSim(legacy.id)
    const otherLegacy = await createTestLegacy(otherUserId)
    const theirs = await createTestSim(otherLegacy.id)
    await expect(assertSimsOwned(db, [mine.id, theirs.id], userId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('throws NOT_FOUND when any sim does not exist', async () => {
    const legacy = await createTestLegacy(userId)
    const mine = await createTestSim(legacy.id)
    await expect(assertSimsOwned(db, [mine.id, 'nonexistent-id'], userId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/server/lib/ownership.test.ts`
Expected: FAIL — `assertSimsOwned` is not exported.

- [ ] **Step 3: Write the implementation**

Append to `src/server/lib/ownership.ts`:

```ts
/**
 * Return all requested sims (in input order, duplicates preserved) if every one
 * belongs to a legacy owned by the user, else throw NOT_FOUND.
 */
export async function assertSimsOwned(db: PrismaClient, simIds: string[], userId: string) {
  const uniqueIds = [...new Set(simIds)]
  const sims = await db.sim.findMany({
    where: { id: { in: uniqueIds }, legacy: { userId } },
  })
  if (sims.length !== uniqueIds.length) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Sim not found' })
  }
  const byId = new Map(sims.map((s) => [s.id, s]))
  return simIds.map((id) => byId.get(id)!)
}
```

(The non-null assertion is safe — the length check guarantees every unique id is in the map. Existing code uses `!` the same way, e.g. `sims.ts` `generationNumber!`.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/server/lib/ownership.test.ts`
Expected: PASS (12 tests).

- [ ] **Step 5: Validate and commit**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

Run: `but status -fv`, then:

```bash
but commit server-ownership-helpers -m "feat(server): add assertSimsOwned ownership helper" --changes <id1>,<id2>
```

---

### Task 5: `assertHouseholdOwned`, `assertMilestoneOwned`, `assertChallengeRunOwned`

**Files:**
- Modify: `src/server/lib/ownership.test.ts`
- Modify: `src/server/lib/ownership.ts`

These absorb the entity-specific helpers currently local to `households.ts` / `milestones.ts`, plus the run check inline in `challengeRuns.getById` — so that *every* ownership assertion lives in one module.

- [ ] **Step 1: Write the failing tests**

Extend the imports in `src/server/lib/ownership.test.ts`:

```ts
import {
  createTestUser,
  cleanupUser,
  createTestLegacy,
  createTestSim,
  createTestHousehold,
  createTestChallengeRun,
} from '@/test/helpers'
import {
  assertLegacyOwned,
  assertLegacyOwnedBySlug,
  assertSimOwned,
  assertSimsOwned,
  assertHouseholdOwned,
  assertMilestoneOwned,
  assertChallengeRunOwned,
} from './ownership'
```

Append:

```ts
describe('entity ownership helpers (household, milestone, challenge run)', () => {
  let userId: string
  let otherUserId: string
  let myLegacyId: string
  let theirLegacyId: string
  beforeEach(async () => {
    ;({ id: userId } = await createTestUser())
    ;({ id: otherUserId } = await createTestUser())
    myLegacyId = (await createTestLegacy(userId)).id
    theirLegacyId = (await createTestLegacy(otherUserId)).id
  })
  afterEach(async () => {
    await cleanupUser(userId)
    await cleanupUser(otherUserId)
  })

  it('assertHouseholdOwned returns the owned household and rejects a foreign one', async () => {
    const mine = await createTestHousehold(myLegacyId)
    const theirs = await createTestHousehold(theirLegacyId)
    const result = await assertHouseholdOwned(db, mine.id, userId)
    expect(result.id).toBe(mine.id)
    expect(result.legacyId).toBe(myLegacyId)
    await expect(assertHouseholdOwned(db, theirs.id, userId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('assertMilestoneOwned returns the owned milestone and rejects a foreign one', async () => {
    const mine = await db.milestone.create({
      data: { legacyId: myLegacyId, title: 'Mine', sortOrder: 0 },
    })
    const theirs = await db.milestone.create({
      data: { legacyId: theirLegacyId, title: 'Theirs', sortOrder: 0 },
    })
    const result = await assertMilestoneOwned(db, mine.id, userId)
    expect(result.id).toBe(mine.id)
    expect(result.legacyId).toBe(myLegacyId)
    await expect(assertMilestoneOwned(db, theirs.id, userId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('assertChallengeRunOwned returns the owned run and rejects a foreign one', async () => {
    const mine = await createTestChallengeRun(myLegacyId)
    const theirs = await createTestChallengeRun(theirLegacyId)
    const result = await assertChallengeRunOwned(db, mine.id, userId)
    expect(result.id).toBe(mine.id)
    expect(result.legacyId).toBe(myLegacyId)
    await expect(assertChallengeRunOwned(db, theirs.id, userId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/server/lib/ownership.test.ts`
Expected: FAIL — the three new helpers are not exported.

- [ ] **Step 3: Write the implementation**

Append to `src/server/lib/ownership.ts`:

```ts
/** Return the household if it belongs to a legacy owned by the user, else throw NOT_FOUND. */
export async function assertHouseholdOwned(db: PrismaClient, householdId: string, userId: string) {
  const household = await db.household.findFirst({ where: { id: householdId, legacy: { userId } } })
  if (!household) throw new TRPCError({ code: 'NOT_FOUND', message: 'Household not found' })
  return household
}

/** Return the milestone if it belongs to a legacy owned by the user, else throw NOT_FOUND. */
export async function assertMilestoneOwned(db: PrismaClient, milestoneId: string, userId: string) {
  const milestone = await db.milestone.findFirst({ where: { id: milestoneId, legacy: { userId } } })
  if (!milestone) throw new TRPCError({ code: 'NOT_FOUND', message: 'Milestone not found' })
  return milestone
}

/** Return the challenge run if it belongs to a legacy owned by the user, else throw NOT_FOUND. */
export async function assertChallengeRunOwned(db: PrismaClient, runId: string, userId: string) {
  const run = await db.challengeRun.findFirst({ where: { id: runId, legacy: { userId } } })
  if (!run) throw new TRPCError({ code: 'NOT_FOUND', message: 'Challenge run not found' })
  return run
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/server/lib/ownership.test.ts`
Expected: PASS (15 tests).

- [ ] **Step 5: Validate and commit**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

Run: `but status -fv`, then:

```bash
but commit server-ownership-helpers -m "feat(server): add household/milestone/challenge-run ownership helpers" --changes <id1>,<id2>
```

---

### Task 6: Migrate `sims.ts` (mechanical — no behavior change)

**Files:**
- Modify: `src/server/routers/sims.ts`
- Test: `src/server/routers/sims.test.ts` (existing tests are the safety net; no new tests in this task)

This task migrates everything in `sims.ts` **except** `updateSocialRelationship` and `removeSocialRelationship` (the drift fix, Task 7, because their behavior changes).

- [ ] **Step 1: Add the import**

In `src/server/routers/sims.ts`, after the existing `imageUrlSchema` import (line 7), add:

```ts
import { assertLegacyOwned, assertLegacyOwnedBySlug, assertSimOwned, assertSimsOwned } from '../lib/ownership'
```

- [ ] **Step 2: Migrate the legacy guards**

In `create` (~line 40), replace:

```ts
      const legacy = await ctx.db.legacy.findFirst({ where: { id: input.legacyId, userId } })
      if (!legacy) throw new TRPCError({ code: 'NOT_FOUND', message: 'Legacy not found' })
```

with:

```ts
      const legacy = await assertLegacyOwned(ctx.db, input.legacyId, userId)
```

In `listByLegacy` (~line 159), replace the same two lines with:

```ts
      await assertLegacyOwned(ctx.db, input.legacyId, userId)
```

In `getTreeData` (~line 172), replace:

```ts
      const legacy = await ctx.db.legacy.findFirst({
        where: { slug: input.legacySlug, userId },
      })
      if (!legacy) throw new TRPCError({ code: 'NOT_FOUND', message: 'Legacy not found' })
```

with:

```ts
      const legacy = await assertLegacyOwnedBySlug(ctx.db, input.legacySlug, userId)
```

- [ ] **Step 3: Migrate `getById` to assert-then-fetch**

Replace (~lines 129–131):

```ts
      const userId = ctx.session.user.id
      const sim = await ctx.db.sim.findFirst({
        where: { id: input.id, legacy: { userId } },
```

with:

```ts
      const userId = ctx.session.user.id
      await assertSimOwned(ctx.db, input.id, userId)
      const sim = await ctx.db.sim.findUnique({
        where: { id: input.id },
```

The `include` block and the trailing `if (!sim) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sim not found' })` stay **unchanged** (the row can vanish between assert and fetch; that must stay a 404, not become a 500).

- [ ] **Step 4: Migrate `getMiniTreeData` to assert-then-fetch**

Replace (~lines 223–226):

```ts
      const userId = ctx.session.user.id

      const focusedSim = await ctx.db.sim.findFirst({
        where: { id: input.simId, legacy: { userId } },
```

with:

```ts
      const userId = ctx.session.user.id
      await assertSimOwned(ctx.db, input.simId, userId)

      const focusedSim = await ctx.db.sim.findUnique({
        where: { id: input.simId },
```

The big `select` block and the trailing `if (!focusedSim) throw ...` stay unchanged.

Then mark the **one intentional inline ownership filter** in the same procedure (~line 329). Replace:

```ts
      if (missingPartnerIds.length > 0) {
        const partnerSims = await ctx.db.sim.findMany({
          where: { id: { in: missingPartnerIds }, legacy: { userId } },
```

with:

```ts
      if (missingPartnerIds.length > 0) {
        // Ownership *filter*, not a guard: partner sims outside the user's
        // legacies are intentionally omitted from the mini tree. This is the
        // one sanctioned inline ownership condition outside src/server/lib/ownership.ts.
        const partnerSims = await ctx.db.sim.findMany({
          where: { id: { in: missingPartnerIds }, legacy: { userId } },
```

- [ ] **Step 5: Migrate the single-sim guards**

In `update` (~line 363), replace:

```ts
      const sim = await ctx.db.sim.findFirst({ where: { id: input.id, legacy: { userId } } })
      if (!sim) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sim not found' })
```

with:

```ts
      const sim = await assertSimOwned(ctx.db, input.id, userId)
```

In `removeTrait` (~line 441), replace:

```ts
      const sim = await ctx.db.sim.findFirst({ where: { id: input.simId, legacy: { userId } } })
      if (!sim) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sim not found' })
```

with:

```ts
      await assertSimOwned(ctx.db, input.simId, userId)
```

In `addSkill` (~line 454) and `setSkillLevel` (~line 473), replace (in each — `sim.legacyId` is still used by `recomputeLegacyTrackers`, keep the variable):

```ts
      const sim = await ctx.db.sim.findFirst({ where: { id: input.simId, legacy: { userId } } })
      if (!sim) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sim not found' })
```

with:

```ts
      const sim = await assertSimOwned(ctx.db, input.simId, userId)
```

In `removeSkill` (~line 491), replace the same two lines with:

```ts
      await assertSimOwned(ctx.db, input.simId, userId)
```

In `completeAspiration` (~line 650), replace:

```ts
      const sim = await ctx.db.sim.findFirst({
        where: { id: input.simId, legacy: { userId } },
        select: { id: true, legacyId: true },
      })
      if (!sim) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sim not found' })
```

with:

```ts
      const sim = await assertSimOwned(ctx.db, input.simId, userId)
```

In `endCareer` (~line 673), apply the identical replacement.

- [ ] **Step 6: Migrate `addTrait` (guard + relation fetch split)**

In `addTrait` (~lines 413–431), replace:

```ts
      const [sim, trait] = await Promise.all([
        ctx.db.sim.findFirst({
          where: { id: input.simId, legacy: { userId } },
          include: { personalityTraits: { select: { personalityTraitId: true } } },
        }),
        ctx.db.personalityTrait.findUnique({
          where: { id: input.traitId },
          select: { minLifeStage: true, maxLifeStage: true },
        }),
      ])
      if (!sim) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sim not found' })
      if (!trait) throw new TRPCError({ code: 'NOT_FOUND', message: 'Trait not found' })
      if (!isLifeStageInRange(sim.lifeStage, trait.minLifeStage, trait.maxLifeStage))
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Trait not available for this life stage' })
      if (sim.personalityTraits.length >= 6)
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Maximum 6 traits allowed' })
      const currentIds = sim.personalityTraits.map((t) => t.personalityTraitId)
```

with:

```ts
      const [sim, trait, currentTraits] = await Promise.all([
        assertSimOwned(ctx.db, input.simId, userId),
        ctx.db.personalityTrait.findUnique({
          where: { id: input.traitId },
          select: { minLifeStage: true, maxLifeStage: true },
        }),
        ctx.db.simPersonalityTrait.findMany({
          where: { simId: input.simId },
          select: { personalityTraitId: true },
        }),
      ])
      if (!trait) throw new TRPCError({ code: 'NOT_FOUND', message: 'Trait not found' })
      if (!isLifeStageInRange(sim.lifeStage, trait.minLifeStage, trait.maxLifeStage))
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Trait not available for this life stage' })
      if (currentTraits.length >= 6)
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Maximum 6 traits allowed' })
      const currentIds = currentTraits.map((t) => t.personalityTraitId)
```

(If the sim isn't owned, `assertSimOwned` rejects and `Promise.all` rejects with it — the trait rows fetched for an unauthorized sim never leave the server, so nothing leaks.)

- [ ] **Step 7: Migrate the sim-pair guards**

In `addFamilyRelationship` (~lines 510–515), replace:

```ts
      const userId = ctx.session.user.id
      const [parent, child] = await Promise.all([
        ctx.db.sim.findFirst({ where: { id: input.parentId, legacy: { userId } } }),
        ctx.db.sim.findFirst({ where: { id: input.childId, legacy: { userId } } }),
      ])
      if (!parent || !child) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sim not found' })
```

with:

```ts
      const userId = ctx.session.user.id
      const [parent, child] = await assertSimsOwned(ctx.db, [input.parentId, input.childId], userId)
```

(The `parent.legacyId !== child.legacyId` BAD_REQUEST check that follows stays exactly as is.)

In `removeFamilyRelationship` (~lines 544–549), replace:

```ts
      const userId = ctx.session.user.id
      const [parent, child] = await Promise.all([
        ctx.db.sim.findFirst({ where: { id: input.parentId, legacy: { userId } } }),
        ctx.db.sim.findFirst({ where: { id: input.childId, legacy: { userId } } }),
      ])
      if (!parent || !child) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sim not found' })
```

with:

```ts
      const userId = ctx.session.user.id
      const [, child] = await assertSimsOwned(ctx.db, [input.parentId, input.childId], userId)
```

(`parent` was only used for the existence check; only `child` is used afterwards.)

In `addSocialRelationship` (~lines 587–592), replace:

```ts
      const userId = ctx.session.user.id
      const [simA, simB] = await Promise.all([
        ctx.db.sim.findFirst({ where: { id: input.simAId, legacy: { userId } } }),
        ctx.db.sim.findFirst({ where: { id: input.simBId, legacy: { userId } } }),
      ])
      if (!simA || !simB) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sim not found' })
```

with:

```ts
      const userId = ctx.session.user.id
      const [simA, simB] = await assertSimsOwned(ctx.db, [input.simAId, input.simBId], userId)
```

- [ ] **Step 8: Run the sims tests**

Run: `npx vitest run src/server/routers/sims.test.ts`
Expected: PASS — this migration is behavior-preserving; the existing suite (including the "throws NOT_FOUND for another user's sim" tests) is the regression net.

- [ ] **Step 9: Validate and commit**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean. (If `tsc` reports an unused variable in a procedure you touched, fix by removing the binding — `await assertSimOwned(...)` without `const sim =`.)

Run: `but status -fv`, then:

```bash
but commit server-ownership-helpers -m "refactor(sims): route ownership checks through shared helpers" --changes <id>
```

---

### Task 7: Fix the social-relationship ownership drift (TDD — behavior change)

**Files:**
- Modify: `src/server/routers/sims.test.ts`
- Modify: `src/server/routers/sims.ts:615-644` (`updateSocialRelationship`, `removeSocialRelationship`)

Currently these two procedures check ownership of **only `simAId`**. If a cross-tenant relationship row existed, a user owning one side could update or delete it. Fix: require both sims owned, exactly like `addSocialRelationship`.

- [ ] **Step 1: Write the failing tests**

Append a new describe block at the end of `src/server/routers/sims.test.ts`:

```ts
describe('social relationship cross-tenant ownership', () => {
  let userId: string
  let otherUserId: string
  let mySimId: string
  let theirSimId: string

  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
    const otherUser = await createTestUser()
    otherUserId = otherUser.id
    const myLegacy = await createTestLegacy(userId)
    const theirLegacy = await createTestLegacy(otherUserId)
    mySimId = (await createTestSim(myLegacy.id)).id
    theirSimId = (await createTestSim(theirLegacy.id)).id
  })
  afterEach(async () => {
    await cleanupUser(userId)
    await cleanupUser(otherUserId)
  })

  /** Force a relationship row between the two sims, bypassing the tRPC guard
   *  (the procedures normalize the pair sorted, so the row must be too). */
  async function forceCrossTenantRelationship() {
    const [simAId, simBId] = [mySimId, theirSimId].sort()
    await db.socialRelationship.create({
      data: { simAId, simBId, romanticStatus: 'DATING', friendshipScore: 0, romanceScore: 0 },
    })
  }

  it('updateSocialRelationship throws NOT_FOUND when simB belongs to another user, even if the row exists', async () => {
    await forceCrossTenantRelationship()
    const caller = authedCaller(userId)
    await expect(
      caller.sims.updateSocialRelationship({
        simAId: mySimId,
        simBId: theirSimId,
        romanticStatus: 'MARRIED',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('removeSocialRelationship throws NOT_FOUND when simB belongs to another user, even if the row exists', async () => {
    await forceCrossTenantRelationship()
    const caller = authedCaller(userId)
    await expect(
      caller.sims.removeSocialRelationship({ simAId: mySimId, simBId: theirSimId }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })

    // The cross-tenant row must be untouched.
    const [simAId, simBId] = [mySimId, theirSimId].sort()
    expect(
      await db.socialRelationship.findUnique({ where: { simAId_simBId: { simAId, simBId } } }),
    ).not.toBeNull()
  })
})
```

(`authedCaller`, `createTestUser`, `cleanupUser`, `createTestLegacy`, `createTestSim`, and `db` are already imported at the top of `sims.test.ts` — check, and extend the imports only if one is missing.)

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `npx vitest run src/server/routers/sims.test.ts -t 'cross-tenant'`
Expected: **both tests FAIL** — the mutations currently succeed because only `simAId` is checked and the forced row exists. This failure is the proof the drift was real.

- [ ] **Step 3: Fix the two procedures**

In `updateSocialRelationship` (~lines 623–626), replace:

```ts
      const userId = ctx.session.user.id
      const sim = await ctx.db.sim.findFirst({ where: { id: input.simAId, legacy: { userId } } })
      if (!sim) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sim not found' })
```

with:

```ts
      const userId = ctx.session.user.id
      await assertSimsOwned(ctx.db, [input.simAId, input.simBId], userId)
```

In `removeSocialRelationship` (~lines 636–639), apply the identical replacement.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/server/routers/sims.test.ts`
Expected: PASS — the two new tests, plus the whole existing suite (legitimate same-user update/remove flows must be unaffected).

- [ ] **Step 5: Validate and commit**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

Run: `but status -fv`, then:

```bash
but commit server-ownership-helpers -m "fix(sims): require ownership of both sims in social relationship update/remove

updateSocialRelationship and removeSocialRelationship only verified
ownership of simAId, so a cross-tenant relationship row (impossible
today only because addSocialRelationship checks both sides) could be
mutated by a user owning one side. Both procedures now assert both
sims, matching add." --changes <id1>,<id2>
```

---

### Task 8: Migrate `households.ts` and `milestones.ts`

**Files:**
- Modify: `src/server/routers/households.ts`
- Modify: `src/server/routers/milestones.ts`
- Test: existing `src/server/routers/households.test.ts`, `src/server/routers/milestones.test.ts`

Both routers carry private copies of ownership helpers. Replace with the shared ones. `milestones.ts#assertSimsInLegacy` stays local (legacy-membership, BAD_REQUEST — not user-ownership).

- [ ] **Step 1: Migrate `households.ts`**

Add to the imports:

```ts
import { assertLegacyOwned, assertSimOwned, assertHouseholdOwned } from '../lib/ownership'
```

Delete both local helpers (lines 6–24):

```ts
/** Throw unless the legacy exists and is owned by the user. */
async function assertOwnedLegacy(db: PrismaClient, legacyId: string, userId: string) {
  const legacy = await db.legacy.findFirst({
    where: { id: legacyId, userId },
    select: { id: true, activeHouseholdId: true },
  })
  if (!legacy) throw new TRPCError({ code: 'NOT_FOUND', message: 'Legacy not found' })
  return legacy
}

/** Return the owned household's id + legacyId, or throw NOT_FOUND. */
async function findOwnedHousehold(db: PrismaClient, id: string, userId: string) {
  const household = await db.household.findFirst({
    where: { id, legacy: { userId } },
    select: { id: true, legacyId: true },
  })
  if (!household) throw new TRPCError({ code: 'NOT_FOUND', message: 'Household not found' })
  return household
}
```

Then update the call sites:

- `create` (~line 49): `assertOwnedLegacy(ctx.db, input.legacyId, userId)` → `assertLegacyOwned(ctx.db, input.legacyId, userId)` (`legacy.activeHouseholdId` is still available — the shared helper returns the full row)
- `update` (~line 112): `await findOwnedHousehold(ctx.db, householdId, userId)` → `await assertHouseholdOwned(ctx.db, householdId, userId)`
- `setActive` (~line 121): `const household = await findOwnedHousehold(ctx.db, input.householdId, userId)` → `const household = await assertHouseholdOwned(ctx.db, input.householdId, userId)`
- `listByLegacy` (~line 163): `await assertOwnedLegacy(ctx.db, input.legacyId, userId)` → `await assertLegacyOwned(ctx.db, input.legacyId, userId)`

In `moveSim` (~lines 133–137), replace:

```ts
      const sim = await ctx.db.sim.findFirst({
        where: { id: input.simId, legacy: { userId } },
        select: { id: true, legacyId: true, householdId: true },
      })
      if (!sim) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sim not found' })
```

with:

```ts
      const sim = await assertSimOwned(ctx.db, input.simId, userId)
```

Finally, fix the imports at the top: `assertWorldExists` still needs `PrismaClient`, so keep `import type { PrismaClient } from '@prisma/client'`. If `TRPCError` is now unused in this file (check — `assertWorldExists` and `create`/`moveSim` BAD_REQUEST throws still use it), keep it; otherwise remove it.

- [ ] **Step 2: Migrate `milestones.ts`**

Add to the imports:

```ts
import { assertLegacyOwned, assertMilestoneOwned } from '../lib/ownership'
```

Delete both local helpers:

```ts
/** Throw unless the legacy exists and is owned by the user. */
async function assertOwnedLegacy(db: PrismaClient, legacyId: string, userId: string) {
  const legacy = await db.legacy.findFirst({ where: { id: legacyId, userId } })
  if (!legacy) throw new TRPCError({ code: 'NOT_FOUND', message: 'Legacy not found' })
}
```

and:

```ts
/** Return the owned milestone's id + legacyId, or throw NOT_FOUND. */
async function findOwnedMilestone(db: PrismaClient, id: string, userId: string) {
  const existing = await db.milestone.findFirst({
    where: { id, legacy: { userId } },
    select: { id: true, legacyId: true },
  })
  if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Milestone not found' })
  return existing
}
```

Then update the call sites:

- `create` (~line 46): `await assertOwnedLegacy(ctx.db, input.legacyId, userId)` → `await assertLegacyOwned(ctx.db, input.legacyId, userId)`
- `update` (~line 73): `const existing = await findOwnedMilestone(ctx.db, input.id, userId)` → `const existing = await assertMilestoneOwned(ctx.db, input.id, userId)`
- `delete` (~line 94): `await findOwnedMilestone(ctx.db, input.id, userId)` → `await assertMilestoneOwned(ctx.db, input.id, userId)`
- `reorder` (~line 109): same replacement as `delete`

Keep the `PrismaClient` type import — `assertSimsInLegacy` still uses it. `TRPCError` is still used (`assertSimsInLegacy`, `reorder`) — keep it.

- [ ] **Step 3: Run both routers' tests**

Run: `npx vitest run src/server/routers/households.test.ts src/server/routers/milestones.test.ts`
Expected: PASS — behavior-preserving; the existing "throws NOT_FOUND for another user's …" tests cover the swap.

- [ ] **Step 4: Validate and commit**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

Run: `but status -fv`, then:

```bash
but commit server-ownership-helpers -m "refactor(households,milestones): use shared ownership helpers" --changes <id1>,<id2>
```

---

### Task 9: Migrate `challengeRuns.ts`

**Files:**
- Modify: `src/server/routers/challengeRuns.ts`
- Test: existing `src/server/routers/challengeRuns.test.ts`

The two legacy guards and the `getById` read migrate. The deep-chain `FORBIDDEN` guards in `updatePhase`/`updateTracker`/`updateProgress` stay as they are (scope decision 4 — different model, existing tests assert FORBIDDEN).

- [ ] **Step 1: Migrate the legacy guards**

Add to the imports:

```ts
import { assertLegacyOwned, assertChallengeRunOwned } from '../lib/ownership'
```

In `link` (~lines 16–17), replace:

```ts
      const legacy = await ctx.db.legacy.findFirst({ where: { id: input.legacyId, userId } })
      if (!legacy) throw new TRPCError({ code: 'NOT_FOUND', message: 'Legacy not found' })
```

with:

```ts
      await assertLegacyOwned(ctx.db, input.legacyId, userId)
```

In `listByLegacy` (~lines 82–83), replace:

```ts
      const legacy = await ctx.db.legacy.findFirst({ where: { id: input.legacyId, userId } })
      if (!legacy) throw new TRPCError({ code: 'NOT_FOUND' })
```

with:

```ts
      await assertLegacyOwned(ctx.db, input.legacyId, userId)
```

(The `legacy` variable was unused in both procedures. `listByLegacy` gains the message `'Legacy not found'` on its NOT_FOUND — tests assert the code, not the message.)

- [ ] **Step 2: Migrate `getById` to assert-then-fetch**

Replace (~lines 93–95):

```ts
      const userId = ctx.session.user.id
      const run = await ctx.db.challengeRun.findFirst({
        where: { id: input.id, legacy: { userId } },
```

with:

```ts
      const userId = ctx.session.user.id
      await assertChallengeRunOwned(ctx.db, input.id, userId)
      const run = await ctx.db.challengeRun.findUnique({
        where: { id: input.id },
```

The `include` block and the trailing `if (!run) throw new TRPCError({ code: 'NOT_FOUND' })` stay unchanged.

- [ ] **Step 3: Run the tests**

Run: `npx vitest run src/server/routers/challengeRuns.test.ts`
Expected: PASS.

- [ ] **Step 4: Validate and commit**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

Run: `but status -fv`, then:

```bash
but commit server-ownership-helpers -m "refactor(challenge-runs): use shared ownership helpers" --changes <id>
```

---

### Task 10: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Verify the grep invariant**

Run:

```bash
grep -rn "legacy: { userId" /Users/beatka/Projects/simstrack-526/src/server/routers --include="*.ts" | grep -v ".test.ts"
grep -rn "input.legacyId, userId" /Users/beatka/Projects/simstrack-526/src/server/routers --include="*.ts" | grep -v ".test.ts"
```

Expected: the first grep returns **exactly one** hit — the commented partner-sim *filter* in `sims.ts` `getMiniTreeData`. The second returns **nothing**. If anything else shows up, migrate it following the patterns in Tasks 6–9 before continuing.

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: ALL PASS.

- [ ] **Step 3: Run the E2E tests**

Requires PostgreSQL + MinIO (`docker compose up -d`) and `.env` present.

Run: `npm run test:e2e`
Expected: ALL PASS.

- [ ] **Step 4: Final static checks**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 5: Report**

Do **not** push or open a PR — the user hasn't asked. Report: branch name (`server-ownership-helpers`), the commit list (`but show server-ownership-helpers`), test results, and the one intentional behavior change (cross-tenant social-relationship mutation now returns NOT_FOUND instead of succeeding).
