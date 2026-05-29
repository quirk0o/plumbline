# Add Sims to Legacy — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users see and add sims on the legacy detail page, backed by a direct `legacyId` field on the `Sim` model.

**Architecture:** Add `legacyId String` (non-nullable, cascade-delete) to `Sim` so every sim is directly owned by a legacy — no traversal through households required. Update both `sims.create` and the `legacies.create` founder path to store it. Replace the "Sim tracking coming soon" placeholder on the legacy detail page with a flat list of sim name cards and an "Add sim" link. The schema migration will break existing integration tests; fixing the two mutators restores them — no new integration tests are needed for these simple field additions. E2E tests cover the user-visible flow.

**Tech Stack:** Prisma (schema + migration), tRPC (server procedures), Next.js 16 server components, CSS Modules, Vitest (integration tests), Playwright (E2E tests).

---

## File Map

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `legacyId String` + `legacy Legacy @relation("LegacyMember")` to `Sim`; add `sims Sim[] @relation("LegacyMember")` to `Legacy` |
| `src/server/routers/sims.ts` | Pass `legacyId: input.legacyId` into `ctx.db.sim.create` |
| `src/server/routers/legacies.ts` | Pass `legacyId: legacy.id` into `tx.sim.create` in the founder path |
| `src/app/app/legacies/[slug]/page.tsx` | Extend query to include `sims`; replace placeholder with sim list + Add sim link |
| `src/app/app/legacies/[slug]/page.module.css` | Add `.addSimLink`, `.simList`, `.simCard`, `.simName`, `.emptyAction` |
| `e2e/add-sims-to-legacy.spec.ts` | New: E2E tests for the sims section |

---

## Task 1: Schema — add `legacyId` to `Sim`

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Edit the Sim model**

In `prisma/schema.prisma`, add `legacyId` and its relation to the `Sim` model. The existing `foundedLegacy` relation uses the name `"LegacyFounder"` — use `"LegacyMember"` for this new relation to avoid Prisma ambiguity errors.

Find the `Sim` model block and add these two lines after the existing `household` relation line:

```prisma
  legacyId             String
  legacy               Legacy                @relation("LegacyMember", fields: [legacyId], references: [id], onDelete: Cascade)
```

- [ ] **Step 2: Edit the Legacy model**

In the `Legacy` model block, add `sims` after the existing `households` line:

```prisma
  sims       Sim[]       @relation("LegacyMember")
```

- [ ] **Step 3: Create the migration and reset the database**

`legacyId` is non-nullable, so existing rows would violate the constraint. Run `migrate dev` to generate the migration file — Prisma will detect the breaking change and offer to reset the database:

```bash
npx prisma migrate dev --name add-sim-legacy-id
```

When Prisma prompts `We need to reset the PostgreSQL database… Do you want to continue?`, type `y`.

Expected output ends with: `Your database is now in sync with your schema.` and `✓ Generated Prisma Client`.

- [ ] **Step 4: Re-seed the database**

```bash
npm run db:seed
```

Expected: seed completes without errors. This restores traits, careers, aspirations, and packs needed by integration tests.

- [ ] **Step 5: Confirm the schema change broke existing tests**

```bash
npm test
```

Expected: tests in `sims.test.ts` and `legacies.test.ts` fail — `db.sim.create` now requires `legacyId` but the mutators don't provide it yet. This is the red state; Tasks 2 and 3 restore green.

---

## Task 2: Fix `sims.create` to store `legacyId`

**Files:**
- Modify: `src/server/routers/sims.ts`

- [ ] **Step 1: Add `legacyId` to the sim creation data**

Open `src/server/routers/sims.ts`. In the `return ctx.db.sim.create({ data: { ... } })` call, add `legacyId` as the first field in `data`:

```ts
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

- [ ] **Step 2: Run the sims tests to confirm they pass**

```bash
npm test -- sims
```

Expected: all tests in `sims.test.ts` pass.

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/ src/server/routers/sims.ts
git commit -m "feat(sims): add legacyId to Sim model and store it at creation"
```

---

## Task 3: Fix `legacies.create` founder path to store `legacyId`

**Files:**
- Modify: `src/server/routers/legacies.ts`

- [ ] **Step 1: Add `legacyId` to the founder sim creation data**

Open `src/server/routers/legacies.ts`. In the `tx.sim.create({ data: { ... } })` call inside the founder branch, add `legacyId: legacy.id` as the first field:

```ts
const sim = await tx.sim.create({
  data: {
    legacyId: legacy.id,
    firstName: simFields.firstName,
    lastName: simFields.lastName,
    gender: simFields.gender,
    lifeStage: simFields.lifeStage,
    pronounSubject: simFields.pronounSubject ?? null,
    pronounObject: simFields.pronounObject ?? null,
    pronounPossessive: simFields.pronounPossessive ?? null,
    imageUrl: simFields.imageUrl ?? null,
    occultType: simFields.occultType ?? null,
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

- [ ] **Step 2: Run all tests and verify TypeScript is clean**

```bash
npm test
npx tsc --noEmit
npm run lint
```

Expected: all tests pass, no TypeScript errors, no lint warnings.

- [ ] **Step 3: Commit**

```bash
git add src/server/routers/legacies.ts
git commit -m "feat(legacies): store legacyId on founder sim at legacy creation"
```

---

## Task 4: Sims section UI on the legacy detail page

**Files:**
- Modify: `src/app/app/legacies/[slug]/page.tsx`
- Modify: `src/app/app/legacies/[slug]/page.module.css`

- [ ] **Step 1: Extend the DB query to include sims**

Open `src/app/app/legacies/[slug]/page.tsx`. Update the `db.legacy.findFirst` call to add `sims` to the `include`:

```ts
const legacy = await db.legacy.findFirst({
  where: { slug, userId: session.user.id },
  include: {
    founderSim: {
      include: {
        personalityTraits: { include: { personalityTrait: { select: { name: true } } } },
      },
    },
    sims: {
      select: { id: true, firstName: true, lastName: true },
      orderBy: { createdAt: 'asc' },
    },
  },
})
```

- [ ] **Step 2: Replace the placeholder Sims section with the real UI**

Still in `page.tsx`, replace the entire `<section>` block that currently renders "Sim tracking coming soon." with:

```tsx
<section className={styles.section}>
  <div className={styles.sectionHeader}>
    <h2 className={styles.sectionTitle}>Sims</h2>
    <Link href={`/app/legacies/${slug}/sims/new`} className={styles.addSimLink}>
      Add sim
    </Link>
  </div>
  {legacy.sims.length === 0 ? (
    <div className={styles.emptyState}>
      <p className={styles.empty}>No sims yet.</p>
      <Link href={`/app/legacies/${slug}/sims/new`} className={styles.emptyAction}>
        Add your first sim →
      </Link>
    </div>
  ) : (
    <ul className={styles.simList}>
      {legacy.sims.map((sim) => (
        <li key={sim.id} className={styles.simCard}>
          <span className={styles.simName}>
            {sim.firstName} {sim.lastName}
          </span>
        </li>
      ))}
    </ul>
  )}
</section>
```

Add `Link` to the import at the top of the file:

```ts
import Link from 'next/link'
```

- [ ] **Step 3: Add CSS for the new elements**

Open `src/app/app/legacies/[slug]/page.module.css`. Append at the end of the file:

```css
/* ── Sims section ────────────────────────────────────────── */

.addSimLink {
  margin-left: auto;
  font-family: var(--font-body);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  color: var(--green);
  text-decoration: none;
  padding: var(--space-1) var(--space-3);
  border: 1px solid var(--green);
  border-radius: var(--radius-md);
  transition: background var(--transition-base), color var(--transition-base);
}

.addSimLink:hover {
  background: var(--green);
  color: #fff;
}

.simList {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  list-style: none;
  margin: 0;
  padding: 0;
}

.simCard {
  display: flex;
  align-items: center;
  padding: var(--space-3) var(--space-5);
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  transition: box-shadow var(--transition-base);
}

.simCard:hover {
  box-shadow: var(--shadow-md);
}

.simName {
  font-family: var(--font-display);
  font-size: var(--text-base);
  font-weight: var(--weight-semibold);
  color: var(--text);
}

.emptyAction {
  font-size: var(--text-sm);
  color: var(--green);
  text-decoration: none;
}

.emptyAction:hover {
  text-decoration: underline;
}
```

- [ ] **Step 4: Run type-check and lint**

```bash
npx tsc --noEmit && npm run lint
```

Expected: no errors or warnings.

- [ ] **Step 5: Commit**

```bash
git add src/app/app/legacies/[slug]/page.tsx src/app/app/legacies/[slug]/page.module.css
git commit -m "feat(legacy-detail): replace sims placeholder with sim list and Add sim link"
```

---

## Task 5: E2E tests for the Sims section

**Files:**
- Create: `e2e/add-sims-to-legacy.spec.ts`

- [ ] **Step 1: Write the E2E spec**

Create `e2e/add-sims-to-legacy.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

test('legacy with a founder shows the founder in the sims section', async ({ page }) => {
  await page.goto('/app/legacies/new')

  const legacyName = `Founder Sims Test ${Date.now()}`
  await page.getByPlaceholder('e.g. The Caliente Legacy').fill(legacyName)
  await page.getByRole('button', { name: 'Continue →' }).click()

  await page.getByPlaceholder('First name').fill('Bella')
  await page.getByPlaceholder('Last name').fill('Goth')
  await page.getByLabel('Gender').selectOption('FEMALE')
  await page.getByRole('button', { name: 'Create legacy →' }).click()

  await expect(page).toHaveURL(/\/app\/legacies\/[^/]+$/)
  await expect(page.getByRole('heading', { name: 'Sims' })).toBeVisible()
  await expect(page.getByText('Bella Goth')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Add sim' })).toBeVisible()
})

test('legacy with no sims shows empty state with a CTA link', async ({ page }) => {
  await page.goto('/app/legacies/new')

  const legacyName = `No Sims Test ${Date.now()}`
  await page.getByPlaceholder('e.g. The Caliente Legacy').fill(legacyName)
  await page.getByRole('button', { name: 'Continue →' }).click()

  await page.getByRole('button', { name: 'Skip →' }).click()

  await expect(page).toHaveURL(/\/app\/legacies\/[^/]+$/)
  await expect(page.getByRole('heading', { name: 'Sims' })).toBeVisible()
  await expect(page.getByText('No sims yet.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Add your first sim →' })).toBeVisible()
})

test('user can add a sim to an existing legacy and see it in the list', async ({ page }) => {
  await page.goto('/app/legacies/new')
  const legacyName = `Add Sim Test ${Date.now()}`
  await page.getByPlaceholder('e.g. The Caliente Legacy').fill(legacyName)
  await page.getByRole('button', { name: 'Continue →' }).click()
  await page.getByRole('button', { name: 'Skip →' }).click()
  await expect(page).toHaveURL(/\/app\/legacies\/[^/]+$/)

  await page.getByRole('link', { name: 'Add your first sim →' }).click()
  await expect(page).toHaveURL(/\/app\/legacies\/[^/]+\/sims\/new$/)

  await page.getByPlaceholder('First name').fill('Don')
  await page.getByPlaceholder('Last name').fill('Lothario')
  await page.getByLabel('Gender').selectOption('MALE')
  await page.getByRole('button', { name: 'Add sim' }).click()

  await expect(page).toHaveURL(/\/app\/legacies\/[^/]+$/)
  await expect(page.getByText('Don Lothario')).toBeVisible()
})
```

- [ ] **Step 2: Start the dev server and run new E2E tests**

In one terminal:
```bash
npm run dev -- --port 3737
```

In another terminal:
```bash
npm run test:e2e -- --project=chromium e2e/add-sims-to-legacy.spec.ts
```

Expected: all 3 tests pass.

- [ ] **Step 3: Run the full E2E suite to check for regressions**

```bash
npm run test:e2e -- --project=chromium
```

Expected: all E2E tests pass, including `legacy-wizard.spec.ts`, `packs.spec.ts`, and `auth.spec.ts`.

- [ ] **Step 4: Commit**

```bash
git add e2e/add-sims-to-legacy.spec.ts
git commit -m "test(e2e): add sims section E2E tests for legacy detail page"
```

---

## Verification Checklist

- [ ] `npm test` — all integration tests pass
- [ ] `npm run test:e2e -- --project=chromium` — all E2E tests pass
- [ ] `npx tsc --noEmit` — no TypeScript errors
- [ ] `npm run lint` — no ESLint warnings
- [ ] Manual: create legacy with founder → founder visible in sims list + "Add sim" link present
- [ ] Manual: create legacy without founder → empty state visible with "Add your first sim →" link
- [ ] Manual: click "Add sim" → fill form → submit → new sim appears in sims list
