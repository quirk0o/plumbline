# Test-Suite Ergonomics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop paying a full `prisma migrate reset --force && db seed` tax on every test run, and replace the hand-rolled `createTestUser/cleanupUser/createTestLegacy` `beforeEach`/`afterEach` choreography with reusable `withTestUser()` / `withTestLegacy()` fixtures across all test files.

**Architecture:** (A) A `scripts/setup-test-db.ts` orchestrator computes a SHA-256 hash of `prisma/schema.prisma`, every file under `prisma/migrations/`, and `prisma/seed.ts`. It resets+seeds the test DB only when that hash differs from a per-database stamp at `node_modules/.cache/test-db-<dbName>.json`, when `--force` is passed, or when a cheap "is the DB reachable and seeded?" probe fails. The DB name (and the consent string / log lines / stamp filename) is parsed from `DATABASE_URL`, never hardcoded. All `pretest` / `pretest:watch` / `pretest:e2e` hooks call this same conditional script, so unit and e2e runs both benefit. (B) A `src/test/fixtures.ts` module exposes `withTestUser()` and `withTestLegacy()` — thin wrappers that register `beforeEach`/`afterEach` and return a mutable context (`userId`, `caller`, and `legacyId`). Every router/lib test that hand-rolls the user/legacy dance is migrated to these fixtures.

**Tech Stack:** Next.js 16, tRPC v11, Prisma 7 (`@prisma/adapter-pg`), Vitest 4, tsx, GitButler (`but`) for commits.

---

## Context

This addresses tech-debt review finding **H4 — "Test-suite ergonomics will throttle velocity as the suite grows."** Two compounding costs:

1. **Fixed reset tax.** `pretest` → `db:test:setup` runs `prisma migrate reset --force && prisma db seed` unconditionally before *every* `npm test`, even a one-test iteration — several seconds paid every run. Tests already isolate per-user (unique-UUID users created and torn down per test), so reusing an already-correct seeded DB is safe; the reset only needs to happen when migrations/schema/seed actually change.
2. **No fixture layer.** Every router test file repeats the same `let userId; beforeEach(createTestUser…); afterEach(cleanupUser…)` block (and a `createTestLegacy` variant). `sims.test.ts` is ~1,881 lines; adding a test costs ~30 lines of boilerplate. That cost curve is how Trophy-style suites decay.

Decisions made with the user: **migrate all** existing test files to the new fixtures; make the conditional reset apply to **both unit and e2e** with a DB safety probe; **do not add automated tests** for the setup script or the fixtures (they are verified via smoke runs / by the suite exercising them); name the script per the codebase's verb-first kebab convention (`scripts/setup-test-db.ts`, matching `scripts/backfill-uploads-to-s3.ts`); and **derive the database name from `DATABASE_URL`** (the consent string, log lines, and stamp filename must not hardcode `simstrack_test`).

## Conventions for this plan

- Work on a dedicated GitButler branch `feat/test-suite-ergonomics`. Commit via GitButler (`but`), staging only this session's hunks (see project version-control rules; do not absorb other agents' uncommitted edits). Each "Commit" step gives the exact files and a Conventional Commits message.
- After every task: `npx tsc --noEmit` (no errors) and `npm run lint` (no errors/warnings). No `eslint-disable` / `@ts-*` suppressions — fix the root cause.

## File Structure

| File | Responsibility |
|------|----------------|
| `scripts/setup-test-db.ts` (create) | Conditional test-DB setup. Loads `.env.test`, parses the DB name from `DATABASE_URL`, hashes schema+migrations+seed, reads/writes a per-db stamp (`node_modules/.cache/test-db-<dbName>.json`), runs the seeded-DB probe, decides via a local `decideReset()` helper, and shells out to `prisma migrate reset --force` + `prisma db seed` only when needed. |
| `package.json` (modify) | Repoint `db:test:setup` at the new script; add `test:fresh` / `test:e2e:fresh` force escape hatches. |
| `src/test/fixtures.ts` (create) | `withTestUser()` / `withTestLegacy()` — register `beforeEach`/`afterEach`, return a populated context (`userId`, `caller`, `legacyId`). |
| `src/server/routers/*.test.ts`, `src/server/lib/*.test.ts` (modify) | Migrate the user/legacy choreography to the fixtures. |

---

## Task 1: Conditional test-DB setup script

**Files:**
- Create: `scripts/setup-test-db.ts`

No automated test (per the user): the only branching logic, `decideReset()`, is a small pure helper kept inline for readability, and the script is verified by the smoke runs below and by `npm test` itself.

- [ ] **Step 1: Write the script**

```ts
// scripts/setup-test-db.ts
import { config } from 'dotenv'
// Load the test DB connection BEFORE anything reads process.env. Mirrors
// vitest.config.ts. dotenv does not override existing process.env, so the
// value below also takes precedence over Prisma's automatic .env load.
config({ path: '.env.test' })

import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { join, relative } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const ROOT = process.cwd()
const PRISMA_DIR = join(ROOT, 'prisma')
const MIGRATIONS_DIR = join(PRISMA_DIR, 'migrations')
const STAMP_DIR = join(ROOT, 'node_modules', '.cache')

/** Database name parsed from the connection string (e.g. `simstrack_test`). */
function databaseName(connectionString: string): string {
  const name = decodeURIComponent(new URL(connectionString).pathname.replace(/^\//, '').split('/')[0])
  if (!name) throw new Error('Could not parse a database name from DATABASE_URL')
  return name
}

/** Per-database stamp file, so different test DBs never share a stamp. */
function stampFilePath(dbName: string): string {
  return join(STAMP_DIR, `test-db-${dbName}.json`)
}

/**
 * Standing consent so `prisma migrate reset` can run unattended against the
 * pinned test DB only (Prisma 7 AI-action guard). The DB name is taken from
 * DATABASE_URL, never hardcoded.
 */
function consentString(dbName: string): string {
  return `Standing user consent to reset the local ${dbName} database via this test-only script (pinned to .env.test).`
}

interface ResetDecisionInput {
  force: boolean
  stampHash: string | null
  currentHash: string
  seeded: boolean
}

/**
 * Decide whether the test DB needs a reset + reseed. Returns the list of
 * human-readable reasons; empty means skip. The empty-DB reason is only
 * considered when no cheaper reason already triggered a reset, so the caller
 * can avoid the (slower) DB probe.
 */
function decideReset(input: ResetDecisionInput): string[] {
  const reasons: string[] = []
  if (input.force) reasons.push('forced (--force)')
  if (input.stampHash === null) reasons.push('no previous test-db stamp')
  else if (input.stampHash !== input.currentHash) reasons.push('schema/migrations/seed changed')
  if (reasons.length === 0 && !input.seeded) reasons.push('test database is empty or unreachable')
  return reasons
}

function collectHashInputs(): string[] {
  const files = [join(PRISMA_DIR, 'schema.prisma'), join(PRISMA_DIR, 'seed.ts')]
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) walk(full)
      else files.push(full)
    }
  }
  if (existsSync(MIGRATIONS_DIR)) walk(MIGRATIONS_DIR)
  return files.filter(existsSync).sort()
}

function computeInputsHash(): string {
  const hash = createHash('sha256')
  for (const file of collectHashInputs()) {
    hash.update(relative(ROOT, file))
    hash.update('\0')
    hash.update(readFileSync(file))
    hash.update('\0')
  }
  return hash.digest('hex')
}

function readStampHash(stampFile: string): string | null {
  if (!existsSync(stampFile)) return null
  try {
    const parsed = JSON.parse(readFileSync(stampFile, 'utf8')) as { hash?: string }
    return parsed.hash ?? null
  } catch {
    return null
  }
}

function writeStamp(stampFile: string, hash: string): void {
  mkdirSync(STAMP_DIR, { recursive: true })
  writeFileSync(stampFile, `${JSON.stringify({ hash }, null, 2)}\n`)
}

/** Cheap probe: is the test DB reachable and does it have seeded reference data? */
async function isDbSeeded(connectionString: string): Promise<boolean> {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
  try {
    return (await prisma.pack.count()) > 0
  } catch {
    return false
  } finally {
    try {
      await prisma.$disconnect()
    } catch {
      // Ignore teardown errors — we only care whether the probe query succeeded.
    }
  }
}

function runResetAndSeed(consent: string): void {
  const prismaBin = join(ROOT, 'node_modules', '.bin', 'prisma')
  const env = { ...process.env, PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: consent }
  execFileSync(prismaBin, ['migrate', 'reset', '--force'], { stdio: 'inherit', env })
  execFileSync(prismaBin, ['db', 'seed'], { stdio: 'inherit', env })
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL is not set (expected from .env.test)')
  const dbName = databaseName(connectionString)
  const stampFile = stampFilePath(dbName)

  const force = process.argv.includes('--force')
  const currentHash = computeInputsHash()
  const stampHash = readStampHash(stampFile)

  // Decide using cheap inputs first; only run the (slower) DB probe when no
  // cheaper reason already forces a reset.
  const needsResetWithoutProbe =
    decideReset({ force, stampHash, currentHash, seeded: true }).length > 0
  const seeded = needsResetWithoutProbe || (await isDbSeeded(connectionString))
  const reasons = decideReset({ force, stampHash, currentHash, seeded })

  if (reasons.length === 0) {
    console.log(`[test-db] ${dbName} up to date — skipping reset/seed`)
    return
  }

  console.log(`[test-db] resetting ${dbName}: ${reasons.join('; ')}`)
  runResetAndSeed(consentString(dbName))
  writeStamp(stampFile, currentHash)
  console.log(`[test-db] ${dbName} reset + seed complete`)
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
```

- [ ] **Step 2: Validate types and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 3: Smoke-test directly — first run resets**

Run: `npx tsx scripts/setup-test-db.ts`
Expected: prints `[test-db] resetting simstrack_test: no previous test-db stamp` (or `...changed`), then Prisma reset + seed output, then `[test-db] simstrack_test reset + seed complete`. A `node_modules/.cache/test-db-simstrack_test.json` file now exists. (The `simstrack_test` name comes from `.env.test`.)

- [ ] **Step 4: Smoke-test idempotency — second run skips**

Run: `npx tsx scripts/setup-test-db.ts`
Expected: prints `[test-db] simstrack_test up to date — skipping reset/seed` and exits immediately (no Prisma output).

- [ ] **Step 5: Smoke-test the force path**

Run: `npx tsx scripts/setup-test-db.ts --force`
Expected: prints `[test-db] resetting simstrack_test: forced (--force)` and runs the full reset + seed.

- [ ] **Step 6: Commit (GitButler)**

Files: `scripts/setup-test-db.ts`
Message: `feat(test): conditionally reset/seed test DB via hash stamp + safety probe`

---

## Task 2: Wire scripts into package.json

**Files:**
- Modify: `package.json:15-20`

- [ ] **Step 1: Repoint `db:test:setup` and add force escape hatches**

Replace the current `db:test:setup` one-liner and add two `*:fresh` scripts. The `pretest`, `pretest:watch`, and `pretest:e2e` hooks are left unchanged — they already call `db:test:setup`, so they automatically become conditional.

Resulting `scripts` block (changed/added lines):

```json
    "pretest": "npm run db:test:setup",
    "test": "vitest run",
    "test:fresh": "tsx scripts/setup-test-db.ts --force && vitest run",
    "pretest:watch": "npm run db:test:setup",
    "test:watch": "vitest",
    "db:test:setup": "tsx scripts/setup-test-db.ts",
    "pretest:e2e": "npm run db:test:setup",
    "test:e2e": "playwright test",
    "test:e2e:fresh": "tsx scripts/setup-test-db.ts --force && playwright test",
    "test:e2e:ui": "playwright test --ui",
```

- [ ] **Step 2: Verify the conditional flow end-to-end via npm**

Run: `npm test`
Expected: first invocation may reset (if the stamp is stale), then the full Vitest suite runs and passes.

Run again: `npm test`
Expected: the `pretest` step prints `[test-db] simstrack_test up to date — skipping reset/seed` (no multi-second Prisma reset), then Vitest runs.

- [ ] **Step 3: Verify the force path**

Run: `npm run test:fresh`
Expected: prints `[test-db] resetting simstrack_test: forced (--force)`, runs reset + seed, then the full suite.

- [ ] **Step 4: Commit (GitButler)**

Files: `package.json`
Message: `chore(test): use conditional db setup; add test:fresh / test:e2e:fresh`

---

## Task 3: Test fixtures module

**Files:**
- Create: `src/test/fixtures.ts`

No dedicated test (per the user); the fixtures are exercised by every migrated test file in Tasks 4–6, which fail loudly if the fixtures are wrong.

- [ ] **Step 1: Write the fixtures**

```ts
// src/test/fixtures.ts
import { beforeEach, afterEach } from 'vitest'
import { authedCaller } from '@/test/caller'
import { createTestUser, cleanupUser, createTestLegacy } from '@/test/helpers'

export interface TestUserContext {
  userId: string
  caller: ReturnType<typeof authedCaller>
}

export interface TestLegacyContext extends TestUserContext {
  legacyId: string
}

/**
 * Registers beforeEach/afterEach on the enclosing describe block to create and
 * tear down a fresh test user per test. Returns a context object whose fields
 * are populated before each test body runs.
 *
 * Usage:
 *   describe('packs.getAll', () => {
 *     const ctx = withTestUser()
 *     it('...', async () => { await ctx.caller.packs.getAll() })
 *   })
 */
export function withTestUser(): TestUserContext {
  const ctx = {} as TestUserContext
  beforeEach(async () => {
    const user = await createTestUser()
    ctx.userId = user.id
    ctx.caller = authedCaller(user.id)
  })
  afterEach(async () => {
    await cleanupUser(ctx.userId)
  })
  return ctx
}

/**
 * Like withTestUser, but also creates a legacy owned by that user. cleanupUser
 * cascades to the legacy, so no extra teardown is needed.
 */
export function withTestLegacy(): TestLegacyContext {
  const ctx = {} as TestLegacyContext
  beforeEach(async () => {
    const user = await createTestUser()
    ctx.userId = user.id
    ctx.caller = authedCaller(user.id)
    const legacy = await createTestLegacy(user.id)
    ctx.legacyId = legacy.id
  })
  afterEach(async () => {
    await cleanupUser(ctx.userId)
  })
  return ctx
}
```

- [ ] **Step 2: Validate**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 3: Commit (GitButler)**

Files: `src/test/fixtures.ts`
Message: `feat(test): add withTestUser/withTestLegacy fixtures`

---

## Migration recipe (applies to Tasks 4–6)

For each target file, transform the per-`describe` setup. **Read the file's existing `beforeEach`/`afterEach` blocks first**, then apply:

**Case A — user only** (block creates just a user):
```ts
// BEFORE
describe('packs.getAll', () => {
  let userId: string
  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
  })
  afterEach(async () => {
    await cleanupUser(userId)
  })
  it('returns pack groups', async () => {
    const caller = authedCaller(userId)
    const result = await caller.packs.getAll()
    // ...
  })
})

// AFTER
describe('packs.getAll', () => {
  const ctx = withTestUser()
  it('returns pack groups', async () => {
    const result = await ctx.caller.packs.getAll()
    // ...
  })
})
```

**Case B — user + legacy** (block creates a user then a legacy):
```ts
// BEFORE
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

// AFTER
const ctx = withTestLegacy()
// reference ctx.userId / ctx.legacyId / ctx.caller below
```

**Case C — user/legacy + extra per-block entities** (e.g. a tracker type or sim). Keep the fixture for the base, and add a *second* `beforeEach` after it for the extras. Vitest runs hooks in registration order, so the fixture populates `ctx` first:
```ts
describe('challengeRuns.link', () => {
  const ctx = withTestLegacy()
  let trackerTypeId: string
  beforeEach(async () => {
    const tt = await createTestTrackerType({ ownerId: ctx.userId })
    trackerTypeId = tt.id
  })
  it('...', async () => {
    await ctx.caller.challengeRuns.link(/* ... */)
  })
})
```

**Mechanical rules for every file:**
- Replace `authedCaller(userId)` → `ctx.caller`. **Exception:** where a test passes a custom db (e.g. `authedCaller(userId, failingDb(...))`), keep `authedCaller(ctx.userId, fdb)` and keep the `authedCaller` import.
- Replace bare `userId` → `ctx.userId`, `legacyId` → `ctx.legacyId`.
- Multi-user tests that create a *second* user (e.g. ownership checks creating `otherUser`) keep using `createTestUser`/`cleanupUser` directly — do not remove those imports there.
- After editing, **remove now-unused imports** (`createTestUser`, `cleanupUser`, `createTestLegacy`, `beforeEach`, `afterEach`, `authedCaller`) — only those truly no longer referenced. Add `withTestUser` / `withTestLegacy` to a `@/test/fixtures` import. Lint will fail on unused imports, so this is enforced.
- Do **not** change test assertions or behavior — this is a pure setup refactor.

After each file: `npx vitest run <file>` (green), then `npx tsc --noEmit && npm run lint`.

---

## Task 4: Migrate user-only router tests

**Files (apply Case A):**
- Modify: `src/server/routers/packs.test.ts`
- Modify: `src/server/routers/legacies.test.ts`
- Modify: `src/server/routers/challenges.test.ts`
- Modify: `src/server/routers/trackerTypes.test.ts`
- Modify: `src/server/routers/traits.test.ts`
- Modify: `src/server/routers/aspirations.test.ts`
- Modify: `src/server/routers/careers.test.ts`

> Note: confirm per file whether each `describe` block sets up only a user (Case A) or also a legacy (Case B); a few may have mixed blocks. `worlds-seed.test.ts` uses no user/legacy helpers — leave it untouched.

- [ ] **Step 1: Migrate `packs.test.ts`** (Case A). Run `npx vitest run src/server/routers/packs.test.ts` → PASS.
- [ ] **Step 2: Migrate `legacies.test.ts`.** Run its file → PASS.
- [ ] **Step 3: Migrate `challenges.test.ts`.** Run its file → PASS.
- [ ] **Step 4: Migrate `trackerTypes.test.ts`.** Run its file → PASS.
- [ ] **Step 5: Migrate `traits.test.ts`.** Run its file → PASS.
- [ ] **Step 6: Migrate `aspirations.test.ts`.** Run its file → PASS.
- [ ] **Step 7: Migrate `careers.test.ts`.** Run its file → PASS.
- [ ] **Step 8: Validate the batch**

Run: `npx tsc --noEmit && npm run lint && npx vitest run src/server/routers/packs.test.ts src/server/routers/legacies.test.ts src/server/routers/challenges.test.ts src/server/routers/trackerTypes.test.ts src/server/routers/traits.test.ts src/server/routers/aspirations.test.ts src/server/routers/careers.test.ts`
Expected: all green, no type/lint errors.

- [ ] **Step 9: Commit (GitButler)**

Files: the seven test files above.
Message: `refactor(test): adopt withTestUser fixture in user-only router tests`

---

## Task 5: Migrate user+legacy router tests

**Files (apply Case B / Case C):**
- Modify: `src/server/routers/households.test.ts`
- Modify: `src/server/routers/milestones.test.ts`

- [ ] **Step 1: Migrate `households.test.ts`** (Case B; keep extra household/sim setup as a second `beforeEach` per Case C). Run `npx vitest run src/server/routers/households.test.ts` → PASS.
- [ ] **Step 2: Migrate `milestones.test.ts`** (Case B/C; preserve multi-user `otherUser` tests using `createTestUser`/`cleanupUser` directly). Run its file → PASS.
- [ ] **Step 3: Validate**

Run: `npx tsc --noEmit && npm run lint && npx vitest run src/server/routers/households.test.ts src/server/routers/milestones.test.ts`
Expected: all green.

- [ ] **Step 4: Commit (GitButler)**

Files: `households.test.ts`, `milestones.test.ts`
Message: `refactor(test): adopt withTestLegacy fixture in household/milestone tests`

---

## Task 6: Migrate complex tests (sims, challengeRuns, lib)

These are the highest-boilerplate files and contain the special cases (`failingDb`, multi-user ownership checks, extra entity setup). Migrate one at a time and run after each.

**Files:**
- Modify: `src/server/routers/sims.test.ts` (~1,881 lines; Case B/C; preserve `failingDb` usages as `authedCaller(ctx.userId, fdb)`)
- Modify: `src/server/routers/challengeRuns.test.ts` (Case C — base user+legacy via `withTestLegacy`, tracker type via a second `beforeEach`; keep the local `buildChallengeWithPhaseAndTracker` helper)
- Modify: `src/server/lib/trackerComputation.test.ts` (Case B/C)
- Modify: `src/server/lib/ownership.test.ts` (Case A/B; preserve multi-user ownership tests using `createTestUser` directly)

- [ ] **Step 1: Migrate `sims.test.ts`.** Apply Case B/C to each `describe`. For every test using `failingDb(...)`, keep `const caller = authedCaller(ctx.userId, fdb)`. Remove `createTestUser`/`cleanupUser`/`createTestLegacy` imports only if no longer used anywhere in the file. Run `npx vitest run src/server/routers/sims.test.ts` → PASS.
- [ ] **Step 2: Migrate `challengeRuns.test.ts`.** Run its file → PASS.
- [ ] **Step 3: Migrate `trackerComputation.test.ts`.** Run its file → PASS.
- [ ] **Step 4: Migrate `ownership.test.ts`.** Run its file → PASS.
- [ ] **Step 5: Validate**

Run: `npx tsc --noEmit && npm run lint && npx vitest run src/server/routers/sims.test.ts src/server/routers/challengeRuns.test.ts src/server/lib/trackerComputation.test.ts src/server/lib/ownership.test.ts`
Expected: all green, no type/lint errors.

- [ ] **Step 6: Commit (GitButler)**

Files: the four files above.
Message: `refactor(test): adopt fixtures in sims/challengeRuns/lib tests`

---

## Task 7: Full-suite verification

- [ ] **Step 1: Full unit suite, twice (proves the skip path)**

Run: `npm test`
Expected: passes. Note whether `pretest` reset or skipped.

Run again: `npm test`
Expected: `pretest` prints `[test-db] simstrack_test up to date — skipping reset/seed`; full suite passes.

- [ ] **Step 2: Force-fresh suite**

Run: `npm run test:fresh`
Expected: `[test-db] resetting simstrack_test: forced (--force)`, reset + seed, full suite passes.

- [ ] **Step 3: E2E suite**

Ensure no stray `dev:test` server is running on port 3737 first (it would be reused against the wrong DB). Then run: `npm run test:e2e`
Expected: passes; `pretest:e2e` uses the same conditional setup (skips when current).

- [ ] **Step 4: Confirm the boilerplate reduction**

Sanity check: `grep -rL "withTestUser\|withTestLegacy" src/server/routers/*.test.ts` should now only list files that genuinely have no per-user setup (e.g. `worlds-seed.test.ts`). No migrated file should still contain a `beforeEach(async () => { const user = await createTestUser()` block that the fixtures were meant to replace.

- [ ] **Step 5: Reviews before merge**

Run the `/code-review` skill on the branch. (No UI changed, so design-system/web-qa reviews are not required.) Address any findings.

- [ ] **Step 6: Final commit / push** only if the user asks. Per project rules, do not push or open a PR unprompted.

---

## Self-Review notes

- **Spec coverage:** H4(1) reset tax → Tasks 1–2 (hash stamp + probe + package.json, unit & e2e). H4(2) fixtures → Tasks 3–6 (`withTestUser`/`withTestLegacy` + migrate all files). Done.
- **Type consistency:** `TestUserContext`/`TestLegacyContext` field names (`userId`, `caller`, `legacyId`) are used consistently in Tasks 3–6. `withTestUser`/`withTestLegacy` names match everywhere.
- **No placeholders:** the script and fixtures modules are shown in full; migrations specify the exact mechanical transform with before/after examples and enumerate every target file.
- **No new test files:** per the user, neither the script nor the fixtures get a dedicated test; the script is smoke-verified and the fixtures are covered transitively by the migrated suite.
- **Naming:** `scripts/setup-test-db.ts` follows the verb-first kebab convention of `scripts/backfill-uploads-to-s3.ts`.
- **No hardcoded DB name:** the database name is parsed from `DATABASE_URL` and flows into the consent string, log lines, and the per-db stamp filename (`test-db-<dbName>.json`) — nothing assumes `simstrack_test`.
- **Safety:** reset still uses a Prisma AI-consent string pinned to the (derived) test DB name; the `pack.count()` probe guards against a dropped/empty DB silently skipping a needed reset.
