# Challenges Browse & Detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first challenges UI — a browse/search page at `/app/challenges` (tabs: All / Mine / Public, URL-param search) and a read-only detail page at `/app/challenges/[id]` with a "Start run" dialog.

**Architecture:** Server components fetch with Prisma directly (dashboard pattern) through a new testable query lib (`src/server/lib/challengeBrowse.ts`). Search/tab state lives in URL params; a small client island debounces search input into `router.replace`. The start-run dialog is a client island calling the existing `challengeRuns.link` tRPC mutation. No schema changes, no new tRPC procedures.

**Tech Stack:** Next.js 16 (App Router — `params`/`searchParams` are Promises and must be awaited), Prisma, tRPC (existing `challengeRuns.link`), CSS Modules with Parchment & Forest tokens, Vitest + RTL, Playwright.

**Spec:** `docs/superpowers/specs/2026-06-04-challenges-browse-design.md`

---

## Codebase facts the implementer needs

- **Auth in server components:** `const session = await auth()` from `@/lib/auth`; `session?.user?.id`; redirect to `/auth/signin` if missing. See `src/app/app/page.tsx:8-11`.
- **Prisma client:** `import { db } from '@/server/db'`.
- **tRPC client (client components):** `import { trpc } from '@/trpc/client'`; mutations via `trpc.x.y.useMutation()` → `mutateAsync`. Model: `src/app/app/legacies/[slug]/_components/succession/name-heir-dialog.tsx`.
- **Shared UI** (`@/components/ui`): `Card` (`as`, `hoverable`, `padding`), `Button`/`ButtonLink` (`variant`, `size`), `Input` (`error?` + native props), `Badge`, `Dialog` (Radix compound: `Dialog.Trigger/Portal/Overlay/Content/Title/Description/Close`), `Combobox` (compound: `Combobox.Item`; trigger is a `<button>` that takes `id`, so `FormField`'s `htmlFor` associates; items render with `role="option"`), `FormField` (`label`, `htmlFor`, `error?`, `required?`), `EmptyState` (`icon`, `title`, `action`, children = body), `FeatherIcon`.
- **Plumbob:** `import { Plumbob } from '@/components/plumbob'` — props `size?: number`; renders `aria-hidden="true"` already.
- **Design tokens** (globals.css): `--text-sm` 12px, `--text-base` 14px, `--text-lg` 20px, `--space-N`, `--radius-*`, `--weight-semibold`, `--font-display`, `--green`, `--amber`, `--amber-text` (AA-legible amber for text), `--border`, `--text-muted`, `--error`, `--bg-card`.
- **Brand rules:** amber strictly for "yours/heir" accents; page titles use `--font-display` at `2rem` (see `.greeting` in `src/app/app/page.module.css`).
- **Tests:** `npm test` resets + seeds the dedicated test DB (`.env.test` → `simstrack_test`) via the `pretest` hook, then runs Vitest. Filter to one file with `npm test -- path/to/file.test.ts`. jsdom is auto-applied to `.test.tsx` under `src/app/`/`src/components/`; node env (real DB) otherwise. Integration helpers: `authedCaller`/`unauthCaller` from `@/test/caller`, `createTestUser`/`cleanupUser`/`createTestTrackerType` from `@/test/helpers`.
- **E2E:** `npm run test:e2e` resets the test DB, Playwright auto-starts `dev:test` on port 3737, `setup/auth.setup.ts` signs in `e2e-test@simtrack.test` (user is created by the auth callback) and saves cookies; `teardown/auth.teardown.ts` deletes that user with a raw `PrismaClient` + `PrismaPg` adapter — copy that pattern for spec-local DB setup.
- **Worktrees:** the root `.env` is gitignored — if executing in a worktree, copy `.env` and `.env.test` from the main checkout first or auth/DB will break.
- **Validation after every task:** `npx tsc --noEmit` and `npm run lint` must both be clean. No eslint-disable/@ts-ignore ever.
- **Never `cd`** — run all commands from the repo root.

## File structure

| File | Responsibility |
|---|---|
| `src/server/lib/challengeBrowse.ts` | Query lib: `listChallenges`, `getChallengeForView`, `normalizeTab`, `normalizeQuery` |
| `src/server/lib/challengeBrowse.test.ts` | Integration tests (real DB) for the above |
| `src/app/app/challenges/_components/ownership-badge.tsx` + `.module.css` | "Public"/"Yours" badge (green/amber), shared by list + detail |
| `src/app/app/challenges/_components/challenge-grid.tsx` + `.module.css` | Presentational card grid + both empty states |
| `src/app/app/challenges/_components/challenge-search.tsx` + `.module.css` | Client island: debounced search → `router.replace` |
| `src/app/app/challenges/__tests__/challenge-grid.test.tsx` | Component tests for grid |
| `src/app/app/challenges/__tests__/challenge-search.test.tsx` | Component tests for search |
| `src/app/app/challenges/page.tsx` + `page.module.css` | List page: auth, params, tabs, composition |
| `src/app/app/challenges/[id]/_components/phase-list.tsx` + `.module.css` | Presentational phase list with title fallbacks |
| `src/app/app/challenges/[id]/_components/start-run-dialog.tsx` + `.module.css` | Client dialog: pick legacy, name run, `challengeRuns.link` |
| `src/app/app/challenges/[id]/__tests__/phase-list.test.tsx` | Component tests for phase list |
| `src/app/app/challenges/[id]/__tests__/start-run-dialog.test.tsx` | Component tests for dialog |
| `src/app/app/challenges/[id]/page.tsx` + `page.module.css` | Detail page: auth, fetch, `notFound()`, composition |
| `src/app/app/components/app-nav.tsx` (modify) | Add "Challenges" nav link |
| `e2e/challenges.spec.ts` | One journey: browse → tabs → search → detail → start run |

**Two deliberate deviations from the spec:**
1. The start-run dialog receives the user's legacies as **props from the detail page's server fetch** instead of a client-side tRPC query. The page already talks to Prisma; passing `{id, name, slug}[]` down avoids a loading state and a second data-access pattern. (The spec's intent — "pick one of your legacies" — is unchanged.)
2. The dialog's no-legacies state links to **`/app/legacies/new`** ("Start a legacy") rather than the dashboard — it's the direct entry to legacy creation, one step closer to what the user needs.

---

### Task 1: Browse query lib

**Files:**
- Create: `src/server/lib/challengeBrowse.ts`
- Test: `src/server/lib/challengeBrowse.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/server/lib/challengeBrowse.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createTestUser, cleanupUser, createTestTrackerType } from '@/test/helpers'
import { db } from '@/server/db'
import {
  getChallengeForView,
  listChallenges,
  normalizeQuery,
  normalizeTab,
} from './challengeBrowse'

// Challenge.ownerId is SetNull on user delete, so cleanupUser does NOT remove
// challenges — track and delete them explicitly.
const createdChallengeIds: string[] = []

// Unique per-run marker so assertions are immune to seed rows and parallel files.
const run = `browse-${Date.now()}`

async function makeChallenge(data: {
  name: string
  description?: string
  isPublic?: boolean
  ownerId?: string | null
}) {
  const challenge = await db.challenge.create({
    data: {
      name: data.name,
      description: data.description ?? null,
      isPublic: data.isPublic ?? false,
      ownerId: data.ownerId ?? null,
    },
  })
  createdChallengeIds.push(challenge.id)
  return challenge
}

describe('listChallenges', () => {
  let userId: string
  let otherId: string

  beforeEach(async () => {
    ;({ id: userId } = await createTestUser())
    ;({ id: otherId } = await createTestUser())
  })

  afterEach(async () => {
    await db.challenge.deleteMany({ where: { id: { in: createdChallengeIds } } })
    createdChallengeIds.length = 0
    await cleanupUser(userId)
    await cleanupUser(otherId)
  })

  it("returns own and public challenges, never others' private ones", async () => {
    const ownPrivate = await makeChallenge({ name: `${run} own private`, ownerId: userId })
    const ownPublic = await makeChallenge({ name: `${run} own public`, ownerId: userId, isPublic: true })
    const otherPublic = await makeChallenge({ name: `${run} other public`, ownerId: otherId, isPublic: true })
    const otherPrivate = await makeChallenge({ name: `${run} other private`, ownerId: otherId })

    const ids = (await listChallenges(userId)).map((c) => c.id)
    expect(ids).toContain(ownPrivate.id)
    expect(ids).toContain(ownPublic.id)
    expect(ids).toContain(otherPublic.id)
    expect(ids).not.toContain(otherPrivate.id)
  })

  it('tab=mine returns only own challenges', async () => {
    const ownPrivate = await makeChallenge({ name: `${run} mine a`, ownerId: userId })
    const ownPublic = await makeChallenge({ name: `${run} mine b`, ownerId: userId, isPublic: true })
    const otherPublic = await makeChallenge({ name: `${run} not mine`, ownerId: otherId, isPublic: true })

    const ids = (await listChallenges(userId, { tab: 'mine' })).map((c) => c.id)
    expect(ids).toContain(ownPrivate.id)
    expect(ids).toContain(ownPublic.id)
    expect(ids).not.toContain(otherPublic.id)
  })

  it('tab=public excludes own private challenges', async () => {
    const ownPrivate = await makeChallenge({ name: `${run} hidden`, ownerId: userId })
    const ownPublic = await makeChallenge({ name: `${run} shared`, ownerId: userId, isPublic: true })

    const ids = (await listChallenges(userId, { tab: 'public' })).map((c) => c.id)
    expect(ids).toContain(ownPublic.id)
    expect(ids).not.toContain(ownPrivate.id)
  })

  it('searches name and description case-insensitively', async () => {
    const byName = await makeChallenge({ name: `${run} Decennial Dynasty`, isPublic: true })
    const byDescription = await makeChallenge({
      name: `${run} plain`,
      description: 'A DECENNIAL undertaking',
      isPublic: true,
    })
    const noMatch = await makeChallenge({ name: `${run} unrelated`, isPublic: true })

    const ids = (await listChallenges(userId, { q: 'decennial' })).map((c) => c.id)
    expect(ids).toContain(byName.id)
    expect(ids).toContain(byDescription.id)
    expect(ids).not.toContain(noMatch.id)
  })

  it('orders by name and counts phases', async () => {
    const b = await makeChallenge({ name: `${run} Bravo`, ownerId: userId })
    const a = await makeChallenge({ name: `${run} Alpha`, ownerId: userId })
    await db.challengePhase.create({
      data: { challengeId: a.id, generationNumber: 1, sortOrder: 0 },
    })

    const results = await listChallenges(userId, { q: run, tab: 'mine' })
    expect(results.map((c) => c.id)).toEqual([a.id, b.id])
    expect(results[0]._count.phases).toBe(1)
    expect(results[1]._count.phases).toBe(0)
  })
})

describe('normalizeTab / normalizeQuery', () => {
  it('coerces invalid tab values to all', () => {
    expect(normalizeTab('mine')).toBe('mine')
    expect(normalizeTab('public')).toBe('public')
    expect(normalizeTab('banana')).toBe('all')
    expect(normalizeTab(undefined)).toBe('all')
    expect(normalizeTab(['mine'])).toBe('all')
  })

  it('trims query text and ignores non-strings', () => {
    expect(normalizeQuery('  legacy ')).toBe('legacy')
    expect(normalizeQuery(undefined)).toBe('')
    expect(normalizeQuery(['a'])).toBe('')
  })
})

describe('getChallengeForView', () => {
  let userId: string
  let otherId: string

  beforeEach(async () => {
    ;({ id: userId } = await createTestUser())
    ;({ id: otherId } = await createTestUser())
  })

  afterEach(async () => {
    await db.challenge.deleteMany({ where: { id: { in: createdChallengeIds } } })
    createdChallengeIds.length = 0
    await cleanupUser(userId)
    await cleanupUser(otherId)
  })

  it('returns phases and trackers in sortOrder', async () => {
    const challenge = await makeChallenge({ name: `${run} ordered`, ownerId: userId })
    await db.challengePhase.create({
      data: { challengeId: challenge.id, title: 'Second', sortOrder: 1 },
    })
    const phase1 = await db.challengePhase.create({
      data: { challengeId: challenge.id, title: 'First', sortOrder: 0 },
    })
    const trackerType = await createTestTrackerType({ ownerId: userId })
    await db.trackerDefinition.create({
      data: { challengePhaseId: phase1.id, trackerTypeId: trackerType.id, name: 'Later goal', sortOrder: 1 },
    })
    await db.trackerDefinition.create({
      data: { challengePhaseId: phase1.id, trackerTypeId: trackerType.id, name: 'First goal', sortOrder: 0 },
    })

    const view = await getChallengeForView(userId, challenge.id)
    expect(view?.phases.map((p) => p.title)).toEqual(['First', 'Second'])
    expect(view?.phases[0].trackers.map((t) => t.name)).toEqual(['First goal', 'Later goal'])
  })

  it("returns null for another user's private challenge and for unknown ids", async () => {
    const otherPrivate = await makeChallenge({ name: `${run} secret`, ownerId: otherId })
    expect(await getChallengeForView(userId, otherPrivate.id)).toBeNull()
    expect(await getChallengeForView(userId, 'nonexistent-id')).toBeNull()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/server/lib/challengeBrowse.test.ts`
Expected: FAIL — cannot resolve `./challengeBrowse`

- [ ] **Step 3: Write the implementation**

```ts
// src/server/lib/challengeBrowse.ts
import { Prisma } from '@prisma/client'
import { db } from '@/server/db'

export type ChallengeTab = 'all' | 'mine' | 'public'

/** Coerce a raw searchParams value to a known tab; anything else means 'all'. */
export function normalizeTab(raw: unknown): ChallengeTab {
  return raw === 'mine' || raw === 'public' ? raw : 'all'
}

/** Coerce a raw searchParams value to trimmed search text; arrays/missing → ''. */
export function normalizeQuery(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim() : ''
}

export async function listChallenges(
  userId: string,
  { q = '', tab = 'all' }: { q?: string; tab?: ChallengeTab } = {},
) {
  // Access control is always applied: another user's private challenge is
  // never visible regardless of tab or search.
  const conditions: Prisma.ChallengeWhereInput[] = [
    { OR: [{ isPublic: true }, { ownerId: userId }] },
  ]
  if (tab === 'mine') conditions.push({ ownerId: userId })
  if (tab === 'public') conditions.push({ isPublic: true })
  const query = q.trim()
  if (query) {
    conditions.push({
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
      ],
    })
  }
  return db.challenge.findMany({
    where: { AND: conditions },
    select: {
      id: true,
      name: true,
      description: true,
      isPublic: true,
      ownerId: true,
      _count: { select: { phases: true } },
    },
    orderBy: { name: 'asc' },
  })
}

export async function getChallengeForView(userId: string, id: string) {
  return db.challenge.findFirst({
    where: { id, OR: [{ isPublic: true }, { ownerId: userId }] },
    select: {
      id: true,
      name: true,
      description: true,
      isPublic: true,
      ownerId: true,
      phases: {
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          title: true,
          generationNumber: true,
          description: true,
          trackers: {
            orderBy: { sortOrder: 'asc' },
            select: { id: true, name: true },
          },
        },
      },
    },
  })
}

export type ChallengeListRow = Awaited<ReturnType<typeof listChallenges>>[number]
export type ChallengeView = NonNullable<Awaited<ReturnType<typeof getChallengeForView>>>
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/server/lib/challengeBrowse.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Validate**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors, no warnings

- [ ] **Step 6: Commit**

```bash
git add src/server/lib/challengeBrowse.ts src/server/lib/challengeBrowse.test.ts
git commit -m "feat(challenges): browse query lib with access control, tabs, and search"
```

---

### Task 2: Ownership badge + challenge grid (presentational)

**Files:**
- Create: `src/app/app/challenges/_components/ownership-badge.tsx`
- Create: `src/app/app/challenges/_components/ownership-badge.module.css`
- Create: `src/app/app/challenges/_components/challenge-grid.tsx`
- Create: `src/app/app/challenges/_components/challenge-grid.module.css`
- Test: `src/app/app/challenges/__tests__/challenge-grid.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// src/app/app/challenges/__tests__/challenge-grid.test.tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ChallengeGrid } from '../_components/challenge-grid'

const items = [
  {
    id: 'c1',
    name: 'Legacy Challenge',
    description: 'Ten generations, one lot.',
    isYours: false,
    phaseCount: 10,
  },
  { id: 'c2', name: 'Rags to Riches', description: null, isYours: true, phaseCount: 1 },
]

describe('ChallengeGrid', () => {
  it('renders a card per challenge linking to its detail page', () => {
    render(<ChallengeGrid challenges={items} tab="all" query="" />)
    expect(screen.getByRole('link', { name: /Legacy Challenge/ })).toHaveAttribute(
      'href',
      '/app/challenges/c1',
    )
    expect(screen.getByText('Ten generations, one lot.')).toBeInTheDocument()
  })

  it('shows phase counts (singular and plural) and ownership badges', () => {
    render(<ChallengeGrid challenges={items} tab="all" query="" />)
    expect(screen.getByText('10 phases')).toBeInTheDocument()
    expect(screen.getByText('1 phase')).toBeInTheDocument()
    expect(screen.getByText('Public')).toBeInTheDocument()
    expect(screen.getByText('Yours')).toBeInTheDocument()
  })

  it('shows the no-matches empty state with a clear-search action preserving the tab', () => {
    render(<ChallengeGrid challenges={[]} tab="mine" query="dynasty" />)
    expect(screen.getByText(/No challenges match/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Clear search' })).toHaveAttribute(
      'href',
      '/app/challenges?tab=mine',
    )
  })

  it('clear-search on the All tab links to the bare path', () => {
    render(<ChallengeGrid challenges={[]} tab="all" query="dynasty" />)
    expect(screen.getByRole('link', { name: 'Clear search' })).toHaveAttribute(
      'href',
      '/app/challenges',
    )
  })

  it('shows tab-aware copy when there are no challenges at all', () => {
    render(<ChallengeGrid challenges={[]} tab="mine" query="" />)
    expect(screen.getByText(/haven't created any challenges yet/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/app/app/challenges/__tests__/challenge-grid.test.tsx`
Expected: FAIL — cannot resolve `../_components/challenge-grid`

- [ ] **Step 3: Write the ownership badge**

```tsx
// src/app/app/challenges/_components/ownership-badge.tsx
import { cn } from '@/lib/utils'
import styles from './ownership-badge.module.css'

/**
 * Category badge for challenge ownership. Like the pack-type badges, these
 * colors are category signals: green = public library, amber = yours.
 */
export function OwnershipBadge({ isYours }: { isYours: boolean }) {
  return (
    <span className={cn(styles.badge, isYours ? styles.yours : styles.public)}>
      {isYours ? 'Yours' : 'Public'}
    </span>
  )
}
```

```css
/* src/app/app/challenges/_components/ownership-badge.module.css */
.badge {
  display: inline-flex;
  align-items: center;
  font-size: var(--text-sm);
  font-weight: var(--weight-bold);
  padding: 0.15rem 0.45rem;
  border-radius: var(--radius-xs);
  line-height: 1;
  white-space: nowrap;
  letter-spacing: 0.02em;
  border: 1px solid transparent;
}

.public {
  background: color-mix(in srgb, var(--green) 12%, transparent);
  color: var(--green);
  border-color: color-mix(in srgb, var(--green) 22%, transparent);
}

.yours {
  background: color-mix(in srgb, var(--amber) 14%, transparent);
  color: var(--amber-text);
  border-color: color-mix(in srgb, var(--amber) 28%, transparent);
}
```

- [ ] **Step 4: Write the grid**

```tsx
// src/app/app/challenges/_components/challenge-grid.tsx
import Link from 'next/link'
import { ButtonLink, Card, EmptyState, FeatherIcon } from '@/components/ui'
import type { ChallengeTab } from '@/server/lib/challengeBrowse'
import { OwnershipBadge } from './ownership-badge'
import styles from './challenge-grid.module.css'

export interface ChallengeGridItem {
  id: string
  name: string
  description: string | null
  isYours: boolean
  phaseCount: number
}

interface ChallengeGridProps {
  challenges: ChallengeGridItem[]
  tab: ChallengeTab
  query: string
}

const EMPTY_COPY: Record<ChallengeTab, string> = {
  all: 'Public challenges will appear here as they are added.',
  mine: "You haven't created any challenges yet.",
  public: 'No public challenges have been shared yet.',
}

function clearSearchHref(tab: ChallengeTab): string {
  return tab === 'all' ? '/app/challenges' : `/app/challenges?tab=${tab}`
}

export function ChallengeGrid({ challenges, tab, query }: ChallengeGridProps) {
  if (challenges.length === 0 && query) {
    return (
      <EmptyState
        icon={<FeatherIcon size={28} />}
        title={<>No challenges match &ldquo;{query}&rdquo;</>}
        action={
          <ButtonLink variant="outline" size="sm" href={clearSearchHref(tab)}>
            Clear search
          </ButtonLink>
        }
      >
        Try a different name, or browse the full library.
      </EmptyState>
    )
  }

  if (challenges.length === 0) {
    return (
      <EmptyState icon={<FeatherIcon size={28} />} title="No challenges here yet">
        {EMPTY_COPY[tab]}
      </EmptyState>
    )
  }

  return (
    <ul className={styles.grid}>
      {challenges.map((challenge) => (
        <li key={challenge.id}>
          <Link href={`/app/challenges/${challenge.id}`} className={styles.cardLink}>
            <Card as="article" hoverable className={styles.card}>
              <h3 className={styles.name}>{challenge.name}</h3>
              {challenge.description && (
                <p className={styles.description}>{challenge.description}</p>
              )}
              <div className={styles.meta}>
                <span className={styles.phaseCount}>
                  {challenge.phaseCount} {challenge.phaseCount === 1 ? 'phase' : 'phases'}
                </span>
                <OwnershipBadge isYours={challenge.isYours} />
              </div>
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  )
}
```

```css
/* src/app/app/challenges/_components/challenge-grid.module.css */
.grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-4);
}

@media (max-width: 900px) {
  .grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 600px) {
  .grid {
    grid-template-columns: 1fr;
  }
}

.cardLink {
  display: block;
  height: 100%;
  text-decoration: none;
  color: inherit;
}

.card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  height: 100%;
}

.name {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
  color: var(--text);
  margin: 0;
}

.description {
  margin: 0;
  color: var(--text-muted);
  font-size: var(--text-sm);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.meta {
  margin-top: auto;
  padding-top: var(--space-2);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.phaseCount {
  color: var(--text-muted);
  font-size: var(--text-sm);
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- src/app/app/challenges/__tests__/challenge-grid.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 6: Validate**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors, no warnings

- [ ] **Step 7: Commit**

```bash
git add src/app/app/challenges/_components/ownership-badge.tsx src/app/app/challenges/_components/ownership-badge.module.css src/app/app/challenges/_components/challenge-grid.tsx src/app/app/challenges/_components/challenge-grid.module.css src/app/app/challenges/__tests__/challenge-grid.test.tsx
git commit -m "feat(challenges): challenge grid with ownership badges and empty states"
```

---

### Task 3: Debounced URL-synced search input

**Files:**
- Create: `src/app/app/challenges/_components/challenge-search.tsx`
- Create: `src/app/app/challenges/_components/challenge-search.module.css`
- Test: `src/app/app/challenges/__tests__/challenge-search.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// src/app/app/challenges/__tests__/challenge-search.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// External boundary: the Next.js router. The component's observable behavior
// is the URL it asks the router to replace.
const replace = vi.fn()
let params: URLSearchParams
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => params,
}))

import { ChallengeSearch } from '../_components/challenge-search'

describe('ChallengeSearch', () => {
  beforeEach(() => {
    replace.mockClear()
    params = new URLSearchParams()
  })

  it('debounces typing into a single URL update with the query', async () => {
    const user = userEvent.setup()
    render(<ChallengeSearch />)

    await user.type(screen.getByRole('searchbox', { name: 'Search challenges' }), 'legacy')

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith('/app/challenges?q=legacy', { scroll: false }),
    )
    expect(replace).toHaveBeenCalledTimes(1)
  })

  it('preserves the current tab when searching', async () => {
    params = new URLSearchParams('tab=mine')
    const user = userEvent.setup()
    render(<ChallengeSearch />)

    await user.type(screen.getByRole('searchbox', { name: 'Search challenges' }), 'rags')

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith('/app/challenges?tab=mine&q=rags', { scroll: false }),
    )
  })

  it('drops q from the URL when the input is cleared', async () => {
    params = new URLSearchParams('q=legacy')
    const user = userEvent.setup()
    render(<ChallengeSearch />)

    const input = screen.getByRole('searchbox', { name: 'Search challenges' })
    expect(input).toHaveValue('legacy')
    await user.clear(input)

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith('/app/challenges', { scroll: false }),
    )
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/app/app/challenges/__tests__/challenge-search.test.tsx`
Expected: FAIL — cannot resolve `../_components/challenge-search`

- [ ] **Step 3: Write the implementation**

```tsx
// src/app/app/challenges/_components/challenge-search.tsx
'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui'
import styles from './challenge-search.module.css'

const DEBOUNCE_MS = 300

/**
 * Search box for the challenges list. Keeps its own input state for smooth
 * typing and debounces into `router.replace`, so the query lives in the URL
 * (shareable) and the server re-filters. Preserves other params (tab).
 */
export function ChallengeSearch() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlQuery = searchParams.get('q') ?? ''
  const [value, setValue] = useState(urlQuery)
  const [, startTransition] = useTransition()

  useEffect(() => {
    if (value === urlQuery) return
    const handle = setTimeout(() => {
      const params = new URLSearchParams(searchParams)
      if (value.trim()) params.set('q', value)
      else params.delete('q')
      const qs = params.toString()
      startTransition(() => {
        router.replace(qs ? `/app/challenges?${qs}` : '/app/challenges', { scroll: false })
      })
    }, DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [value, urlQuery, searchParams, router])

  return (
    <Input
      type="search"
      className={styles.input}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder="Search challenges…"
      aria-label="Search challenges"
    />
  )
}
```

```css
/* src/app/app/challenges/_components/challenge-search.module.css */
.input {
  width: 260px;
  max-width: 100%;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/app/app/challenges/__tests__/challenge-search.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Validate**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors, no warnings

- [ ] **Step 6: Commit**

```bash
git add src/app/app/challenges/_components/challenge-search.tsx src/app/app/challenges/_components/challenge-search.module.css src/app/app/challenges/__tests__/challenge-search.test.tsx
git commit -m "feat(challenges): debounced URL-synced challenge search input"
```

---

### Task 4: List page, tabs, and nav link

The page itself is an async server component (auth + DB) — its pieces are covered by Task 1 (queries) and Task 2 (grid) tests, and the assembled page by the Task 8 e2e journey. No new unit test here.

**Files:**
- Create: `src/app/app/challenges/page.tsx`
- Create: `src/app/app/challenges/page.module.css`
- Modify: `src/app/app/components/app-nav.tsx:32-45` (add a link between Dashboard and Settings)

- [ ] **Step 1: Write the page**

```tsx
// src/app/app/challenges/page.tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { cn } from '@/lib/utils'
import {
  listChallenges,
  normalizeQuery,
  normalizeTab,
  type ChallengeTab,
} from '@/server/lib/challengeBrowse'
import { ChallengeGrid } from './_components/challenge-grid'
import { ChallengeSearch } from './_components/challenge-search'
import styles from './page.module.css'

interface Props {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

const TABS: { value: ChallengeTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'mine', label: 'Mine' },
  { value: 'public', label: 'Public' },
]

function tabHref(tab: ChallengeTab, q: string): string {
  const params = new URLSearchParams()
  if (tab !== 'all') params.set('tab', tab)
  if (q) params.set('q', q)
  const qs = params.toString()
  return qs ? `/app/challenges?${qs}` : '/app/challenges'
}

export default async function ChallengesPage({ searchParams }: Props) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) redirect('/auth/signin')

  const params = await searchParams
  const tab = normalizeTab(params.tab)
  const q = normalizeQuery(params.q)

  const challenges = await listChallenges(userId, { q, tab })

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Challenges</h1>
        <ChallengeSearch />
      </div>

      <nav className={styles.tabs} aria-label="Filter challenges">
        {TABS.map(({ value, label }) => (
          <Link
            key={value}
            href={tabHref(value, q)}
            className={cn(styles.tab, tab === value && styles.tabActive)}
            aria-current={tab === value ? 'page' : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>

      <ChallengeGrid
        challenges={challenges.map((challenge) => ({
          id: challenge.id,
          name: challenge.name,
          description: challenge.description,
          isYours: challenge.ownerId === userId,
          phaseCount: challenge._count.phases,
        }))}
        tab={tab}
        query={q}
      />
    </div>
  )
}
```

```css
/* src/app/app/challenges/page.module.css */
.page {
  max-width: 900px;
  margin: 0 auto;
  padding: 2.5rem 2rem 4rem;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
  margin-bottom: var(--space-6);
}

.title {
  font-family: var(--font-display);
  font-size: 2rem;
  font-weight: var(--weight-semibold);
  color: var(--text);
  margin: 0;
}

.tabs {
  display: flex;
  gap: var(--space-5);
  border-bottom: 1px solid var(--border);
  margin-bottom: var(--space-6);
}

.tab {
  padding: var(--space-2) 0;
  font-size: var(--text-base);
  color: var(--text-muted);
  text-decoration: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
}

.tab:hover {
  color: var(--text);
}

.tabActive {
  color: var(--green);
  border-bottom-color: var(--green);
  font-weight: var(--weight-semibold);
}
```

- [ ] **Step 2: Add the nav link**

In `src/app/app/components/app-nav.tsx`, inside `<div className={styles.links}>`, between the Dashboard and Settings links, add:

```tsx
        <Link
          href="/app/challenges"
          className={`${styles.link} ${isActive('/app/challenges') ? styles.linkActive : ''}`}
        >
          Challenges
        </Link>
```

- [ ] **Step 3: Validate**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors, no warnings

Run the existing suite to confirm nothing regressed (app-nav has a11y tests):
`npm test`
Expected: PASS

- [ ] **Step 4: Manual smoke check (optional but recommended)**

Start the dev server (`npm run dev`), sign in via magic link (see AGENTS.md: submit any email at `/auth/signin`, then `grep "Magic link" .next/dev/logs/next-development.log`). Insert sample data so the page isn't empty:

```bash
npx tsx -e "
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import 'dotenv/config'
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })
const c = await db.challenge.create({ data: {
  name: 'Legacy Challenge', isPublic: true,
  description: 'Ten generations on a single lot, starting from nothing.',
  phases: { create: [
    { generationNumber: 1, title: 'The Founder', sortOrder: 0 },
    { generationNumber: 2, sortOrder: 1 },
  ] },
} })
console.log('created', c.id)
await db.\$disconnect()
"
```

Visit `http://localhost:3000/app/challenges`: tabs switch, search filters (typing pauses ~300ms then updates), card shows "2 phases" and a green Public badge. Check dark mode via the theme toggle.

- [ ] **Step 5: Commit**

```bash
git add src/app/app/challenges/page.tsx src/app/app/challenges/page.module.css src/app/app/components/app-nav.tsx
git commit -m "feat(challenges): browse page with tabs, search, and nav entry"
```

---

### Task 5: Phase list (presentational, detail page)

**Files:**
- Create: `src/app/app/challenges/[id]/_components/phase-list.tsx`
- Create: `src/app/app/challenges/[id]/_components/phase-list.module.css`
- Test: `src/app/app/challenges/[id]/__tests__/phase-list.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// src/app/app/challenges/[id]/__tests__/phase-list.test.tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { PhaseList, type PhaseListPhase } from '../_components/phase-list'

function phase(over: Partial<PhaseListPhase> & { id: string }): PhaseListPhase {
  return {
    title: null,
    generationNumber: null,
    description: null,
    trackers: [],
    ...over,
  }
}

describe('PhaseList', () => {
  it('uses the phase title when present', () => {
    render(<PhaseList phases={[phase({ id: 'p1', title: 'The Founder', generationNumber: 1 })]} />)
    expect(screen.getByRole('heading', { name: 'The Founder' })).toBeInTheDocument()
  })

  it('falls back to "Generation N" when only a generation number is set', () => {
    render(<PhaseList phases={[phase({ id: 'p1', generationNumber: 3 })]} />)
    expect(screen.getByRole('heading', { name: 'Generation 3' })).toBeInTheDocument()
  })

  it('falls back to "Legacy-wide goals" when title and generation are both null', () => {
    render(<PhaseList phases={[phase({ id: 'p1' })]} />)
    expect(screen.getByRole('heading', { name: 'Legacy-wide goals' })).toBeInTheDocument()
  })

  it('lists each tracker as a goal line', () => {
    render(
      <PhaseList
        phases={[
          phase({
            id: 'p1',
            title: 'The Founder',
            description: 'Move in, survive, marry.',
            trackers: [
              { id: 't1', name: 'Max one skill' },
              { id: 't2', name: 'Complete an aspiration' },
            ],
          }),
        ]}
      />,
    )
    expect(screen.getByText('Move in, survive, marry.')).toBeInTheDocument()
    expect(screen.getByText('Max one skill')).toBeInTheDocument()
    expect(screen.getByText('Complete an aspiration')).toBeInTheDocument()
  })

  it('shows a quiet note when there are no phases', () => {
    render(<PhaseList phases={[]} />)
    expect(screen.getByText('This challenge has no phases yet.')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- "src/app/app/challenges/[id]/__tests__/phase-list.test.tsx"`
Expected: FAIL — cannot resolve `../_components/phase-list`

- [ ] **Step 3: Write the implementation**

```tsx
// src/app/app/challenges/[id]/_components/phase-list.tsx
import { Card } from '@/components/ui'
import { Plumbob } from '@/components/plumbob'
import styles from './phase-list.module.css'

export interface PhaseListPhase {
  id: string
  title: string | null
  generationNumber: number | null
  description: string | null
  trackers: { id: string; name: string }[]
}

function phaseTitle(phase: Pick<PhaseListPhase, 'title' | 'generationNumber'>): string {
  if (phase.title) return phase.title
  if (phase.generationNumber != null) return `Generation ${phase.generationNumber}`
  return 'Legacy-wide goals'
}

/** Read-only, fully expanded list of a challenge's phases and their goals. */
export function PhaseList({ phases }: { phases: PhaseListPhase[] }) {
  if (phases.length === 0) {
    return <p className={styles.noPhases}>This challenge has no phases yet.</p>
  }

  return (
    <ol className={styles.list}>
      {phases.map((phase) => (
        <li key={phase.id}>
          <Card as="article">
            <h2 className={styles.phaseTitle}>{phaseTitle(phase)}</h2>
            {phase.description && (
              <p className={styles.phaseDescription}>{phase.description}</p>
            )}
            {phase.trackers.length > 0 && (
              <ul className={styles.goals}>
                {phase.trackers.map((tracker) => (
                  <li key={tracker.id} className={styles.goal}>
                    <Plumbob size={10} />
                    {tracker.name}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </li>
      ))}
    </ol>
  )
}
```

(`Plumbob` already renders `aria-hidden="true"` — it's the brand-sanctioned decorative marker, so the goal text remains the only content screen readers see.)

```css
/* src/app/app/challenges/[id]/_components/phase-list.module.css */
.noPhases {
  color: var(--text-muted);
  font-size: var(--text-base);
  margin: 0;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.phaseTitle {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
  color: var(--text);
  margin: 0;
}

.phaseDescription {
  color: var(--text-muted);
  font-size: var(--text-sm);
  line-height: 1.5;
  margin: var(--space-1) 0 0;
}

.goals {
  list-style: none;
  margin: var(--space-3) 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.goal {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-base);
  color: var(--text);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- "src/app/app/challenges/[id]/__tests__/phase-list.test.tsx"`
Expected: PASS (5 tests)

- [ ] **Step 5: Validate**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors, no warnings

- [ ] **Step 6: Commit**

```bash
git add "src/app/app/challenges/[id]/_components/phase-list.tsx" "src/app/app/challenges/[id]/_components/phase-list.module.css" "src/app/app/challenges/[id]/__tests__/phase-list.test.tsx"
git commit -m "feat(challenges): read-only phase list with generation title fallbacks"
```

---

### Task 6: Start-run dialog

**Files:**
- Create: `src/app/app/challenges/[id]/_components/start-run-dialog.tsx`
- Create: `src/app/app/challenges/[id]/_components/start-run-dialog.module.css`
- Test: `src/app/app/challenges/[id]/__tests__/start-run-dialog.test.tsx`

- [ ] **Step 1: Write the failing tests**

The Radix Popover inside `Combobox` needs `matchMedia`/`ResizeObserver` polyfills in jsdom — copy the `beforeAll` from `src/app/app/legacies/[slug]/sims/[id]/__tests__/add-relationship-modal.test.tsx:8-23` exactly. The combobox trigger's accessible name is its placeholder (it sets `aria-label` from the placeholder until a value is chosen).

```tsx
// src/app/app/challenges/[id]/__tests__/start-run-dialog.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// External boundaries — mock the mutation + router; assert what the dialog
// persists and where it navigates, not its internals.
const mutateAsync = vi.fn().mockResolvedValue({})
const push = vi.fn()
vi.mock('@/trpc/client', () => ({
  trpc: {
    challengeRuns: {
      link: { useMutation: () => ({ mutateAsync, isPending: false }) },
    },
  },
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false, media: query, onchange: null,
      addListener: vi.fn(), removeListener: vi.fn(),
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
  class MockResizeObserver {
    observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn()
  }
  global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver
})

import { StartRunDialog } from '../_components/start-run-dialog'

const legacies = [
  { id: 'leg-1', name: 'The Calientes', slug: 'the-calientes' },
  { id: 'leg-2', name: 'The Goths', slug: 'the-goths' },
]

function dialog() {
  return within(screen.getByRole('dialog'))
}

describe('StartRunDialog', () => {
  beforeEach(() => {
    mutateAsync.mockClear()
    push.mockClear()
  })

  it('starts a run on the chosen legacy and navigates to it', async () => {
    const user = userEvent.setup()
    render(
      <StartRunDialog challengeId="ch-1" challengeName="Legacy Challenge" legacies={legacies} />,
    )

    await user.click(screen.getByRole('button', { name: 'Start run' }))
    await user.click(dialog().getByRole('button', { name: /choose a legacy/i }))
    await user.click(await screen.findByRole('option', { name: 'The Calientes' }))
    await user.click(dialog().getByRole('button', { name: 'Start run' }))

    expect(mutateAsync).toHaveBeenCalledWith({
      legacyId: 'leg-1',
      challengeId: 'ch-1',
      name: 'Legacy Challenge',
    })
    expect(push).toHaveBeenCalledWith('/app/legacies/the-calientes')
  })

  it('pre-fills the run name with the challenge name and sends edits', async () => {
    const user = userEvent.setup()
    render(
      <StartRunDialog challengeId="ch-1" challengeName="Legacy Challenge" legacies={legacies} />,
    )

    await user.click(screen.getByRole('button', { name: 'Start run' }))
    const nameInput = dialog().getByLabelText('Run name')
    expect(nameInput).toHaveValue('Legacy Challenge')
    await user.clear(nameInput)
    await user.type(nameInput, 'Second attempt')
    await user.click(dialog().getByRole('button', { name: /choose a legacy/i }))
    await user.click(await screen.findByRole('option', { name: 'The Goths' }))
    await user.click(dialog().getByRole('button', { name: 'Start run' }))

    expect(mutateAsync).toHaveBeenCalledWith({
      legacyId: 'leg-2',
      challengeId: 'ch-1',
      name: 'Second attempt',
    })
  })

  it('requires choosing a legacy before starting', async () => {
    const user = userEvent.setup()
    render(
      <StartRunDialog challengeId="ch-1" challengeName="Legacy Challenge" legacies={legacies} />,
    )

    await user.click(screen.getByRole('button', { name: 'Start run' }))
    await user.click(dialog().getByRole('button', { name: 'Start run' }))

    expect(await dialog().findByRole('alert')).toHaveTextContent(/choose a legacy/i)
    expect(mutateAsync).not.toHaveBeenCalled()
  })

  it('keeps the dialog open and shows an error when the mutation fails', async () => {
    mutateAsync.mockRejectedValueOnce(new Error('boom'))
    const user = userEvent.setup()
    render(
      <StartRunDialog challengeId="ch-1" challengeName="Legacy Challenge" legacies={legacies} />,
    )

    await user.click(screen.getByRole('button', { name: 'Start run' }))
    await user.click(dialog().getByRole('button', { name: /choose a legacy/i }))
    await user.click(await screen.findByRole('option', { name: 'The Calientes' }))
    await user.click(dialog().getByRole('button', { name: 'Start run' }))

    expect(await dialog().findByRole('alert')).toHaveTextContent(/could not start/i)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(push).not.toHaveBeenCalled()
  })

  it('prompts to create a legacy when there are none', async () => {
    const user = userEvent.setup()
    render(<StartRunDialog challengeId="ch-1" challengeName="Legacy Challenge" legacies={[]} />)

    await user.click(screen.getByRole('button', { name: 'Start run' }))

    expect(await screen.findByText(/need a legacy/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Start a legacy' })).toHaveAttribute(
      'href',
      '/app/legacies/new',
    )
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- "src/app/app/challenges/[id]/__tests__/start-run-dialog.test.tsx"`
Expected: FAIL — cannot resolve `../_components/start-run-dialog`

- [ ] **Step 3: Write the implementation**

```tsx
// src/app/app/challenges/[id]/_components/start-run-dialog.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Button,
  ButtonLink,
  Combobox,
  Dialog,
  FormField,
  Input,
} from '@/components/ui'
import { trpc } from '@/trpc/client'
import styles from './start-run-dialog.module.css'

export interface LegacyOption {
  id: string
  name: string
  slug: string
}

export interface StartRunDialogProps {
  challengeId: string
  challengeName: string
  /** The user's legacies, fetched server-side by the detail page. */
  legacies: LegacyOption[]
}

/**
 * "Start run" action on the challenge detail page. Picks one of the user's
 * legacies, names the run (pre-filled with the challenge name), and creates
 * the run via challengeRuns.link, then navigates to the legacy.
 */
export function StartRunDialog({ challengeId, challengeName, legacies }: StartRunDialogProps) {
  const [open, setOpen] = useState(false)
  const [legacyId, setLegacyId] = useState('')
  const [name, setName] = useState(challengeName)
  const [error, setError] = useState('')
  const router = useRouter()
  const link = trpc.challengeRuns.link.useMutation()

  async function start() {
    if (!legacyId) {
      setError('Choose a legacy first.')
      return
    }
    setError('')
    try {
      await link.mutateAsync({ legacyId, challengeId, name: name.trim() || undefined })
      const legacy = legacies.find((l) => l.id === legacyId)
      router.push(legacy ? `/app/legacies/${legacy.slug}` : '/app')
    } catch {
      setError('Could not start the run. Please try again.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button>Start run</Button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content size="sm">
          <Dialog.Title>Start run</Dialog.Title>
          <Dialog.Description>
            Run {challengeName} on one of your legacies.
          </Dialog.Description>

          {legacies.length === 0 ? (
            <div className={styles.empty}>
              <p className={styles.emptyText}>
                You need a legacy before you can start this challenge.
              </p>
              <ButtonLink variant="primary" size="sm" href="/app/legacies/new">
                Start a legacy
              </ButtonLink>
            </div>
          ) : (
            <div className={styles.form}>
              <FormField label="Legacy" htmlFor="start-run-legacy" required>
                <Combobox
                  id="start-run-legacy"
                  value={legacyId || undefined}
                  onChange={setLegacyId}
                  placeholder="Choose a legacy…"
                >
                  {legacies.map((legacy) => (
                    <Combobox.Item key={legacy.id} value={legacy.id}>
                      {legacy.name}
                    </Combobox.Item>
                  ))}
                </Combobox>
              </FormField>

              <FormField label="Run name" htmlFor="start-run-name">
                <Input
                  id="start-run-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </FormField>

              {error && (
                <p className={styles.error} role="alert">
                  {error}
                </p>
              )}

              <div className={styles.actions}>
                <Dialog.Close asChild>
                  <Button variant="ghost" size="sm">
                    Cancel
                  </Button>
                </Dialog.Close>
                <Button size="sm" onClick={start} disabled={link.isPending}>
                  {link.isPending ? 'Starting…' : 'Start run'}
                </Button>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  )
}
```

```css
/* src/app/app/challenges/[id]/_components/start-run-dialog.module.css */
.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  margin-top: var(--space-4);
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-3);
  margin-top: var(--space-4);
}

.emptyText {
  margin: 0;
  color: var(--text-muted);
  font-size: var(--text-base);
}

.error {
  margin: 0;
  color: var(--error);
  font-size: var(--text-sm);
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  margin-top: var(--space-2);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- "src/app/app/challenges/[id]/__tests__/start-run-dialog.test.tsx"`
Expected: PASS (5 tests)

- [ ] **Step 5: Validate**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors, no warnings

- [ ] **Step 6: Commit**

```bash
git add "src/app/app/challenges/[id]/_components/start-run-dialog.tsx" "src/app/app/challenges/[id]/_components/start-run-dialog.module.css" "src/app/app/challenges/[id]/__tests__/start-run-dialog.test.tsx"
git commit -m "feat(challenges): start-run dialog with legacy picker"
```

---

### Task 7: Detail page

Like the list page: an async server component assembled from tested pieces (Task 1 queries, Task 5 phase list, Task 6 dialog); the full page is exercised by the Task 8 e2e journey.

**Files:**
- Create: `src/app/app/challenges/[id]/page.tsx`
- Create: `src/app/app/challenges/[id]/page.module.css`

- [ ] **Step 1: Write the page**

```tsx
// src/app/app/challenges/[id]/page.tsx
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { db } from '@/server/db'
import { getChallengeForView } from '@/server/lib/challengeBrowse'
import { OwnershipBadge } from '../_components/ownership-badge'
import { PhaseList } from './_components/phase-list'
import { StartRunDialog } from './_components/start-run-dialog'
import styles from './page.module.css'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ChallengeDetailPage({ params }: Props) {
  const { id } = await params
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) redirect('/auth/signin')

  // Unknown id and private-but-not-yours both 404 — private ids leak nothing.
  const challenge = await getChallengeForView(userId, id)
  if (!challenge) notFound()

  const legacies = await db.legacy.findMany({
    where: { userId },
    select: { id: true, name: true, slug: true },
    orderBy: { name: 'asc' },
  })

  const phaseCount = challenge.phases.length

  return (
    <div className={styles.page}>
      <Link href="/app/challenges" className={styles.backLink}>
        ← All challenges
      </Link>

      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{challenge.name}</h1>
          <div className={styles.meta}>
            <OwnershipBadge isYours={challenge.ownerId === userId} />
            <span className={styles.phaseCount}>
              {phaseCount} {phaseCount === 1 ? 'phase' : 'phases'}
            </span>
          </div>
        </div>
        <StartRunDialog
          challengeId={challenge.id}
          challengeName={challenge.name}
          legacies={legacies}
        />
      </header>

      {challenge.description && (
        <p className={styles.description}>{challenge.description}</p>
      )}

      <PhaseList phases={challenge.phases} />
    </div>
  )
}
```

```css
/* src/app/app/challenges/[id]/page.module.css */
.page {
  max-width: 900px;
  margin: 0 auto;
  padding: 2.5rem 2rem 4rem;
}

.backLink {
  display: inline-block;
  font-size: var(--text-sm);
  color: var(--text-muted);
  text-decoration: none;
  margin-bottom: var(--space-4);
}

.backLink:hover {
  color: var(--text);
}

.header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
  margin-bottom: var(--space-4);
}

.title {
  font-family: var(--font-display);
  font-size: 2rem;
  font-weight: var(--weight-semibold);
  color: var(--text);
  margin: 0 0 var(--space-2);
}

.meta {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.phaseCount {
  color: var(--text-muted);
  font-size: var(--text-sm);
}

.description {
  color: var(--text);
  font-size: var(--text-base);
  line-height: 1.6;
  margin: 0 0 var(--space-6);
  max-width: 65ch;
}
```

- [ ] **Step 2: Validate**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors, no warnings

Note: `PhaseList` accepts `challenge.phases` directly — `getChallengeForView` selects exactly the `PhaseListPhase` shape (`id`, `title`, `generationNumber`, `description`, `trackers: {id, name}[]`). If tsc complains here, the select in Task 1 and the interface in Task 5 have drifted — fix the select, not the type.

- [ ] **Step 3: Manual smoke check (optional)**

With the Task 4 sample data: visit `/app/challenges`, click the Legacy Challenge card. Verify the back link, badge + "2 phases" meta, description, both phase cards ("The Founder", "Generation 2"), and that "Start run" opens the dialog (pick a legacy if you have one → lands on the legacy page; with no legacies → "Start a legacy" link).

- [ ] **Step 4: Commit**

```bash
git add "src/app/app/challenges/[id]/page.tsx" "src/app/app/challenges/[id]/page.module.css"
git commit -m "feat(challenges): read-only challenge detail page with start-run action"
```

---

### Task 8: E2E journey + final validation

**Files:**
- Create: `e2e/challenges.spec.ts`

- [ ] **Step 1: Write the journey test**

Spec-local DB setup mirrors `e2e/teardown/auth.teardown.ts` (raw PrismaClient + PrismaPg). The auth setup project has already created the test user before this spec runs. Tab/search steps are ordered so the Mine-tab check happens *before* searching (the `q` param persists across tab links by design).

```ts
// e2e/challenges.spec.ts
import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const TEST_EMAIL = process.env.TEST_EMAIL ?? 'e2e-test@simtrack.test'
const STAMP = Date.now()
const CHALLENGE_NAME = `Decennial Legacy ${STAMP}`
const DECOY_NAME = `Aquarium Keeper ${STAMP}`
const LEGACY_NAME = `Challenge Runners ${STAMP}`
const LEGACY_SLUG = `challenge-runners-${STAMP}`

let db: PrismaClient
let challengeId: string
let decoyId: string

test.beforeAll(async () => {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
  db = new PrismaClient({ adapter })
  const user = await db.user.findUniqueOrThrow({ where: { email: TEST_EMAIL } })

  const challenge = await db.challenge.create({
    data: {
      name: CHALLENGE_NAME,
      description: 'Ten generations of end-to-end verification.',
      isPublic: true,
      phases: {
        create: [
          { generationNumber: 1, title: 'The Founder', sortOrder: 0 },
          { generationNumber: 2, sortOrder: 1 },
        ],
      },
    },
  })
  challengeId = challenge.id

  const decoy = await db.challenge.create({
    data: { name: DECOY_NAME, isPublic: true },
  })
  decoyId = decoy.id

  await db.legacy.create({
    data: { name: LEGACY_NAME, slug: LEGACY_SLUG, userId: user.id },
  })
})

test.afterAll(async () => {
  await db.challengeRun.deleteMany({ where: { sourceChallengeId: challengeId } })
  await db.legacy.deleteMany({ where: { slug: LEGACY_SLUG } })
  await db.challenge.deleteMany({ where: { id: { in: [challengeId, decoyId] } } })
  await db.$disconnect()
})

test('user browses challenges, searches, and starts a run on their legacy', async ({ page }) => {
  await test.step('navigate to the challenges page from the nav', async () => {
    await page.goto('/app')
    await page.getByRole('link', { name: 'Challenges' }).click()
    await expect(page.getByRole('heading', { name: 'Challenges' })).toBeVisible()
    await expect(page.getByRole('heading', { name: CHALLENGE_NAME })).toBeVisible()
  })

  await test.step('the Mine tab shows the empty state', async () => {
    await page.getByRole('link', { name: 'Mine' }).click()
    await expect(page.getByText(/haven't created any challenges yet/i)).toBeVisible()
    await page.getByRole('link', { name: 'All', exact: true }).click()
    await expect(page.getByRole('heading', { name: CHALLENGE_NAME })).toBeVisible()
  })

  await test.step('search narrows the list', async () => {
    await page.getByRole('searchbox', { name: 'Search challenges' }).fill(`Decennial Legacy ${STAMP}`)
    await expect(page.getByRole('heading', { name: DECOY_NAME })).not.toBeVisible()
    await expect(page.getByRole('heading', { name: CHALLENGE_NAME })).toBeVisible()
    await expect(page).toHaveURL(/q=Decennial/)
  })

  await test.step('open the challenge detail', async () => {
    await page.getByRole('link', { name: new RegExp(CHALLENGE_NAME) }).click()
    await expect(page.getByRole('heading', { name: CHALLENGE_NAME })).toBeVisible()
    await expect(page.getByText('Ten generations of end-to-end verification.')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'The Founder' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Generation 2' })).toBeVisible()
  })

  await test.step('start a run on the legacy', async () => {
    await page.getByRole('button', { name: 'Start run' }).click()
    const dialog = page.getByRole('dialog', { name: 'Start run' })
    await dialog.getByLabel('Legacy', { exact: true }).click()
    await page.getByRole('option', { name: LEGACY_NAME }).click()
    await dialog.getByRole('button', { name: 'Start run' }).click()
    await expect(page).toHaveURL(new RegExp(`/app/legacies/${LEGACY_SLUG}$`))
  })
})
```

- [ ] **Step 2: Run the e2e suite**

Run: `npm run test:e2e`
Expected: PASS, including the existing specs (this also resets the test DB first via `pretest:e2e`).

If the legacy-picker step is flaky on the `getByLabel('Legacy')` locator (the combobox trigger carries the placeholder as `aria-label` until a value is chosen), switch the locator to `dialog.getByRole('button', { name: 'Choose a legacy…' })` — same element, accessible-name query.

- [ ] **Step 3: Final full validation (everything must pass)**

```bash
npx tsc --noEmit
npm run lint
npm test
npm run test:e2e
```

Expected: all clean / all passing.

- [ ] **Step 4: Commit**

```bash
git add e2e/challenges.spec.ts
git commit -m "test(challenges): e2e journey for browsing, searching, and starting a run"
```

---

## Spec coverage map

| Spec section | Task |
|---|---|
| Routes & navigation (list, detail, nav link, URL params) | 4, 7 |
| Data layer (list query, detail query, coercion) | 1 |
| List page UI (cards, badges, tabs, empty states, search) | 2, 3, 4 |
| Detail page UI (header, phase list, title fallbacks, ◆ goals) | 5, 7 |
| Start run flow (dialog, legacy picker, no-legacy state, errors) | 6 |
| Error handling (notFound, param coercion, null owner) | 1, 7 |
| Testing (integration, component, e2e) | 1, 2, 3, 5, 6, 8 |
