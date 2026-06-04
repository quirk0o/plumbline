# Filter Pack-Linked Content by User-Owned Packs

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Everywhere traits, aspirations, careers, and skills are listed for user selection, restrict the results to base-game content (`packId IS NULL`) plus content from packs the user owns (`packId IN user's UserPack records`).

**Architecture:** The filter `WHERE packId IS NULL OR packId IN (owned pack IDs)` is applied at two layers — TRPC routers for traits/aspirations/careers (already have `ctx.session.user.id`) and `src/lib/reference-data.ts` server-side functions (need a `userId` parameter added). The two page server components that call `reference-data.ts` are updated to pass `userId` from the session.

**Tech Stack:** Prisma ORM, tRPC (protectedProcedure), Next.js 16 App Router server components, Vitest integration tests (real DB), GitButler (`but`) for all version-control write operations.

**GitButler branch:** `filter-content-by-owned-packs` — create once before Task 1 with `but branch new filter-content-by-owned-packs`. All commits go to this branch.

---

## File Structure

**Modified source files:**
- `src/server/routers/traits.ts` — add owned-pack `where` filter to `getAll`
- `src/server/routers/aspirations.ts` — add owned-pack `where` filter to `getAll`
- `src/server/routers/careers.ts` — add owned-pack `where` filter to `getAll`
- `src/lib/reference-data.ts` — add private `getOwnedPackFilter(userId)` helper; add `userId: string` param to all four exported functions
- `src/app/app/legacies/[slug]/sims/new/page.tsx` — extract `userId` variable, pass to three fetch calls
- `src/app/app/legacies/[slug]/sims/[id]/page.tsx` — pass existing `userId` to all four fetch calls

**Modified test files:**
- `src/server/routers/traits.test.ts` — add two new filter tests

**Created test files:**
- `src/server/routers/aspirations.test.ts` — full suite including filter tests
- `src/server/routers/careers.test.ts` — full suite including filter tests
- `src/lib/reference-data.test.ts` — filter tests for `fetchSkills` (the only function with no TRPC router equivalent)

---

## Branch Setup (do once before any task)

- [ ] **Create the GitButler branch**

```bash
but branch new filter-content-by-owned-packs
```

---

### Task 1: TDD — filter `traits.getAll` by owned packs

**Files:**
- Modify: `src/server/routers/traits.test.ts`
- Modify: `src/server/routers/traits.ts`

- [ ] **Step 1: Add two failing tests to `traits.test.ts`**

Append inside the existing `describe('traits.getAll', ...)` block (after the UNAUTHORIZED test):

```ts
  it('excludes traits from packs the user does not own', async () => {
    const packLinkedTrait = await db.personalityTrait.findFirst({
      where: { packId: { not: null } },
    })
    if (!packLinkedTrait) return

    const caller = authedCaller(userId)
    const result = await caller.traits.getAll()
    expect(result.map((t) => t.id)).not.toContain(packLinkedTrait.id)
  })

  it('includes traits from packs the user owns', async () => {
    const packLinkedTrait = await db.personalityTrait.findFirst({
      where: { packId: { not: null } },
    })
    if (!packLinkedTrait) return

    await db.userPack.create({ data: { userId, packId: packLinkedTrait.packId! } })

    const caller = authedCaller(userId)
    const result = await caller.traits.getAll()
    expect(result.map((t) => t.id)).toContain(packLinkedTrait.id)
  })
```

Also add `db` to the imports at the top of the file:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { authedCaller, unauthCaller } from '@/test/caller'
import { createTestUser, cleanupUser } from '@/test/helpers'
import { db } from '@/server/db'
```

- [ ] **Step 2: Run tests to confirm the first new test fails**

```bash
npx vitest run src/server/routers/traits.test.ts
```

Expected: "excludes traits from packs the user does not own" FAILS (currently all traits are returned). The "includes" test passes (everything is returned currently).

- [ ] **Step 3: Add the pack filter to `traits.ts`**

Replace the full file contents:

```ts
import { router, protectedProcedure } from '../trpc'

export const traitsRouter = router({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const ownedPackIds = (
      await ctx.db.userPack.findMany({
        where: { userId: ctx.session.user.id },
        select: { packId: true },
      })
    ).map((up) => up.packId)

    const traits = await ctx.db.personalityTrait.findMany({
      where: {
        OR: [{ packId: null }, { packId: { in: ownedPackIds } }],
      },
      include: {
        conflictsA: { select: { traitBId: true } },
        conflictsB: { select: { traitAId: true } },
      },
      orderBy: { name: 'asc' },
    })
    return traits.map((t) => ({
      id: t.id,
      name: t.name,
      category: t.category,
      minLifeStage: t.minLifeStage,
      maxLifeStage: t.maxLifeStage,
      conflictsWith: [
        ...t.conflictsA.map((c) => c.traitBId),
        ...t.conflictsB.map((c) => c.traitAId),
      ],
    }))
  }),
})
```

- [ ] **Step 4: Run tests to confirm all pass**

```bash
npx vitest run src/server/routers/traits.test.ts
```

Expected: all 5 tests pass.

- [ ] **Step 5: Commit with GitButler**

```bash
but status -fv
# Note the file IDs for traits.ts and traits.test.ts, then:
but commit filter-content-by-owned-packs -m "feat(traits): filter getAll by user-owned packs" --changes <id-for-traits.ts>,<id-for-traits.test.ts>
```

---

### Task 2: TDD — filter `aspirations.getAll` by owned packs

**Files:**
- Create: `src/server/routers/aspirations.test.ts`
- Modify: `src/server/routers/aspirations.ts`

- [ ] **Step 1: Create `aspirations.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { authedCaller, unauthCaller } from '@/test/caller'
import { createTestUser, cleanupUser } from '@/test/helpers'
import { db } from '@/server/db'

describe('aspirations.getAll', () => {
  let userId: string

  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
  })

  afterEach(async () => {
    await cleanupUser(userId)
  })

  it('returns a non-empty array of aspirations', async () => {
    const caller = authedCaller(userId)
    const result = await caller.aspirations.getAll()
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
  })

  it('excludes aspirations from packs the user does not own', async () => {
    const packLinkedAspiration = await db.aspiration.findFirst({
      where: { packId: { not: null } },
    })
    if (!packLinkedAspiration) return

    const caller = authedCaller(userId)
    const result = await caller.aspirations.getAll()
    expect(result.map((a) => a.id)).not.toContain(packLinkedAspiration.id)
  })

  it('includes aspirations from packs the user owns', async () => {
    const packLinkedAspiration = await db.aspiration.findFirst({
      where: { packId: { not: null } },
    })
    if (!packLinkedAspiration) return

    await db.userPack.create({ data: { userId, packId: packLinkedAspiration.packId! } })

    const caller = authedCaller(userId)
    const result = await caller.aspirations.getAll()
    expect(result.map((a) => a.id)).toContain(packLinkedAspiration.id)
  })

  it('throws UNAUTHORIZED without a session', async () => {
    const caller = unauthCaller()
    await expect(caller.aspirations.getAll()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })
})
```

- [ ] **Step 2: Run to confirm the "excludes" test fails**

```bash
npx vitest run src/server/routers/aspirations.test.ts
```

Expected: "excludes aspirations from packs the user does not own" FAILS.

- [ ] **Step 3: Add the pack filter to `aspirations.ts`**

Replace the full file contents:

```ts
import { router, protectedProcedure } from '../trpc'

export const aspirationsRouter = router({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const ownedPackIds = (
      await ctx.db.userPack.findMany({
        where: { userId: ctx.session.user.id },
        select: { packId: true },
      })
    ).map((up) => up.packId)

    return ctx.db.aspiration.findMany({
      where: {
        OR: [{ packId: null }, { packId: { in: ownedPackIds } }],
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, category: true, minLifeStage: true, maxLifeStage: true },
    })
  }),
})
```

- [ ] **Step 4: Run tests to confirm all pass**

```bash
npx vitest run src/server/routers/aspirations.test.ts
```

Expected: all 4 tests pass.

- [ ] **Step 5: Commit with GitButler**

```bash
but status -fv
# Note the file IDs for aspirations.ts and aspirations.test.ts, then:
but commit filter-content-by-owned-packs -m "feat(aspirations): filter getAll by user-owned packs" --changes <id-for-aspirations.ts>,<id-for-aspirations.test.ts>
```

---

### Task 3: TDD — filter `careers.getAll` by owned packs

**Files:**
- Create: `src/server/routers/careers.test.ts`
- Modify: `src/server/routers/careers.ts`

- [ ] **Step 1: Create `careers.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { authedCaller, unauthCaller } from '@/test/caller'
import { createTestUser, cleanupUser } from '@/test/helpers'
import { db } from '@/server/db'

describe('careers.getAll', () => {
  let userId: string

  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
  })

  afterEach(async () => {
    await cleanupUser(userId)
  })

  it('returns a non-empty array of careers', async () => {
    const caller = authedCaller(userId)
    const result = await caller.careers.getAll()
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
  })

  it('excludes careers from packs the user does not own', async () => {
    const packLinkedCareer = await db.career.findFirst({
      where: { packId: { not: null } },
    })
    if (!packLinkedCareer) return

    const caller = authedCaller(userId)
    const result = await caller.careers.getAll()
    expect(result.map((c) => c.id)).not.toContain(packLinkedCareer.id)
  })

  it('includes careers from packs the user owns', async () => {
    const packLinkedCareer = await db.career.findFirst({
      where: { packId: { not: null } },
    })
    if (!packLinkedCareer) return

    await db.userPack.create({ data: { userId, packId: packLinkedCareer.packId! } })

    const caller = authedCaller(userId)
    const result = await caller.careers.getAll()
    expect(result.map((c) => c.id)).toContain(packLinkedCareer.id)
  })

  it('throws UNAUTHORIZED without a session', async () => {
    const caller = unauthCaller()
    await expect(caller.careers.getAll()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })
})
```

- [ ] **Step 2: Run to confirm the "excludes" test fails**

```bash
npx vitest run src/server/routers/careers.test.ts
```

Expected: "excludes careers from packs the user does not own" FAILS.

- [ ] **Step 3: Add the pack filter to `careers.ts`**

Replace the full file contents:

```ts
import { router, protectedProcedure } from '../trpc'

export const careersRouter = router({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const ownedPackIds = (
      await ctx.db.userPack.findMany({
        where: { userId: ctx.session.user.id },
        select: { packId: true },
      })
    ).map((up) => up.packId)

    return ctx.db.career.findMany({
      where: {
        OR: [{ packId: null }, { packId: { in: ownedPackIds } }],
      },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, type: true, branchAName: true, branchBName: true },
    })
  }),
})
```

- [ ] **Step 4: Run tests to confirm all pass**

```bash
npx vitest run src/server/routers/careers.test.ts
```

Expected: all 4 tests pass.

- [ ] **Step 5: Commit with GitButler**

```bash
but status -fv
# Note the file IDs for careers.ts and careers.test.ts, then:
but commit filter-content-by-owned-packs -m "feat(careers): filter getAll by user-owned packs" --changes <id-for-careers.ts>,<id-for-careers.test.ts>
```

---

### Task 4: TDD — filter `reference-data.ts` functions by userId + update page callers

`fetchSkills` has no TRPC router, so this task tests it directly. The same `getOwnedPackFilter` helper is used by all four functions, so testing skills validates the helper for traits/aspirations/careers/skills alike. This task also updates the two page server components that call these functions — they must be updated in the same commit as the `reference-data.ts` signature change to keep TypeScript passing.

**Files:**
- Create: `src/lib/reference-data.test.ts`
- Modify: `src/lib/reference-data.ts`
- Modify: `src/app/app/legacies/[slug]/sims/new/page.tsx`
- Modify: `src/app/app/legacies/[slug]/sims/[id]/page.tsx`

- [ ] **Step 1: Create `src/lib/reference-data.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createTestUser, cleanupUser } from '@/test/helpers'
import { db } from '@/server/db'
import { fetchSkills } from './reference-data'

describe('fetchSkills', () => {
  let userId: string

  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
  })

  afterEach(async () => {
    await cleanupUser(userId)
  })

  it('excludes skills from packs the user does not own', async () => {
    const packLinkedSkill = await db.skill.findFirst({ where: { packId: { not: null } } })
    if (!packLinkedSkill) return

    const result = await fetchSkills(userId)
    expect(result.map((s) => s.id)).not.toContain(packLinkedSkill.id)
  })

  it('includes skills from packs the user owns', async () => {
    const packLinkedSkill = await db.skill.findFirst({ where: { packId: { not: null } } })
    if (!packLinkedSkill) return

    await db.userPack.create({ data: { userId, packId: packLinkedSkill.packId! } })

    const result = await fetchSkills(userId)
    expect(result.map((s) => s.id)).toContain(packLinkedSkill.id)
  })
})
```

- [ ] **Step 2: Run to confirm the "excludes" test fails**

```bash
npx vitest run src/lib/reference-data.test.ts
```

Expected: "excludes skills from packs the user does not own" FAILS because `fetchSkills` does not yet filter by `userId` and returns all skills, including pack-linked ones.

- [ ] **Step 3: Rewrite `src/lib/reference-data.ts` to accept `userId` and filter**

```ts
import { db } from '@/server/db'
import type { Trait } from '@/app/components/trait-picker'

async function getOwnedPackFilter(userId: string) {
  const ownedPacks = await db.userPack.findMany({
    where: { userId },
    select: { packId: true },
  })
  const packIds = ownedPacks.map((up) => up.packId)
  return { OR: [{ packId: null }, { packId: { in: packIds } }] }
}

export async function fetchTraitsWithConflicts(userId: string): Promise<Trait[]> {
  const packFilter = await getOwnedPackFilter(userId)
  const traits = await db.personalityTrait.findMany({
    where: packFilter,
    include: {
      conflictsA: { select: { traitBId: true } },
      conflictsB: { select: { traitAId: true } },
    },
    orderBy: { name: 'asc' },
  })
  return traits.map((t) => ({
    id: t.id,
    name: t.name,
    category: t.category,
    conflictsWith: [
      ...t.conflictsA.map((c) => c.traitBId),
      ...t.conflictsB.map((c) => c.traitAId),
    ],
  }))
}

export async function fetchAspirations(userId: string) {
  const packFilter = await getOwnedPackFilter(userId)
  return db.aspiration.findMany({
    where: packFilter,
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, category: true },
  })
}

export async function fetchCareers(userId: string) {
  const packFilter = await getOwnedPackFilter(userId)
  return db.career.findMany({
    where: packFilter,
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, type: true },
  })
}

export async function fetchSkills(userId: string) {
  const packFilter = await getOwnedPackFilter(userId)
  return db.skill.findMany({
    where: packFilter,
    orderBy: { name: 'asc' },
    select: { id: true, name: true, maxLevel: true },
  })
}
```

- [ ] **Step 4: Update `src/app/app/legacies/[slug]/sims/new/page.tsx`**

Extract `userId` and pass it to the three fetch calls. Change lines 13–24:

```tsx
  const { slug } = await params
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin')
  const userId = session.user.id

  const legacy = await db.legacy.findFirst({ where: { slug, userId } })
  if (!legacy) notFound()

  const [traits, aspirations, careers] = await Promise.all([
    fetchTraitsWithConflicts(userId),
    fetchAspirations(userId),
    fetchCareers(userId),
  ])
```

- [ ] **Step 5: Update `src/app/app/legacies/[slug]/sims/[id]/page.tsx`**

`userId` is already extracted on line 16. Update the four fetch calls in the `Promise.all` (lines 45–48):

```tsx
    fetchTraitsWithConflicts(userId),
    fetchAspirations(userId),
    fetchCareers(userId),
    fetchSkills(userId),
```

- [ ] **Step 6: Run the reference-data tests to confirm all pass**

```bash
npx vitest run src/lib/reference-data.test.ts
```

Expected: both tests pass.

- [ ] **Step 7: Run the full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 8: TypeScript and lint check**

```bash
npx tsc --noEmit
npm run lint
```

Expected: no errors or warnings.

- [ ] **Step 9: Commit with GitButler**

```bash
but status -fv
# Note the file IDs for all four changed files, then:
but commit filter-content-by-owned-packs -m "feat(reference-data): filter server-side fetch functions by user-owned packs" --changes <id1>,<id2>,<id3>,<id4>
```

---

### Task 5: Final verification

- [ ] **Step 1: Run the complete test suite**

```bash
npm test
```

Expected: all tests pass with no failures.

- [ ] **Step 2: TypeScript and lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: zero errors, zero warnings.
