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

Always query by what the user sees and interacts with — never by implementation details like element IDs, CSS classes, or DOM structure. Use this priority order in both RTL and Playwright:

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
