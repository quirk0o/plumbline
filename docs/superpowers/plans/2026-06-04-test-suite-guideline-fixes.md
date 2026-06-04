# Test Suite Guideline Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all violations found in the four-agent test-suite review (2026-06-03): CSS-source assertions, CSS-class assertions, a mislabeled non-test, ~36 silent vacuous skips, e2e hard sleeps, plus medium/low cleanups (fireEvent→userEvent, networkidle, querySelector→role queries, duplicated polyfills, brittle structural assertions).

**Architecture:** Each task owns a disjoint set of files so tasks can run as independent subagents. Task 1 (shared seed-data helpers) must complete before Tasks 2–4. Tasks 5–10 are fully independent of each other and of Tasks 2–4. Task 11 (full validation) runs last.

**Tech Stack:** Vitest + React Testing Library (jsdom), tRPC integration tests against real PostgreSQL (must be running, `DATABASE_URL` in `.env`), Playwright e2e.

**Decisions already made by the user (do not re-litigate):**
- All severity tiers are in scope.
- `src/app/__tests__/contrast.test.ts` stays **as-is** (accepted exception). Do not touch it.
- The e2e test `'section titles are h2 headings'` is **deleted entirely** (not renamed, not relaxed).
- `src/components/ui/ghost-circle/__tests__/ghost-circle.test.tsx`, `hero.test.tsx`/`empty-state.test.tsx` `<em>` checks: leave as-is (accepted).

**Conventions that bind every task:**
- No `eslint-disable`, `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck` — ever. Fix the root cause.
- Never `cd`; run all commands from the repo root with explicit paths.
- Conventional commits; stage only the specific files you changed (`git add <file>`, never `git add .`).
- After each task: `npx tsc --noEmit` and `npm run lint` must both pass clean before committing.
- Targeted test runs: `npx vitest run <path>` (integration tests need PostgreSQL running and a seeded DB — `npm run db:seed` if lookups fail).

---

### Task 1: Seed-data helpers that fail loudly

The review found ~36 tests that silently pass when seed data is missing (`const x = await db.foo.findFirst(); if (!x) return`). The fix pattern already exists in `src/test/helpers.ts` (`getAnyPack`, `getAnyTrait` throw when the DB is unseeded). Add the missing getters; Tasks 2–4 consume them.

**Files:**
- Modify: `src/test/helpers.ts`
- (No new test file — these are test utilities; their behavior is exercised by the suites in Tasks 2–4.)

- [ ] **Step 1: Add the new helpers**

Append to `src/test/helpers.ts` (after `getAnyCareer`, before `createTestTrackerType`):

```ts
export async function getAnySkill(where: { maxLevel?: number } = {}) {
  const skill = await db.skill.findFirst({ where })
  if (!skill) throw new Error('No skill found. Is the DB seeded?')
  return skill
}

export async function getAnyAspiration() {
  const aspiration = await db.aspiration.findFirst()
  if (!aspiration) throw new Error('No aspirations found. Is the DB seeded?')
  return aspiration
}

export async function getTrackerTypeByName(name: string) {
  const trackerType = await db.trackerType.findFirst({ where: { name } })
  if (!trackerType) throw new Error(`No tracker type named "${name}". Is the DB seeded?`)
  return trackerType
}

export async function getAnyBuiltInTrackerType(
  opts: { requireComputationSpec?: boolean } = {},
) {
  const where = opts.requireComputationSpec
    ? { isBuiltIn: true, computationSpec: { not: Prisma.AnyNull } }
    : { isBuiltIn: true }
  const trackerType = await db.trackerType.findFirst({ where })
  if (!trackerType) throw new Error('No built-in tracker type found. Is the DB seeded?')
  return trackerType
}

/** Game traits (the `trait` model used by tracker computation — distinct from `personalityTrait`). */
export async function getGameTraits(count = 1) {
  const traits = await db.trait.findMany({ take: count })
  if (traits.length < count)
    throw new Error(`Need ${count} game traits, found ${traits.length}. Is the DB seeded?`)
  return traits
}

export async function getPersonalityTraits(count: number) {
  const traits = await db.personalityTrait.findMany({ take: count })
  if (traits.length < count)
    throw new Error(`Need ${count} personality traits, found ${traits.length}. Is the DB seeded?`)
  return traits
}

export async function getBaseGamePack() {
  const pack = await db.pack.findFirst({ where: { type: PackType.BASE_GAME } })
  if (!pack) throw new Error('No BASE_GAME pack found. Is the DB seeded?')
  return pack
}
```

Update the imports at the top of `src/test/helpers.ts`: `Prisma` must be imported for `Prisma.AnyNull`:

```ts
import { PackType, Gender, LifeStage, Prisma } from '@prisma/client'
```

Verify the model names against `prisma/schema.prisma` before assuming: `skill`, `aspiration`, `trackerType`, `trait`, `personalityTrait`, `pack` — if a model name differs, follow the schema, not this plan.

- [ ] **Step 2: Validate types and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors, no warnings.

- [ ] **Step 3: Commit**

```bash
git add src/test/helpers.ts
git commit -m "test(helpers): add loud-failing seed-data getters for skills, aspirations, tracker types, traits, base pack"
```

---

### Task 2: `sims.test.ts` — mislabeled test, silent skips, positional assertion

**Depends on Task 1.**

**Files:**
- Modify: `src/server/routers/sims.test.ts`

- [ ] **Step 1: Delete the mislabeled non-test (lines ~842–849)**

Delete this entire test:

```ts
it('updating only firstName does not call recomputeLegacyTrackers path (update succeeds without error)', async () => {
  const sim = await createTestSim(legacyId)
  // This test verifies the firstName-only update path does not trigger recompute.
  // If recompute were triggered with broken data it would throw; here it should succeed silently.
  await authedCaller(userId).sims.update({ id: sim.id, firstName: 'Renamed' })
  const record = await db.sim.findUnique({ where: { id: sim.id } })
  expect(record?.firstName).toBe('Renamed')
})
```

Rationale (record in the commit message): its name claims to verify "recompute not called" (a forbidden collaborator assertion per `.claude/rules/testing.md`), its body only re-asserts the scalar update already covered at line ~270, and the recompute-skip cannot be asserted deterministically because `sims.update` fires recompute as `void` (fire-and-forget — see `src/server/routers/sims.ts:399-401`). The positive recompute path is covered by `'stamps completedAt on Skill Maxed tracker when skill is maxed via addSkill'` in the same file (awaited path).

- [ ] **Step 2: Fix the positional/order-dependent assertion (line ~234–238)**

Replace:

```ts
it('returns all sims in the legacy', async () => {
  const result = await authedCaller(userId).sims.listByLegacy({ legacyId })
  expect(result).toHaveLength(2)
  expect(result[0]).toMatchObject({ firstName: expect.any(String), imageUrl: null })
})
```

with:

```ts
it('returns all sims in the legacy', async () => {
  const result = await authedCaller(userId).sims.listByLegacy({ legacyId })
  expect(result.map((s) => s.firstName).sort()).toEqual(['Alice', 'Bob'])
  for (const sim of result) {
    expect(sim.imageUrl).toBeNull()
  }
})
```

- [ ] **Step 3: Replace every silent skip with a loud helper**

Import the new helpers (extend the existing `@/test/helpers` import):

```ts
import { createTestUser, cleanupUser, createTestLegacy, createTestSim, getAnyTrait, getConflictingTraits, getAnySkill, getAnyAspiration, getAnyCareer, getTrackerTypeByName, getPersonalityTraits, createTestChallenge, createTestChallengePhase, createTestChallengeRun } from '@/test/helpers'
```

(Match the file's actual existing import list — keep whatever it already imports and add the new names. If `getAnyCareer` etc. are unused after the edits, don't import them.)

Then apply these mechanical replacements at the listed lines (line numbers are pre-edit; re-locate by content):

| Location | Old | New |
|---|---|---|
| ~284–285 (`swaps aspiration`) | `const aspiration = await db.aspiration.findFirst()` + `if (!aspiration) return` | `const aspiration = await getAnyAspiration()` |
| ~346–347 (`already at 6 traits`) | `const traits = await db.personalityTrait.findMany({ take: 7 })` + `if (traits.length < 7) return // not enough seed data` | `const traits = await getPersonalityTraits(7)` |
| ~376–377, ~384–385, ~392–393, ~401–402, ~412–413 (skill tests) | `const skill = await db.skill.findFirst()` + `if (!skill) return` | `const skill = await getAnySkill()` |
| ~866–869 (addSkill recompute test) | `const skill = await db.skill.findFirst()` / `if (!skill) return` / `const trackerType = await db.trackerType.findFirst({ where: { name: 'Skill Maxed' } })` / `if (!trackerType) return` | `const skill = await getAnySkill()` / `const trackerType = await getTrackerTypeByName('Skill Maxed')` |
| ~983–984, ~999–1000, ~1012–1013, ~1021–1022 (completeAspiration tests) | `const aspiration = await db.aspiration.findFirst()` + `if (!aspiration) return` | `const aspiration = await getAnyAspiration()` |
| ~1050–1051 (`endCareer`) | `const career = await db.career.findFirst()` + `if (!career) return` | `const career = await getAnyCareer()` |

Sweep the whole file afterwards: `grep -n ") return$" src/server/routers/sims.test.ts` must return no silent-skip guards (legitimate early returns inside helpers are fine — there should be none in tests).

- [ ] **Step 4: Run the file**

Run: `npx vitest run src/server/routers/sims.test.ts`
Expected: all tests pass (none skipped-by-stealth anymore). If any fail with "Is the DB seeded?", run `npm run db:seed` and re-run.

- [ ] **Step 5: Validate and commit**

Run: `npx tsc --noEmit && npm run lint`

```bash
git add src/server/routers/sims.test.ts
git commit -m "test(sims): remove mislabeled recompute-skip test, fail loudly on missing seed data, drop order-dependent assertion"
```

---

### Task 3: `trackerComputation.test.ts` — trivial unit tests, duplicate coverage, Proxy coupling, silent skips

**Depends on Task 1.**

**Files:**
- Modify: `src/server/lib/trackerComputation.test.ts`

- [ ] **Step 1: Delete the trivial pure-function unit tests (lines 6–43)**

Delete the entire `describe('resolveThresholds', ...)` and `describe('countThresholdsCrossed', ...)` blocks. Per the Testing Trophy rule (no unit tests for simple functions), their observable behavior is already covered by the THRESHOLD integration tests in this file (`recomputeLegacyTrackers — THRESHOLD earnedPoints and completion`, lines ~572–687) and in `challengeRuns.test.ts` (`full flow — THRESHOLD tracker...`).

Update the import on line 4 — remove the now-unused names:

```ts
import { evaluateSpec, recomputeLegacyTrackers } from './trackerComputation'
```

Do **not** un-export `resolveThresholds`/`countThresholdsCrossed` from `trackerComputation.ts` unless `tsc`/`lint` flags them as unused exports (they may be used by production code — check before touching).

- [ ] **Step 2: Delete the duplicated recompute test (the `describe('recomputeLegacyTrackers', ...)` block at line ~253)**

Delete the whole `describe('recomputeLegacyTrackers', () => { ... })` block containing only `'stamps completedAt when a built-in tracker becomes satisfied'` (~lines 253–295). This exact path is covered twice elsewhere with distinct entry points worth keeping: via the `sims.addSkill` mutation (`sims.test.ts`) and via `challengeRuns.link` + recompute (`challengeRuns.test.ts`). Keep the other `recomputeLegacyTrackers — ...` describes (completedAt one-way, manual skip, THRESHOLD, error swallowing) — those each test distinct behavior.

- [ ] **Step 3: Decouple the error-swallowing test from internal call order (lines ~485–502)**

The behavior under test ("recompute never rejects — a failing recompute must not crash the mutation that triggered it") is a real, intended contract. Keep it, but remove the coupling to *which model is queried first*. Replace the body:

```ts
describe('recomputeLegacyTrackers — swallows internal errors instead of rejecting', () => {
  it('resolves without throwing when any internal DB access throws', async () => {
    // Intended contract: recompute is fired from mutations (sometimes un-awaited);
    // an internal failure must never reject and crash the caller.
    // Every property access on this proxy throws, so the test holds no matter
    // which query recompute happens to run first.
    const brokenDb = new Proxy({} as Parameters<typeof recomputeLegacyTrackers>[0], {
      get() {
        throw new Error('simulated DB failure')
      },
    })
    await expect(recomputeLegacyTrackers(brokenDb, 'non-existent-legacy')).resolves.toBeUndefined()
  })
})
```

Caveat: if `recomputeLegacyTrackers` internally does `typeof db.x === 'function'` checks or `await`s the db object itself, a throw-on-every-get proxy may break differently than intended — run the test; if it fails for a structural reason (not the swallow contract), fall back to the original `challengeRun.findMany` proxy and instead add a comment documenting the deliberate coupling.

- [ ] **Step 4: Replace silent skips with loud helpers**

Add to the helpers import (line 3): `getAnySkill, getAnyAspiration, getTrackerTypeByName, getGameTraits`.

Mechanical replacements (locate by content; pre-edit line numbers shift after Steps 1–2):

| Old pattern | New |
|---|---|
| `const skill = await db.skill.findFirst()` + `if (!skill) return` (was at 64–65, 77–78, 347–348, 373–374, 388–389, 417–418, 585–586, 641–642) | `const skill = await getAnySkill()` |
| `const aspiration = await db.aspiration.findFirst()` + `if (!aspiration) return` (was at 109–110, 122–123) | `const aspiration = await getAnyAspiration()` |
| `const trackerType = await db.trackerType.findFirst({ where: { name: 'Skill Maxed' } })` + `if (!trackerType) return` (was at 419–420) | `const trackerType = await getTrackerTypeByName('Skill Maxed')` |
| `const trackerType = await db.trackerType.findFirst({ where: { name: 'Manual Goal' } })` + `if (!trackerType) return` (was at 444–445) | `const trackerType = await getTrackerTypeByName('Manual Goal')` |
| `const traits = await db.trait.findMany({ take: 2 })` + `if (traits.length < 2) return` (was at 546–547) | `const traits = await getGameTraits(2)` |
| `const trait = await db.trait.findFirst()` + `if (!trait) return` (was at 559–560) | `const [trait] = await getGameTraits(1)` |

There are also `if (!skill) return` / `if (!aspiration) return` occurrences in describes between lines 135–250 (causeOfDeath, countUnique, multi-condition) not shown above — sweep the **whole file**: `grep -n ") return$" src/server/lib/trackerComputation.test.ts` must come back empty.

- [ ] **Step 5: Run the file**

Run: `npx vitest run src/server/lib/trackerComputation.test.ts`
Expected: all remaining tests pass.

- [ ] **Step 6: Validate and commit**

Run: `npx tsc --noEmit && npm run lint`

```bash
git add src/server/lib/trackerComputation.test.ts
git commit -m "test(trackerComputation): drop trivial unit tests and duplicate recompute coverage, fail loudly on missing seed, decouple error-swallow test from query order"
```

---

### Task 4: Server-test cleanups — `challengeRuns`, `trackerTypes`, `packs`, `traits`, `storage`

**Depends on Task 1.**

**Files:**
- Modify: `src/server/routers/challengeRuns.test.ts`
- Modify: `src/server/routers/trackerTypes.test.ts`
- Modify: `src/server/routers/packs.test.ts`
- Modify: `src/server/routers/traits.test.ts`
- Modify: `src/lib/storage.test.ts`

- [ ] **Step 1: `challengeRuns.test.ts` — silent skips**

Add to the helpers import: `getAnySkill, getTrackerTypeByName, getAnyBuiltInTrackerType`.

| Location | Old | New |
|---|---|---|
| ~226–227 | `const builtIn = await db.trackerType.findFirst({ where: { isBuiltIn: true, computationSpec: { not: Prisma.AnyNull } } })` + `if (!builtIn) return` | `const builtIn = await getAnyBuiltInTrackerType({ requireComputationSpec: true })` |
| ~469–472 | `const skillMaxedType = await db.trackerType.findFirst({ where: { isBuiltIn: true, name: 'Skill Maxed' } })` + `if (!skillMaxedType) return // guard: skip if DB not seeded` | `const skillMaxedType = await getTrackerTypeByName('Skill Maxed')` |
| ~475–476 and ~530–531 | `const skill = await db.skill.findFirst({ where: { maxLevel: 10 } })` + `if (!skill) return` | `const skill = await getAnySkill({ maxLevel: 10 })` |

If `Prisma` import becomes unused in the file after the first replacement, remove it. Sweep: `grep -n ") return$" src/server/routers/challengeRuns.test.ts` → empty.

- [ ] **Step 2: `trackerTypes.test.ts` — silent skip (line ~87–88)**

Add `getAnyBuiltInTrackerType` to the helpers import. Replace:

```ts
const builtIn = await db.trackerType.findFirst({ where: { isBuiltIn: true } })
if (!builtIn) return
```

with:

```ts
const builtIn = await getAnyBuiltInTrackerType()
```

- [ ] **Step 3: `packs.test.ts` — silent skip + weak validation assertion**

Add `getBaseGamePack` to the helpers import. Replace (line ~87–88):

```ts
const basePack = await db.pack.findFirst({ where: { type: PackType.BASE_GAME } })
if (!basePack) return
```

with:

```ts
const basePack = await getBaseGamePack()
```

If `PackType`/`db` imports become unused, remove them.

Tighten the matcher-less throw assertion (line ~110–113). Replace:

```ts
it('throws a validation error for a non-CUID packId', async () => {
  const caller = authedCaller(userId)
  await expect(caller.packs.toggle({ packId: 'not-a-cuid' })).rejects.toThrow()
})
```

with:

```ts
it('throws a validation error for a non-CUID packId', async () => {
  const caller = authedCaller(userId)
  await expect(caller.packs.toggle({ packId: 'not-a-cuid' })).rejects.toMatchObject({
    code: 'BAD_REQUEST',
  })
})
```

(tRPC surfaces Zod input failures as `TRPCError` with `code: 'BAD_REQUEST'` — consistent with every other validation assertion in this suite. If the run shows a different code, assert the actual typed code, not a bare `toThrow()`.)

- [ ] **Step 4: `traits.test.ts` — slim the shape-tautology test (lines ~24–32)**

The `typeof trait.id === 'string'` checks re-assert the TypeScript type. The one meaningful behavior is that the procedure includes the `conflictsWith` relation. Replace the test body so it asserts only that:

```ts
it('includes the conflictsWith relation on every trait', async () => {
  const result = await unauthCaller().traits.getAll()
  expect(result.length).toBeGreaterThan(0)
  for (const trait of result) {
    expect(Array.isArray(trait.conflictsWith)).toBe(true)
  }
})
```

(Match the actual caller/procedure name used in the file — read the surrounding code first; only the assertions change.)

- [ ] **Step 5: `storage.test.ts` — assert the actual rethrown error (line ~62–67)**

Replace:

```ts
await expect(getObject('uploads/user-1/boom.png')).rejects.toBeTruthy()
```

with:

```ts
await expect(getObject('uploads/user-1/boom.png')).rejects.toMatchObject({
  name: 'InternalError',
})
```

- [ ] **Step 6: Run all five files**

Run: `npx vitest run src/server/routers/challengeRuns.test.ts src/server/routers/trackerTypes.test.ts src/server/routers/packs.test.ts src/server/routers/traits.test.ts src/lib/storage.test.ts`
Expected: all pass.

- [ ] **Step 7: Validate and commit**

Run: `npx tsc --noEmit && npm run lint`

```bash
git add src/server/routers/challengeRuns.test.ts src/server/routers/trackerTypes.test.ts src/server/routers/packs.test.ts src/server/routers/traits.test.ts src/lib/storage.test.ts
git commit -m "test(server): fail loudly on missing seed data, tighten weak error assertions"
```

---

### Task 5: `section-nav.test.tsx` — CSS-source test, scroll-math coupling, observe-count assertion

**Independent.**

**Files:**
- Modify: `src/app/app/legacies/[slug]/_components/__tests__/section-nav.test.tsx`

- [ ] **Step 1: Delete the CSS-source tap-target test (lines 191–215) and its imports**

Delete the entire trailing test including its comment block:

```ts
// Each rail item is a touch target — it needs a comfortable >=44px height,
// ... (comment lines)
it('gives each rail item a >=44px tap target', () => { ... })
```

Then delete the now-unused imports at the top:

```ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import navStyles from '../section-nav/section-nav.module.css'
```

This is the project's explicit "no CSS-source assertion tests" rule. Tap-target size is real-layout territory — note in the commit body that it belongs in an e2e/visual check if it needs automated coverage later (do NOT add that e2e test in this task).

- [ ] **Step 2: Relax the scroll assertion (lines ~109–114)**

The smooth-scroll *behavior* is observable; the exact `boundingRect.top + scrollY - 56` arithmetic is internal. Replace:

```ts
it('smooth-scrolls the window when an item is clicked', () => {
  render(<SectionNav items={items} />)
  fireEvent.click(screen.getByRole('button', { name: 'Milestones' }))
  // top = boundingRect.top (600) + scrollY (100) - 56 = 644
  expect(scrollToSpy).toHaveBeenCalledWith({ top: 644, behavior: 'smooth' })
})
```

with:

```ts
it('smooth-scrolls the window when an item is clicked', async () => {
  render(<SectionNav items={items} />)
  await userEvent.click(screen.getByRole('button', { name: 'Milestones' }))
  expect(scrollToSpy).toHaveBeenCalledWith(
    expect.objectContaining({ behavior: 'smooth', top: expect.any(Number) }),
  )
})
```

Add the import: `import userEvent from '@testing-library/user-event'` and drop `fireEvent` from the RTL import if now unused.

- [ ] **Step 3: Drop the observe-count assertion (lines ~105–106)**

In `'renders a nav with all items as buttons'`, delete:

```ts
// It observes every section element on mount.
expect(observeSpy).toHaveBeenCalledTimes(items.length)
```

The `aria-current` tests already prove the observer wiring works through observable output. Keep `observeSpy` itself (the mock class needs an `observe` function); if lint flags it as unused after this, replace `observe = observeSpy` with `observe = vi.fn()` and delete the `observeSpy` declaration + its `mockClear()`.

- [ ] **Step 4: Run the file**

Run: `npx vitest run "src/app/app/legacies/[slug]/_components/__tests__/section-nav.test.tsx"`
Expected: all remaining tests pass.

- [ ] **Step 5: Validate and commit**

Run: `npx tsc --noEmit && npm run lint`

```bash
git add "src/app/app/legacies/[slug]/_components/__tests__/section-nav.test.tsx"
git commit -m "test(section-nav): remove CSS-source tap-target assertion and internal-wiring checks"
```

---

### Task 6: `SimNode` — expose focused state accessibly, fix class-name assertions

**Independent.**

**Files:**
- Modify: `src/components/family-tree/SimNode.tsx`
- Modify: `src/components/family-tree/SimNode.test.tsx`

- [ ] **Step 1: Write the failing tests first (replace the two className tests, lines 95–105)**

Replace:

```tsx
it('applies focused CSS class when data.isFocused is true', () => {
  const { container } = render(<SimNode {...makeNodeProps({ isFocused: true })} />)
  const node = container.querySelector('[role="button"]')
  expect(node?.className).toMatch(/focused/)
})

it('does not apply focused CSS class when data.isFocused is false', () => {
  const { container } = render(<SimNode {...makeNodeProps({ isFocused: false })} />)
  const node = container.querySelector('[role="button"]')
  expect(node?.className).not.toMatch(/focused/)
})
```

with:

```tsx
it('marks the node as current when data.isFocused is true', () => {
  render(<SimNode {...makeNodeProps({ isFocused: true })} />)
  expect(screen.getByRole('button')).toHaveAttribute('aria-current', 'true')
})

it('does not mark the node as current when data.isFocused is false', () => {
  render(<SimNode {...makeNodeProps({ isFocused: false })} />)
  expect(screen.getByRole('button')).not.toHaveAttribute('aria-current')
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/components/family-tree/SimNode.test.tsx`
Expected: the two new tests FAIL (`aria-current` not set), all others pass.

- [ ] **Step 3: Add `aria-current` to the component**

In `src/components/family-tree/SimNode.tsx`, the focused node is the sim whose detail page the user navigated from — "current item in the tree". Change the node div (line ~21–27):

```tsx
<div
  className={`${styles.node} ${data.isFocused ? styles.focused : ''}`}
  onClick={handleClick}
  role="button"
  tabIndex={0}
  aria-current={data.isFocused ? 'true' : undefined}
  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleClick()}
  aria-label={`${data.firstName} ${data.lastName}`}
>
```

(The CSS class stays — it drives the styling; the test now asserts the accessible state instead of the class.)

- [ ] **Step 4: Convert `fireEvent` to `userEvent` (lines 74–93)**

Replace the three interaction tests:

```tsx
it('navigates to data.href when the node is clicked', async () => {
  render(<SimNode {...makeNodeProps()} />)
  await userEvent.click(screen.getByRole('button'))
  expect(mockPush).toHaveBeenCalledOnce()
  expect(mockPush).toHaveBeenCalledWith('/app/legacies/goth-dynasty/sims/sim-1')
})

it('navigates to data.href when Enter is pressed', async () => {
  render(<SimNode {...makeNodeProps()} />)
  screen.getByRole('button').focus()
  await userEvent.keyboard('{Enter}')
  expect(mockPush).toHaveBeenCalledOnce()
  expect(mockPush).toHaveBeenCalledWith('/app/legacies/goth-dynasty/sims/sim-1')
})

it('navigates to data.href when Space is pressed', async () => {
  render(<SimNode {...makeNodeProps()} />)
  screen.getByRole('button').focus()
  await userEvent.keyboard(' ')
  expect(mockPush).toHaveBeenCalledOnce()
  expect(mockPush).toHaveBeenCalledWith('/app/legacies/goth-dynasty/sims/sim-1')
})
```

Update imports: add `import userEvent from '@testing-library/user-event'`; remove `fireEvent` from the RTL import.

Note: `userEvent.click` on a `role="button"` div fires only click (not keydown), so `toHaveBeenCalledOnce()` still holds. If the Enter test double-fires (click + keydown synthesis), relax that one to `toHaveBeenCalledWith(...)` without the `Once` — but verify by running, don't assume.

- [ ] **Step 5: Run to verify all pass**

Run: `npx vitest run src/components/family-tree/SimNode.test.tsx`
Expected: PASS.

- [ ] **Step 6: Validate and commit**

Run: `npx tsc --noEmit && npm run lint`

```bash
git add src/components/family-tree/SimNode.tsx src/components/family-tree/SimNode.test.tsx
git commit -m "test(SimNode): assert focused state via aria-current instead of CSS class; use userEvent"
```

---

### Task 7: Small component-test cleanups — `portrait-avatar`, `icons`, `layout.a11y`, `chronicle-sections`

**Independent.**

**Files:**
- Modify: `src/components/ui/portrait-avatar/portrait-avatar.tsx`
- Modify: `src/components/ui/portrait-avatar/__tests__/portrait-avatar.test.tsx`
- Modify: `src/components/ui/icons/__tests__/empty-state-icons.test.tsx`
- Modify: `src/app/app/__tests__/layout.a11y.test.tsx`
- Modify: `src/app/app/legacies/[slug]/_components/__tests__/chronicle-sections.test.tsx`

- [ ] **Step 1: `portrait-avatar` — expose the accent ring as a data attribute, write failing tests**

Replace the two boxShadow tests (lines 48–62):

```tsx
it('marks the avatar as accented for ring="founder"', () => {
  render(
    <PortraitAvatar imageUrl={null} firstName="Bob" lastName="Pancakes" ring="founder" />
  )
  expect(screen.getByTitle('Bob Pancakes')).toHaveAttribute('data-accent')
})

it('does not mark the avatar as accented for ring="green"', () => {
  render(
    <PortraitAvatar imageUrl={null} firstName="Bob" lastName="Pancakes" ring="green" />
  )
  expect(screen.getByTitle('Bob Pancakes')).not.toHaveAttribute('data-accent')
})
```

(The monogram root carries `title={fullName}` when not linked — `getByTitle` reaches it without `container.firstChild`.)

Run: `npx vitest run src/components/ui/portrait-avatar/__tests__/portrait-avatar.test.tsx` — expect the two new tests to FAIL.

- [ ] **Step 2: Add `data-accent` to the component**

In `portrait-avatar.tsx`, both avatar variants (photo div at ~line 48, monogram div at ~line 63) get:

```tsx
data-accent={isAccent ? '' : undefined}
```

Run the file again — expect PASS. (The amber boxShadow itself is brand styling, now left to visual review per the no-style-assertion rule; the semantic founder/heir accent state is what's asserted.)

- [ ] **Step 3: `empty-state-icons.test.tsx` — drop the presentational assertions**

Keep the a11y behavior (decorative icons hidden from screen readers); drop `stroke` and the size-prop test. Replace the whole describe body:

```tsx
describe('empty-state icons', () => {
  it.each(icons)('%s renders a decorative svg hidden from screen readers', (_name, Icon) => {
    const { container } = render(<Icon />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg).toHaveAttribute('aria-hidden', 'true')
  })
})
```

(`container.querySelector('svg')` stays — an `aria-hidden` element has no accessible handle; that's the documented last-resort case.)

- [ ] **Step 4: `layout.a11y.test.tsx` — query the main landmark by role (lines 47–51)**

Replace:

```tsx
it('marks the main content region with a matching id', () => {
  const { container } = renderShell()
  const main = container.querySelector('main#main-content')
  expect(main).toBeTruthy()
})
```

with:

```tsx
it('marks the main content region with the skip-link target id', () => {
  renderShell()
  const main = screen.getByRole('main')
  expect(main).toHaveAttribute('id', 'main-content')
})
```

(The id assertion stays — it is load-bearing as the skip-link target; only the query changes. Ensure `screen` is imported.)

- [ ] **Step 5: `chronicle-sections.test.tsx` — assert anchors the way they're consumed (lines 97–105, 119–125)**

The section ids are functional anchor targets (SectionNav calls `document.getElementById(id)`), so assert through that consumption path instead of `container.querySelector('[data-section=...]')`:

```tsx
it('renders all four sections as anchor targets', () => {
  render(<ChronicleSections {...baseProps} />)
  for (const id of ['hero', 'succession', 'milestones', 'sims']) {
    // SectionNav locates sections via document.getElementById — assert the same contract.
    expect(document.getElementById(id), `section #${id}`).not.toBeNull()
  }
})
```

and:

```tsx
it('renders the treeSlot content inside the hero', () => {
  render(<ChronicleSections {...baseProps} />)
  const hero = document.getElementById('hero')
  expect(hero).not.toBeNull()
  const button = screen.getByRole('button', { name: /view family tree/i })
  expect(hero?.contains(button)).toBe(true)
})
```

Remove the `container` destructuring if now unused.

- [ ] **Step 6: Run all four files**

Run: `npx vitest run src/components/ui/portrait-avatar/__tests__/portrait-avatar.test.tsx src/components/ui/icons/__tests__/empty-state-icons.test.tsx src/app/app/__tests__/layout.a11y.test.tsx "src/app/app/legacies/[slug]/_components/__tests__/chronicle-sections.test.tsx"`
Expected: PASS.

- [ ] **Step 7: Validate and commit**

Run: `npx tsc --noEmit && npm run lint`

```bash
git add src/components/ui/portrait-avatar/portrait-avatar.tsx src/components/ui/portrait-avatar/__tests__/portrait-avatar.test.tsx src/components/ui/icons/__tests__/empty-state-icons.test.tsx src/app/app/__tests__/layout.a11y.test.tsx "src/app/app/legacies/[slug]/_components/__tests__/chronicle-sections.test.tsx"
git commit -m "test(components): replace style/structure assertions with semantic state and consumption-path queries"
```

---

### Task 8: Lineage-tree family — `crest-node`, `lineage-tree`, `use-pan-zoom`, `tree-utils`

**Independent.**

**Files:**
- Modify: `src/components/lineage-tree/__tests__/crest-node.test.tsx`
- Modify: `src/components/lineage-tree/__tests__/lineage-tree.test.tsx`
- Modify: `src/components/lineage-tree/__tests__/use-pan-zoom.test.ts`
- Modify: `src/components/family-tree/tree-utils.test.ts`

- [ ] **Step 1: `crest-node.test.tsx` — delete the structural scaffolding tests (lines 62–72)**

Delete both:

```tsx
it('applies the lift-shadow filter to the medallion', () => { ... })
it('includes a focus-ring element that is hidden by default', () => { ... })
```

These assert internal SVG plumbing (`circle[filter*="crest-lift"]`, `[data-focus-ring]`) whose visibility/effect is CSS-driven — visual-review territory.

**Keep** the monogram test (lines 53–60): `font-style="italic"` is a *rendered attribute* asserting the brand-mandated italic monogram (allowed per the project rule "assert rendered attributes"; the italic-typography decision explicitly wants italic monogram initials).

- [ ] **Step 2: `crest-node.test.tsx` — idiomatic keyboard activation (lines 42–51)**

Replace:

```tsx
it('activates on Enter and Space', () => {
  const onSelect = vi.fn()
  const { getByRole } = renderNode({}, { onSelect })
  const btn = getByRole('button')
  btn.focus()
  btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  btn.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
  expect(onSelect).toHaveBeenCalledTimes(2)
  expect(onSelect).toHaveBeenCalledWith('reed')
})
```

with:

```tsx
it('activates on Enter and Space', async () => {
  const onSelect = vi.fn()
  const { getByRole } = renderNode({}, { onSelect })
  getByRole('button').focus()
  await userEvent.keyboard('{Enter}')
  await userEvent.keyboard(' ')
  expect(onSelect).toHaveBeenCalledTimes(2)
  expect(onSelect).toHaveBeenCalledWith('reed')
})
```

Add `import userEvent from '@testing-library/user-event'`. If `userEvent.keyboard` on the SVG element double-fires (keydown+keyup both handled) or doesn't reach the handler, check how the component listens (likely `onKeyDown`) and assert accordingly — adjust the expected call count to what a real keyboard interaction produces, not to make the test green.

- [ ] **Step 3: `lineage-tree.test.tsx` — drop the tagName check (lines 66–73), convert fireEvent (line 85)**

Replace:

```tsx
it('renders an SVG <image> for a sim with a portrait', () => {
  const { getAllByTestId } = render(
    <LineageTree sims={sims} familyEdges={familyEdges} partnerEdges={partnerEdges} />,
  )
  const portraits = getAllByTestId('crest-portrait')
  expect(portraits).toHaveLength(1)
  expect(portraits[0].tagName.toLowerCase()).toBe('image')
})
```

with:

```tsx
it('renders a portrait for the sim that has an imageUrl', () => {
  const { getAllByTestId } = render(
    <LineageTree sims={sims} familyEdges={familyEdges} partnerEdges={partnerEdges} />,
  )
  expect(getAllByTestId('crest-portrait')).toHaveLength(1)
})
```

And in `'calls onSelectSim with the sim id when a node is clicked'`:

```tsx
it('calls onSelectSim with the sim id when a node is clicked', async () => {
  const onSelectSim = vi.fn()
  render(
    <LineageTree
      sims={sims}
      familyEdges={familyEdges}
      partnerEdges={partnerEdges}
      onSelectSim={onSelectSim}
    />,
  )
  await userEvent.click(screen.getByRole('button', { name: /Reed Caliente/ }))
  expect(onSelectSim).toHaveBeenCalledWith('heir')
})
```

Add the `userEvent` import; drop `fireEvent` from the RTL import if unused. **Leave the `dimmedIds` opacity test (lines 104–117) as-is** — the dim level is the prop-driven observable output of the search feature; the reviewers judged it defensible.

- [ ] **Step 4: `use-pan-zoom.test.ts` — delete the trivial `clampZoom` describe (lines 4–10)**

Delete:

```ts
describe('clampZoom', () => {
  it('clamps to [MIN_ZOOM, MAX_ZOOM]', () => {
    expect(clampZoom(0.01)).toBe(MIN_ZOOM)
    expect(clampZoom(99)).toBe(MAX_ZOOM)
    expect(clampZoom(1)).toBe(1)
  })
})
```

`clampZoom` is a one-line min/max clamp (Trophy: no unit tests for trivial functions); `computeFit`/`zoomAtPoint` tests stay — that's genuinely complex geometry. Remove `clampZoom` (and `MIN_ZOOM`/`MAX_ZOOM` if now unused) from the import on line 2.

- [ ] **Step 5: `tree-utils.test.ts` — relax id-format/style internals (lines 62–67, 85–91)**

Replace:

```ts
expect(edges[0]).toMatchObject({ id: 'family-p-c', source: 'p', target: 'c' })
```

with:

```ts
expect(edges[0]).toMatchObject({ source: 'p', target: 'c' })
```

and:

```ts
expect(edges[0]).toMatchObject({ id: 'partner-a-b', source: 'a', target: 'b', type: 'straight' })
expect(String(edges[0].style?.strokeDasharray)).toMatch(/\d/)
```

with:

```ts
expect(edges[0]).toMatchObject({ source: 'a', target: 'b' })
```

Rename that test from `'creates a dashed straight edge for each partner pair'` to `'creates one edge per partner pair'` (the dash styling is visual). Keep all geometry/positioning tests untouched.

- [ ] **Step 6: Run all four files**

Run: `npx vitest run src/components/lineage-tree/__tests__/crest-node.test.tsx src/components/lineage-tree/__tests__/lineage-tree.test.tsx src/components/lineage-tree/__tests__/use-pan-zoom.test.ts src/components/family-tree/tree-utils.test.ts`
Expected: PASS.

- [ ] **Step 7: Validate and commit**

Run: `npx tsc --noEmit && npm run lint`

```bash
git add src/components/lineage-tree/__tests__/crest-node.test.tsx src/components/lineage-tree/__tests__/lineage-tree.test.tsx src/components/lineage-tree/__tests__/use-pan-zoom.test.ts src/components/family-tree/tree-utils.test.ts
git commit -m "test(tree): drop structural SVG scaffolding, trivial clamp unit test, and edge id/style internals; use userEvent"
```

---

### Task 9: Shared jsdom polyfills + remaining `fireEvent` → `userEvent`

**Independent.**

**Files:**
- Modify: `src/test/setup.ts`
- Modify: `src/app/components/__tests__/create-sim-modal.test.tsx`
- Modify: `src/components/ui/dialog/__tests__/dialog.test.tsx`
- Modify: `src/components/ui/combobox/__tests__/combobox.test.tsx`
- Modify: `src/app/app/legacies/[slug]/sims/[id]/__tests__/add-relationship-modal.test.tsx`
- Modify: `src/app/components/__tests__/pack-grid.test.tsx`
- Modify: `src/app/components/__tests__/trait-picker.test.tsx`
- Modify: `src/app/auth/signin/__tests__/sign-in-form.test.tsx`

- [ ] **Step 1: Add the `matchMedia` polyfill to `src/test/setup.ts`**

After the ResizeObserver block (line ~17), add:

```ts
// jsdom does not implement matchMedia; Radix and reduced-motion checks touch it.
// Default to "no media query matches" (motion allowed, desktop).
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}
```

(`setup.ts` also runs for node-env integration tests — the `typeof window` guard keeps it inert there.)

- [ ] **Step 2: Remove the duplicated `beforeAll` polyfill blocks**

In each of these four files, delete the entire `beforeAll(() => { Object.defineProperty(window, 'matchMedia', ...) ... })` block (and its `MockResizeObserver` class where present — `setup.ts` already polyfills ResizeObserver):

- `src/app/components/__tests__/create-sim-modal.test.tsx` (lines ~8–22)
- `src/components/ui/dialog/__tests__/dialog.test.tsx` (lines ~7–21)
- `src/components/ui/combobox/__tests__/combobox.test.tsx` (locate the equivalent block)
- `src/app/app/legacies/[slug]/sims/[id]/__tests__/add-relationship-modal.test.tsx` (lines ~8–22)

Remove `beforeAll` from each file's vitest import if it becomes unused. **Leave `section-nav.test.tsx`'s `vi.stubGlobal('matchMedia', ...)` alone** — it intentionally controls the value per-test and unstubs in `afterEach`.

- [ ] **Step 3: Convert remaining `fireEvent` to `userEvent`**

- `trait-picker.test.tsx` (lines 24, 31, 60): make each test `async`, replace `fireEvent.click(x)` with `await userEvent.click(x)`; add `import userEvent from '@testing-library/user-event'`; remove `fireEvent` from the RTL import.
- `pack-grid.test.tsx` (line 78 and any other `fireEvent.click`): same conversion. The optimistic-update assertions already use `waitFor`, which composes fine with `userEvent`.
- `sign-in-form.test.tsx` (line 106): same conversion — the file already imports `userEvent`, so just replace the call:

```ts
it('calls signIn("google") with callbackUrl when Google button is clicked', async () => {
  render(<SignInForm />)
  await userEvent.click(screen.getByText('Continue with Google'))
  expect(mockSignIn).toHaveBeenCalledWith('google', { callbackUrl: '/app' })
})
```

Remove `fireEvent` from each file's RTL import once unused. Note: `portrait-avatar.test.tsx` keeps its `fireEvent.error(...)` — there is no userEvent equivalent for synthetic `error` events; that usage is correct.

- [ ] **Step 4: Run the affected component suites**

Run: `npx vitest run src/app/components/__tests__/create-sim-modal.test.tsx src/components/ui/dialog/__tests__/dialog.test.tsx src/components/ui/combobox/__tests__/combobox.test.tsx "src/app/app/legacies/[slug]/sims/[id]/__tests__/add-relationship-modal.test.tsx" src/app/components/__tests__/pack-grid.test.tsx src/app/components/__tests__/trait-picker.test.tsx src/app/auth/signin/__tests__/sign-in-form.test.tsx`
Expected: PASS. If a dialog/combobox test breaks after removing its local polyfill, the shared `setup.ts` polyfill differs from what that file stubbed — fix `setup.ts` to cover the need (e.g. `addEventListener` shape), never re-add the local block.

- [ ] **Step 5: Validate and commit**

Run: `npx tsc --noEmit && npm run lint`

```bash
git add src/test/setup.ts src/app/components/__tests__/create-sim-modal.test.tsx src/components/ui/dialog/__tests__/dialog.test.tsx src/components/ui/combobox/__tests__/combobox.test.tsx "src/app/app/legacies/[slug]/sims/[id]/__tests__/add-relationship-modal.test.tsx" src/app/components/__tests__/pack-grid.test.tsx src/app/components/__tests__/trait-picker.test.tsx src/app/auth/signin/__tests__/sign-in-form.test.tsx
git commit -m "test: consolidate jsdom polyfills into shared setup, migrate remaining fireEvent clicks to userEvent"
```

---

### Task 10: E2E fixes — hard sleeps, h2 test, networkidle, unscoped assertions, config glob

**Independent.** E2E runs need PostgreSQL seeded, `.env` present (if working in a worktree, copy the root `.env` in — `AUTH_SECRET` is required), and the Playwright web server starts automatically on port 3737.

**Files:**
- Modify: `e2e/sim-detail.spec.ts`
- Modify: `e2e/add-relationship-modal.spec.ts`
- Modify: `e2e/packs.spec.ts`
- Modify: `e2e/legacy-wizard.spec.ts`
- Modify: `playwright.config.ts`
- Possibly modify: the sim-detail page component (to add `data-testid="relationships"` — see Step 3)

- [ ] **Step 1: `sim-detail.spec.ts` — replace the two hard sleeps with response waits**

Test `'editing first name inline saves on blur'` (lines 36–43) — replace:

```ts
const firstNameInput = page.getByLabel('First name')
await firstNameInput.fill('Nova')
await firstNameInput.blur()

// Wait for the mutation to settle then reload to confirm persistence
await page.waitForTimeout(500)
await page.reload()
await expect(page.getByLabel('First name')).toHaveValue('Nova')
```

with:

```ts
const firstNameInput = page.getByLabel('First name')
await firstNameInput.fill('Nova')
// Register the wait BEFORE the blur that fires the mutation.
const saved = page.waitForResponse(
  (r) => r.url().includes('sims.update') && r.ok(),
)
await firstNameInput.blur()
await saved
await page.reload()
await expect(page.getByLabel('First name')).toHaveValue('Nova')
```

Test `'life stage dropdown saves on change'` (lines 54–58) — replace:

```ts
await page.getByRole('button', { name: 'Young Adult' }).click()
await page.getByRole('option', { name: 'Elder' }).click()
await page.waitForTimeout(500)
await page.reload()
await expect(page.getByRole('button', { name: 'Elder' })).toBeVisible()
```

with:

```ts
await page.getByRole('button', { name: 'Young Adult' }).click()
const saved = page.waitForResponse(
  (r) => r.url().includes('sims.update') && r.ok(),
)
await page.getByRole('option', { name: 'Elder' }).click()
await saved
await page.reload()
await expect(page.getByRole('button', { name: 'Elder' })).toBeVisible()
```

(tRPC batches requests at `/api/trpc/<proc>?batch=1`, so `url().includes('sims.update')` matches. Verify the actual procedure path in a trace/run if the wait times out; adjust the substring to what the network tab shows, e.g. a batched multi-proc URL still contains `sims.update`.)

- [ ] **Step 2: `sim-detail.spec.ts` — delete the heading-level test (lines 87–97)**

Delete the whole test (user decision: remove, don't relax):

```ts
test('section titles are h2 headings', async ({ page }) => { ... })
```

- [ ] **Step 3: `add-relationship-modal.spec.ts` — scope the post-add assertions**

The two `await expect(page.getByText('Mortimer Goth')).toBeVisible()` after the dialog closes (lines 58 and 76) pass even if only a stale combobox option is on the page. Scope them to the relationships region. First check the sim-detail page component for an existing handle on the Relationships section (`grep -rn "Relationships" src/app/app/legacies/`); if none exists, add `data-testid="relationships"` to the section element that wraps the relationships list in that component (last-resort testid is the documented pattern for container scoping). Then replace both occurrences:

```ts
await expect(dialog).not.toBeVisible()
await expect(
  page.getByTestId('relationships').getByText('Mortimer Goth'),
).toBeVisible()
```

Also tighten the combobox-open assertions (lines 41–42) to option roles:

```ts
await page.getByRole('button', { name: 'Select sim' }).click()
await expect(page.getByRole('option', { name: /Mortimer Goth/ })).toBeVisible()
await expect(page.getByRole('option', { name: /\+ Create new sim…/ })).toBeVisible()
```

And the selections at lines 53 and 71: `await page.getByRole('option', { name: /Mortimer Goth/ }).click()`. (If the combobox items don't expose `role="option"`, check the rendered markup first and scope with the listbox role or the dialog instead — do not leave the page-global `getByText`.)

- [ ] **Step 4: Remove the redundant `networkidle` waits**

Delete `await page.waitForLoadState('networkidle')` from:
- `e2e/sim-detail.spec.ts:5`
- `e2e/add-relationship-modal.spec.ts:5`
- `e2e/packs.spec.ts:5`
- `e2e/legacy-wizard.spec.ts:5`

Each is followed by web-first assertions/actions that auto-wait. In `legacy-wizard.spec.ts` the next action is a `getByRole('link').click()` with auto-wait; in `packs.spec.ts` the next line asserts the heading is visible. No replacement needed.

- [ ] **Step 5: `playwright.config.ts` — stop hand-listing authenticated specs**

A new authenticated spec currently silently never runs unless added to the `testMatch` array. Replace the `chromium` project (lines 21–26):

```ts
{
  name: 'chromium',
  testMatch: '**/*.spec.ts',
  testIgnore: '**/auth.spec.ts',
  use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/user.json' },
  dependencies: ['setup'],
},
```

(`setup`/`teardown` projects match `*.ts` under their own dirs, not `*.spec.ts`, so they're unaffected; `auth.spec.ts` stays exclusive to `chromium-unauthed`.)

- [ ] **Step 6: Run the e2e suite**

Run: `npm run test:e2e`
Expected: all specs pass, including both previously-sleeping sim-detail tests, with no `waitForTimeout` left: `grep -rn "waitForTimeout\|networkidle" e2e/` returns nothing.

- [ ] **Step 7: Validate and commit**

Run: `npx tsc --noEmit && npm run lint`

```bash
git add e2e/sim-detail.spec.ts e2e/add-relationship-modal.spec.ts e2e/packs.spec.ts e2e/legacy-wizard.spec.ts playwright.config.ts
# plus the component file if a relationships testid was added:
# git add <sim-detail page component path>
git commit -m "test(e2e): replace hard sleeps with response waits, drop networkidle and heading-level test, scope post-add assertions, glob authed specs"
```

---

### Task 11: Final full-suite validation

**Run last, after all other tasks are merged into the working branch.**

**Files:** none (verification only).

- [ ] **Step 1: Static analysis**

Run: `npx tsc --noEmit && npm run lint`
Expected: zero errors, zero warnings.

- [ ] **Step 2: Full unit/integration suite**

Run: `npm test`
Expected: all tests pass. Also verify no stealth-skips remain anywhere:

```bash
grep -rn ") return$" src --include='*.test.ts' --include='*.test.tsx'
```

Expected: no matches that guard a test body on missing seed data.

- [ ] **Step 3: Full e2e suite**

Run: `npm run test:e2e`
Expected: all specs pass.

- [ ] **Step 4: Report**

No commit. Report the three command outputs verbatim (pass/fail counts). If anything fails, fix it via superpowers:systematic-debugging before declaring the plan complete — do not paper over with retries, timeouts, or suppressions.
