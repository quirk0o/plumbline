---
paths:
  - "src/**/*.test.{ts,tsx}"
  - "e2e/**"
  - "vitest.config.ts"
  - "playwright.config.ts"
---

# Testing Guide

This project follows [Kent C. Dodds' Testing Trophy](https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications): mostly integration tests, a few E2E tests at the top, static analysis at the base, and minimal unit tests only for genuinely complex isolated logic.

---

## Test Behavior, Not Implementation Details

**Testing implementation details is not allowed.** Tests must assert on observable behavior — what a user sees and does, or what a public API returns — never on _how_ the code achieves it internally. As Kent C. Dodds puts it: ["The more your tests resemble the way your software is used, the more confidence they can give you."](https://testing-library.com/docs/guiding-principles/)

An implementation detail is anything a user (end user or API caller) never observes: internal state, private functions, component internals, the exact DOM/CSS structure, or which collaborators were called. Tests coupled to these break when you refactor working code (false negatives) and pass when behavior is actually broken (false positives). Both destroy the test's value.

### What counts as an implementation detail

- Internal component state, hooks, or instance variables
- Private (non-exported) functions and helpers
- CSS class names, element IDs, tag names, and DOM nesting structure
- Whether a specific internal function or collaborator was called, and how many times
- Props passed to child components
- Full-DOM snapshots that fail on any markup change

### Examples

**❌ Asserting on internal state instead of rendered output**

```tsx
// BAD — reaches into the component's state
const { result } = renderHook(() => usePackGrid())
expect(result.current.selectedPacks).toContain('expansion-1')
```

```tsx
// GOOD — asserts what the user sees
render(<PackGrid />)
await userEvent.click(screen.getByRole('button', { name: 'City Living' }))
expect(screen.getByRole('button', { name: 'City Living' })).toHaveAttribute('aria-pressed', 'true')
```

**❌ Asserting on CSS classes or DOM structure**

```tsx
// BAD — couples the test to styling and markup
expect(container.querySelector('.pack-card--selected')).toBeTruthy()
expect(container.querySelector('div > form > input')).toBeTruthy()
```

```tsx
// GOOD — asserts the accessible, user-facing state
expect(screen.getByRole('button', { name: 'City Living' })).toHaveAttribute('aria-pressed', 'true')
expect(screen.getByLabelText('Legacy name')).toBeInTheDocument()
```

**❌ Asserting that an internal function was called**

```tsx
// BAD — tests the wiring, not the result. Refactoring the internals breaks this
//        even when the user-visible behavior is unchanged.
const toggleSpy = vi.spyOn(packModule, 'computeToggleState')
render(<PackGrid />)
await userEvent.click(screen.getByRole('button', { name: 'City Living' }))
expect(toggleSpy).toHaveBeenCalledTimes(1)
```

```tsx
// GOOD — assert the outcome the user gets from the click
await userEvent.click(screen.getByRole('button', { name: 'City Living' }))
expect(await screen.findByText('Pack added')).toBeInTheDocument()
```

> Mocking **external** boundaries (tRPC hooks, the Next.js router, NextAuth, the S3 client) is correct and expected — those are not implementation details of the unit under test. The rule is about spying on the code's _own_ internals.

**❌ Testing a private helper directly instead of through its public surface**

```ts
// BAD — imports and tests a non-exported helper, freezing an internal contract
import { __sanitizeCallbackUrl } from '../sign-in-form'
expect(__sanitizeCallbackUrl('javascript:alert(1)')).toBe('/')
```

```ts
// GOOD — exercise the behavior through the public component/procedure
render(<SignInForm callbackUrl="javascript:alert(1)" />)
await userEvent.click(screen.getByRole('button', { name: 'Send magic link' }))
// assert the safe redirect target the user actually ends up with
```

**❌ Full-DOM snapshot tests**

```tsx
// BAD — fails on any markup/styling change, tells you nothing about behavior
expect(container).toMatchSnapshot()
```

```tsx
// GOOD — assert the specific, meaningful output
expect(screen.getByRole('heading', { name: 'Your Legacy' })).toBeInTheDocument()
```

For tRPC integration tests, assert on the **procedure's return value and the resulting database state** (the observable contract), not on which internal query builders or service functions ran along the way.

---

## E2E Tests Cover User Journeys, Not Edge Cases

E2E tests are the slowest, most expensive, and flakiest layer of the trophy. Every E2E test must earn its place by covering a **complete user journey** — a realistic workflow a user walks through start to finish. Granular checks of a single widget behavior belong in component or integration tests, where they are fast and cheap.

> "Think about the high-value interactions users will have with your application. Try to come up with user journeys that define the core value of your product and translate the most important steps of these user journeys into automated end-to-end tests." — [Martin Fowler, The Practical Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html)

> "I typically suggest that you have a single 'Arrange' per test, and as many 'Act' and 'Asserts' as necessary for the workflow you're trying to get confidence about." — [Kent C. Dodds, Write fewer, longer tests](https://kentcdodds.com/blog/write-fewer-longer-tests)

### The litmus test

Read the test name. If it describes a **user goal** ("user creates a legacy and records the founder's marriage"), it's an E2E test. If it describes a **widget behavior** ("cancel closes the modal", "dropdown saves on change", "section titles are h2 headings"), it's too granular — push it down to a component test.

### Rules

1. **One test per journey: single Arrange, many Act/Assert.** Drive a full workflow with multiple interactions and checks. The old "one assertion per test" dogma does not apply at this level — modern runners pinpoint the exact failing assertion regardless.
2. **Structure journeys with `test.step()`.** Each named step shows up as a collapsible node in the HTML report and trace, so a long test stays readable and failures point at the exact phase.
3. **Push edge cases down the trophy.** Validation errors, cancel paths, empty states, combobox contents, heading levels, and ARIA landmarks are component-test material. Don't re-test at the E2E level what a lower layer already covers.
4. **Tests stay independent of each other.** "Fewer, longer" means each test is a self-contained journey — not a `describe.serial()` chain where one test's output feeds the next, and not one mega-test gluing unrelated flows together.
5. **Expensive setup repeated per micro-test is the smell to watch for.** If every test in a file replays the same multi-step helper (`createLegacyWithTwoSims(page)`) just to make one small assertion, those tests want to be one journey.

### Example

**❌ Granular widget tests — each replays the full setup to check one thing**

```ts
test('add relationship modal opens and shows available sims in the combobox', async ({ page }) => {
  await createLegacyWithTwoSims(page)   // ~10 steps of setup
  await page.getByRole('button', { name: /^\+ Add$/ }).click()
  await expect(page.getByText('Mortimer Goth')).toBeVisible()
})

test('cancel closes the modal without adding a relationship', async ({ page }) => {
  await createLegacyWithTwoSims(page)   // same ~10 steps again
  await page.getByRole('button', { name: /^\+ Add$/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Add relationship' })
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).not.toBeVisible()
})
```

The cancel behavior, combobox contents, and dialog open/close are component-level concerns — test them in a jsdom test of the dialog component with mocked tRPC.

**✅ One journey test — the full scenario a user actually performs**

```ts
test('user records relationships for a sim', async ({ page }) => {
  await test.step('create a legacy with two sims', async () => {
    await createLegacyWithTwoSims(page)
  })

  await test.step('add a partner relationship', async () => {
    await page.getByRole('button', { name: /^\+ Add$/ }).click()
    const dialog = page.getByRole('dialog', { name: 'Add relationship' })
    await page.getByRole('button', { name: 'Select sim' }).click()
    await page.getByText('Mortimer Goth').click()
    await dialog.getByRole('button', { name: 'Add' }).click()
    await expect(dialog).not.toBeVisible()
  })

  await test.step('verify the relationship persists', async () => {
    await page.reload()
    await expect(page.getByText('Mortimer Goth')).toBeVisible()
  })
})
```

### Where the granular checks go instead

| Granular concern | Right home |
|---|---|
| Cancel/escape closes a dialog | Component test of the dialog |
| Validation error on empty field | Component test of the form |
| Dropdown options, combobox contents | Component test |
| Heading levels, ARIA landmarks | Component test (or an axe a11y check) |
| Auth guard, ownership checks | tRPC integration test |
| Data persists correctly | tRPC integration test (or one assert inside a journey) |

---

## Running Tests

```bash
# Component + integration tests (fast, most useful during development)
npm test

# Watch mode
npm run test:watch

# E2E tests (requires dev server + DB + seeded data)
npm run test:e2e

# E2E with interactive UI
npm run test:e2e:ui
```

---

## Test Layers

### Static Analysis (always on)

TypeScript and ESLint run on every file and catch type errors, unsafe patterns, and style issues before any test runs.

```bash
npm run lint
npx tsc --noEmit
```

### Component Tests (jsdom, no DB needed)

Fast tests for React components using [React Testing Library](https://testing-library.com/docs/react-testing-library/intro). These run in a jsdom environment and mock all external dependencies (tRPC hooks, Next.js router, NextAuth).

**Location:** `src/**/__tests__/*.test.tsx`

**What's tested:**
- `src/app/auth/signin/__tests__/sign-in-form.test.tsx` — email form, Google sign-in, error messages, callbackUrl safety
- `src/app/components/__tests__/pack-grid.test.tsx` — pack rendering, aria-pressed state, toggle mutation, section labels

**No DB required** — these tests run anywhere.

### Integration Tests (node, DB required)

tRPC procedure tests that call procedures through `createCallerFactory` with the **real Prisma client and a real PostgreSQL database**. These verify that business logic, auth middleware, and database queries work together correctly.

**Location:** `src/**/*.test.ts`

**What's tested:**
- `src/server/routers/packs.test.ts` — `packs.getAll` and `packs.toggle` procedures, including auth guard, BASE_GAME protection, and real UserPack creation/deletion

**Requires:**
- PostgreSQL running locally
- `DATABASE_URL` set in your environment (or `.env` file in the project root)
- Database seeded with pack data: `npm run db:seed`

```bash
# Run with env var (if .env not in current directory)
DATABASE_URL="postgresql://..." npm test
```

### E2E Tests (Playwright, full stack required)

End-to-end tests using Playwright that exercise the full stack — Next.js server, database, auth flow. They run against the dev server. Each test covers a **complete user journey** (see [E2E Tests Cover User Journeys, Not Edge Cases](#e2e-tests-cover-user-journeys-not-edge-cases)).

**Location:** `e2e/` — one spec file per feature area, one test per journey through it. Examples: `auth.spec.ts` (unauthenticated redirect → sign-in → email submission → inbox confirmation), `packs.spec.ts` (onboarding page → browse grid → toggle ownership), `legacy-wizard.spec.ts` (create legacy with founder, end to end).

**Authentication setup:** The `setup/auth.setup.ts` project creates a test user and saves session cookies to `e2e/.auth/user.json`. The `packs.spec.ts` tests reuse this session. Teardown deletes the test user.

**Requires:**
- PostgreSQL running with seeded data
- `DATABASE_URL` set
- `AUTH_SECRET` and any other auth env vars from `.env`
- Dev server started (Playwright starts it automatically via `webServer` on port **3737**, separate from the standard dev server on 3000)

---

## Test Infrastructure

### Vitest Config (`vitest.config.ts`)

- `environment: 'node'` by default (for integration tests)
- `.test.tsx` component tests declare `// @vitest-environment jsdom` at the top of the file (the config default is `node`)
- `globals: true` — `expect`, `describe`, `it`, `vi` available without imports
- `e2e/**` excluded from Vitest (those are Playwright's responsibility)

### Setup File (`src/test/setup.ts`)

Runs before every test file. Loads `.env`/`.env.test` via dotenv (for DB credentials) and registers jest-dom matchers (`toBeInTheDocument`, `toHaveAttribute`, etc.) globally.

### tRPC Test Helpers (`src/test/`)

- `test.ts` — the Vitest `test` extended with database fixtures. **Integration tests import `test` from here** (`import { test } from '@/test/test'`) instead of using `it`/`test` from `vitest`. Fixtures are lazy — a test only creates what it destructures — and are torn down automatically after the test:
  - `userId` — a fresh test user
  - `trpcCaller` — a tRPC caller authenticated as that user (named `trpcCaller`, not `caller`, which collides with `Function.prototype.caller`)
  - `legacyId` — a legacy owned by that user (deleting the user cascades to it, so no extra teardown)
- `caller.ts` — `authedCaller(userId)` and `unauthCaller()` — create tRPC callers with real DB context (used directly for unauthenticated, second-user, and custom-db cases)
- `helpers.ts` — `createTestUser()`, `cleanupUser()`, `createTestLegacy()`, `getAnyPack()`, … — DB factories for data the fixtures don't cover

### Playwright Config (`playwright.config.ts`)

Two browser projects:
- `chromium` — authenticated (depends on `setup/auth.setup.ts` to run first)
- `chromium-unauthed` — no session (used by `auth.spec.ts`)

---

## Query Priority

This is the query-level application of [Test Behavior, Not Implementation Details](#test-behavior-not-implementation-details). Always query by what the user sees and interacts with — never by implementation details like element IDs, CSS classes, or DOM structure. Use this priority order in both RTL and Playwright:

1. **`getByRole`** — matches by ARIA role + accessible name. Prefer this for buttons, links, headings, inputs.
   ```ts
   getByRole('button', { name: 'Continue →' })
   getByRole('heading', { name: 'Your Legacy' })
   getByRole('link', { name: '+ Start a legacy' })
   ```
2. **`getByLabel`** — matches form controls by their associated `<label>` text. Use for all labelled inputs, selects, and textareas.
   ```ts
   getByLabel('Legacy name')       // finds the input via its label
   getByLabel('Gender')            // finds the select; the aria-hidden * is excluded
   ```
3. **`getByPlaceholderText`** — only when no label is present.
   ```ts
   getByPlaceholderText('your@email.com')
   ```
4. **`getByText`** — for non-interactive text content.
5. **`getByTestId`** — last resort. Requires adding `data-testid` to the element first.

**Never use:** `locator('#id')`, `locator('.class')`, `locator('div > form > input')`, or any selector that would break if the implementation changed without the user-visible behavior changing.

---

## Writing New Tests

### New tRPC procedure → add to `src/server/routers/*.test.ts`

Import `test` from `@/test/test` and destructure the fixtures each test needs — no `beforeEach`/`afterEach` user/legacy boilerplate. Keep `describe`/`expect` from `vitest`.

```ts
import { describe, expect } from 'vitest'
import { test } from '@/test/test'
import { db } from '@/server/db'

describe('myRouter.myProcedure', () => {
  // `trpcCaller` is authed as a fresh user; add `legacyId` if you need a legacy.
  test('does the right thing', async ({ trpcCaller }) => {
    const result = await trpcCaller.myRouter.myProcedure({ input: 'value' })
    expect(result).toEqual({ expected: true })
  })

  test('persists for the owning legacy', async ({ trpcCaller, legacyId }) => {
    await trpcCaller.myRouter.myProcedure({ legacyId, input: 'value' })
    expect(await db.thing.count({ where: { legacyId } })).toBe(1)
  })
})
```

For a **custom/failing db** (rollback tests) or a **second user** (ownership checks), destructure `userId` and use the `@/test/caller` / `@/test/helpers` factories directly:

```ts
import { authedCaller, unauthCaller } from '@/test/caller'
import { createTestUser, cleanupUser } from '@/test/helpers'

test('rejects an unauthenticated caller', async () => {
  await expect(unauthCaller().myRouter.myProcedure({ input: 'value' }))
    .rejects.toMatchObject({ code: 'UNAUTHORIZED' })
})

test("rejects another user's resource", async ({ userId }) => {
  const other = await createTestUser()
  try {
    const theirThing = await createThingOwnedBy(other.id)
    await expect(authedCaller(userId).myRouter.myProcedure({ id: theirThing.id }))
      .rejects.toMatchObject({ code: 'NOT_FOUND' })
  } finally {
    await cleanupUser(other.id)
  }
})
```

**Create test-specific data inline — don't make it a fixture.** The base context (`userId` / `trpcCaller` / `legacyId`) holds only what nearly *every* integration test needs. Fixtures take no arguments, so they can't be tailored per test: a Sim, household, trait, or relationship almost always needs values specific to the case under test, so build it in the test body with the `@/test/helpers` factories — never as a shared fixture.

```ts
test('promotes the named heir', async ({ trpcCaller, legacyId }) => {
  const heir = await createTestSim(legacyId, { firstName: 'Cassandra', isHeir: true })
  const result = await trpcCaller.sims.update({ id: heir.id, /* … */ })
  expect(result.isHeir).toBe(true)
})
```

Only extend the base `test` when a suite genuinely needs the **same, fixed** extra setup in *every* one of its tests (e.g. a second user for ownership checks) — and keep that fixture local to the file so the global context stays small. Name the continuation `provide` (not `use`, which trips the react-hooks rule):

```ts
import { test as base } from '@/test/test'

// Every test in this suite needs an unrelated second user — identical setup,
// no per-test data — so a local fixture is justified.
const test = base.extend<{ otherUserId: string }>({
  otherUserId: async ({}, provide) => {
    const other = await createTestUser()
    await provide(other.id)
    await cleanupUser(other.id)
  },
})
```

### New React component → add `__tests__/component.test.tsx` alongside it

Use `// @vitest-environment jsdom` at the top if the auto-detection doesn't pick up the file.

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { MyComponent } from '../my-component'

it('renders correctly', () => {
  render(<MyComponent prop="value" />)
  expect(screen.getByText('Expected text')).toBeInTheDocument()
})
```

Mock external dependencies (tRPC, Next.js router, NextAuth) with `vi.mock(...)`.

### New user flow → add `e2e/feature.spec.ts`

Write one journey test per scenario, structured with `test.step()`. Before adding a new E2E test, check it passes the [litmus test](#the-litmus-test): does the name describe a user goal, or a widget behavior?

```ts
import { test, expect } from '@playwright/test'

test('user completes the feature workflow', async ({ page }) => {
  await test.step('navigate to the feature', async () => {
    await page.goto('/app/feature')
  })

  await test.step('do the thing', async () => {
    await page.getByRole('button', { name: 'Do thing' }).click()
    await expect(page.getByText('Thing done')).toBeVisible()
  })

  await test.step('verify it persisted', async () => {
    await page.reload()
    await expect(page.getByText('Thing done')).toBeVisible()
  })
})
```

If the test needs authentication, it will automatically use the saved session from the setup project (file must not use `test.use({ storageState: ... })` to override it).
