# Household Section & Household Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Households section to the legacy chronicle page — featured "Now playing" card, compact card grid, ceremonial founding dialog, and a right-side management drawer for renaming, editing, setting active, and moving sims between households.

**Architecture:** Server-fed section (data fetched in `page.tsx`), client components for the drawer/dialog, every mutation = tRPC call + `router.refresh()` (the `NameHeirDialog` pattern). New seeded `World`/`Lot` reference data; `Legacy.activeHouseholdId` pointer guarantees one active household per legacy.

**Tech Stack:** Next.js 16 App Router, tRPC 11 + Zod, Prisma 7 (PostgreSQL), Radix Dialog (existing `Dialog`/`Drawer` primitives), CSS Modules, Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-06-04-household-management-design.md` — read it first. It records what the designer explicitly rejected (status badges other than "Now playing", inline founding composer, white-card drawer styling). Do not reintroduce those.

**Design reference:** The exported prototype lives at `/tmp/design-legacy/simtrack-legacy-redesign/project/households.jsx` (if missing, re-extract: `curl -sL "https://api.anthropic.com/v1/design/h/hsPt8M9XV26y04UE22czmw" -o /tmp/design-legacy.zip && mkdir -p /tmp/design-legacy && tar -xzf /tmp/design-legacy.zip -C /tmp/design-legacy`). Match its visual output; don't copy its internal structure.

---

## Before you start — environment cautions

1. **Work in a worktree on a feature branch** (AGENTS.md requirement for subagent-driven development; never commit to master directly). Use the `superpowers:using-git-worktrees` skill. Copy the gitignored root `.env` into the worktree or e2e auth breaks (`cp /Users/beatka/Projects/simstrack-526/.env <worktree>/.env`, same for `.env.test` if gitignored).
2. **`prisma/seed.ts` has unrelated uncommitted changes in the main checkout** (Not So Berry challenge seeding). A worktree branched from master won't contain them — that's fine. When this branch merges, the seed.ts changes are in different regions of `main()` and should merge cleanly; if not, follow the AGENTS.md 3-way merge procedure.
3. **Validation after every task:** `npx tsc --noEmit` and `npm run lint` must both pass before the task's commit. `npm test` runs against the test DB (`npm run db:test:setup` runs automatically via `pretest` and re-applies migrations + seed).
4. **Conventional commits**; stage specific files only (`git add <file>`), never `git add .`.
5. **No lint/TS suppressions, ever.** Fix the root cause.

## File structure (what gets created/modified)

```
prisma/schema.prisma                      [modify] World, Lot models; Household fields; Legacy.activeHouseholdId
prisma/migrations/<ts>_add_household_management/migration.sql  [create] DDL + active-household backfill
prisma/seed.ts                            [modify] world + lot seeding (appended in main())
src/server/routers/households.ts          [create] create / update / setActive / moveSim / listByLegacy
src/server/routers/households.test.ts     [create] integration tests
src/server/routers/index.ts               [modify] register householdsRouter
src/server/routers/sims.ts                [modify] drop auto-create; optional householdId input
src/server/routers/sims.test.ts           [modify] update household expectations
src/server/routers/legacies.ts            [modify] founder foundHousehold flag
src/server/routers/legacies.test.ts       [modify] foundHousehold cases
src/test/helpers.ts                       [modify] createTestSim unhoused; add createTestHousehold
src/components/ui/icons/house-icon.tsx    [create] lucide house
src/components/ui/icons/plus-icon.tsx     [create] lucide plus
src/components/ui/combobox/combobox.tsx   [modify] add 'inline' + 'ghost' trigger variants
src/components/ui/combobox/combobox.module.css [modify] variant styles
src/components/ui/editable/editable-heading.tsx [create] dashed-green inline-edit heading
src/components/ui/editable/editable-text.tsx    [create] body variant (single/multiline)
src/components/ui/editable/editable-stat.tsx    [create] §-numeric variant
src/components/ui/editable/editable.module.css  [create]
src/components/ui/editable/__tests__/editable.test.tsx [create]
src/components/ui/index.ts                [modify] export new primitives + icons
src/app/app/legacies/[slug]/lib/types.ts  [modify] FetchedHousehold/FetchedSim, HouseholdView, HouseholdSim, WorldOption
src/app/app/legacies/[slug]/_components/households/lib.ts        [create] simoleons, worldOptions, lotOptions
src/app/app/legacies/[slug]/_components/households/__tests__/lib.test.ts [create]
src/app/app/legacies/[slug]/_components/households/households-section.tsx [create] stateful section shell
src/app/app/legacies/[slug]/_components/households/households-section.module.css [create]
src/app/app/legacies/[slug]/_components/households/featured-household.tsx [create]
src/app/app/legacies/[slug]/_components/households/household-card.tsx     [create]
src/app/app/legacies/[slug]/_components/households/households.module.css  [create] card styles
src/app/app/legacies/[slug]/_components/households/__tests__/household-cards.test.tsx [create]
src/app/app/legacies/[slug]/_components/households/found-household-dialog.tsx [create]
src/app/app/legacies/[slug]/_components/households/found-household-dialog.module.css [create]
src/app/app/legacies/[slug]/_components/households/household-drawer.tsx   [create]
src/app/app/legacies/[slug]/_components/households/household-drawer.module.css [create]
src/app/app/legacies/[slug]/_components/households/resident-row.tsx       [create]
src/app/app/legacies/[slug]/_components/households/__tests__/households-section.test.tsx [create]
src/app/app/legacies/[slug]/_components/households/__tests__/found-household-dialog.test.tsx [create]
src/app/app/legacies/[slug]/_components/households/__tests__/household-drawer.test.tsx [create]
src/app/app/legacies/[slug]/page.tsx      [modify] fetch households/worlds/activeHouseholdId; NAV_ITEMS
src/app/app/legacies/[slug]/_components/chronicle-sections/chronicle-sections.tsx [modify] insert section
src/app/components/sim-form.tsx           [modify] household picker + foundHousehold checkbox
src/app/components/sim-form.module.css    [modify] checkbox styles
src/app/components/__tests__/sim-form.test.tsx [modify] picker/checkbox cases
src/app/components/create-sim-modal.tsx   [modify] pass households via listByLegacy
src/app/app/legacies/new/legacy-wizard.tsx [modify] offerFoundHousehold
src/app/app/legacies/[slug]/sims/new/page.tsx [modify] fetch households
src/app/app/legacies/[slug]/sims/new/add-sim-client.tsx [modify] pass households
e2e/households.spec.ts                    [create] the household journey
```

---

### Task 1: Schema — World, Lot, Household fields, active-household pointer

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_household_management/migration.sql` (generated, then edited)

- [ ] **Step 1: Add the World and Lot models**

In `prisma/schema.prisma`, after the `Pack` model's closing brace, add:

```prisma
model World {
  id        String   @id @default(cuid())
  name      String   @unique
  packId    String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  pack       Pack?       @relation(fields: [packId], references: [id])
  lots       Lot[]
  households Household[]

  @@map("worlds")
}

model Lot {
  id      String @id @default(cuid())
  name    String
  worldId String

  world World @relation(fields: [worldId], references: [id], onDelete: Cascade)

  @@unique([worldId, name])
  @@map("lots")
}
```

In the `Pack` model, add to the relations block (after `userPacks UserPack[]`):

```prisma
  worlds            World[]
```

- [ ] **Step 2: Extend Household and Legacy**

Replace the `Household` model with:

```prisma
model Household {
  id                String   @id @default(cuid())
  name              String
  legacyId          String
  worldId           String?
  lot               String?
  description       String?
  funds             Int      @default(0)
  lotValue          Int      @default(0)
  foundedGeneration Int?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  legacy   Legacy  @relation(fields: [legacyId], references: [id], onDelete: Cascade)
  world    World?  @relation(fields: [worldId], references: [id], onDelete: SetNull)
  sims     Sim[]
  activeOf Legacy? @relation("LegacyActiveHousehold")

  @@map("households")
}
```

In the `Legacy` model, add after `founderSimId String?  @unique`:

```prisma
  activeHouseholdId String?  @unique
```

and add to its relations block (after `founderSim`):

```prisma
  activeHousehold Household? @relation("LegacyActiveHousehold", fields: [activeHouseholdId], references: [id], onDelete: SetNull)
```

- [ ] **Step 3: Generate the migration without applying it**

Run: `npm run db:migrate -- --create-only --name add_household_management`
Expected: a new folder `prisma/migrations/<timestamp>_add_household_management/` containing `migration.sql` with `CREATE TABLE "worlds"`, `CREATE TABLE "lots"`, `ALTER TABLE "households" ADD COLUMN ...`, `ALTER TABLE "legacies" ADD COLUMN "activeHouseholdId"`.

- [ ] **Step 4: Append the active-household backfill to the migration**

At the end of the generated `migration.sql`, append:

```sql
-- Backfill: each existing legacy's first household becomes its active household.
UPDATE "legacies" SET "activeHouseholdId" = sub."id"
FROM (
  SELECT DISTINCT ON ("legacyId") "id", "legacyId"
  FROM "households"
  ORDER BY "legacyId", "createdAt" ASC
) AS sub
WHERE "legacies"."id" = sub."legacyId" AND "legacies"."activeHouseholdId" IS NULL;
```

- [ ] **Step 5: Apply the migration and regenerate the client**

Run: `npm run db:migrate`
Expected: "All migrations have been successfully applied" (or "already in sync"); Prisma Client regenerates.

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors. (Two pre-existing call sites construct households — `sims.ts` and `helpers.ts` — they still compile because all new fields are optional/defaulted.)

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): add World/Lot models, household fields, active-household pointer"
```

---

### Task 2: Seed worlds and canonical lots

**Files:**
- Modify: `prisma/seed.ts`
- Create: `src/server/routers/worlds-seed.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/server/routers/worlds-seed.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { db } from '@/server/db'

// The test DB is seeded by `npm run db:test:setup` (pretest hook), so these
// assert the seed itself.
describe('worlds seed', () => {
  it('seeds base-game worlds with no pack', async () => {
    const willowCreek = await db.world.findUnique({
      where: { name: 'Willow Creek' },
      include: { lots: true },
    })
    expect(willowCreek).not.toBeNull()
    expect(willowCreek!.packId).toBeNull()
    expect(willowCreek!.lots.map((l) => l.name)).toContain('1 Goth Hill')
  })

  it('links pack worlds to their pack by code', async () => {
    const windenburg = await db.world.findUnique({
      where: { name: 'Windenburg' },
      include: { pack: true },
    })
    expect(windenburg).not.toBeNull()
    expect(windenburg!.pack?.code).toBe('EP02')
  })

  it('is idempotent — seeded worlds have stable counts', async () => {
    const count = await db.world.count()
    expect(count).toBeGreaterThanOrEqual(20)
  })
})
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npm test -- worlds-seed`
Expected: FAIL — `willowCreek` is null (worlds not yet seeded).

- [ ] **Step 3: Append world seeding to `prisma/seed.ts`**

Inside `main()`, immediately before the final closing logic of the function (after the tracker-types/challenge section — at the end of `main()`'s body), add:

```ts
  // ── Worlds & canonical lots ───────────────────────────────────────────────
  console.log('Seeding worlds and lots...')

  // Pack linkage by pack code; null = base game / free update.
  const worldSeed: Array<{ name: string; packCode: string | null; lots: string[] }> = [
    { name: 'Willow Creek',      packCode: null,   lots: ['165 Sim Lane', '1 Goth Hill', '21 Culpepper House', '3 Forrester Lane', '15 Crawdad Quarter'] },
    { name: 'Oasis Springs',     packCode: null,   lots: ['4 Affluista Way', '21 Crick Cabana', '55 Oak Arbor', '9 Acolyte Lane', '7 Pendula View'] },
    { name: 'Newcrest',          packCode: null,   lots: ['1 Llama Lagoon', '2 Hightower Hollow', '3 Sandtrap Flat'] },
    { name: 'Magnolia Promenade',packCode: 'EP01', lots: [] },
    { name: 'Windenburg',        packCode: 'EP02', lots: ['44 Russett Way', '12 Von Haunt Estate', '8 Crumbling Isle'] },
    { name: 'San Myshuno',       packCode: 'EP03', lots: ['1018 Culpepper Apt', '701 Stella Terrace', '7 Spice Market'] },
    { name: 'Brindleton Bay',    packCode: 'EP04', lots: [] },
    { name: 'Del Sol Valley',    packCode: 'EP06', lots: [] },
    { name: 'Sulani',            packCode: 'EP07', lots: [] },
    { name: 'Britechester',      packCode: 'EP08', lots: [] },
    { name: 'Evergreen Harbor',  packCode: 'EP09', lots: [] },
    { name: 'Mt. Komorebi',      packCode: 'EP10', lots: [] },
    { name: 'Henford-on-Bagley', packCode: 'EP11', lots: [] },
    { name: 'Copperdale',        packCode: 'EP12', lots: [] },
    { name: 'San Sequoia',       packCode: 'EP13', lots: [] },
    { name: 'Chestnut Ridge',    packCode: 'EP14', lots: [] },
    { name: 'Tomarang',          packCode: 'EP15', lots: [] },
    { name: 'Ciudad Enamorada',  packCode: 'EP16', lots: [] },
    { name: 'Ravenwood',         packCode: 'EP17', lots: [] },
    { name: 'Nordhaven',         packCode: 'EP18', lots: [] },
    { name: 'Innisgreen',        packCode: 'EP19', lots: [] },
    { name: 'Forgotten Hollow',  packCode: 'GP04', lots: [] },
    { name: 'StrangerVille',     packCode: 'GP07', lots: [] },
    { name: 'Glimmerbrook',      packCode: 'GP08', lots: [] },
    { name: 'Moonwood Mill',     packCode: 'GP12', lots: [] },
    { name: 'Tartosa',           packCode: 'GP11', lots: [] },
  ]

  for (const w of worldSeed) {
    const packId = w.packCode
      ? (await prisma.pack.findUniqueOrThrow({ where: { code: w.packCode } })).id
      : null
    const world = await prisma.world.upsert({
      where: { name: w.name },
      update: { packId },
      create: { name: w.name, packId },
    })
    for (const lotName of w.lots) {
      await prisma.lot.upsert({
        where: { worldId_name: { worldId: world.id, name: lotName } },
        update: {},
        create: { worldId: world.id, name: lotName },
      })
    }
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- worlds-seed`
Expected: PASS (the `pretest` hook resets + reseeds the test DB, picking up the new seed code).

Also reseed the dev database so the dev server has worlds: `npm run db:seed`
Expected: log lines end with "Seeding worlds and lots..." and exit 0.

- [ ] **Step 5: Validate and commit**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

```bash
git add prisma/seed.ts src/server/routers/worlds-seed.test.ts
git commit -m "feat(db): seed Sims 4 worlds and canonical lots"
```

---

### Task 3: Test helpers — unhoused-by-default sims, household factory

**Files:**
- Modify: `src/test/helpers.ts`

The spec drops auto-created households. `createTestSim` currently auto-creates "Household 1" — that would mask the new behavior in every test.

- [ ] **Step 1: Update `createTestSim` and add `createTestHousehold`**

In `src/test/helpers.ts`, replace the whole `createTestSim` function with:

```ts
export async function createTestSim(
  legacyId: string,
  overrides: {
    firstName?: string
    lastName?: string
    gender?: Gender
    householdId?: string | null
    generationNumber?: number | null
  } = {},
) {
  return db.sim.create({
    data: {
      legacyId,
      householdId: overrides.householdId ?? null,
      generationNumber: overrides.generationNumber ?? null,
      firstName: overrides.firstName ?? 'Test',
      lastName: overrides.lastName ?? 'Sim',
      gender: overrides.gender ?? Gender.FEMALE,
      lifeStage: LifeStage.YOUNG_ADULT,
    },
  })
}

export async function createTestHousehold(
  legacyId: string,
  overrides: { name?: string; funds?: number; worldId?: string | null } = {},
) {
  return db.household.create({
    data: {
      legacyId,
      name: overrides.name ?? 'Test Household',
      funds: overrides.funds ?? 0,
      worldId: overrides.worldId ?? null,
    },
  })
}
```

- [ ] **Step 2: Run the full test suite to find fallout**

Run: `npm test`
Expected: PASS, or failures only in tests that asserted the old auto-household behavior. If any test fails because it relied on `createTestSim` housing the sim, give that test an explicit household: `const h = await createTestHousehold(legacyId)` then `createTestSim(legacyId, { householdId: h.id })`. Do not change what the failing test asserts about its actual subject.

- [ ] **Step 3: Validate and commit**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

```bash
git add src/test/helpers.ts
git commit -m "test: unhoused-by-default createTestSim, add createTestHousehold"
```

(Include any test files you had to adjust in the same commit, listed explicitly.)

---

### Task 4: tRPC `households` router

**Files:**
- Create: `src/server/routers/households.test.ts`
- Create: `src/server/routers/households.ts`
- Modify: `src/server/routers/index.ts`

- [ ] **Step 1: Write the failing integration tests**

Create `src/server/routers/households.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { authedCaller, unauthCaller } from '@/test/caller'
import {
  createTestUser,
  cleanupUser,
  createTestLegacy,
  createTestSim,
  createTestHousehold,
} from '@/test/helpers'
import { db } from '@/server/db'

describe('households router', () => {
  let userId: string
  let legacyId: string

  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
    const legacy = await createTestLegacy(userId)
    legacyId = legacy.id
  })

  afterEach(async () => {
    await cleanupUser(userId)
  })

  describe('create', () => {
    it('creates a household and returns its id', async () => {
      const caller = authedCaller(userId)
      const result = await caller.households.create({
        legacyId,
        name: 'Goth Manor',
        funds: 20000,
        description: 'The founding home.',
      })
      const record = await db.household.findUnique({ where: { id: result.id } })
      expect(record).toMatchObject({
        name: 'Goth Manor',
        funds: 20000,
        description: 'The founding home.',
        legacyId,
      })
    })

    it('becomes the active household when the legacy has none', async () => {
      const caller = authedCaller(userId)
      const first = await caller.households.create({ legacyId, name: 'First', funds: 0 })
      const second = await caller.households.create({ legacyId, name: 'Second', funds: 0 })
      const legacy = await db.legacy.findUnique({ where: { id: legacyId } })
      expect(legacy!.activeHouseholdId).toBe(first.id)
      expect(legacy!.activeHouseholdId).not.toBe(second.id)
    })

    it('snapshots foundedGeneration from the highest sim generation (default 1)', async () => {
      const caller = authedCaller(userId)
      const empty = await caller.households.create({ legacyId, name: 'Empty Era', funds: 0 })
      expect((await db.household.findUnique({ where: { id: empty.id } }))!.foundedGeneration).toBe(1)

      await createTestSim(legacyId, { generationNumber: 3 })
      const later = await caller.households.create({ legacyId, name: 'Later Era', funds: 0 })
      expect((await db.household.findUnique({ where: { id: later.id } }))!.foundedGeneration).toBe(3)
    })

    it('moves chosen sims in, pulling them from their old household', async () => {
      const old = await createTestHousehold(legacyId, { name: 'Old House' })
      const housed = await createTestSim(legacyId, { firstName: 'Dina', householdId: old.id })
      const unhoused = await createTestSim(legacyId, { firstName: 'Nina' })

      const caller = authedCaller(userId)
      const result = await caller.households.create({
        legacyId,
        name: 'New House',
        funds: 0,
        simIds: [housed.id, unhoused.id],
      })

      const sims = await db.sim.findMany({ where: { householdId: result.id } })
      expect(sims.map((s) => s.firstName).sort()).toEqual(['Dina', 'Nina'])
      expect(await db.sim.count({ where: { householdId: old.id } })).toBe(0)
    })

    it('stores world and lot when given', async () => {
      const world = await db.world.findUniqueOrThrow({ where: { name: 'Willow Creek' } })
      const caller = authedCaller(userId)
      const result = await caller.households.create({
        legacyId,
        name: 'Creek House',
        funds: 0,
        worldId: world.id,
        lot: '1 Goth Hill',
      })
      const record = await db.household.findUnique({ where: { id: result.id } })
      expect(record!.worldId).toBe(world.id)
      expect(record!.lot).toBe('1 Goth Hill')
    })

    it('rejects an unknown worldId', async () => {
      const caller = authedCaller(userId)
      await expect(
        caller.households.create({ legacyId, name: 'X', funds: 0, worldId: 'nope' }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    })

    it('rejects sims from another legacy', async () => {
      const otherLegacy = await createTestLegacy(userId, { slug: `other-${Date.now()}` })
      const foreignSim = await createTestSim(otherLegacy.id)
      const caller = authedCaller(userId)
      await expect(
        caller.households.create({ legacyId, name: 'X', funds: 0, simIds: [foreignSim.id] }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    })

    it("throws NOT_FOUND for another user's legacy", async () => {
      const other = await createTestUser()
      try {
        const caller = authedCaller(other.id)
        await expect(
          caller.households.create({ legacyId, name: 'X', funds: 0 }),
        ).rejects.toMatchObject({ code: 'NOT_FOUND' })
      } finally {
        await cleanupUser(other.id)
      }
    })

    it('rejects unauthenticated calls', async () => {
      const caller = unauthCaller()
      await expect(
        caller.households.create({ legacyId, name: 'X', funds: 0 }),
      ).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    })
  })

  describe('update', () => {
    it('updates only the provided fields', async () => {
      const h = await createTestHousehold(legacyId, { name: 'Before', funds: 100 })
      const caller = authedCaller(userId)
      await caller.households.update({ householdId: h.id, name: 'After', lotValue: 50000 })
      const record = await db.household.findUnique({ where: { id: h.id } })
      expect(record).toMatchObject({ name: 'After', funds: 100, lotValue: 50000 })
    })

    it('rejects negative funds', async () => {
      const h = await createTestHousehold(legacyId)
      const caller = authedCaller(userId)
      await expect(
        caller.households.update({ householdId: h.id, funds: -1 }),
      ).rejects.toThrow()
    })

    it("throws NOT_FOUND for another user's household", async () => {
      const h = await createTestHousehold(legacyId)
      const other = await createTestUser()
      try {
        await expect(
          authedCaller(other.id).households.update({ householdId: h.id, name: 'Stolen' }),
        ).rejects.toMatchObject({ code: 'NOT_FOUND' })
      } finally {
        await cleanupUser(other.id)
      }
    })
  })

  describe('setActive', () => {
    it('swaps the active household pointer', async () => {
      const a = await createTestHousehold(legacyId, { name: 'A' })
      const b = await createTestHousehold(legacyId, { name: 'B' })
      const caller = authedCaller(userId)
      await caller.households.setActive({ householdId: a.id })
      expect((await db.legacy.findUnique({ where: { id: legacyId } }))!.activeHouseholdId).toBe(a.id)
      await caller.households.setActive({ householdId: b.id })
      expect((await db.legacy.findUnique({ where: { id: legacyId } }))!.activeHouseholdId).toBe(b.id)
    })
  })

  describe('moveSim', () => {
    it('moves a sim between households', async () => {
      const from = await createTestHousehold(legacyId, { name: 'From' })
      const to = await createTestHousehold(legacyId, { name: 'To' })
      const sim = await createTestSim(legacyId, { householdId: from.id })
      const caller = authedCaller(userId)
      await caller.households.moveSim({ simId: sim.id, toHouseholdId: to.id })
      expect((await db.sim.findUnique({ where: { id: sim.id } }))!.householdId).toBe(to.id)
    })

    it('moves a sim out to unhoused with null', async () => {
      const from = await createTestHousehold(legacyId)
      const sim = await createTestSim(legacyId, { householdId: from.id })
      const caller = authedCaller(userId)
      await caller.households.moveSim({ simId: sim.id, toHouseholdId: null })
      expect((await db.sim.findUnique({ where: { id: sim.id } }))!.householdId).toBeNull()
    })

    it('rejects a target household from a different legacy', async () => {
      const otherLegacy = await createTestLegacy(userId, { slug: `other-${Date.now()}` })
      const foreignHousehold = await createTestHousehold(otherLegacy.id)
      const sim = await createTestSim(legacyId)
      const caller = authedCaller(userId)
      await expect(
        caller.households.moveSim({ simId: sim.id, toHouseholdId: foreignHousehold.id }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    })

    it("throws NOT_FOUND for another user's sim", async () => {
      const sim = await createTestSim(legacyId)
      const other = await createTestUser()
      try {
        await expect(
          authedCaller(other.id).households.moveSim({ simId: sim.id, toHouseholdId: null }),
        ).rejects.toMatchObject({ code: 'NOT_FOUND' })
      } finally {
        await cleanupUser(other.id)
      }
    })
  })

  describe('listByLegacy', () => {
    it('lists the legacy households as id + name', async () => {
      await createTestHousehold(legacyId, { name: 'Alpha' })
      await createTestHousehold(legacyId, { name: 'Beta' })
      const caller = authedCaller(userId)
      const result = await caller.households.listByLegacy({ legacyId })
      expect(result.map((h) => h.name)).toEqual(['Alpha', 'Beta'])
      expect(Object.keys(result[0]).sort()).toEqual(['id', 'name'])
    })

    it("throws NOT_FOUND for another user's legacy", async () => {
      const other = await createTestUser()
      try {
        await expect(
          authedCaller(other.id).households.listByLegacy({ legacyId }),
        ).rejects.toMatchObject({ code: 'NOT_FOUND' })
      } finally {
        await cleanupUser(other.id)
      }
    })
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test -- households.test`
Expected: FAIL — `households` does not exist on the router.

- [ ] **Step 3: Implement the router**

Create `src/server/routers/households.ts`:

```ts
import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import type { PrismaClient } from '@prisma/client'
import { router, protectedProcedure } from '../trpc'

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

/** Throw unless the world exists. The select filters by owned packs as a UX
 *  concern; the server only requires that the world is real. */
async function assertWorldExists(db: PrismaClient, worldId: string) {
  const world = await db.world.findUnique({ where: { id: worldId }, select: { id: true } })
  if (!world) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Unknown world' })
}

export const householdsRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        legacyId: z.string(),
        name: z.string().trim().min(1).max(100),
        worldId: z.string().optional(),
        lot: z.string().max(120).optional(),
        funds: z.number().int().min(0).default(0),
        description: z.string().max(1000).optional(),
        simIds: z.array(z.string()).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const simIds = [...new Set(input.simIds)]
      const legacy = await assertOwnedLegacy(ctx.db, input.legacyId, userId)
      if (input.worldId) await assertWorldExists(ctx.db, input.worldId)
      if (simIds.length > 0) {
        const count = await ctx.db.sim.count({
          where: { id: { in: simIds }, legacyId: input.legacyId },
        })
        if (count !== simIds.length) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'All sims must belong to this legacy' })
        }
      }

      const maxGen = await ctx.db.sim.aggregate({
        where: { legacyId: input.legacyId },
        _max: { generationNumber: true },
      })
      const foundedGeneration = maxGen._max.generationNumber ?? 1

      return ctx.db.$transaction(async (tx) => {
        const household = await tx.household.create({
          data: {
            legacyId: input.legacyId,
            name: input.name,
            worldId: input.worldId ?? null,
            lot: input.lot ?? null,
            funds: input.funds,
            description: input.description ?? null,
            foundedGeneration,
          },
        })
        if (simIds.length > 0) {
          await tx.sim.updateMany({
            where: { id: { in: simIds } },
            data: { householdId: household.id },
          })
        }
        if (!legacy.activeHouseholdId) {
          await tx.legacy.update({
            where: { id: input.legacyId },
            data: { activeHouseholdId: household.id },
          })
        }
        return { id: household.id }
      })
    }),

  update: protectedProcedure
    .input(
      z.object({
        householdId: z.string(),
        name: z.string().trim().min(1).max(100).optional(),
        worldId: z.string().nullable().optional(),
        lot: z.string().max(120).nullable().optional(),
        description: z.string().max(1000).nullable().optional(),
        funds: z.number().int().min(0).optional(),
        lotValue: z.number().int().min(0).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const { householdId, ...fields } = input
      await findOwnedHousehold(ctx.db, householdId, userId)
      if (fields.worldId) await assertWorldExists(ctx.db, fields.worldId)
      return ctx.db.household.update({ where: { id: householdId }, data: fields })
    }),

  setActive: protectedProcedure
    .input(z.object({ householdId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const household = await findOwnedHousehold(ctx.db, input.householdId, userId)
      await ctx.db.legacy.update({
        where: { id: household.legacyId },
        data: { activeHouseholdId: household.id },
      })
      return { id: household.id }
    }),

  moveSim: protectedProcedure
    .input(z.object({ simId: z.string(), toHouseholdId: z.string().nullable() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const sim = await ctx.db.sim.findFirst({
        where: { id: input.simId, legacy: { userId } },
        select: { id: true, legacyId: true, householdId: true },
      })
      if (!sim) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sim not found' })

      if (input.toHouseholdId) {
        const target = await ctx.db.household.findFirst({
          where: { id: input.toHouseholdId, legacyId: sim.legacyId },
          select: { id: true },
        })
        if (!target) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Household must belong to the same legacy' })
        }
      }

      // Moving to the current household is a no-op, not an error.
      if (sim.householdId === input.toHouseholdId) return { id: sim.id }

      await ctx.db.sim.update({
        where: { id: sim.id },
        data: { householdId: input.toHouseholdId },
      })
      return { id: sim.id }
    }),

  listByLegacy: protectedProcedure
    .input(z.object({ legacyId: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      await assertOwnedLegacy(ctx.db, input.legacyId, userId)
      return ctx.db.household.findMany({
        where: { legacyId: input.legacyId },
        select: { id: true, name: true },
        orderBy: { createdAt: 'asc' },
      })
    }),
})
```

- [ ] **Step 4: Register the router**

In `src/server/routers/index.ts`, add the import and entry:

```ts
import { householdsRouter } from './households'
```

and inside `router({ ... })`, after `milestones: milestonesRouter,`:

```ts
  households: householdsRouter,
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- households.test`
Expected: PASS (all describe blocks).

- [ ] **Step 6: Validate and commit**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

```bash
git add src/server/routers/households.ts src/server/routers/households.test.ts src/server/routers/index.ts
git commit -m "feat(api): households router — create, update, setActive, moveSim, listByLegacy"
```

---

### Task 5: `sims.create` — optional householdId, no auto-create

**Files:**
- Modify: `src/server/routers/sims.test.ts`
- Modify: `src/server/routers/sims.ts`

- [ ] **Step 1: Write/adjust the failing tests**

In `src/server/routers/sims.test.ts`, inside `describe('sims.create')`, add (import `createTestHousehold` from `@/test/helpers` at the top):

```ts
  it('creates the sim unhoused when no householdId is given', async () => {
    const caller = authedCaller(userId)
    const result = await caller.sims.create({
      legacyId,
      firstName: 'Free',
      lastName: 'Spirit',
      gender: Gender.FEMALE,
    })
    const record = await db.sim.findUnique({ where: { id: result.id } })
    expect(record!.householdId).toBeNull()
    expect(await db.household.count({ where: { legacyId } })).toBe(0)
  })

  it('assigns the sim to the given household', async () => {
    const household = await createTestHousehold(legacyId)
    const caller = authedCaller(userId)
    const result = await caller.sims.create({
      legacyId,
      firstName: 'Housed',
      lastName: 'Sim',
      gender: Gender.MALE,
      householdId: household.id,
    })
    expect((await db.sim.findUnique({ where: { id: result.id } }))!.householdId).toBe(household.id)
  })

  it("rejects a householdId from another legacy", async () => {
    const otherLegacy = await createTestLegacy(userId, { slug: `other-${Date.now()}` })
    const foreignHousehold = await createTestHousehold(otherLegacy.id)
    const caller = authedCaller(userId)
    await expect(
      caller.sims.create({
        legacyId,
        firstName: 'X',
        lastName: 'Y',
        gender: Gender.MALE,
        householdId: foreignHousehold.id,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })
```

If existing tests in this file assert the old auto-created "Household 1", update them to expect `householdId: null` instead — the behavior they were really testing (sim creation) is unchanged.

- [ ] **Step 2: Run to verify the new tests fail**

Run: `npm test -- sims.test`
Expected: the three new tests FAIL (auto-create still happens / householdId not accepted).

- [ ] **Step 3: Implement**

In `src/server/routers/sims.ts`:

1. Add to the `create` input object (after `parentIds`):

```ts
        householdId: z.string().optional(),
```

2. Replace the auto-create block (lines 44–49, the `let household = await ctx.db.household.findFirst...` block) with:

```ts
      if (input.householdId) {
        const household = await ctx.db.household.findFirst({
          where: { id: input.householdId, legacyId: input.legacyId },
          select: { id: true },
        })
        if (!household) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Household must belong to this legacy' })
        }
      }
```

3. In the destructure line, also pull out `householdId`:

```ts
      const { legacyId: _legacyId, personalityTraitIds, aspirationId, careerId, parentIds: _parentIds, generationNumber: _gen, householdId, ...simFields } = input
```

4. In the `ctx.db.sim.create` data, replace `householdId: household.id,` with:

```ts
          householdId: householdId ?? null,
```

- [ ] **Step 4: Run the tests**

Run: `npm test -- sims.test`
Expected: PASS.

- [ ] **Step 5: Validate and commit**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

```bash
git add src/server/routers/sims.ts src/server/routers/sims.test.ts
git commit -m "feat(api): sims.create takes optional householdId, drops auto-created household"
```

---

### Task 6: `legacies.create` — founder `foundHousehold` flag

**Files:**
- Modify: `src/server/routers/legacies.test.ts`
- Modify: `src/server/routers/legacies.ts`

- [ ] **Step 1: Write the failing tests**

In `src/server/routers/legacies.test.ts`, inside the create describe block (match the file's existing setup helpers), add:

```ts
  it('founds "The <LastName> Household" when foundHousehold is set', async () => {
    const caller = authedCaller(userId)
    const result = await caller.legacies.create({
      name: `Founder House Test ${Date.now()}`,
      founder: {
        firstName: 'Dina',
        lastName: 'Caliente',
        gender: Gender.FEMALE,
        foundHousehold: true,
      },
    })
    const legacy = await db.legacy.findUnique({
      where: { id: result.legacy.id },
      include: { households: true, sims: true },
    })
    expect(legacy!.households).toHaveLength(1)
    expect(legacy!.households[0].name).toBe('The Caliente Household')
    expect(legacy!.households[0].foundedGeneration).toBe(1)
    expect(legacy!.activeHouseholdId).toBe(legacy!.households[0].id)
    expect(legacy!.sims[0].householdId).toBe(legacy!.households[0].id)
  })

  it('leaves the founder unhoused when foundHousehold is not set', async () => {
    const caller = authedCaller(userId)
    const result = await caller.legacies.create({
      name: `Unhoused Founder Test ${Date.now()}`,
      founder: { firstName: 'Nina', lastName: 'Caliente', gender: Gender.FEMALE },
    })
    const legacy = await db.legacy.findUnique({
      where: { id: result.legacy.id },
      include: { households: true, sims: true },
    })
    expect(legacy!.households).toHaveLength(0)
    expect(legacy!.sims[0].householdId).toBeNull()
    expect(legacy!.activeHouseholdId).toBeNull()
  })
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm test -- legacies.test`
Expected: the first new test FAILS (`foundHousehold` not an accepted input).

- [ ] **Step 3: Implement**

In `src/server/routers/legacies.ts`:

1. Add to `founderInput` (after `occultType`):

```ts
  foundHousehold: z.boolean().optional(),
```

2. In the mutation, change the founder destructure to also pull the flag out of `simFields` (it must not reach `tx.sim.create`):

```ts
          const { personalityTraitIds, aspirationId, careerId, foundHousehold, ...simFields } = input.founder
```

3. After `await tx.legacy.update({ where: { id: legacy.id }, data: { founderSimId: sim.id } })`, add:

```ts
          if (foundHousehold) {
            const household = await tx.household.create({
              data: {
                legacyId: legacy.id,
                name: `The ${simFields.lastName} Household`,
                foundedGeneration: 1,
              },
            })
            await tx.sim.update({ where: { id: sim.id }, data: { householdId: household.id } })
            await tx.legacy.update({
              where: { id: legacy.id },
              data: { activeHouseholdId: household.id },
            })
          }
```

- [ ] **Step 4: Run the tests**

Run: `npm test -- legacies.test`
Expected: PASS.

- [ ] **Step 5: Validate and commit**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

```bash
git add src/server/routers/legacies.ts src/server/routers/legacies.test.ts
git commit -m "feat(api): legacies.create founder can found their first household"
```

---

### Task 7: Icons and Combobox trigger variants

**Files:**
- Create: `src/components/ui/icons/house-icon.tsx`
- Create: `src/components/ui/icons/plus-icon.tsx`
- Modify: `src/components/ui/combobox/combobox.tsx`
- Modify: `src/components/ui/combobox/combobox.module.css`
- Modify: `src/components/ui/index.ts`

- [ ] **Step 1: Create the icons** (lucide paths verbatim — house, plus; same shape as `users-icon.tsx`)

`src/components/ui/icons/house-icon.tsx`:

```tsx
import type { IconProps } from './icon-props'

export function HouseIcon({ size = 24, className, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
      <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  )
}
```

`src/components/ui/icons/plus-icon.tsx`:

```tsx
import type { IconProps } from './icon-props'

export function PlusIcon({ size = 24, className, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  )
}
```

- [ ] **Step 2: Add `inline` and `ghost` Combobox variants**

In `src/components/ui/combobox/combobox.tsx`:

1. Change the variant type in `ComboboxProps`:

```ts
  variant?: 'default' | 'chip' | 'inline' | 'ghost'
```

2. Replace the `triggerClass` computation with:

```ts
  const variantClass =
    variant === 'chip' ? styles.chip
    : variant === 'inline' ? styles.inline
    : variant === 'ghost' ? styles.ghost
    : size !== 'base' ? styles[size] : ''
  const triggerClass = [styles.trigger, variantClass, error ? styles.error : '']
    .filter(Boolean)
    .join(' ')
```

3. In `src/components/ui/combobox/combobox.module.css`, append (matching the prototype's inline dashed-underline select and ghost dashed add-row; the existing `.chip` class shows the conventions used in this file — mirror its token usage):

```css
/* Inline variant — reads as plain text with a dashed-green underline on
   hover/open (the DS "dashed = editable" affordance). Used for the drawer's
   world · lot line. */
.inline {
  background: transparent;
  border: none;
  border-bottom: 1.5px dashed transparent;
  border-radius: 0;
  padding: 0 0 1px;
  width: auto;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-muted);
  transition: border-color var(--transition-fast), color var(--transition-fast);
}

.inline:hover,
.inline[aria-expanded='true'] {
  border-bottom-color: var(--green);
  color: var(--green);
}

/* Ghost variant — full-width dashed add-row ("+ Move a sim in"). */
.ghost {
  width: 100%;
  justify-content: center;
  gap: 8px;
  padding: 10px 14px;
  background: transparent;
  border: 1.5px dashed var(--border-bright);
  border-radius: var(--radius-base);
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-muted);
  transition: border-color var(--transition-fast), color var(--transition-fast), background var(--transition-fast);
}

.ghost:hover,
.ghost[aria-expanded='true'] {
  border-color: var(--green);
  color: var(--green);
  background: var(--bg-card);
}
```

(If `.trigger` sets properties these must override — e.g. `width`, `border`, `background` — the appended classes win on specificity ties because they come later in the file. Verify visually in Task 14's run-through.)

- [ ] **Step 3: Export the icons**

In `src/components/ui/index.ts`, after the `UserPlusIcon` export line, add:

```ts
export { HouseIcon } from './icons/house-icon'
export { PlusIcon } from './icons/plus-icon'
```

- [ ] **Step 4: Validate and commit**

Run: `npx tsc --noEmit && npm run lint && npm test -- combobox`
Expected: clean; any existing combobox tests still pass.

```bash
git add src/components/ui/icons/house-icon.tsx src/components/ui/icons/plus-icon.tsx src/components/ui/combobox/combobox.tsx src/components/ui/combobox/combobox.module.css src/components/ui/index.ts
git commit -m "feat(ui): house/plus icons, combobox inline and ghost variants"
```

---

### Task 8: Editable inline-edit primitives

**Files:**
- Create: `src/components/ui/editable/editable.module.css`
- Create: `src/components/ui/editable/editable-heading.tsx`
- Create: `src/components/ui/editable/editable-text.tsx`
- Create: `src/components/ui/editable/editable-stat.tsx`
- Create: `src/components/ui/editable/__tests__/editable.test.tsx`
- Modify: `src/components/ui/index.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/components/ui/editable/__tests__/editable.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EditableHeading } from '../editable-heading'
import { EditableText } from '../editable-text'
import { EditableStat } from '../editable-stat'

describe('EditableHeading', () => {
  it('commits a changed value on Enter', async () => {
    const user = userEvent.setup()
    const onCommit = vi.fn()
    render(<EditableHeading value="Goth Manor" onCommit={onCommit} aria-label="Household name" />)

    await user.click(screen.getByRole('button', { name: 'Goth Manor' }))
    const input = screen.getByRole('textbox', { name: 'Household name' })
    await user.clear(input)
    await user.type(input, 'Caliente Villa{Enter}')

    expect(onCommit).toHaveBeenCalledWith('Caliente Villa')
  })

  it('does not commit an empty or unchanged value', async () => {
    const user = userEvent.setup()
    const onCommit = vi.fn()
    render(<EditableHeading value="Goth Manor" onCommit={onCommit} aria-label="Household name" />)

    await user.click(screen.getByRole('button', { name: 'Goth Manor' }))
    await user.clear(screen.getByRole('textbox', { name: 'Household name' }))
    await user.keyboard('{Enter}')
    expect(onCommit).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Goth Manor' }))
    await user.keyboard('{Enter}') // unchanged
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('cancels on Escape', async () => {
    const user = userEvent.setup()
    const onCommit = vi.fn()
    render(<EditableHeading value="Goth Manor" onCommit={onCommit} aria-label="Household name" />)

    await user.click(screen.getByRole('button', { name: 'Goth Manor' }))
    await user.type(screen.getByRole('textbox', { name: 'Household name' }), 'X{Escape}')

    expect(onCommit).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Goth Manor' })).toBeInTheDocument()
  })

  it('starts in edit mode with autoEdit', () => {
    render(<EditableHeading value="New household" onCommit={vi.fn()} autoEdit aria-label="Household name" />)
    expect(screen.getByRole('textbox', { name: 'Household name' })).toBeInTheDocument()
  })
})

describe('EditableText', () => {
  it('shows the placeholder when empty and commits typed text on blur', async () => {
    const user = userEvent.setup()
    const onCommit = vi.fn()
    render(
      <EditableText value="" onCommit={onCommit} placeholder="Add a note…" aria-label="Description" />,
    )

    await user.click(screen.getByRole('button', { name: 'Add a note…' }))
    await user.type(screen.getByRole('textbox', { name: 'Description' }), 'The founding home.')
    await user.tab() // blur commits

    expect(onCommit).toHaveBeenCalledWith('The founding home.')
  })
})

describe('EditableStat', () => {
  it('renders simoleons and commits the parsed integer', async () => {
    const user = userEvent.setup()
    const onCommit = vi.fn()
    render(<EditableStat value={20000} label="Funds" onCommit={onCommit} />)

    expect(screen.getByText('§20,000')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Funds/i }))
    const input = screen.getByRole('textbox', { name: /Funds/i })
    await user.clear(input)
    await user.type(input, '35500{Enter}')

    expect(onCommit).toHaveBeenCalledWith(35500)
  })

  it('reverts on invalid input instead of committing', async () => {
    const user = userEvent.setup()
    const onCommit = vi.fn()
    render(<EditableStat value={100} label="Funds" onCommit={onCommit} />)

    await user.click(screen.getByRole('button', { name: /Funds/i }))
    await user.clear(screen.getByRole('textbox', { name: /Funds/i }))
    await user.keyboard('{Enter}')

    expect(onCommit).not.toHaveBeenCalled()
    expect(screen.getByText('§100')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm test -- editable`
Expected: FAIL — modules don't exist.

- [ ] **Step 3: Create the CSS module**

Create `src/components/ui/editable/editable.module.css`:

```css
/* The DS "dashed = editable" affordance: static text, dashed green underline
   on hover, input swap on click. No pencils. */

.displayButton {
  font: inherit;
  color: inherit;
  background: none;
  border: none;
  padding: 0 0 2px;
  cursor: text;
  display: inline-block;
  max-width: 100%;
  border-bottom: 2px dashed transparent;
  transition: border-color var(--transition-fast);
}

.displayButton:hover,
.displayButton:focus-visible {
  border-bottom-color: var(--green);
  outline: none;
}

.heading {
  font-family: var(--font-display);
  font-size: 26px;
  font-weight: 600;
  color: var(--text);
  line-height: 1.05;
  letter-spacing: -0.01em;
  margin: 0;
}

.headingInput {
  display: inline-block;
  max-width: 100%;
  min-width: 8ch;
  field-sizing: content;
  background: transparent;
  border: none;
  border-bottom: 2px solid var(--green);
  outline: none;
  padding: 0 0 2px;
}

.body {
  font-family: var(--font-body);
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-muted);
}

.bodyEmpty {
  color: var(--text-subtle);
  font-style: italic;
}

.bodyEmpty .displayButton {
  border-bottom: 1.5px dashed var(--border-bright);
}

.bodyEmpty .displayButton:hover,
.bodyEmpty .displayButton:focus-visible {
  border-bottom-color: var(--green);
}

.bodyInput {
  width: 100%;
  box-sizing: border-box;
  display: block;
  background: transparent;
  border: none;
  border-bottom: 2px solid var(--green);
  outline: none;
  padding: 0 0 3px;
  resize: none;
  margin: 0;
  font: inherit;
  color: inherit;
}

.bodyTextarea {
  field-sizing: content;
  min-height: 3em;
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 3px;
  align-items: center;
  min-width: 0;
  max-width: 100%;
}

/* Fixed-height number row so the display↔input swap never reflows. */
.statValueRow {
  height: 24px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  max-width: 100%;
}

.statValue {
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 600;
  line-height: 1;
  color: var(--text);
  white-space: nowrap;
}

.statValueGreen {
  color: var(--green);
}

.statInputWrap {
  display: inline-flex;
  align-items: flex-end;
  max-width: 100%;
  border-bottom: 2px solid var(--green);
}

.statPrefix {
  opacity: 0.6;
}

.statInput {
  line-height: 1;
  min-width: 0;
  background: transparent;
  border: none;
  outline: none;
  padding: 0;
  font: inherit;
  color: inherit;
}

.statLabel {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-subtle);
}
```

- [ ] **Step 4: Create `EditableHeading`**

Create `src/components/ui/editable/editable-heading.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import styles from './editable.module.css'

export interface EditableHeadingProps {
  value: string
  onCommit: (value: string) => void
  /** Open directly in edit mode (e.g. right after founding a household). */
  autoEdit?: boolean
  'aria-label': string
  className?: string
}

/** Serif display heading with the dashed-green click-to-edit affordance.
 *  Commits trimmed, non-empty, changed values on blur/Enter; Esc cancels. */
export function EditableHeading({
  value,
  onCommit,
  autoEdit = false,
  'aria-label': ariaLabel,
  className,
}: EditableHeadingProps) {
  const [editing, setEditing] = useState(autoEdit)
  const [draft, setDraft] = useState(value)

  useEffect(() => {
    setDraft(value)
  }, [value])

  function commit() {
    const v = draft.trim()
    if (v && v !== value) onCommit(v)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        className={cn(styles.heading, styles.headingInput, className)}
        value={draft}
        autoFocus
        aria-label={ariaLabel}
        onFocus={(e) => e.target.select()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') {
            setDraft(value)
            setEditing(false)
          }
        }}
      />
    )
  }

  return (
    <h2 className={cn(styles.heading, className)}>
      <button
        type="button"
        className={styles.displayButton}
        title="Click to rename"
        onClick={() => {
          setDraft(value)
          setEditing(true)
        }}
      >
        {value}
      </button>
    </h2>
  )
}
```

- [ ] **Step 5: Create `EditableText`**

Create `src/components/ui/editable/editable-text.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import styles from './editable.module.css'

export interface EditableTextProps {
  value: string
  onCommit: (value: string) => void
  multiline?: boolean
  placeholder?: string
  'aria-label': string
  className?: string
}

/** Body-text inline edit. Single-line commits on Enter; multiline commits on
 *  Enter (Shift+Enter inserts a newline). Blur commits; Esc cancels. Empty
 *  values ARE committed (clearing a description is a real edit); shows an
 *  italic placeholder when empty. */
export function EditableText({
  value,
  onCommit,
  multiline = false,
  placeholder = 'Add a note…',
  'aria-label': ariaLabel,
  className,
}: EditableTextProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  useEffect(() => {
    setDraft(value)
  }, [value])

  function commit() {
    const v = draft.trim()
    if (v !== value) onCommit(v)
    setEditing(false)
  }

  if (editing) {
    const shared = {
      value: draft,
      autoFocus: true,
      'aria-label': ariaLabel,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setDraft(e.target.value),
      onBlur: commit,
    }
    if (multiline) {
      return (
        <textarea
          {...shared}
          rows={1}
          className={cn(styles.body, styles.bodyInput, styles.bodyTextarea, className)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              commit()
            }
            if (e.key === 'Escape') {
              setDraft(value)
              setEditing(false)
            }
          }}
        />
      )
    }
    return (
      <input
        {...shared}
        className={cn(styles.body, styles.bodyInput, className)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') {
            setDraft(value)
            setEditing(false)
          }
        }}
      />
    )
  }

  const empty = value.trim().length === 0
  return (
    <span className={cn(styles.body, empty && styles.bodyEmpty, className)}>
      <button
        type="button"
        className={styles.displayButton}
        title="Click to edit"
        onClick={() => {
          setDraft(value)
          setEditing(true)
        }}
      >
        {empty ? placeholder : value}
      </button>
    </span>
  )
}
```

- [ ] **Step 6: Create `EditableStat`**

Create `src/components/ui/editable/editable-stat.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import styles from './editable.module.css'

export interface EditableStatProps {
  value: number
  label: string
  onCommit: (value: number) => void
  /** Green numeral (funds). */
  green?: boolean
  className?: string
}

/** §-prefixed serif numeral with the dashed-edit affordance; numeric input on
 *  click. Strips non-digits; empty/invalid reverts without committing. */
export function EditableStat({ value, label, onCommit, green = false, className }: EditableStatProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value))

  useEffect(() => {
    setDraft(String(value))
  }, [value])

  function commit() {
    const n = parseInt(draft.replace(/[^0-9]/g, ''), 10)
    if (!Number.isNaN(n) && n !== value) onCommit(n)
    setEditing(false)
  }

  const valueClass = cn(styles.statValue, green && styles.statValueGreen)

  return (
    <div className={cn(styles.stat, className)}>
      <div className={styles.statValueRow}>
        {editing ? (
          <span className={cn(valueClass, styles.statInputWrap)}>
            <span className={styles.statPrefix}>§</span>
            <input
              className={styles.statInput}
              value={draft}
              autoFocus
              inputMode="numeric"
              aria-label={label}
              style={{ width: `${Math.min(8, Math.max(3, draft.replace(/[^0-9]/g, '').length))}ch` }}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ''))}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit()
                if (e.key === 'Escape') {
                  setDraft(String(value))
                  setEditing(false)
                }
              }}
            />
          </span>
        ) : (
          <span className={valueClass}>
            <button
              type="button"
              className={styles.displayButton}
              aria-label={`Edit ${label}`}
              title="Click to edit"
              onClick={() => {
                setDraft(String(value))
                setEditing(true)
              }}
            >
              {'§' + value.toLocaleString('en-US')}
            </button>
          </span>
        )}
      </div>
      <span className={styles.statLabel}>{label}</span>
    </div>
  )
}
```

- [ ] **Step 7: Export from the UI barrel**

In `src/components/ui/index.ts`, append:

```ts
export { EditableHeading } from './editable/editable-heading'
export type { EditableHeadingProps } from './editable/editable-heading'
export { EditableText } from './editable/editable-text'
export type { EditableTextProps } from './editable/editable-text'
export { EditableStat } from './editable/editable-stat'
export type { EditableStatProps } from './editable/editable-stat'
```

- [ ] **Step 8: Run the tests**

Run: `npm test -- editable`
Expected: PASS. (Note: the EditableText test expects empty commits — re-read the test: it types into an empty field and commits non-empty; fine. EditableHeading never commits empty; EditableText commits any *changed* trim, including empty — clearing a description is meaningful.)

- [ ] **Step 9: Validate and commit**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

```bash
git add src/components/ui/editable src/components/ui/index.ts
git commit -m "feat(ui): EditableHeading/EditableText/EditableStat inline-edit primitives"
```

---

### Task 9: View types and households lib helpers

**Files:**
- Modify: `src/app/app/legacies/[slug]/lib/types.ts`
- Create: `src/app/app/legacies/[slug]/_components/households/lib.ts`
- Create: `src/app/app/legacies/[slug]/_components/households/__tests__/lib.test.ts`

- [ ] **Step 1: Extend the types**

In `src/app/app/legacies/[slug]/lib/types.ts`:

1. Add `householdId` to `FetchedSim` (after `causeOfDeath`):

```ts
  householdId: string | null
```

2. Replace the `FetchedHousehold` interface with:

```ts
/** Household row fetched from Prisma (world name joined in). */
export interface FetchedHousehold {
  id: string
  name: string
  worldId: string | null
  lot: string | null
  description: string | null
  funds: number
  lotValue: number
  foundedGeneration: number | null
  world: { name: string } | null
}
```

3. Append the new view types at the end of the file:

```ts
/** A sim as the households section sees them (resident rows + pickers). */
export interface HouseholdSim {
  id: string
  firstName: string
  lastName: string
  imageUrl: string | null
  isHeir: boolean
  isFounder: boolean
  generationNumber: number | null
  lifeStage: LifeStage
  householdId: string | null
}

/** A household with its residents resolved, ready to render. */
export interface HouseholdView {
  id: string
  name: string
  worldId: string | null
  worldName: string | null
  lot: string | null
  description: string | null
  funds: number
  lotValue: number
  foundedGeneration: number | null
  isActive: boolean
  residents: HouseholdSim[]
}

/** A world option for the world/lot selects (already pack-filtered). */
export interface WorldOption {
  id: string
  name: string
  lots: string[]
}
```

- [ ] **Step 2: Write the failing helper tests**

Create `src/app/app/legacies/[slug]/_components/households/__tests__/lib.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { simoleons, worldOptions, lotOptions } from '../lib'
import type { WorldOption } from '../../../lib/types'

const WORLDS: WorldOption[] = [
  { id: 'w1', name: 'Willow Creek', lots: ['1 Goth Hill', '165 Sim Lane'] },
  { id: 'w2', name: 'Oasis Springs', lots: ['4 Affluista Way'] },
]

describe('simoleons', () => {
  it('formats with the § sign and thousands separators', () => {
    expect(simoleons(184250)).toBe('§184,250')
    expect(simoleons(0)).toBe('§0')
  })
})

describe('worldOptions', () => {
  it('returns the filtered list as-is when the current world is included', () => {
    expect(worldOptions(WORLDS, { worldId: 'w1', worldName: 'Willow Creek' })).toEqual(WORLDS)
  })

  it('prepends the current world when the pack filter excluded it', () => {
    const result = worldOptions(WORLDS, { worldId: 'w9', worldName: 'Ravenwood' })
    expect(result[0]).toEqual({ id: 'w9', name: 'Ravenwood', lots: [] })
    expect(result).toHaveLength(3)
  })

  it('handles no current world', () => {
    expect(worldOptions(WORLDS, { worldId: null, worldName: null })).toEqual(WORLDS)
  })
})

describe('lotOptions', () => {
  it('returns the world lots, preserving a custom current lot at the front', () => {
    expect(lotOptions(WORLDS[0], '7 Custom Way')).toEqual([
      '7 Custom Way',
      '1 Goth Hill',
      '165 Sim Lane',
    ])
  })

  it('does not duplicate a canonical current lot', () => {
    expect(lotOptions(WORLDS[0], '1 Goth Hill')).toEqual(['1 Goth Hill', '165 Sim Lane'])
  })

  it('handles a missing world', () => {
    expect(lotOptions(undefined, '7 Custom Way')).toEqual(['7 Custom Way'])
  })
})
```

- [ ] **Step 3: Run to verify failure**

Run: `npm test -- households/__tests__/lib`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement the helpers**

Create `src/app/app/legacies/[slug]/_components/households/lib.ts`:

```ts
import type { WorldOption } from '../../lib/types'

/** Simoleon currency formatting: §184,250. */
export function simoleons(n: number): string {
  return '§' + n.toLocaleString('en-US')
}

/**
 * World options for a household's world select. The list is already filtered
 * to owned packs server-side; the household's CURRENT world is merged back in
 * so existing data never disappears from the select (preserve-current rule).
 */
export function worldOptions(
  worlds: WorldOption[],
  current: { worldId: string | null; worldName: string | null },
): WorldOption[] {
  if (!current.worldId || !current.worldName) return worlds
  if (worlds.some((w) => w.id === current.worldId)) return worlds
  return [{ id: current.worldId, name: current.worldName, lots: [] }, ...worlds]
}

/**
 * Lot options for the selected world, with the household's current (possibly
 * custom) lot always offered first.
 */
export function lotOptions(world: WorldOption | undefined, currentLot: string | null): string[] {
  const lots = world?.lots ?? []
  if (currentLot && !lots.includes(currentLot)) return [currentLot, ...lots]
  return lots
}
```

- [ ] **Step 5: Run the tests**

Run: `npm test -- households/__tests__/lib`
Expected: PASS.

- [ ] **Step 6: Validate and commit**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean, with two foreseeable exceptions to fix here:
- `FetchedHousehold` changed shape — `page.tsx` still selects only `{ id }`; that select is updated in Task 14. If tsc reports the mismatch in `page.tsx` now, make the minimal `page.tsx` select change from Task 14 Step 1 in this task instead and say so in the commit.
- `FetchedSim` gained `householdId` — any derive/page test fixtures that construct `FetchedSim` objects need `householdId: null` added. Include those fixture updates in this commit.

```bash
git add "src/app/app/legacies/[slug]/lib/types.ts" "src/app/app/legacies/[slug]/_components/households/lib.ts" "src/app/app/legacies/[slug]/_components/households/__tests__/lib.test.ts"
git commit -m "feat(chronicle): household view types and select-option helpers"
```

---

### Task 10: Household cards (featured + compact)

**Files:**
- Create: `src/app/app/legacies/[slug]/_components/households/households.module.css`
- Create: `src/app/app/legacies/[slug]/_components/households/featured-household.tsx`
- Create: `src/app/app/legacies/[slug]/_components/households/household-card.tsx`
- Create: `src/app/app/legacies/[slug]/_components/households/__tests__/household-cards.test.tsx`

Pure presentational cards. The stateful section that arranges them comes in Task 13, after the dialog (Task 11) and drawer (Task 12) exist — that ordering means no stubs or placeholder renders anywhere.

- [ ] **Step 1: Write the failing card tests**

Create `src/app/app/legacies/[slug]/_components/households/__tests__/household-cards.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { HouseholdView, HouseholdSim } from '../../../lib/types'

vi.mock('next/image', () => ({
  default: (props: { alt?: string }) => <span aria-label={props.alt} />,
}))

import { FeaturedHousehold } from '../featured-household'
import { HouseholdCard } from '../household-card'

function sim(over: Partial<HouseholdSim> & { id: string; firstName: string }): HouseholdSim {
  return {
    lastName: 'Caliente',
    imageUrl: null,
    isHeir: false,
    isFounder: false,
    generationNumber: 1,
    lifeStage: 'YOUNG_ADULT',
    householdId: null,
    ...over,
  }
}

function household(over: Partial<HouseholdView> & { id: string; name: string }): HouseholdView {
  return {
    worldId: null,
    worldName: null,
    lot: null,
    description: null,
    funds: 0,
    lotValue: 0,
    foundedGeneration: 1,
    isActive: false,
    residents: [],
    ...over,
  }
}

describe('FeaturedHousehold', () => {
  it('renders the now-playing pill, identity, stats, and manage CTA', async () => {
    const user = userEvent.setup()
    const onManage = vi.fn()
    render(
      <FeaturedHousehold
        household={household({
          id: 'h1',
          name: 'Caliente Villa',
          isActive: true,
          funds: 184250,
          lotValue: 248900,
          worldName: 'Willow Creek',
          lot: '165 Sim Lane',
          description: 'The seat of the legacy.',
          foundedGeneration: 1,
          residents: [sim({ id: 's1', firstName: 'Dina', householdId: 'h1' })],
        })}
        onManage={onManage}
      />,
    )

    expect(screen.getByText('Now playing')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Caliente Villa' })).toBeInTheDocument()
    expect(screen.getByText('Willow Creek · 165 Sim Lane')).toBeInTheDocument()
    expect(screen.getByText('§184,250')).toBeInTheDocument()
    expect(screen.getByText('§248,900')).toBeInTheDocument()
    expect(screen.getByText('Gen I')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Manage household/i }))
    expect(onManage).toHaveBeenCalled()
  })

  it('omits the Founded stat when foundedGeneration is null', () => {
    render(
      <FeaturedHousehold
        household={household({ id: 'h1', name: 'Old House', foundedGeneration: null })}
        onManage={vi.fn()}
      />,
    )
    expect(screen.queryByText('Founded')).not.toBeInTheDocument()
  })
})

describe('HouseholdCard', () => {
  it('renders name, address, funds, resident count, and opens on click', async () => {
    const user = userEvent.setup()
    const onManage = vi.fn()
    render(
      <HouseholdCard
        household={household({
          id: 'h2',
          name: 'Goth Manor',
          worldName: 'Willow Creek',
          lot: '1 Goth Hill',
          funds: 92400,
          residents: [sim({ id: 's2', firstName: 'Mortimer', householdId: 'h2' })],
        })}
        onManage={onManage}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Goth Manor' })).toBeInTheDocument()
    expect(screen.getByText('Willow Creek · 1 Goth Hill')).toBeInTheDocument()
    expect(screen.getByText('§92,400')).toBeInTheDocument()
    expect(screen.getByText('· 1 resident')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Goth Manor/ }))
    expect(onManage).toHaveBeenCalled()
  })

  it('notes an empty lot when there are no residents', () => {
    render(
      <HouseholdCard household={household({ id: 'h3', name: 'Fresh Lot' })} onManage={vi.fn()} />,
    )
    expect(screen.getByText('Empty lot')).toBeInTheDocument()
  })
})
```

(Note on `'· 1 resident'`: the card renders the separator and count in one span — see Step 5. If the rendered text node splits differently, assert with a function matcher or adjust the markup, not the behavior.)

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- household-cards`
Expected: FAIL — modules not found.

- [ ] **Step 3: Create the card styles**

Create `src/app/app/legacies/[slug]/_components/households/households.module.css`:

```css
/* ── Featured (active) household card ─────────────────────────────────── */

.featured {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  overflow: hidden;
  display: grid;
  grid-template-columns: 2fr 1fr;
}

@media (max-width: 760px) {
  .featured {
    grid-template-columns: 1fr;
  }
}

.featuredMain {
  padding: 26px 28px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.featuredTopRow {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.featuredName {
  margin: 0;
  font-family: var(--font-display);
  font-size: 32px;
  font-weight: 600;
  color: var(--text);
  line-height: 1.05;
  letter-spacing: -0.01em;
}

.featuredBlurb {
  margin: 8px 0 0;
  font-size: 14.5px;
  color: var(--text-muted);
  line-height: 1.5;
  max-width: 440px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.featuredResidents {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: auto;
  padding-top: 6px;
}

.featuredResidentNames {
  font-size: 12.5px;
  color: var(--text-subtle);
  letter-spacing: 0.04em;
}

/* Right: stat rail on parchment */
.featuredRail {
  background: var(--bg);
  border-left: 1px solid var(--border);
  padding: 26px 28px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.railStats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px 18px;
}

.railStat {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.railStatValue {
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 600;
  line-height: 1;
  color: var(--text);
}

.railStatGreen {
  color: var(--green);
}

.railStatAmber {
  color: var(--amber-text);
}

.railStatLabel {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.13em;
  text-transform: uppercase;
  color: var(--text-subtle);
}

.manageButton {
  margin-top: auto;
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 7px;
}

/* ── Lot line (house icon + world · address) ─────────────────────────── */

.lotLine {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--text-muted);
  font-family: var(--font-body);
  font-size: 12.5px;
}

/* ── Overlapping resident avatars ────────────────────────────────────── */

.stack {
  display: flex;
  align-items: center;
}

.stackItem {
  border-radius: var(--radius-full);
  border: 2px solid var(--bg-card);
  position: relative;
}

.stackItem + .stackItem {
  margin-left: -10px;
}

.stackOverflow {
  margin-left: -10px;
  border-radius: var(--radius-full);
  border: 2px solid var(--bg-card);
  background: var(--bg-card-hover);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-body);
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted);
}

/* ── Compact household card ──────────────────────────────────────────── */

.card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  padding: 15px 28px 13px;
  display: flex;
  flex-direction: column;
  gap: 11px;
  cursor: pointer;
  text-align: left;
  width: 100%;
  font: inherit;
  color: inherit;
  transition:
    box-shadow var(--transition-base),
    transform var(--transition-base),
    border-color var(--transition-base);
}

.card:hover,
.card:focus-visible {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
  border-color: var(--border-bright);
}

.cardTop {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.cardName {
  margin: 0;
  font-family: var(--font-display);
  font-size: 19px;
  font-weight: 600;
  color: var(--text);
  line-height: 1.1;
}

.cardAddress {
  margin: 3px 0 0;
  font-size: 11.5px;
  color: var(--text-subtle);
  letter-spacing: 0.02em;
}

.cardEmptyNote {
  flex-shrink: 0;
  font-size: 11px;
  font-style: italic;
  color: var(--text-subtle);
  white-space: nowrap;
}

.cardFooter {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 10px;
  border-top: 1px solid var(--border);
}

.cardFunds {
  font-size: 12.5px;
  color: var(--text-muted);
}

.cardFundsValue {
  color: var(--green);
  font-weight: 600;
}

.cardResidentCount {
  color: var(--text-subtle);
}

.cardManage {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--green);
}

/* ── Now playing pill ────────────────────────────────────────────────── */

.nowPlaying {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 9px 3px 8px;
  border-radius: var(--radius-full);
  background: var(--green-glow);
  color: var(--green);
  font-family: var(--font-body);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  white-space: nowrap;
}
```

- [ ] **Step 4: Create the featured card component**

Create `src/app/app/legacies/[slug]/_components/households/featured-household.tsx`:

```tsx
import { Button, PortraitAvatar, HouseIcon, ArrowRightIcon } from '@/components/ui'
import { Plumbob } from '@/components/plumbob'
import { roman } from '@/lib/legacy-format'
import type { HouseholdView, HouseholdSim } from '../../lib/types'
import { simoleons } from './lib'
import styles from './households.module.css'

function ringFor(sim: HouseholdSim): 'founder' | 'heir' | 'green' {
  return sim.isHeir ? 'heir' : sim.isFounder ? 'founder' : 'green'
}

export function NowPlayingPill() {
  return (
    <span className={styles.nowPlaying}>
      <Plumbob size={9} glow />
      Now playing
    </span>
  )
}

export function LotLine({ household }: { household: HouseholdView }) {
  if (!household.worldName && !household.lot) return null
  return (
    <span className={styles.lotLine}>
      <HouseIcon size={13} />
      <span>{[household.worldName, household.lot].filter(Boolean).join(' · ')}</span>
    </span>
  )
}

export function ResidentStack({
  residents,
  size = 34,
  max = 5,
}: {
  residents: HouseholdSim[]
  size?: number
  max?: number
}) {
  const shown = residents.slice(0, max)
  const extra = residents.length - shown.length
  return (
    <div className={styles.stack}>
      {shown.map((r) => (
        <div key={r.id} className={styles.stackItem} title={`${r.firstName} ${r.lastName}`}>
          <PortraitAvatar
            imageUrl={r.imageUrl}
            firstName={r.firstName}
            lastName={r.lastName}
            size={size}
            ring={ringFor(r)}
          />
        </div>
      ))}
      {extra > 0 && (
        <div className={styles.stackOverflow} style={{ width: size, height: size }}>
          +{extra}
        </div>
      )}
    </div>
  )
}

export interface FeaturedHouseholdProps {
  household: HouseholdView
  onManage: () => void
}

/** The large "now playing" card: identity + residents on the left, a
 *  parchment stat rail with the manage CTA on the right. */
export function FeaturedHousehold({ household: h, onManage }: FeaturedHouseholdProps) {
  return (
    <div className={styles.featured}>
      <div className={styles.featuredMain}>
        <div className={styles.featuredTopRow}>
          <NowPlayingPill />
          <LotLine household={h} />
        </div>
        <div>
          <h3 className={styles.featuredName}>{h.name}</h3>
          {h.description && <p className={styles.featuredBlurb}>{h.description}</p>}
        </div>
        {h.residents.length > 0 && (
          <div className={styles.featuredResidents}>
            <ResidentStack residents={h.residents} size={40} />
            <span className={styles.featuredResidentNames}>
              {h.residents.map((r) => r.firstName).join(' · ')}
            </span>
          </div>
        )}
      </div>

      <div className={styles.featuredRail}>
        <div className={styles.railStats}>
          <div className={styles.railStat}>
            <span className={`${styles.railStatValue} ${styles.railStatGreen}`}>
              {simoleons(h.funds)}
            </span>
            <span className={styles.railStatLabel}>Household funds</span>
          </div>
          <div className={styles.railStat}>
            <span className={styles.railStatValue}>{h.residents.length}</span>
            <span className={styles.railStatLabel}>Residents</span>
          </div>
          <div className={styles.railStat}>
            <span className={styles.railStatValue}>{simoleons(h.lotValue)}</span>
            <span className={styles.railStatLabel}>Lot value</span>
          </div>
          {h.foundedGeneration !== null && (
            <div className={styles.railStat}>
              <span className={`${styles.railStatValue} ${styles.railStatAmber}`}>
                Gen {roman(h.foundedGeneration)}
              </span>
              <span className={styles.railStatLabel}>Founded</span>
            </div>
          )}
        </div>
        <Button type="button" variant="outline" size="sm" className={styles.manageButton} onClick={onManage}>
          Manage household <ArrowRightIcon size={15} />
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Create the compact card**

Create `src/app/app/legacies/[slug]/_components/households/household-card.tsx`:

```tsx
import { ArrowRightIcon } from '@/components/ui'
import type { HouseholdView } from '../../lib/types'
import { simoleons } from './lib'
import { ResidentStack } from './featured-household'
import styles from './households.module.css'

export interface HouseholdCardProps {
  household: HouseholdView
  onManage: () => void
}

/** Compact grid card for a non-playing household. The whole card opens the
 *  management drawer. */
export function HouseholdCard({ household: h, onManage }: HouseholdCardProps) {
  return (
    <button type="button" className={styles.card} onClick={onManage}>
      <span className={styles.cardTop}>
        <span>
          <h4 className={styles.cardName}>{h.name}</h4>
          {(h.worldName || h.lot) && (
            <p className={styles.cardAddress}>
              {[h.worldName, h.lot].filter(Boolean).join(' · ')}
            </p>
          )}
        </span>
        {h.residents.length > 0 ? (
          <ResidentStack residents={h.residents} size={26} max={4} />
        ) : (
          <span className={styles.cardEmptyNote}>Empty lot</span>
        )}
      </span>

      <span className={styles.cardFooter}>
        <span className={styles.cardFunds}>
          <span className={styles.cardFundsValue}>{simoleons(h.funds)}</span>
          <span className={styles.cardResidentCount}>
            {' · '}
            {h.residents.length} resident{h.residents.length === 1 ? '' : 's'}
          </span>
        </span>
        <span className={styles.cardManage}>
          Manage <ArrowRightIcon size={13} />
        </span>
      </span>
    </button>
  )
}
```

- [ ] **Step 6: Run the tests**

Run: `npm test -- household-cards`
Expected: PASS.

- [ ] **Step 7: Validate and commit**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

```bash
git add "src/app/app/legacies/[slug]/_components/households"
git commit -m "feat(chronicle): featured and compact household cards"
```

---

### Task 11: Found-a-household dialog

**Files:**
- Create: `src/app/app/legacies/[slug]/_components/households/found-household-dialog.tsx`
- Create: `src/app/app/legacies/[slug]/_components/households/found-household-dialog.module.css`
- Create: `src/app/app/legacies/[slug]/_components/households/__tests__/found-household-dialog.test.tsx`
- Modify: `src/app/app/legacies/[slug]/_components/households/households-section.tsx`

The ceremonial centered modal (design: option B no-crest, V1 fields): plumbob, amber eyebrow, centered serif name input, gem divider, World + Lot selects, starting funds (prefilled 20,000), description, "Move sims in" avatar picker over ALL sims with their current home.

- [ ] **Step 1: Write the failing tests**

Create `src/app/app/legacies/[slug]/_components/households/__tests__/found-household-dialog.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { HouseholdSim, WorldOption } from '../../../lib/types'

const mutateAsync = vi.fn().mockResolvedValue({ id: 'new-h' })
const refresh = vi.fn()
vi.mock('@/trpc/client', () => ({
  trpc: {
    households: {
      create: { useMutation: () => ({ mutateAsync, isPending: false }) },
    },
  },
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
vi.mock('next/image', () => ({
  default: (props: { alt?: string }) => <span aria-label={props.alt} />,
}))

import { FoundHouseholdDialog } from '../found-household-dialog'

function sim(over: Partial<HouseholdSim> & { id: string; firstName: string }): HouseholdSim {
  return {
    lastName: 'Caliente',
    imageUrl: null,
    isHeir: false,
    isFounder: false,
    generationNumber: 1,
    lifeStage: 'YOUNG_ADULT',
    householdId: null,
    ...over,
  }
}

const WORLDS: WorldOption[] = [
  { id: 'w1', name: 'Willow Creek', lots: ['1 Goth Hill', '165 Sim Lane'] },
]

const baseProps = {
  legacyId: 'legacy-1',
  worlds: WORLDS,
  sims: [sim({ id: 's1', firstName: 'Dina', householdId: 'h1' }), sim({ id: 's2', firstName: 'Nina' })],
  homeNames: { h1: 'Goth Manor' } as Record<string, string>,
  onClose: vi.fn(),
  onFounded: vi.fn(),
}

describe('FoundHouseholdDialog', () => {
  beforeEach(() => {
    mutateAsync.mockClear()
    refresh.mockClear()
    baseProps.onFounded.mockClear()
  })

  it('disables founding until a name is entered', async () => {
    const user = userEvent.setup()
    render(<FoundHouseholdDialog {...baseProps} />)

    const submit = screen.getByRole('button', { name: /Found the household/i })
    expect(submit).toBeDisabled()
    await user.type(screen.getByPlaceholderText('Name your household'), 'Zest Bungalow')
    expect(submit).toBeEnabled()
  })

  it('lists every sim with their current home', () => {
    render(<FoundHouseholdDialog {...baseProps} />)
    expect(screen.getByRole('button', { name: /Dina/ })).toHaveAccessibleName(/Goth Manor/)
    expect(screen.getByRole('button', { name: /Nina/ })).toHaveAccessibleName(/Unhoused/)
  })

  it('creates the household with the entered fields and selected sims, then reports the id', async () => {
    const user = userEvent.setup()
    render(<FoundHouseholdDialog {...baseProps} />)

    await user.type(screen.getByPlaceholderText('Name your household'), 'Zest Bungalow')
    await user.click(screen.getByRole('button', { name: /Nina/ }))
    await user.click(screen.getByRole('button', { name: /Found the household/i }))

    expect(mutateAsync).toHaveBeenCalledWith({
      legacyId: 'legacy-1',
      name: 'Zest Bungalow',
      worldId: 'w1',
      lot: '1 Goth Hill',
      funds: 20000,
      description: undefined,
      simIds: ['s2'],
    })
    expect(refresh).toHaveBeenCalled()
    expect(baseProps.onFounded).toHaveBeenCalledWith('new-h')
  })

  it('shows an inline error when the mutation fails', async () => {
    mutateAsync.mockRejectedValueOnce(new Error('nope'))
    const user = userEvent.setup()
    render(<FoundHouseholdDialog {...baseProps} />)

    await user.type(screen.getByPlaceholderText('Name your household'), 'X')
    await user.click(screen.getByRole('button', { name: /Found the household/i }))

    expect(await screen.findByText(/Couldn.t found the household/i)).toBeInTheDocument()
    expect(baseProps.onFounded).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- found-household-dialog`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the styles**

Create `src/app/app/legacies/[slug]/_components/households/found-household-dialog.module.css`:

```css
/* Ceremonial founding modal (option B, no crest, V1 fields). Parchment
   surface — never a white card. */

.content {
  width: min(460px, calc(100vw - 48px));
  max-height: 90vh;
  overflow-y: auto;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  padding: 24px 30px 26px;
  text-align: center;
}

.closeRow {
  display: flex;
  justify-content: flex-end;
}

.plumbobRow {
  display: flex;
  justify-content: center;
  margin: 4px 0 20px;
}

.eyebrow {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--amber-text);
}

.nameRow {
  margin-top: 12px;
  display: flex;
  justify-content: center;
}

.nameInput {
  font-family: var(--font-display);
  font-size: 28px;
  font-weight: 600;
  text-align: center;
  color: var(--text);
  background: transparent;
  border: none;
  outline: none;
  border-bottom: 2px dashed var(--border-bright);
  padding: 0 4px 3px;
  width: 100%;
  max-width: 340px;
}

.nameInput:focus {
  border-bottom-color: var(--green);
  border-bottom-style: solid;
}

.gemDivider {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 18px 0;
}

.gemDividerLine {
  flex: 1;
  height: 1px;
  background: var(--border);
}

.fields {
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.fieldPair {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.fieldLabel {
  font-family: var(--font-body);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--text-subtle);
}

.fieldControl {
  margin-top: 6px;
}

.fundsInput {
  margin-top: 6px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 11px 14px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-base);
}

.fundsInput:focus-within {
  border-color: var(--green);
}

.fundsSign {
  color: var(--text-subtle);
}

.fundsField {
  flex: 1;
  border: none;
  background: transparent;
  outline: none;
  font: inherit;
  color: var(--text);
  padding: 0;
  min-width: 0;
}

.descriptionField {
  margin-top: 6px;
  width: 100%;
  box-sizing: border-box;
  resize: none;
  min-height: 54px;
  line-height: 1.5;
  font-family: var(--font-body);
  font-size: 13px;
  color: var(--text);
  padding: 11px 14px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-base);
}

.descriptionField:focus {
  outline: none;
  border-color: var(--green);
}

.residentsBlock {
  margin-top: 18px;
}

.residentsHint {
  text-align: center;
  font-size: 11.5px;
  color: var(--text-subtle);
  margin: 4px 0 10px;
}

.residentsGrid {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: center;
}

.simPick {
  width: 64px;
  text-align: center;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
}

.simPickAvatar {
  position: relative;
  width: 44px;
  height: 44px;
  margin: 0 auto;
  border-radius: var(--radius-full);
  opacity: 0.55;
  transition: opacity var(--transition-base);
}

.simPickAvatarOn {
  opacity: 1;
  box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px var(--green);
}

.simPickCheck {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 17px;
  height: 17px;
  border-radius: var(--radius-full);
  background: var(--green);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--bg);
  font-size: 10px;
  line-height: 1;
}

.simPickName {
  font-size: 10.5px;
  color: var(--text-subtle);
  margin-top: 5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.simPickNameOn {
  color: var(--text);
  font-weight: 600;
}

.simPickHome {
  font-size: 9px;
  color: var(--text-subtle);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.noSims {
  font-size: 12.5px;
  font-style: italic;
  color: var(--text-subtle);
}

.error {
  margin: 14px 0 0;
  font-size: 12.5px;
  color: var(--error, #b3261e);
}

.submitRow {
  margin-top: 20px;
}

.submit {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}
```

(Check `globals.css` for an `--error` token before relying on the fallback; if one exists under another name — e.g. `--danger` — use that.)

- [ ] **Step 4: Create the dialog component**

Create `src/app/app/legacies/[slug]/_components/households/found-household-dialog.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { trpc } from '@/trpc/client'
import { Dialog, Button, Combobox, PortraitAvatar, ArrowRightIcon } from '@/components/ui'
import { Plumbob } from '@/components/plumbob'
import type { HouseholdSim, WorldOption } from '../../lib/types'
import { lotOptions } from './lib'
import styles from './found-household-dialog.module.css'

export interface FoundHouseholdDialogProps {
  legacyId: string
  worlds: WorldOption[]
  /** Every sim in the legacy; selecting a housed one moves them here. */
  sims: HouseholdSim[]
  /** householdId → household name, to caption each sim's current home. */
  homeNames: Record<string, string>
  onClose: () => void
  /** Called with the new household id after a successful founding. */
  onFounded: (id: string) => void
}

function ringFor(sim: HouseholdSim): 'founder' | 'heir' | 'green' {
  return sim.isHeir ? 'heir' : sim.isFounder ? 'founder' : 'green'
}

/** Ceremonial founding modal: name, world + lot, starting funds, description,
 *  and a "move sims in" avatar picker. Mirrors the prototype's B/V1 layout. */
export function FoundHouseholdDialog({
  legacyId,
  worlds,
  sims,
  homeNames,
  onClose,
  onFounded,
}: FoundHouseholdDialogProps) {
  const router = useRouter()
  const create = trpc.households.create.useMutation()

  const [name, setName] = useState('')
  const [worldId, setWorldId] = useState<string | undefined>(worlds[0]?.id)
  const world = worlds.find((w) => w.id === worldId)
  const [lot, setLot] = useState<string | undefined>(worlds[0]?.lots[0])
  const [funds, setFunds] = useState('20000')
  const [description, setDescription] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [error, setError] = useState('')

  const canFound = name.trim().length > 0 && !create.isPending

  function toggleSim(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  }

  async function submit() {
    if (!canFound) return
    setError('')
    try {
      const result = await create.mutateAsync({
        legacyId,
        name: name.trim(),
        worldId,
        lot,
        funds: parseInt(funds || '0', 10),
        description: description.trim() || undefined,
        simIds: selected,
      })
      router.refresh()
      onFounded(result.id)
    } catch {
      setError("Couldn't found the household. Please try again.")
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content className={styles.content} aria-describedby={undefined}>
          <div className={styles.closeRow}>
            <Dialog.Close asChild>
              <Button type="button" variant="ghost" size="icon" aria-label="Close">
                ✕
              </Button>
            </Dialog.Close>
          </div>

          <div className={styles.plumbobRow}>
            <Plumbob size={20} glow />
          </div>
          <Dialog.Title className={styles.eyebrow}>Found a household</Dialog.Title>

          <div className={styles.nameRow}>
            <input
              className={styles.nameInput}
              value={name}
              autoFocus
              placeholder="Name your household"
              aria-label="Household name"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submit()
              }}
            />
          </div>

          <div className={styles.gemDivider} aria-hidden="true">
            <div className={styles.gemDividerLine} />
            <Plumbob size={9} />
            <div className={styles.gemDividerLine} />
          </div>

          <div className={styles.fields}>
            <div className={styles.fieldPair}>
              <div>
                <span className={styles.fieldLabel}>World</span>
                <div className={styles.fieldControl}>
                  <Combobox
                    value={worldId ?? ''}
                    onChange={(v) => {
                      setWorldId(v)
                      const next = worlds.find((w) => w.id === v)
                      setLot(next?.lots[0])
                    }}
                    placeholder="Choose a world"
                    aria-label="World"
                  >
                    {worlds.map((w) => (
                      <Combobox.Item key={w.id} value={w.id}>
                        {w.name}
                      </Combobox.Item>
                    ))}
                  </Combobox>
                </div>
              </div>
              <div>
                <span className={styles.fieldLabel}>Lot</span>
                <div className={styles.fieldControl}>
                  <Combobox
                    value={lot ?? ''}
                    onChange={(v) => setLot(v)}
                    placeholder="Choose a lot"
                    aria-label="Lot"
                  >
                    {lotOptions(world, lot ?? null).map((l) => (
                      <Combobox.Item key={l} value={l}>
                        {l}
                      </Combobox.Item>
                    ))}
                  </Combobox>
                </div>
              </div>
            </div>

            <div>
              <span className={styles.fieldLabel}>Starting funds</span>
              <div className={styles.fundsInput}>
                <span className={styles.fundsSign}>§</span>
                <input
                  className={styles.fundsField}
                  value={Number(funds || '0').toLocaleString('en-US')}
                  inputMode="numeric"
                  aria-label="Starting funds"
                  onChange={(e) => setFunds(e.target.value.replace(/[^0-9]/g, ''))}
                />
              </div>
            </div>

            <div>
              <label className={styles.fieldLabel} htmlFor="found-description">
                Description
              </label>
              <textarea
                id="found-description"
                className={styles.descriptionField}
                rows={2}
                value={description}
                placeholder="A line to remember this household by…"
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          <div className={styles.residentsBlock}>
            <span className={styles.fieldLabel}>Move sims in</span>
            <p className={styles.residentsHint}>Sims already in a household will move here.</p>
            {sims.length === 0 ? (
              <p className={styles.noSims}>No sims yet.</p>
            ) : (
              <div className={styles.residentsGrid}>
                {sims.map((s) => {
                  const on = selected.includes(s.id)
                  const home = s.householdId ? homeNames[s.householdId] : undefined
                  return (
                    <button
                      key={s.id}
                      type="button"
                      className={styles.simPick}
                      aria-pressed={on}
                      aria-label={`${s.firstName} ${s.lastName} — ${home ?? 'Unhoused'}`}
                      onClick={() => toggleSim(s.id)}
                    >
                      <span
                        className={`${styles.simPickAvatar} ${on ? styles.simPickAvatarOn : ''}`}
                      >
                        <PortraitAvatar
                          imageUrl={s.imageUrl}
                          firstName={s.firstName}
                          lastName={s.lastName}
                          size={44}
                          ring={ringFor(s)}
                        />
                        {on && (
                          <span className={styles.simPickCheck} aria-hidden="true">
                            ✓
                          </span>
                        )}
                      </span>
                      <span className={`${styles.simPickName} ${on ? styles.simPickNameOn : ''}`}>
                        {s.firstName}
                      </span>
                      <span className={styles.simPickHome}>{home ?? 'Unhoused'}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {error && <p className={styles.error} role="alert">{error}</p>}

          <div className={styles.submitRow}>
            <Button type="button" className={styles.submit} disabled={!canFound} onClick={() => void submit()}>
              Found the household <ArrowRightIcon size={15} />
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  )
}
```

(Check `src/components/ui/dialog/dialog.tsx` first: if `Dialog.Content` doesn't accept `className`, add the same pass-through it uses for `size` — `cn(styles.content, className)` — as part of this task. If `Button` has no `size="icon"`, use `size="sm"`.)

- [ ] **Step 5: Run the tests**

Run: `npm test -- found-household-dialog`
Expected: PASS. (The dialog mounts into the section in Task 13.)

- [ ] **Step 6: Validate and commit**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

```bash
git add "src/app/app/legacies/[slug]/_components/households"
git commit -m "feat(chronicle): ceremonial found-a-household dialog"
```

---

### Task 12: Household management drawer

**Files:**
- Create: `src/app/app/legacies/[slug]/_components/households/household-drawer.module.css`
- Create: `src/app/app/legacies/[slug]/_components/households/resident-row.tsx`
- Create: `src/app/app/legacies/[slug]/_components/households/household-drawer.tsx`
- Create: `src/app/app/legacies/[slug]/_components/households/__tests__/household-drawer.test.tsx`
- Modify: `src/app/app/legacies/[slug]/_components/households/households-section.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/app/app/legacies/[slug]/_components/households/__tests__/household-drawer.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { HouseholdView, HouseholdSim, WorldOption } from '../../../lib/types'

const mutations = {
  update: vi.fn().mockResolvedValue({}),
  setActive: vi.fn().mockResolvedValue({}),
  moveSim: vi.fn().mockResolvedValue({}),
}
const refresh = vi.fn()
vi.mock('@/trpc/client', () => ({
  trpc: {
    households: {
      update: { useMutation: () => ({ mutateAsync: mutations.update, isPending: false }) },
      setActive: { useMutation: () => ({ mutateAsync: mutations.setActive, isPending: false }) },
      moveSim: { useMutation: () => ({ mutateAsync: mutations.moveSim, isPending: false }) },
    },
  },
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
vi.mock('next/image', () => ({
  default: (props: { alt?: string }) => <span aria-label={props.alt} />,
}))

import { HouseholdDrawer } from '../household-drawer'

function sim(over: Partial<HouseholdSim> & { id: string; firstName: string }): HouseholdSim {
  return {
    lastName: 'Caliente',
    imageUrl: null,
    isHeir: false,
    isFounder: false,
    generationNumber: 1,
    lifeStage: 'YOUNG_ADULT',
    householdId: null,
    ...over,
  }
}

function household(over: Partial<HouseholdView> & { id: string; name: string }): HouseholdView {
  return {
    worldId: null,
    worldName: null,
    lot: null,
    description: null,
    funds: 0,
    lotValue: 0,
    foundedGeneration: 1,
    isActive: false,
    residents: [],
    ...over,
  }
}

const WORLDS: WorldOption[] = [
  { id: 'w1', name: 'Willow Creek', lots: ['1 Goth Hill', '165 Sim Lane'] },
]

const dina = sim({ id: 's1', firstName: 'Dina', householdId: 'h1', isHeir: true })
const nina = sim({ id: 's2', firstName: 'Nina', householdId: 'h2' })

const h1 = household({
  id: 'h1',
  name: 'Caliente Villa',
  isActive: true,
  funds: 184250,
  lotValue: 248900,
  residents: [dina],
})
const h2 = household({ id: 'h2', name: 'Goth Manor', residents: [nina] })

const baseProps = {
  worlds: WORLDS,
  households: [h1, h2],
  sims: [dina, nina],
  autoRename: false,
  onClose: vi.fn(),
}

describe('HouseholdDrawer', () => {
  beforeEach(() => {
    mutations.update.mockClear()
    mutations.setActive.mockClear()
    mutations.moveSim.mockClear()
    refresh.mockClear()
  })

  it('shows Now playing for the active household and Set as active for others', () => {
    const { rerender } = render(<HouseholdDrawer {...baseProps} household={h1} />)
    expect(screen.getByText('Now playing')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Set as active' })).not.toBeInTheDocument()

    rerender(<HouseholdDrawer {...baseProps} household={h2} />)
    expect(screen.queryByText('Now playing')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Set as active' })).toBeInTheDocument()
  })

  it('sets the household active and refreshes', async () => {
    const user = userEvent.setup()
    render(<HouseholdDrawer {...baseProps} household={h2} />)
    await user.click(screen.getByRole('button', { name: 'Set as active' }))
    expect(mutations.setActive).toHaveBeenCalledWith({ householdId: 'h2' })
    expect(refresh).toHaveBeenCalled()
  })

  it('commits a rename through households.update', async () => {
    const user = userEvent.setup()
    render(<HouseholdDrawer {...baseProps} household={h1} />)
    await user.click(screen.getByRole('button', { name: 'Caliente Villa' }))
    const input = screen.getByRole('textbox', { name: 'Household name' })
    await user.clear(input)
    await user.type(input, 'Villa Nueva{Enter}')
    expect(mutations.update).toHaveBeenCalledWith({ householdId: 'h1', name: 'Villa Nueva' })
    expect(refresh).toHaveBeenCalled()
  })

  it('renders residents with derived badges and a Move to… select', async () => {
    const user = userEvent.setup()
    render(<HouseholdDrawer {...baseProps} household={h1} />)
    expect(screen.getByText('Dina Caliente')).toBeInTheDocument()
    expect(screen.getByText('Heir')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Move Dina to' }))
    await user.click(await screen.findByRole('option', { name: /Goth Manor/i }))
    expect(mutations.moveSim).toHaveBeenCalledWith({ simId: 's1', toHouseholdId: 'h2' })
  })

  it('moves a resident out to unhoused', async () => {
    const user = userEvent.setup()
    render(<HouseholdDrawer {...baseProps} household={h1} />)
    await user.click(screen.getByRole('button', { name: 'Move Dina to' }))
    await user.click(await screen.findByRole('option', { name: /Unhoused/i }))
    expect(mutations.moveSim).toHaveBeenCalledWith({ simId: 's1', toHouseholdId: null })
  })

  it('moves a sim in from another household via the ghost add row', async () => {
    const user = userEvent.setup()
    render(<HouseholdDrawer {...baseProps} household={h1} />)
    await user.click(screen.getByRole('button', { name: /Move a sim in/i }))
    await user.click(await screen.findByRole('option', { name: /Nina Caliente/i }))
    expect(mutations.moveSim).toHaveBeenCalledWith({ simId: 's2', toHouseholdId: 'h1' })
  })

  it('shows the empty-lot prompt when there are no residents', () => {
    render(
      <HouseholdDrawer
        {...baseProps}
        household={household({ id: 'h3', name: 'Fresh Lot' })}
      />,
    )
    expect(screen.getByText(/This lot is empty/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- household-drawer`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the drawer styles**

Create `src/app/app/legacies/[slug]/_components/households/household-drawer.module.css`:

```css
/* G° ceremonial drawer: parchment header, card-surface body. Never a white
   panel end-to-end — the surface change carries the section break. */

.content {
  background: var(--bg);
}

.header {
  padding: 20px 24px;
  background: var(--bg);
  text-align: center;
}

.headerTop {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 28px;
}

.close {
  margin-left: auto;
}

.nameWrap {
  margin-top: 8px;
}

.lotRow {
  margin-top: 9px;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 7px;
  color: var(--text-muted);
}

.lotDot {
  color: var(--text-subtle);
}

.descriptionWrap {
  margin-top: 11px;
  max-width: 320px;
  margin-left: auto;
  margin-right: auto;
}

.description {
  font-style: italic;
}

.body {
  flex: 1;
  overflow-y: auto;
  background: var(--bg-card);
  padding: 4px 24px 24px;
}

.stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 108px));
  justify-content: center;
  column-gap: 14px;
  padding: 16px 0 20px;
}

.foundedStat {
  display: flex;
  flex-direction: column;
  gap: 3px;
  align-items: center;
}

.foundedValue {
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 600;
  line-height: 1;
  color: var(--amber-text);
}

.foundedLabel {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-subtle);
}

.gemDivider {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 18px;
}

.gemDividerLine {
  flex: 1;
  height: 1px;
  background: var(--border);
}

.residentsLabel {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-family: var(--font-body);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--text-subtle);
}

.residentsCount {
  font-size: 12px;
  color: var(--text-subtle);
  text-transform: none;
  letter-spacing: normal;
}

.residentsList {
  margin-top: 4px;
}

.emptyLot {
  margin-top: 12px;
}

.moveInWrap {
  margin-top: 10px;
}

.moveInLabel {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.error {
  margin: 10px 0 0;
  font-size: 12.5px;
  color: var(--error, #b3261e);
}

/* Resident row */
.row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
}

.rowMain {
  flex: 1;
  min-width: 0;
}

.rowNameLine {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rowName {
  font-family: var(--font-display);
  font-size: 17px;
  font-weight: 600;
  color: var(--text);
  line-height: 1.1;
}

.rowMeta {
  font-size: 11.5px;
  color: var(--text-subtle);
  letter-spacing: 0.04em;
}

.optionRow {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.optionLabel {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.optionMeta {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--text-subtle);
  margin-left: auto;
}
```

- [ ] **Step 4: Create the resident row**

Create `src/app/app/legacies/[slug]/_components/households/resident-row.tsx`:

```tsx
'use client'

import { Badge, Combobox, PortraitAvatar, HouseIcon } from '@/components/ui'
import { roman } from '@/lib/legacy-format'
import type { HouseholdView, HouseholdSim } from '../../lib/types'
import styles from './household-drawer.module.css'

const LIFE_STAGE_LABELS: Record<string, string> = {
  NEWBORN: 'Newborn',
  INFANT: 'Infant',
  TODDLER: 'Toddler',
  CHILD: 'Child',
  TEEN: 'Teen',
  YOUNG_ADULT: 'Young Adult',
  ADULT: 'Adult',
  ELDER: 'Elder',
}

function ringFor(sim: HouseholdSim): 'founder' | 'heir' | 'green' {
  return sim.isHeir ? 'heir' : sim.isFounder ? 'founder' : 'green'
}

export interface ResidentRowProps {
  resident: HouseholdSim
  /** All OTHER households (move-to targets). */
  others: HouseholdView[]
  onMoveTo: (toHouseholdId: string | null) => void
}

/** Borderless resident row: portrait · name · derived badge · "Move to…"
 *  chip select. Badges are derived only — Heir from isHeir, Founder from the
 *  legacy founder; everyone else gets none (spec decision). */
export function ResidentRow({ resident, others, onMoveTo }: ResidentRowProps) {
  return (
    <div className={styles.row}>
      <PortraitAvatar
        imageUrl={resident.imageUrl}
        firstName={resident.firstName}
        lastName={resident.lastName}
        size={40}
        ring={ringFor(resident)}
      />
      <div className={styles.rowMain}>
        <div className={styles.rowNameLine}>
          <span className={styles.rowName}>
            {resident.firstName} {resident.lastName}
          </span>
          {resident.isHeir && <Badge variant="warning">Heir</Badge>}
          {!resident.isHeir && resident.isFounder && <Badge variant="neutral">Founder</Badge>}
        </div>
        <span className={styles.rowMeta}>
          {LIFE_STAGE_LABELS[resident.lifeStage] ?? resident.lifeStage}
          {resident.generationNumber !== null && <> · Gen {roman(resident.generationNumber)}</>}
        </span>
      </div>
      <Combobox
        variant="chip"
        value=""
        onChange={(v) => onMoveTo(v === '__unhoused__' ? null : v)}
        placeholder="Move to…"
        aria-label={`Move ${resident.firstName} to`}
      >
        {others.map((o) => (
          <Combobox.Item key={o.id} value={o.id} textValue={o.name}>
            <span className={styles.optionRow}>
              <HouseIcon size={12} />
              <span className={styles.optionLabel}>{o.name}</span>
              <span className={styles.optionMeta}>
                {o.residents.length} {o.residents.length === 1 ? 'sim' : 'sims'}
              </span>
            </span>
          </Combobox.Item>
        ))}
        <Combobox.Item value="__unhoused__" textValue="Unhoused">
          Unhoused
        </Combobox.Item>
      </Combobox>
    </div>
  )
}
```

- [ ] **Step 5: Create the drawer**

Create `src/app/app/legacies/[slug]/_components/households/household-drawer.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { trpc } from '@/trpc/client'
import {
  Button,
  Combobox,
  Drawer,
  EditableHeading,
  EditableStat,
  EditableText,
  EmptyState,
  HouseIcon,
  PortraitAvatar,
} from '@/components/ui'
import { Plumbob } from '@/components/plumbob'
import { roman } from '@/lib/legacy-format'
import type { HouseholdView, HouseholdSim, WorldOption } from '../../lib/types'
import { worldOptions, lotOptions } from './lib'
import { NowPlayingPill } from './featured-household'
import { ResidentRow } from './resident-row'
import styles from './household-drawer.module.css'

export interface HouseholdDrawerProps {
  household: HouseholdView
  households: HouseholdView[]
  worlds: WorldOption[]
  /** Every sim in the legacy — the move-in select offers the ones elsewhere. */
  sims: HouseholdSim[]
  /** Open with the name in edit mode (right after founding). */
  autoRename: boolean
  onClose: () => void
}

/**
 * Right-side management drawer (G° ceremonial, no crest): inline-editable
 * identity on a parchment header; stats, residents, and move controls on the
 * card-surface body. Every mutation is a tRPC call + router.refresh() — the
 * drawer re-reads its household from refreshed props by id (the section
 * resolves that), so server data stays the single source of truth.
 */
export function HouseholdDrawer({
  household: h,
  households,
  worlds,
  sims,
  autoRename,
  onClose,
}: HouseholdDrawerProps) {
  const router = useRouter()
  const update = trpc.households.update.useMutation()
  const setActive = trpc.households.setActive.useMutation()
  const moveSim = trpc.households.moveSim.useMutation()
  const [error, setError] = useState('')

  const others = households.filter((x) => x.id !== h.id)
  const movableIn = sims.filter((s) => s.householdId !== h.id)
  const worldChoices = worldOptions(worlds, { worldId: h.worldId, worldName: h.worldName })
  const currentWorld = worldChoices.find((w) => w.id === h.worldId)

  async function run(action: () => Promise<unknown>) {
    setError('')
    try {
      await action()
      router.refresh()
    } catch {
      setError("Couldn't save that change. Please try again.")
    }
  }

  return (
    <Drawer open onOpenChange={(open) => { if (!open) onClose() }}>
      <Drawer.Portal>
        <Drawer.Overlay />
        <Drawer.Content side="right" className={styles.content} aria-describedby={undefined}>
          <header className={styles.header}>
            <div className={styles.headerTop}>
              {h.isActive ? (
                <NowPlayingPill />
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void run(() => setActive.mutateAsync({ householdId: h.id }))}
                >
                  Set as active
                </Button>
              )}
              <Drawer.Close asChild>
                <Button type="button" variant="ghost" size="sm" className={styles.close} aria-label="Close">
                  ✕
                </Button>
              </Drawer.Close>
            </div>

            <Drawer.Title asChild>
              <div className={styles.nameWrap}>
                <EditableHeading
                  value={h.name}
                  autoEdit={autoRename}
                  aria-label="Household name"
                  onCommit={(name) => void run(() => update.mutateAsync({ householdId: h.id, name }))}
                />
              </div>
            </Drawer.Title>

            <div className={styles.lotRow}>
              <HouseIcon size={13} />
              <Combobox
                variant="inline"
                value={h.worldId ?? ''}
                onChange={(worldId) => {
                  const next = worldChoices.find((w) => w.id === worldId)
                  void run(() =>
                    update.mutateAsync({
                      householdId: h.id,
                      worldId,
                      lot: next?.lots[0] ?? h.lot,
                    }),
                  )
                }}
                placeholder={h.worldName ?? 'Choose a world'}
                aria-label="World"
              >
                {worldChoices.map((w) => (
                  <Combobox.Item key={w.id} value={w.id}>
                    {w.name}
                  </Combobox.Item>
                ))}
              </Combobox>
              <span className={styles.lotDot} aria-hidden="true">·</span>
              <Combobox
                variant="inline"
                value={h.lot ?? ''}
                onChange={(lot) => void run(() => update.mutateAsync({ householdId: h.id, lot }))}
                placeholder={h.lot ?? 'Choose a lot'}
                aria-label="Lot"
              >
                {lotOptions(currentWorld, h.lot).map((l) => (
                  <Combobox.Item key={l} value={l}>
                    {l}
                  </Combobox.Item>
                ))}
              </Combobox>
            </div>

            <div className={styles.descriptionWrap}>
              <EditableText
                multiline
                value={h.description ?? ''}
                placeholder="Add a note about this household…"
                aria-label="Household description"
                className={styles.description}
                onCommit={(description) =>
                  void run(() =>
                    update.mutateAsync({ householdId: h.id, description: description || null }),
                  )
                }
              />
            </div>
          </header>

          <div className={styles.body}>
            <div className={styles.stats}>
              <EditableStat
                value={h.funds}
                label="Funds"
                green
                onCommit={(funds) => void run(() => update.mutateAsync({ householdId: h.id, funds }))}
              />
              <EditableStat
                value={h.lotValue}
                label="Lot value"
                onCommit={(lotValue) =>
                  void run(() => update.mutateAsync({ householdId: h.id, lotValue }))
                }
              />
              {h.foundedGeneration !== null && (
                <div className={styles.foundedStat}>
                  <span className={styles.foundedValue}>Gen {roman(h.foundedGeneration)}</span>
                  <span className={styles.foundedLabel}>Founded</span>
                </div>
              )}
            </div>

            <div className={styles.gemDivider} aria-hidden="true">
              <div className={styles.gemDividerLine} />
              <Plumbob size={9} />
              <div className={styles.gemDividerLine} />
            </div>

            <div className={styles.residentsLabel}>
              Residents <span className={styles.residentsCount}>{h.residents.length}</span>
            </div>

            {h.residents.length === 0 ? (
              <div className={styles.emptyLot}>
                <EmptyState>This lot is empty — bring a sim in to begin.</EmptyState>
              </div>
            ) : (
              <div className={styles.residentsList}>
                {h.residents.map((r) => (
                  <ResidentRow
                    key={r.id}
                    resident={r}
                    others={others}
                    onMoveTo={(toHouseholdId) =>
                      void run(() => moveSim.mutateAsync({ simId: r.id, toHouseholdId }))
                    }
                  />
                ))}
              </div>
            )}

            <div className={styles.moveInWrap}>
              <Combobox
                variant="ghost"
                value=""
                onChange={(simId) =>
                  void run(() => moveSim.mutateAsync({ simId, toHouseholdId: h.id }))
                }
                placeholder="Move a sim in"
                aria-label="Move a sim in"
              >
                {others
                  .filter((o) => o.residents.length > 0)
                  .map((o) => (
                    <Combobox.Section key={o.id} heading={o.name}>
                      {o.residents.map((s) => (
                        <Combobox.Item key={s.id} value={s.id} textValue={`${s.firstName} ${s.lastName}`}>
                          <span className={styles.optionRow}>
                            <PortraitAvatar
                              imageUrl={s.imageUrl}
                              firstName={s.firstName}
                              lastName={s.lastName}
                              size={24}
                            />
                            <span className={styles.optionLabel}>
                              {s.firstName} {s.lastName}
                            </span>
                          </span>
                        </Combobox.Item>
                      ))}
                    </Combobox.Section>
                  ))}
                {movableIn.some((s) => s.householdId === null) && (
                  <Combobox.Section heading="Unhoused">
                    {movableIn
                      .filter((s) => s.householdId === null)
                      .map((s) => (
                        <Combobox.Item key={s.id} value={s.id} textValue={`${s.firstName} ${s.lastName}`}>
                          <span className={styles.optionRow}>
                            <PortraitAvatar
                              imageUrl={s.imageUrl}
                              firstName={s.firstName}
                              lastName={s.lastName}
                              size={24}
                            />
                            <span className={styles.optionLabel}>
                              {s.firstName} {s.lastName}
                            </span>
                          </span>
                        </Combobox.Item>
                      ))}
                  </Combobox.Section>
                )}
              </Combobox>
            </div>

            {error && <p className={styles.error} role="alert">{error}</p>}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer>
  )
}
```

(The ghost add-row's "+" affordance: the Combobox trigger renders a text placeholder, so the row reads "Move a sim in" with the dashed ghost styling carrying the affordance — no plus icon inside the trigger.)

- [ ] **Step 6: Run the tests**

Run: `npm test -- household-drawer`
Expected: PASS. (The drawer mounts into the section in Task 13.)

- [ ] **Step 7: Validate and commit**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

```bash
git add "src/app/app/legacies/[slug]/_components/households"
git commit -m "feat(chronicle): household management drawer with inline edits and sim moves"
```

---

### Task 13: Households section — stateful shell wiring cards, dialog, drawer

**Files:**
- Create: `src/app/app/legacies/[slug]/_components/households/households-section.tsx`
- Create: `src/app/app/legacies/[slug]/_components/households/households-section.module.css`
- Create: `src/app/app/legacies/[slug]/_components/households/__tests__/households-section.test.tsx`

- [ ] **Step 1: Write the failing section tests**

Create `src/app/app/legacies/[slug]/_components/households/__tests__/households-section.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { HouseholdView, HouseholdSim, WorldOption } from '../../../lib/types'

const mutations = {
  create: vi.fn().mockResolvedValue({ id: 'new-h' }),
  update: vi.fn().mockResolvedValue({}),
  setActive: vi.fn().mockResolvedValue({}),
  moveSim: vi.fn().mockResolvedValue({}),
}
vi.mock('@/trpc/client', () => ({
  trpc: {
    households: {
      create: { useMutation: () => ({ mutateAsync: mutations.create, isPending: false }) },
      update: { useMutation: () => ({ mutateAsync: mutations.update, isPending: false }) },
      setActive: { useMutation: () => ({ mutateAsync: mutations.setActive, isPending: false }) },
      moveSim: { useMutation: () => ({ mutateAsync: mutations.moveSim, isPending: false }) },
    },
  },
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('next/image', () => ({
  default: (props: { alt?: string }) => <span aria-label={props.alt} />,
}))

import { HouseholdsSection } from '../households-section'

function sim(over: Partial<HouseholdSim> & { id: string; firstName: string }): HouseholdSim {
  return {
    lastName: 'Caliente',
    imageUrl: null,
    isHeir: false,
    isFounder: false,
    generationNumber: 1,
    lifeStage: 'YOUNG_ADULT',
    householdId: null,
    ...over,
  }
}

function household(over: Partial<HouseholdView> & { id: string; name: string }): HouseholdView {
  return {
    worldId: null,
    worldName: null,
    lot: null,
    description: null,
    funds: 0,
    lotValue: 0,
    foundedGeneration: 1,
    isActive: false,
    residents: [],
    ...over,
  }
}

const WORLDS: WorldOption[] = [{ id: 'w1', name: 'Willow Creek', lots: ['1 Goth Hill'] }]

const baseProps = {
  legacyId: 'legacy-1',
  worlds: WORLDS,
  sims: [] as HouseholdSim[],
}

describe('HouseholdsSection', () => {
  it('renders the featured card for the active household and compact cards for the rest', () => {
    const dina = sim({ id: 's1', firstName: 'Dina', householdId: 'h1' })
    render(
      <HouseholdsSection
        {...baseProps}
        sims={[dina]}
        households={[
          household({
            id: 'h1',
            name: 'Caliente Villa',
            isActive: true,
            funds: 184250,
            worldName: 'Willow Creek',
            lot: '165 Sim Lane',
            description: 'The seat of the legacy.',
            residents: [dina],
          }),
          household({ id: 'h2', name: 'Goth Manor', funds: 92400 }),
        ]}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Households' })).toBeInTheDocument()
    expect(screen.getByText('Now playing')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Caliente Villa' })).toBeInTheDocument()
    expect(screen.getByText('§184,250')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Goth Manor' })).toBeInTheDocument()
    expect(screen.getByText('Empty lot')).toBeInTheDocument()
  })

  it('renders every household in the grid when none is active', () => {
    render(
      <HouseholdsSection
        {...baseProps}
        households={[
          household({ id: 'h1', name: 'Goth Manor' }),
          household({ id: 'h2', name: 'Zest Bungalow' }),
        ]}
      />,
    )
    expect(screen.queryByText('Now playing')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Goth Manor' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Zest Bungalow' })).toBeInTheDocument()
  })

  it('shows the empty state with a founding CTA and hides the header button', () => {
    render(<HouseholdsSection {...baseProps} households={[]} />)
    expect(screen.getByText('No households yet')).toBeInTheDocument()
    const foundButtons = screen.getAllByRole('button', { name: /Found a household/i })
    expect(foundButtons).toHaveLength(1) // only the CTA, no header button
  })

  it('opens the founding dialog from the header button', async () => {
    const user = userEvent.setup()
    render(
      <HouseholdsSection {...baseProps} households={[household({ id: 'h1', name: 'Goth Manor' })]} />,
    )
    await user.click(screen.getByRole('button', { name: /Found a household/i }))
    expect(screen.getByPlaceholderText('Name your household')).toBeInTheDocument()
  })

  it('opens the management drawer from a compact card', async () => {
    const user = userEvent.setup()
    render(
      <HouseholdsSection {...baseProps} households={[household({ id: 'h1', name: 'Goth Manor' })]} />,
    )
    await user.click(screen.getByRole('button', { name: /Goth Manor/ }))
    expect(screen.getByRole('button', { name: 'Set as active' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- households-section`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the section styles**

Create `src/app/app/legacies/[slug]/_components/households/households-section.module.css`:

```css
.topRow {
  display: flex;
  align-items: flex-end;
  gap: 16px;
  margin-bottom: 24px;
}

.headingWrapper {
  flex: 1;
  min-width: 0;
}

.foundButton {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 7px;
}

.featuredWrap {
  margin-bottom: 18px;
}

.grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fit, minmax(330px, 1fr));
}
```

- [ ] **Step 4: Create the section component**

Create `src/app/app/legacies/[slug]/_components/households/households-section.tsx`:

```tsx
'use client'

import { useMemo, useState } from 'react'
import {
  Button,
  EmptyState,
  SectionHeading,
  HouseIcon,
  PlusIcon,
  ArrowRightIcon,
} from '@/components/ui'
import type { HouseholdView, HouseholdSim, WorldOption } from '../../lib/types'
import { FeaturedHousehold } from './featured-household'
import { HouseholdCard } from './household-card'
import { FoundHouseholdDialog } from './found-household-dialog'
import { HouseholdDrawer } from './household-drawer'
import styles from './households-section.module.css'

export interface HouseholdsSectionProps {
  legacyId: string
  households: HouseholdView[]
  worlds: WorldOption[]
  /** Every sim in the legacy (housed + unhoused) for the move/founding pickers. */
  sims: HouseholdSim[]
}

/**
 * The Households chronicle section: one featured "now playing" card plus a
 * grid of compact cards. Owns the founding-dialog and management-drawer open
 * state; all data arrives from the server page and every mutation ends in
 * router.refresh() (handled inside the dialog/drawer). The open drawer
 * re-reads its household from refreshed props by id, so it stays consistent
 * and unmounts automatically if the household disappears.
 */
export function HouseholdsSection({ legacyId, households, worlds, sims }: HouseholdsSectionProps) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [foundedId, setFoundedId] = useState<string | null>(null)
  const [founding, setFounding] = useState(false)

  const featured = households.find((h) => h.isActive) ?? null
  const rest = households.filter((h) => h.id !== featured?.id)
  const openHousehold = households.find((h) => h.id === openId) ?? null

  const homeNames = useMemo(
    () => Object.fromEntries(households.map((h) => [h.id, h.name])),
    [households],
  )

  function handleFounded(id: string) {
    setFounding(false)
    setFoundedId(id)
    setOpenId(id)
  }

  return (
    <div>
      <div className={styles.topRow}>
        <div className={styles.headingWrapper}>
          <SectionHeading
            eyebrow="Where they live"
            title="Households"
            blurb="Every roof the legacy keeps — and who lives under it."
          />
        </div>
        {households.length > 0 && (
          <Button type="button" className={styles.foundButton} onClick={() => setFounding(true)}>
            <PlusIcon size={15} /> Found a household
          </Button>
        )}
      </div>

      {households.length === 0 ? (
        <EmptyState
          icon={<HouseIcon size={24} />}
          title="No households yet"
          action={
            <Button type="button" size="sm" onClick={() => setFounding(true)}>
              Found a household <ArrowRightIcon size={16} />
            </Button>
          }
        >
          Every legacy keeps a roof over someone&apos;s head. Found the first
          household and move your sims in.
        </EmptyState>
      ) : (
        <>
          {featured && (
            <div className={styles.featuredWrap}>
              <FeaturedHousehold household={featured} onManage={() => setOpenId(featured.id)} />
            </div>
          )}
          <div className={styles.grid}>
            {rest.map((h) => (
              <HouseholdCard key={h.id} household={h} onManage={() => setOpenId(h.id)} />
            ))}
          </div>
        </>
      )}

      {founding && (
        <FoundHouseholdDialog
          legacyId={legacyId}
          worlds={worlds}
          sims={sims}
          homeNames={homeNames}
          onClose={() => setFounding(false)}
          onFounded={handleFounded}
        />
      )}

      {openHousehold && (
        <HouseholdDrawer
          household={openHousehold}
          households={households}
          worlds={worlds}
          sims={sims}
          autoRename={openHousehold.id === foundedId}
          onClose={() => {
            setOpenId(null)
            setFoundedId(null)
          }}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 5: Run the tests**

Run: `npm test -- households-section`
Expected: PASS (all five).

- [ ] **Step 6: Validate and commit**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

```bash
git add "src/app/app/legacies/[slug]/_components/households"
git commit -m "feat(chronicle): households section wiring cards, founding dialog, drawer"
```

---

### Task 14: Page wiring — fetch, section slot, nav entry

**Files:**
- Modify: `src/app/app/legacies/[slug]/page.tsx`
- Modify: `src/app/app/legacies/[slug]/_components/chronicle-sections/chronicle-sections.tsx`
- Modify: `src/app/app/legacies/[slug]/_components/chronicle-sections/chronicle-sections.module.css` (only if a `householdsSection` class is needed — reuse `.cardSection`)

- [ ] **Step 1: Extend the page query and derive household views**

In `src/app/app/legacies/[slug]/page.tsx`:

1. Replace `households: { select: { id: true } },` in the legacy select with:

```ts
      activeHouseholdId: true,
      households: {
        select: {
          id: true,
          name: true,
          worldId: true,
          lot: true,
          description: true,
          funds: true,
          lotValue: true,
          foundedGeneration: true,
          world: { select: { name: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
```

2. Add `householdId: true,` to the `sims` select (after `causeOfDeath: true,`).

3. After the `userMilestones` query, fetch the pack-filtered worlds:

```ts
  // Worlds for the household selects — base-game worlds (no pack) plus worlds
  // whose pack the user owns. A household's current world is merged back in
  // client-side (preserve-current rule).
  const ownedPacks = await db.userPack.findMany({
    where: { userId: session.user.id },
    select: { packId: true },
  })
  const worldRows = await db.world.findMany({
    where: {
      OR: [{ packId: null }, { packId: { in: ownedPacks.map((p) => p.packId) } }],
    },
    select: { id: true, name: true, lots: { select: { name: true }, orderBy: { name: 'asc' } } },
    orderBy: { name: 'asc' },
  })
  const worlds: WorldOption[] = worldRows.map((w) => ({
    id: w.id,
    name: w.name,
    lots: w.lots.map((l) => l.name),
  }))
```

4. The `fetched: FetchedLegacy` assignment keeps compiling because `FetchedHousehold` was widened in Task 9 and the select now matches it. Build the household views after `const founder = ...`:

```ts
  const householdSims: HouseholdSim[] = legacy.sims.map((s) => ({
    id: s.id,
    firstName: s.firstName,
    lastName: s.lastName,
    imageUrl: s.imageUrl,
    isHeir: s.isHeir,
    isFounder: s.id === legacy.founderSimId,
    generationNumber: s.generationNumber,
    lifeStage: s.lifeStage,
    householdId: s.householdId,
  }))
  const householdViews: HouseholdView[] = legacy.households.map((h) => ({
    id: h.id,
    name: h.name,
    worldId: h.worldId,
    worldName: h.world?.name ?? null,
    lot: h.lot,
    description: h.description,
    funds: h.funds,
    lotValue: h.lotValue,
    foundedGeneration: h.foundedGeneration,
    isActive: h.id === legacy.activeHouseholdId,
    residents: householdSims.filter((s) => s.householdId === h.id),
  }))
```

5. Import the types at the top:

```ts
import type { FetchedLegacy, HouseholdSim, HouseholdView, WorldOption } from './lib/types'
```

6. Add the nav item (order matters — between Succession and Milestones):

```ts
const NAV_ITEMS = [
  { id: 'hero', label: 'Chronicle' },
  { id: 'succession', label: 'Succession' },
  { id: 'households', label: 'Households' },
  { id: 'milestones', label: 'Milestones' },
  { id: 'sims', label: 'Family' },
]
```

7. Pass the new props to `ChronicleSections`:

```tsx
        households={householdViews}
        worlds={worlds}
        householdSims={householdSims}
```

- [ ] **Step 2: Slot the section into ChronicleSections**

In `chronicle-sections.tsx`:

1. Add to the imports:

```tsx
import type { HouseholdSim, HouseholdView, WorldOption } from '../../lib/types'
import { HouseholdsSection } from '../households/households-section'
```

2. Add to `ChronicleSectionsProps` and the destructure:

```ts
  households: HouseholdView[]
  worlds: WorldOption[]
  householdSims: HouseholdSim[]
```

3. Between the succession `</section>` and the milestones `<section>`, insert:

```tsx
      <section
        id="households"
        data-section="households"
        data-testid="households"
        aria-label="Households"
        className={styles.cardSection}
      >
        <div className={styles.inner}>
          <HouseholdsSection
            legacyId={legacyId}
            households={households}
            worlds={worlds}
            sims={householdSims}
          />
        </div>
      </section>
```

- [ ] **Step 3: Update any chronicle-section tests' props**

If `chronicle-sections` or page-level tests construct `ChronicleSectionsProps`, add the three new props (`households: []`, `worlds: []`, `householdSims: []`) to their fixtures.

Run: `npm test`
Expected: PASS across the suite.

- [ ] **Step 4: See it work**

Run the dev server (`npm run dev`), sign in via the magic-link flow (AGENTS.md), open a legacy, and verify: Households appears in the left nav between Succession and Milestones; the empty state shows for a legacy without households; founding opens the ceremonial dialog; the new household opens in the drawer with the name primed; inline edits, set-active, and sim moves persist across reloads. Verify the drawer's inline/ghost combobox variants render as dashed affordances (Task 7 note).

- [ ] **Step 5: Validate and commit**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

```bash
git add "src/app/app/legacies/[slug]/page.tsx" "src/app/app/legacies/[slug]/_components/chronicle-sections/chronicle-sections.tsx"
git commit -m "feat(chronicle): wire households section into the legacy page"
```

(Also stage any test fixture files updated in Step 3 — list them explicitly.)

---

### Task 15: Sim form — household picker and founder checkbox

**Files:**
- Modify: `src/app/components/sim-form.tsx`
- Modify: `src/app/components/sim-form.module.css`
- Modify: `src/app/components/__tests__/sim-form.test.tsx`
- Modify: `src/app/app/legacies/new/legacy-wizard.tsx`
- Modify: `src/app/app/legacies/[slug]/sims/new/page.tsx`
- Modify: `src/app/app/legacies/[slug]/sims/new/add-sim-client.tsx`
- Modify: `src/app/components/create-sim-modal.tsx`

- [ ] **Step 1: Write the failing form tests**

In `src/app/components/__tests__/sim-form.test.tsx`, following the file's existing render helpers/mocks, add:

```tsx
  it('shows the household picker when households are provided and submits the choice', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderForm({
      onSubmit,
      households: [{ id: 'h1', name: 'Goth Manor' }],
    })

    await user.type(screen.getByPlaceholderText('First name'), 'Bella')
    await user.type(screen.getByPlaceholderText('Last name'), 'Goth')
    await user.click(screen.getByLabelText('Gender'))
    await user.click(await screen.findByRole('option', { name: 'Female' }))
    await user.click(screen.getByLabelText('Household'))
    await user.click(await screen.findByRole('option', { name: 'Goth Manor' }))
    await user.click(screen.getByRole('button', { name: /Save|Add sim|Create/i }))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ householdId: 'h1' }))
  })

  it('hides the household picker when no households are provided', () => {
    renderForm({})
    expect(screen.queryByLabelText('Household')).not.toBeInTheDocument()
  })

  it('offers the found-household checkbox with a live name preview, checked by default', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderForm({ onSubmit, offerFoundHousehold: true })

    const checkbox = screen.getByRole('checkbox', { name: /Settle them into a household/i })
    expect(checkbox).toBeChecked()

    await user.type(screen.getByPlaceholderText('Last name'), 'Caliente')
    expect(screen.getByText(/The Caliente Household/)).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('First name'), 'Dina')
    await user.click(screen.getByLabelText('Gender'))
    await user.click(await screen.findByRole('option', { name: 'Female' }))
    await user.click(screen.getByRole('button', { name: /Save|Add sim|Create/i }))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ foundHousehold: true }))
  })
```

(Adapt `renderForm` to the file's actual helper — pass the new props through to `SimForm` alongside the existing required `traits`/`aspirations`/`careers`/`onSubmit`.)

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- sim-form`
Expected: the three new tests FAIL.

- [ ] **Step 3: Implement in `SimForm`**

In `src/app/components/sim-form.tsx`:

1. Extend `SimFormData`:

```ts
  householdId?: string
  foundHousehold?: boolean
```

2. Extend `SimFormProps`:

```ts
  /** When provided (non-empty), an optional Household picker is shown. */
  households?: { id: string; name: string }[]
  /** Wizard founder context: offer the "settle into a household" checkbox. */
  offerFoundHousehold?: boolean
```

3. Extend the Zod schema (after `occultType`):

```ts
  householdId: emptyToUndefined.optional(),
  foundHousehold: z.boolean().optional(),
```

4. Destructure the new props in the component signature (`households, offerFoundHousehold`), and extend `defaultValues`:

```ts
      householdId: defaultValues?.householdId ?? '',
      foundHousehold: offerFoundHousehold ? true : undefined,
```

5. Get `watch` from the `useForm` return (add to the destructure) and below it:

```ts
  const lastName = watch('lastName')
```

6. After the occult-type block (still inside the Identity section), add the picker:

```tsx
            {households && households.length > 0 && (
              <div className={styles.pronounRow}>
                <div className={styles.halfCol}>
                  <Controller
                    control={control}
                    name="householdId"
                    render={({ field }) => (
                      <FormField label="Household" htmlFor="household">
                        <Combobox
                          id="household"
                          value={field.value ?? ''}
                          onChange={field.onChange}
                          placeholder="No household"
                        >
                          <Combobox.Item value="">No household</Combobox.Item>
                          {households.map((h) => (
                            <Combobox.Item key={h.id} value={h.id}>
                              {h.name}
                            </Combobox.Item>
                          ))}
                        </Combobox>
                      </FormField>
                    )}
                  />
                </div>
              </div>
            )}

            {offerFoundHousehold && (
              <label className={styles.foundHousehold}>
                <input type="checkbox" {...register('foundHousehold')} />
                <span>
                  <span className={styles.foundHouseholdTitle}>Settle them into a household</span>
                  <span className={styles.foundHouseholdHint}>
                    We&apos;ll found{' '}
                    {lastName.trim()
                      ? `“The ${lastName.trim()} Household”`
                      : 'their first household'}{' '}
                    with them as its first resident. You can rename it anytime.
                  </span>
                </span>
              </label>
            )}
```

7. In `src/app/components/sim-form.module.css`, append:

```css
.foundHousehold {
  grid-column: 1 / -1;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  background: var(--green-glow);
  border: 1px solid var(--border);
  border-radius: var(--radius-base);
  cursor: pointer;
}

.foundHousehold input {
  accent-color: var(--green);
  margin-top: 2px;
}

.foundHouseholdTitle {
  display: block;
  font-weight: 600;
  font-size: 13.5px;
  color: var(--text);
}

.foundHouseholdHint {
  display: block;
  margin-top: 2px;
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.45;
}
```

- [ ] **Step 4: Wire the call sites**

1. `src/app/app/legacies/new/legacy-wizard.tsx` — add `offerFoundHousehold` to the step-2 `<SimForm ...>`. The `submit(founder)` already spreads the form data into `legacies.create`'s `founder` input, so `foundHousehold` flows through (Task 6 accepts it).

2. `src/app/app/legacies/[slug]/sims/new/page.tsx` — fetch and pass households:

```ts
  const households = await db.household.findMany({
    where: { legacyId: legacy.id },
    select: { id: true, name: true },
    orderBy: { createdAt: 'asc' },
  })
```

and add `households={households}` to `<AddSimClient ...>`.

3. `src/app/app/legacies/[slug]/sims/new/add-sim-client.tsx` — add to props:

```ts
  households: { id: string; name: string }[]
```

destructure it, and pass `households={households}` to `<SimForm ...>`. (`handleSubmit` already spreads `data`, so `householdId` reaches `sims.create`.)

4. `src/app/components/create-sim-modal.tsx` — add the query and pass-through:

```ts
  const householdsQuery = trpc.households.listByLegacy.useQuery({ legacyId })
```

include it in `isLoading` (`|| householdsQuery.isLoading`) and pass `households={householdsQuery.data ?? []}` to `<SimForm ...>`.

- [ ] **Step 5: Run the tests**

Run: `npm test -- sim-form`
Expected: PASS.

- [ ] **Step 6: Validate and commit**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: clean, full suite green.

```bash
git add src/app/components/sim-form.tsx src/app/components/sim-form.module.css src/app/components/__tests__/sim-form.test.tsx src/app/app/legacies/new/legacy-wizard.tsx "src/app/app/legacies/[slug]/sims/new/page.tsx" "src/app/app/legacies/[slug]/sims/new/add-sim-client.tsx" src/app/components/create-sim-modal.tsx
git commit -m "feat(sims): household picker and founder found-a-household checkbox"
```

---

### Task 16: E2E journey

**Files:**
- Create: `e2e/households.spec.ts`

One journey covering the user story end-to-end (testing guideline: journeys, not widget edge cases).

- [ ] **Step 1: Write the journey**

Create `e2e/households.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

test('household management journey: found, manage, move, set active', async ({ page }) => {
  // Arrange — a legacy whose founder settles into an auto-founded household
  await page.goto('/app/legacies/new')
  const legacyName = `Household Journey ${Date.now()}`
  await page.getByPlaceholder('e.g. The Caliente Legacy').fill(legacyName)
  await page.getByRole('button', { name: 'Continue →' }).click()

  await page.getByPlaceholder('First name').fill('Dina')
  await page.getByPlaceholder('Last name').fill('Caliente')
  await page.getByLabel('Gender').click()
  await page.getByRole('option', { name: 'Female' }).click()
  await expect(
    page.getByRole('checkbox', { name: /Settle them into a household/i }),
  ).toBeChecked()
  await page.getByRole('button', { name: 'Create legacy →' }).click()
  await expect(page).toHaveURL(/\/app\/legacies\/[^/]+$/)

  const households = page.getByTestId('households')

  await test.step('founder checkbox created the active household', async () => {
    await expect(households.getByText('Now playing')).toBeVisible()
    await expect(
      households.getByRole('heading', { name: 'The Caliente Household' }),
    ).toBeVisible()
  })

  await test.step('rename the household in the management drawer', async () => {
    await households.getByRole('button', { name: /Manage household/i }).click()
    await page.getByRole('button', { name: 'The Caliente Household' }).click()
    const nameInput = page.getByRole('textbox', { name: 'Household name' })
    await nameInput.fill('Caliente Villa')
    await nameInput.press('Enter')
    await page.getByRole('button', { name: 'Close' }).click()
    await expect(households.getByRole('heading', { name: 'Caliente Villa' })).toBeVisible()
  })

  await test.step('found a second household, moving the founder in', async () => {
    await households.getByRole('button', { name: /Found a household/i }).click()
    await page.getByPlaceholder('Name your household').fill('Goth Manor')
    await page.getByRole('button', { name: /Dina Caliente — Caliente Villa/i }).click()
    await page.getByRole('button', { name: /Found the household/i }).click()

    // Founding opens the new household's drawer with Dina now resident
    await expect(page.getByText('Dina Caliente')).toBeVisible()
    await page.getByRole('button', { name: 'Close' }).click()
    await expect(households.getByRole('heading', { name: 'Goth Manor' })).toBeVisible()
  })

  await test.step('set the new household active — the featured card swaps', async () => {
    // The compact card's accessible name concatenates its contents, so match by substring.
    await households.getByRole('button', { name: /Goth Manor/ }).click()
    await page.getByRole('button', { name: 'Set as active' }).click()
    await page.getByRole('button', { name: 'Close' }).click()

    await expect(households.getByText('Now playing')).toBeVisible()
    // The featured card now carries Goth Manor; Caliente Villa is in the grid
    await expect(
      households.getByRole('button', { name: /Manage household/i }),
    ).toBeVisible()
    await expect(households.getByRole('heading', { name: 'Goth Manor' })).toBeVisible()
  })

  await test.step('move the founder back out to unhoused', async () => {
    await households.getByRole('button', { name: /Manage household/i }).click()
    await page.getByRole('button', { name: 'Move Dina to' }).click()
    await page.getByRole('option', { name: 'Unhoused' }).click()
    await expect(page.getByText(/This lot is empty/i)).toBeVisible()
  })
})
```

(Locator notes: the drawer close button has `aria-label="Close"`; the founding picker buttons have `aria-label` "`<name> — <home>`"; the resident move chip has `aria-label` "Move `<firstName>` to". If a locator is ambiguous in practice, scope through `getByTestId('households')` or add a `data-testid` — per the project's Playwright guideline.)

- [ ] **Step 2: Run it**

Run: `npm run test:e2e -- households`
Expected: PASS. Iterate on locators if the run surfaces mismatches — fix the locator or add a `data-testid`, never sleep-and-retry.

- [ ] **Step 3: Commit**

```bash
git add e2e/households.spec.ts
git commit -m "test(e2e): household founding and management journey"
```

---

### Task 17: Final validation sweep

- [ ] **Step 1: Full validation**

Run, in order:

```bash
npx tsc --noEmit
npm run lint
npm test
npm run test:e2e
```

Expected: all clean/green. Fix anything that isn't before proceeding (AGENTS.md: all tests must pass before the work is considered done).

- [ ] **Step 2: Visual pass against the prototype**

With the dev server running, compare side-by-side with `/tmp/design-legacy/simtrack-legacy-redesign/project/Legacy Page.html` opened in a browser: featured card proportions, "Now playing" pill, compact card density, drawer header/body surfaces (parchment/card — no white pile-up), gem dividers, dashed inline-edit affordances, founding modal layout. Check dark mode (Forest Night) — greens stay interactive-only, amber only on heir/founded accents.

- [ ] **Step 3: Wrap up**

Use the `superpowers:finishing-a-development-branch` skill to decide merge/PR handling (the branch merges into master; remember the seed.ts merge caution from the preamble).

---

## Self-review notes (already applied)

- Spec coverage: data model → Tasks 1–2; router → Task 4; sims/legacies changes → Tasks 5–6; primitives → Tasks 7–8; types/helpers → Task 9; cards/dialog/drawer/section → Tasks 10–13; page wiring + nav → Task 14; sim form + wizard + modal → Task 15; e2e → Task 16. Out-of-scope items (deletion, roles, gen filter, lot type) have no tasks — intentional.
- The prototype's `lotType` field is dropped (spec: out of scope).
- "Founded" stat hides when `foundedGeneration` is null (pre-existing households) in both the featured rail and the drawer.
- Badges: Heir (warning) from `isHeir`; Founder (neutral) from `founderSimId`; nothing else — matches the spec's "derived only" decision.
```
