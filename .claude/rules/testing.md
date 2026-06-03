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

End-to-end tests using Playwright that exercise the full stack — Next.js server, database, auth flow. They run against the dev server.

**Location:** `e2e/`

**What's tested:**
- `e2e/auth.spec.ts` — full sign-in user flow: unauthenticated redirect → sign-in page → email submission → inbox confirmation
- `e2e/packs.spec.ts` — authenticated pack management flow: onboarding page → pack grid → toggle ownership
- `e2e/legacy-wizard.spec.ts` — legacy creation wizard: name + description → founder sim (with and without) → validation → back navigation

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
- `.test.tsx` files under `src/app/` and `src/components/` automatically get `jsdom` (via `environmentMatchGlobs`)
- `globals: true` — `expect`, `describe`, `it`, `vi` available without imports
- `e2e/**` excluded from Vitest (those are Playwright's responsibility)

### Setup File (`src/test/setup.ts`)

Runs before every test file. Loads `.env`/`.env.test` via dotenv (for DB credentials) and registers jest-dom matchers (`toBeInTheDocument`, `toHaveAttribute`, etc.) globally.

### tRPC Test Helpers (`src/test/`)

- `caller.ts` — `authedCaller(userId)` and `unauthCaller()` — create tRPC callers with real DB context
- `helpers.ts` — `createTestUser()`, `cleanupUser()`, `getAnyPack()` — DB setup/teardown utilities

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

```ts
import { authedCaller, unauthCaller } from '@/test/caller'
import { createTestUser, cleanupUser } from '@/test/helpers'
import { db } from '@/server/db'

describe('myRouter.myProcedure', () => {
  let userId: string
  beforeEach(async () => { ({ id: userId } = await createTestUser()) })
  afterEach(async () => { await cleanupUser(userId) })

  it('does the right thing', async () => {
    const caller = authedCaller(userId)
    const result = await caller.myRouter.myProcedure({ input: 'value' })
    expect(result).toEqual({ expected: true })
  })
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

```ts
import { test, expect } from '@playwright/test'

test('user can do the thing', async ({ page }) => {
  await page.goto('/app/feature')
  await page.getByRole('button', { name: 'Do thing' }).click()
  await expect(page.getByText('Thing done')).toBeVisible()
})
```

If the test needs authentication, it will automatically use the saved session from the setup project (file must not use `test.use({ storageState: ... })` to override it).
