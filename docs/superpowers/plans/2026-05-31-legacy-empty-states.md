# Legacy Chronicle Empty States Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the legacy chronicle's plain one-line empty states with the richer designed empty cards (ghost-circle icon + serif headline with an italic accent word + body + CTA) across Succession, Milestones, and Roster, give the Hero its brand-new-legacy treatment (em-dash stats + dashed "Now & then" ghost slots), and deliberately omit the white "Record a moment" composer box from the Milestones section.

**Architecture:** All work lives in the `legacy-chronicle-redesign` worktree at `/Users/beatka/Projects/simstrack-526/.claude/worktrees/legacy-chronicle-redesign`. We add two reusable design-system primitives (`GhostCircle` + a small set of Lucide-style icon components), upgrade the existing `EmptyState` primitive's API, then wire the three chronicle section components and the Hero to use them. Everything is plain CSS Modules over the existing CSS custom-property tokens in `src/app/globals.css`. The three section components are React Server Components (no `'use client'`); keep them that way.

**Tech Stack:** Next.js 16 (App Router, RSC), TypeScript, plain CSS Modules, Vitest + React Testing Library (jsdom), existing `@/components/ui` design-system barrel.

---

## Context the implementer needs

**This is NOT the Next.js you know.** Next.js 16 in this repo renames `middleware.ts` → `proxy.ts`; that does not affect this work, but do not be surprised by unfamiliar conventions. Read `node_modules/next/dist/docs/` before reaching for APIs you remember from older Next.

**Brand discipline (from `.claude/rules/brand-design.md` + the design handoff):**
- Dashed borders appear **only** on empty states.
- One ornament — the plumbob. **No emoji, ever.** Icons are Lucide-style inline SVGs (`currentColor`, round caps).
- Voice is archival + second-person warm ("you", "your", em-dashes). Each display headline has exactly **one** italic accent word.
- **Amber** (`var(--amber-text)`) is for heir/founder/legacy callouts only. **Green** (`var(--green)`) is the only interactive accent.
- Upright Cormorant is the default; italic is reserved for decorative accents (the accent word in a headline, the "No heir yet" line) — this matches the saved typography feedback.
- **Never** add `eslint-disable`, `@ts-ignore`, `@ts-expect-error`, or any suppression. Fix the root cause instead.
- Do **not** assert against `.module.css` source in tests. Assert rendered text, roles, attributes (`aria-hidden`, `href`), or inline `style`.

**Design source of truth** (extracted from the design bundle; reproduced inline in each task so you never need to open it):
- Section-level empties: `empty-states-sections.jsx` (`SuccessionEmpty`, `MilestonesEmpty`, `RosterZeroEmpty`).
- Empty-state building blocks: `empty-states-parts.jsx` (`GhostCircle`, Lucide icon paths) + `empty-states-pages.jsx` (`EmptyCard`, `EmptyTitle`, `EmptyBody`, `BrandNewLegacy` hero, `FounderAdded` hero).

**Data-model facts that shape this work** (`src/app/app/legacies/[slug]/lib/derive.ts`):
- **Milestones are auto-derived** from sims (one "birth" per sim, the founder's row is "founds the legacy", plus marriages). There is **no manual milestone entry** — so the design's white "Record a moment" composer box has no backing feature and is intentionally **not** ported. This is the "remove the additional white box" deliverable.
- Milestones is empty **only when the legacy has zero sims**. Succession is empty only with no founder/heir. Roster is empty only with zero sims. In practice all three coincide with a brand-new legacy.
- **No generation filter is shipped** (`page.tsx` has no `?gen` param). The design's "filtered-to-nothing" quiet roster empty is therefore **not reachable and is out of scope** for this plan. (Note it for whoever ships the filter later.)

**Decisions already made with the user (do not re-litigate):**
1. **Scope includes the Hero brand-new treatment** (em-dash stats + dashed "Now & then" ghost founder/heir slots), in addition to the three section empties.
2. **Empty-state CTAs:** render the buttons, but the Succession ("Name an heir →") and Milestones ("Record a moment →") CTAs have **no action wired yet** — render them as inert `<button>` elements (a real-looking affordance pending a future flow). The Roster CTA ("Add your founder →") **keeps a working link** to the existing add-Sim route `/app/legacies/[slug]/sims/new`, and the Hero's ghost-founder-slot CTA links there too.
   - **Post-plan update (resolved):** heir designation was wired. The Succession empty state only appears when a legacy has **no founder** (a founder always yields ≥1 succession step), so its CTA is now **"Add your founder →"** → `/app/legacies/[slug]/sims/new` (matching the Hero/Roster empties). Heirs are designated by a new **"Make heir" toggle** on the sim detail page. See *Post-plan addition: heir designation* at the end of this document. The Milestones "Record a moment →" CTA remains inert (no manual-entry feature).

**Open decisions deferred to the user (see end of plan) — do not block on these.**

---

## File structure

**New files:**
| File | Responsibility |
|---|---|
| `src/components/ui/icons/icon-props.ts` | Shared `IconProps` type (`SVGProps` + optional `size`) for the Lucide-style icons. |
| `src/components/ui/icons/arrow-right-icon.tsx` | `ArrowRightIcon` — trailing CTA arrow. |
| `src/components/ui/icons/git-branch-icon.tsx` | `GitBranchIcon` — Succession empty. |
| `src/components/ui/icons/feather-icon.tsx` | `FeatherIcon` — Milestones empty. |
| `src/components/ui/icons/users-icon.tsx` | `UsersIcon` — Roster empty. |
| `src/components/ui/icons/user-plus-icon.tsx` | `UserPlusIcon` — Hero ghost founder/heir slots. |
| `src/components/ui/icons/__tests__/empty-state-icons.test.tsx` | One test file covering all five new icons. |
| `src/components/ui/ghost-circle/ghost-circle.tsx` | `GhostCircle` — dashed circular placeholder holding an icon (neutral or amber accent). |
| `src/components/ui/ghost-circle/ghost-circle.module.css` | GhostCircle styles. |
| `src/components/ui/ghost-circle/__tests__/ghost-circle.test.tsx` | GhostCircle test. |

**Modified files:**
| File | Change |
|---|---|
| `src/components/ui/empty-state/empty-state.tsx` | New API: `icon`, `title`, `action`, `accent` + body via `children`. |
| `src/components/ui/empty-state/empty-state.module.css` | Centered dashed card; title + body styles. |
| `src/components/ui/empty-state/__tests__/empty-state.test.tsx` | Cover the new API. |
| `src/components/ui/index.ts` | Export the new icons + `GhostCircle`. |
| `src/app/app/legacies/[slug]/_components/succession/succession.tsx` | Rich empty state. |
| `src/app/app/legacies/[slug]/_components/__tests__/succession.test.tsx` | Update empty-state assertions. |
| `src/app/app/legacies/[slug]/_components/milestones/milestones.tsx` | Rich empty state; assert no composer/white box. |
| `src/app/app/legacies/[slug]/_components/__tests__/milestones-empty.test.tsx` | **New** test file for the milestones empty state. |
| `src/app/app/legacies/[slug]/_components/roster/roster.tsx` | Rich empty state. |
| `src/app/app/legacies/[slug]/_components/__tests__/roster.test.tsx` | Update empty-state assertions. |
| `src/app/app/legacies/[slug]/_components/hero/hero.tsx` | Brand-new treatment: em-dash stats + dashed ghost slots. |
| `src/app/app/legacies/[slug]/_components/hero/hero.module.css` | Empty-card + ghost-slot styles. |
| `src/app/app/legacies/[slug]/_components/__tests__/hero.test.tsx` | Replace the "omits card" test with ghost-slot assertions. |

**Token reference** (already defined in `src/app/globals.css` — use these, never hard-code):
`--text-base` 14px · `--text-xl` 24px · `--text-lg` 20px · `--text-sm` 12px · `--text-stat` 28px · `--font-display` · `--weight-semibold` 600 · `--amber` · `--amber-text` `#b45309` · `--green` · `--border-bright` · `--text` · `--text-muted` · `--text-subtle` · `--radius-lg` 14px · `--space-1` 4px · `--space-6` 24px · `--space-8` 32px · `--bg`.

---

## Task 1: Lucide-style icon primitives

**Files:**
- Create: `src/components/ui/icons/icon-props.ts`
- Create: `src/components/ui/icons/arrow-right-icon.tsx`
- Create: `src/components/ui/icons/git-branch-icon.tsx`
- Create: `src/components/ui/icons/feather-icon.tsx`
- Create: `src/components/ui/icons/users-icon.tsx`
- Create: `src/components/ui/icons/user-plus-icon.tsx`
- Test: `src/components/ui/icons/__tests__/empty-state-icons.test.tsx`

These mirror the existing `src/components/ui/icons/tree-icon.tsx` pattern (inline SVG, `currentColor`, `aria-hidden="true"`), with the exact Lucide paths from the design's `empty-states-parts.jsx`. The icon color comes from the parent's `color` (they use `currentColor`).

- [ ] **Step 1: Write the failing test**

Create `src/components/ui/icons/__tests__/empty-state-icons.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ArrowRightIcon } from '../arrow-right-icon'
import { GitBranchIcon } from '../git-branch-icon'
import { FeatherIcon } from '../feather-icon'
import { UsersIcon } from '../users-icon'
import { UserPlusIcon } from '../user-plus-icon'

const icons = [
  ['ArrowRightIcon', ArrowRightIcon],
  ['GitBranchIcon', GitBranchIcon],
  ['FeatherIcon', FeatherIcon],
  ['UsersIcon', UsersIcon],
  ['UserPlusIcon', UserPlusIcon],
] as const

describe('empty-state icons', () => {
  it.each(icons)('%s renders a decorative svg', (_name, Icon) => {
    const { container } = render(<Icon />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    // Decorative: must be hidden from assistive tech (the label lives on the
    // surrounding text/button, never on the icon).
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg?.querySelector('stroke') ?? svg).toBeTruthy()
  })

  it.each(icons)('%s honors the size prop', (_name, Icon) => {
    const { container } = render(<Icon size={20} />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('width', '20')
    expect(svg).toHaveAttribute('height', '20')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/ui/icons/__tests__/empty-state-icons.test.tsx`
Expected: FAIL — cannot resolve `../arrow-right-icon` (modules not created yet).

- [ ] **Step 3: Create the shared props type**

Create `src/components/ui/icons/icon-props.ts`:

```ts
export interface IconProps extends React.SVGProps<SVGSVGElement> {
  /** Square pixel size for width + height. */
  size?: number
}
```

- [ ] **Step 4: Create the five icon components**

Create `src/components/ui/icons/arrow-right-icon.tsx`:

```tsx
import type { IconProps } from './icon-props'

export function ArrowRightIcon({ size = 16, className, ...props }: IconProps) {
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
      <path d="m12 5 7 7-7 7" />
    </svg>
  )
}
```

Create `src/components/ui/icons/git-branch-icon.tsx`:

```tsx
import type { IconProps } from './icon-props'

export function GitBranchIcon({ size = 24, className, ...props }: IconProps) {
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
      <line x1="6" x2="6" y1="3" y2="15" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M18 9a9 9 0 0 1-9 9" />
    </svg>
  )
}
```

Create `src/components/ui/icons/feather-icon.tsx`:

```tsx
import type { IconProps } from './icon-props'

export function FeatherIcon({ size = 24, className, ...props }: IconProps) {
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
      <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z" />
      <line x1="16" x2="2" y1="8" y2="22" />
      <line x1="17.5" x2="9" y1="15" y2="15" />
    </svg>
  )
}
```

Create `src/components/ui/icons/users-icon.tsx`:

```tsx
import type { IconProps } from './icon-props'

export function UsersIcon({ size = 24, className, ...props }: IconProps) {
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
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}
```

Create `src/components/ui/icons/user-plus-icon.tsx`:

```tsx
import type { IconProps } from './icon-props'

export function UserPlusIcon({ size = 22, className, ...props }: IconProps) {
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
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" x2="19" y1="8" y2="14" />
      <line x1="22" x2="16" y1="11" y2="11" />
    </svg>
  )
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/ui/icons/__tests__/empty-state-icons.test.tsx`
Expected: PASS (10 assertions across 5 icons).

- [ ] **Step 6: Validate types + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors, no warnings.

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/icons/icon-props.ts \
  src/components/ui/icons/arrow-right-icon.tsx \
  src/components/ui/icons/git-branch-icon.tsx \
  src/components/ui/icons/feather-icon.tsx \
  src/components/ui/icons/users-icon.tsx \
  src/components/ui/icons/user-plus-icon.tsx \
  src/components/ui/icons/__tests__/empty-state-icons.test.tsx
git commit -m "feat(ui): add Lucide-style empty-state icons"
```

---

## Task 2: GhostCircle primitive

**Files:**
- Create: `src/components/ui/ghost-circle/ghost-circle.tsx`
- Create: `src/components/ui/ghost-circle/ghost-circle.module.css`
- Test: `src/components/ui/ghost-circle/__tests__/ghost-circle.test.tsx`

A dashed circular placeholder that holds an icon. Neutral by default (wheat dashed border, subtle icon); `accent` makes it amber (founder/heir slot). Source: `GhostCircle` in `empty-states-parts.jsx` — `border: 1.5px dashed` (`--border-bright` neutral / `--amber` accent), icon color `--text-subtle` neutral / `--color-amber-700` accent (codebase token: `--amber-text`).

- [ ] **Step 1: Write the failing test**

Create `src/components/ui/ghost-circle/__tests__/ghost-circle.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GhostCircle } from '../ghost-circle'

describe('GhostCircle', () => {
  it('renders the icon it wraps', () => {
    render(
      <GhostCircle>
        <svg data-testid="inner-icon" />
      </GhostCircle>,
    )
    expect(screen.getByTestId('inner-icon')).toBeInTheDocument()
  })

  it('applies the requested size as inline width/height', () => {
    const { container } = render(<GhostCircle size={88} />)
    const root = container.firstChild as HTMLElement
    expect(root).toHaveStyle({ width: '88px', height: '88px' })
  })

  it('defaults to 72px when no size is given', () => {
    const { container } = render(<GhostCircle />)
    const root = container.firstChild as HTMLElement
    expect(root).toHaveStyle({ width: '72px', height: '72px' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/ui/ghost-circle/__tests__/ghost-circle.test.tsx`
Expected: FAIL — cannot resolve `../ghost-circle`.

- [ ] **Step 3: Create the component**

Create `src/components/ui/ghost-circle/ghost-circle.tsx`:

```tsx
import { cn } from '@/lib/utils'
import styles from './ghost-circle.module.css'

export interface GhostCircleProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** Diameter in px (width = height). Defaults to 72. */
  size?: number
  /** Amber treatment for founder/heir slots; neutral wheat otherwise. */
  accent?: boolean
}

export function GhostCircle({
  size = 72,
  accent = false,
  className,
  style,
  children,
  ...props
}: GhostCircleProps) {
  return (
    <div
      className={cn(styles.circle, accent && styles.accent, className)}
      style={{ width: size, height: size, ...style }}
      aria-hidden="true"
      {...props}
    >
      {children}
    </div>
  )
}
```

- [ ] **Step 4: Create the styles**

Create `src/components/ui/ghost-circle/ghost-circle.module.css`:

```css
.circle {
  border-radius: 50%;
  border: 1.5px dashed var(--border-bright);
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-subtle);
  flex-shrink: 0;
}

/* Amber treatment for founder / heir slots. */
.accent {
  border-color: var(--amber);
  color: var(--amber-text);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/ui/ghost-circle/__tests__/ghost-circle.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Validate types + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors, no warnings.

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/ghost-circle/ghost-circle.tsx \
  src/components/ui/ghost-circle/ghost-circle.module.css \
  src/components/ui/ghost-circle/__tests__/ghost-circle.test.tsx
git commit -m "feat(ui): add GhostCircle empty-slot placeholder"
```

---

## Task 3: Upgrade the EmptyState primitive

**Files:**
- Modify: `src/components/ui/empty-state/empty-state.tsx`
- Modify: `src/components/ui/empty-state/empty-state.module.css`
- Test: `src/components/ui/empty-state/__tests__/empty-state.test.tsx`

The current `EmptyState` is a left-aligned dashed card with one italic line + optional `action`. Replace it with the designed centered card: optional ghost-circle `icon`, optional serif `title` (with an italic accent word passed as JSX), body via `children`, optional `action`. Source: `EmptyCard` + `EmptyTitle` + `EmptyBody` in `empty-states-pages.jsx` (centered, gap 18px, padding 36/32, body upright `--text-muted` 14px max-width 420, title `--font-display` 24px/600). The body is **no longer italic** (design body is upright; only the title accent word is italic).

`EmptyState` is used in exactly three places (the three section components), all updated in later tasks — so changing the API here is safe.

- [ ] **Step 1: Write the failing test**

Replace the entire contents of `src/components/ui/empty-state/__tests__/empty-state.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EmptyState } from '../empty-state'

describe('EmptyState', () => {
  it('renders the body text from children', () => {
    render(<EmptyState>No sims yet.</EmptyState>)
    expect(screen.getByText('No sims yet.')).toBeInTheDocument()
  })

  it('renders an optional title', () => {
    render(
      <EmptyState title="No moments recorded yet.">Body copy.</EmptyState>,
    )
    expect(
      screen.getByRole('heading', { name: 'No moments recorded yet.' }),
    ).toBeInTheDocument()
  })

  it('renders an optional icon node', () => {
    render(
      <EmptyState icon={<svg data-testid="state-icon" />}>Body.</EmptyState>,
    )
    expect(screen.getByTestId('state-icon')).toBeInTheDocument()
  })

  it('renders an optional action alongside the message', () => {
    render(
      <EmptyState action={<a href="/x">Add a sim</a>}>No sims yet.</EmptyState>,
    )
    expect(screen.getByText('No sims yet.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Add a sim' })).toBeInTheDocument()
  })

  it('renders a title with an italic accent word as a child node', () => {
    render(
      <EmptyState
        title={
          <>
            No moments <em>recorded</em> yet.
          </>
        }
      >
        Body.
      </EmptyState>,
    )
    const heading = screen.getByRole('heading')
    expect(heading.querySelector('em')?.textContent).toBe('recorded')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/ui/empty-state/__tests__/empty-state.test.tsx`
Expected: FAIL — `title`/`icon` props are not yet rendered (the heading + icon queries fail).

- [ ] **Step 3: Rewrite the component**

Replace the entire contents of `src/components/ui/empty-state/empty-state.tsx`:

```tsx
import { cn } from '@/lib/utils'
import { GhostCircle } from '@/components/ui/ghost-circle/ghost-circle'
import styles from './empty-state.module.css'

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Lucide-style icon node; rendered inside a 72px GhostCircle. */
  icon?: React.ReactNode
  /** Serif headline. May contain one italic <em> accent word. */
  title?: React.ReactNode
  /** Amber GhostCircle (founder/heir context) instead of neutral wheat. */
  accent?: boolean
  /** Call-to-action rendered below the body (e.g. a Button / ButtonLink). */
  action?: React.ReactNode
}

export function EmptyState({
  icon,
  title,
  accent,
  action,
  children,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div className={cn(styles.root, className)} {...props}>
      {icon && (
        <GhostCircle accent={accent} size={72}>
          {icon}
        </GhostCircle>
      )}
      {title && <h3 className={styles.title}>{title}</h3>}
      {children && <p className={styles.body}>{children}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  )
}
```

- [ ] **Step 4: Rewrite the styles**

Replace the entire contents of `src/components/ui/empty-state/empty-state.module.css`:

```css
.root {
  margin-top: var(--space-6);
  /* 36px top/bottom has no token; 32px = --space-8. */
  padding: 2.25rem var(--space-8);
  border: 1px dashed var(--border-bright);
  border-radius: var(--radius-lg);
  background: var(--bg);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  /* 18px gap has no exact token. */
  gap: 1.125rem;
}

.title {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--text-xl);
  font-weight: var(--weight-semibold);
  color: var(--text);
  line-height: 1.15;
  letter-spacing: -0.01em;
  text-wrap: balance;
}

.body {
  margin: 0;
  font-size: var(--text-base);
  color: var(--text-muted);
  line-height: 1.6;
  max-width: 420px;
  text-wrap: pretty;
}

.action {
  margin-top: var(--space-1);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/ui/empty-state/__tests__/empty-state.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 6: Validate types + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: TS errors are EXPECTED here only if the section components still pass the old API — but they pass `children`-only today, which still compiles (all new props are optional). So expect **no** errors. If `tsc` complains, do not suppress; fix the call site.

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/empty-state/empty-state.tsx \
  src/components/ui/empty-state/empty-state.module.css \
  src/components/ui/empty-state/__tests__/empty-state.test.tsx
git commit -m "feat(ui): redesign EmptyState with icon, title, and body"
```

---

## Task 4: Export new primitives from the UI barrel

**Files:**
- Modify: `src/components/ui/index.ts`

- [ ] **Step 1: Add the exports**

In `src/components/ui/index.ts`, immediately after the existing `TreeIcon` export block (the lines exporting `./icons/tree-icon`), add:

```ts
export { ArrowRightIcon } from './icons/arrow-right-icon'
export { GitBranchIcon } from './icons/git-branch-icon'
export { FeatherIcon } from './icons/feather-icon'
export { UsersIcon } from './icons/users-icon'
export { UserPlusIcon } from './icons/user-plus-icon'
export type { IconProps } from './icons/icon-props'
export { GhostCircle } from './ghost-circle/ghost-circle'
export type { GhostCircleProps } from './ghost-circle/ghost-circle'
```

(Leave the existing `EmptyState` / `EmptyStateProps` export lines as they are.)

- [ ] **Step 2: Validate types + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors, no warnings.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/index.ts
git commit -m "feat(ui): export empty-state icons and GhostCircle from barrel"
```

---

## Task 5: Succession empty state

**Files:**
- Modify: `src/app/app/legacies/[slug]/_components/succession/succession.tsx`
- Modify: `src/app/app/legacies/[slug]/_components/__tests__/succession.test.tsx`

Source (`SuccessionEmpty` in `empty-states-sections.jsx`): git-branch icon, headline "No succession to *trace* yet." (italic accent `trace` in amber), body "Name an heir and the line draws itself — founder to heir, down the generations.", CTA "Name an heir →". Per the user decision, the CTA is an **inert button** (no action wired yet).

- [ ] **Step 1: Write the failing test**

In `src/app/app/legacies/[slug]/_components/__tests__/succession.test.tsx`, replace the first two `it(...)` blocks (the `renders the empty-state sentence...` and `does not render the empty state...` tests) with:

```tsx
  it('renders the designed empty state when steps is empty', () => {
    render(<Succession steps={[]} slug="caliente" />)
    // Headline (the italic accent word "trace" is part of the heading text).
    expect(
      screen.getByRole('heading', { name: /No succession to\s*trace\s*yet\./i }),
    ).toBeInTheDocument()
    // Body copy.
    expect(
      screen.getByText(/Name an heir and the line draws itself/i),
    ).toBeInTheDocument()
    // CTA is present as a button (no action wired yet — see plan decision 2).
    expect(
      screen.getByRole('button', { name: /Name an heir/i }),
    ).toBeInTheDocument()
  })

  it('does not render the empty state when steps are present', () => {
    render(<Succession steps={[founder]} slug="caliente" />)
    expect(screen.queryByRole('button', { name: /Name an heir/i })).toBeNull()
    expect(screen.getByText('Dina Caliente')).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "src/app/app/legacies/[slug]/_components/__tests__/succession.test.tsx"`
Expected: FAIL — no heading matching "No succession to trace yet." (the old plain sentence is still rendered).

- [ ] **Step 3: Update the component**

In `src/app/app/legacies/[slug]/_components/succession/succession.tsx`:

Replace the import line:

```tsx
import { SectionHeading, PortraitAvatar, EmptyState } from '@/components/ui'
```

with:

```tsx
import {
  SectionHeading,
  PortraitAvatar,
  EmptyState,
  Button,
  GitBranchIcon,
  ArrowRightIcon,
} from '@/components/ui'
```

Replace the empty-state branch:

```tsx
      {steps.length === 0 ? (
        <EmptyState>No succession line yet — name an heir to begin.</EmptyState>
      ) : (
```

with:

```tsx
      {steps.length === 0 ? (
        <EmptyState
          accent
          icon={<GitBranchIcon size={24} />}
          title={
            <>
              No succession to{' '}
              <em style={{ color: 'var(--amber-text)' }}>trace</em> yet.
            </>
          }
          action={
            <Button variant="primary" size="sm" type="button">
              Name an heir <ArrowRightIcon size={16} />
            </Button>
          }
        >
          Name an heir and the line draws itself — founder to heir, down the
          generations.
        </EmptyState>
      ) : (
```

(The rest of the component — the populated `styles.line` branch — is unchanged.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run "src/app/app/legacies/[slug]/_components/__tests__/succession.test.tsx"`
Expected: PASS (all tests, including the unchanged role/name tests).

- [ ] **Step 5: Validate types + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors, no warnings.

- [ ] **Step 6: Commit**

```bash
git add "src/app/app/legacies/[slug]/_components/succession/succession.tsx" \
  "src/app/app/legacies/[slug]/_components/__tests__/succession.test.tsx"
git commit -m "feat(legacy): rich empty state for the succession section"
```

---

## Task 6: Milestones empty state (and no white composer box)

**Files:**
- Modify: `src/app/app/legacies/[slug]/_components/milestones/milestones.tsx`
- Create: `src/app/app/legacies/[slug]/_components/__tests__/milestones-empty.test.tsx`

Source (`MilestonesEmpty` in `empty-states-sections.jsx`): feather icon, headline "No moments *recorded* yet." (italic accent `recorded` in green), body "Births and weddings log themselves. Everything else — the scandals, the first kisses, the houses lost — is yours to write.", CTA "Record a moment →" (inert button, no action wired).

**White-box deliverable:** The design's `FounderAdded` page renders a white `MilestoneComposerEmpty` card ("Record a moment", `background: var(--bg-card)`) above the rows. We deliberately **do not** port it — milestones are auto-derived, there is no manual-entry feature, and the canonical populated prototype (`prototype-app.jsx`) also omits it. The Milestones section must render only: the `SectionHeading`, then either the rows (`styles.rows`) or the dashed `EmptyState` — never a solid/white composer card. The test below pins this by asserting the empty state is the shared dashed `EmptyState` (feather + "Record a moment" CTA) and that there is **no** "Add milestone" composer affordance.

- [ ] **Step 1: Write the failing test**

Create `src/app/app/legacies/[slug]/_components/__tests__/milestones-empty.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Milestones } from '../milestones/milestones'

vi.mock('next/link', () => ({
  default: (props: { href: string; children: React.ReactNode }) => (
    <a href={props.href}>{props.children}</a>
  ),
}))

describe('Milestones — empty state', () => {
  it('renders the designed empty state when there are no milestones', () => {
    render(<Milestones milestones={[]} simsById={{}} slug="caliente" />)
    expect(
      screen.getByRole('heading', { name: /No moments\s*recorded\s*yet\./i }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Births and weddings log themselves/i),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Record a moment/i }),
    ).toBeInTheDocument()
  })

  it('does NOT render a white "Add milestone" composer box', () => {
    // The white composer card from the design is intentionally not ported
    // (milestones are auto-derived; there is no manual-entry feature).
    render(<Milestones milestones={[]} simsById={{}} slug="caliente" />)
    expect(
      screen.queryByRole('button', { name: /Add milestone/i }),
    ).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "src/app/app/legacies/[slug]/_components/__tests__/milestones-empty.test.tsx"`
Expected: FAIL — no heading "No moments recorded yet." (the current code renders the plain `No milestones recorded yet.` sentence).

- [ ] **Step 3: Update the component**

Replace the entire contents of `src/app/app/legacies/[slug]/_components/milestones/milestones.tsx`:

```tsx
import {
  SectionHeading,
  EmptyState,
  Button,
  FeatherIcon,
  ArrowRightIcon,
} from '@/components/ui'
import type { Milestone, ChronicleSim } from '../../lib/types'
import { MilestoneRow } from './milestone-row'
import styles from './milestones.module.css'

export interface MilestonesProps {
  milestones: Milestone[]
  simsById: Record<string, ChronicleSim>
  slug: string
}

export function Milestones({ milestones, simsById, slug }: MilestonesProps) {
  return (
    <div className={styles.container}>
      <SectionHeading
        eyebrow="Chronicle"
        title="Milestones"
        blurb="Births, marriages, and the moments in between."
      />

      {milestones.length === 0 ? (
        <EmptyState
          icon={<FeatherIcon size={24} />}
          title={
            <>
              No moments{' '}
              <em style={{ color: 'var(--green)' }}>recorded</em> yet.
            </>
          }
          action={
            <Button variant="primary" size="sm" type="button">
              Record a moment <ArrowRightIcon size={16} />
            </Button>
          }
        >
          Births and weddings log themselves. Everything else — the scandals,
          the first kisses, the houses lost — is yours to write.
        </EmptyState>
      ) : (
        <ul className={styles.rows}>
          {milestones.map((milestone) => (
            <MilestoneRow
              key={milestone.id}
              milestone={milestone}
              simsById={simsById}
              slug={slug}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
```

(Note: no composer markup is added. The populated branch is unchanged — rows render directly on the parchment section, with no wrapping card.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run "src/app/app/legacies/[slug]/_components/__tests__/milestones-empty.test.tsx"`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the existing milestone tests to confirm no regression**

Run: `npx vitest run "src/app/app/legacies/[slug]/_components/__tests__/milestone-row.test.tsx" "src/app/app/legacies/[slug]/_components/__tests__/chronicle-sections.test.tsx"`
Expected: PASS. If `chronicle-sections.test.tsx` asserted the old `No milestones recorded yet.` sentence, update that assertion to match the new heading `No moments recorded yet.` (do not weaken the test — just update the expected text). Re-run until green.

- [ ] **Step 6: Validate types + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors, no warnings.

- [ ] **Step 7: Commit**

```bash
git add "src/app/app/legacies/[slug]/_components/milestones/milestones.tsx" \
  "src/app/app/legacies/[slug]/_components/__tests__/milestones-empty.test.tsx"
git commit -m "feat(legacy): rich milestones empty state, no composer box"
```

(If you also edited `chronicle-sections.test.tsx` in Step 5, add it to this commit.)

---

## Task 7: Roster empty state

**Files:**
- Modify: `src/app/app/legacies/[slug]/_components/roster/roster.tsx`
- Modify: `src/app/app/legacies/[slug]/_components/__tests__/roster.test.tsx`

Source (`RosterZeroEmpty` in `empty-states-sections.jsx`): users icon, headline "No Sims *named* yet." (italic accent `named` in green), body "Your founder is the first name in the register. Everyone after follows from them.", CTA "Add your founder →". This CTA **keeps a working link** to `/app/legacies/[slug]/sims/new` (it replaces the current outline "Add your first sim →" link).

- [ ] **Step 1: Write the failing test**

Open `src/app/app/legacies/[slug]/_components/__tests__/roster.test.tsx`. Find the test that asserts the current empty state (it references `No sims yet.` and/or the link name `Add your first sim →`). Replace that test's assertions with:

```tsx
    // Designed empty state: headline + body + working CTA link.
    expect(
      screen.getByRole('heading', { name: /No Sims\s*named\s*yet\./i }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Your founder is the first name in the register/i),
    ).toBeInTheDocument()
    const cta = screen.getByRole('link', { name: /Add your founder/i })
    expect(cta).toHaveAttribute('href', '/app/legacies/caliente/sims/new')
```

(Keep the surrounding `render(<Roster groups={[]} slug="caliente" />)` call. If the test file uses a different slug, match the href to that slug. Ensure `next/link` is mocked in this file the same way the other section tests mock it — if it is not already mocked, add the same `vi.mock('next/link', ...)` block used in `succession.test.tsx`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "src/app/app/legacies/[slug]/_components/__tests__/roster.test.tsx"`
Expected: FAIL — no heading "No Sims named yet." (old plain `No sims yet.` text is rendered).

- [ ] **Step 3: Update the component**

In `src/app/app/legacies/[slug]/_components/roster/roster.tsx`:

Replace the import line:

```tsx
import { SectionHeading, GenerationBadge, ButtonLink, EmptyState } from '@/components/ui'
```

with:

```tsx
import {
  SectionHeading,
  GenerationBadge,
  ButtonLink,
  EmptyState,
  UsersIcon,
  ArrowRightIcon,
} from '@/components/ui'
```

Replace the empty-state branch:

```tsx
      {groups.length === 0 ? (
        <EmptyState
          action={
            <ButtonLink
              variant="outline"
              size="sm"
              href={`/app/legacies/${slug}/sims/new`}
            >
              Add your first sim →
            </ButtonLink>
          }
        >
          No sims yet.
        </EmptyState>
      ) : (
```

with:

```tsx
      {groups.length === 0 ? (
        <EmptyState
          icon={<UsersIcon size={24} />}
          title={
            <>
              No Sims <em style={{ color: 'var(--green)' }}>named</em> yet.
            </>
          }
          action={
            <ButtonLink
              variant="primary"
              size="sm"
              href={`/app/legacies/${slug}/sims/new`}
            >
              Add your founder <ArrowRightIcon size={16} />
            </ButtonLink>
          }
        >
          Your founder is the first name in the register. Everyone after
          follows from them.
        </EmptyState>
      ) : (
```

(The populated `groups.map(...)` branch and the top "Add sim" button row are unchanged.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run "src/app/app/legacies/[slug]/_components/__tests__/roster.test.tsx"`
Expected: PASS.

- [ ] **Step 5: Validate types + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors, no warnings.

- [ ] **Step 6: Commit**

```bash
git add "src/app/app/legacies/[slug]/_components/roster/roster.tsx" \
  "src/app/app/legacies/[slug]/_components/__tests__/roster.test.tsx"
git commit -m "feat(legacy): rich roster empty state"
```

---

## Task 8: Hero brand-new-legacy treatment

**Files:**
- Modify: `src/app/app/legacies/[slug]/_components/hero/hero.tsx`
- Modify: `src/app/app/legacies/[slug]/_components/hero/hero.module.css`
- Modify: `src/app/app/legacies/[slug]/_components/__tests__/hero.test.tsx`

Today the Hero hides the "Now & then" card whenever there is no founder/heir, and always shows numeric stats. The design gives a brand-new legacy a full treatment. Three states, keyed on `founder` / `currentHeir`:

1. **No founder** (`founder === null`): stats render as muted em-dashes (`—`); the "Now & then" card is **dashed** and shows a founder ghost slot (amber GhostCircle + UserPlus + "Add your founder →" link) and a heir ghost slot ("No heir yet" / "Named once the line begins."). If `description` is also null, show the brand-new guidance blurb.
2. **Founder, no heir**: numeric stats; **solid** card (existing `.nowThenCard`); real founder column + heir ghost slot ("No heir yet" / "Named when the next generation comes of age.").
3. **Founder + heir**: unchanged (solid card, both real columns).

Sources: `BrandNewLegacy` (state 1) and `FounderAdded` (state 2) in `empty-states-pages.jsx`. Note the heir ghost slot is **neutral** wheat in state 1 and **amber accent** in state 2 (matching the design); the founder ghost slot is always amber. Generic copy is used for the heir hint to avoid hard-coding a generation number.

Stat em-dashes reuse `StatBlock`'s existing `accent` color-override prop (`accent="var(--text-subtle)"`) — no `StatBlock` change is needed.

- [ ] **Step 1: Write the failing test**

In `src/app/app/legacies/[slug]/_components/__tests__/hero.test.tsx`:

(a) Replace the test titled `omits the Now & then card when both founder and heir are null` with:

```tsx
  it('renders the brand-new card with founder and heir ghost slots when empty', () => {
    render(
      <Hero
        name="Test Legacy"
        description={null}
        stats={{ sims: 0, generations: 0, households: 0, milestones: 0 }}
        slug="caliente"
        founder={null}
        currentHeir={null}
      />,
    )
    expect(screen.getByText('Now & then')).toBeInTheDocument()
    expect(screen.getByText('Founder · Gen I')).toBeInTheDocument()
    expect(screen.getByText('No heir yet')).toBeInTheDocument()
    // Founder ghost slot CTA links to the add-Sim route.
    expect(
      screen.getByRole('link', { name: /Add your founder/i }),
    ).toHaveAttribute('href', '/app/legacies/caliente/sims/new')
  })

  it('renders em-dash muted stats for a brand-new legacy (no founder)', () => {
    render(
      <Hero
        name="Test Legacy"
        description={null}
        stats={{ sims: 0, generations: 0, households: 0, milestones: 0 }}
        slug="caliente"
        founder={null}
        currentHeir={null}
      />,
    )
    // Four labels present, and the numeral cells show an em-dash, not "0".
    expect(screen.getAllByText('—')).toHaveLength(4)
    expect(screen.queryByText('0')).toBeNull()
  })

  it('shows a heir ghost slot when a founder exists but no heir', () => {
    render(
      <Hero
        name="Test Legacy"
        description={null}
        stats={{ sims: 1, generations: 1, households: 1, milestones: 1 }}
        slug="caliente"
        founder={founder}
        currentHeir={null}
      />,
    )
    expect(screen.getByText('Dina Caliente')).toBeInTheDocument()
    expect(screen.getByText('No heir yet')).toBeInTheDocument()
  })
```

(b) The existing test `renders all four stat values` uses the populated `stats` (12/3/4/47) with `founder={null}`. Because state 1 now keys em-dashes on `founder === null`, that test would break. Update it to pass `founder={founder}` so numeric stats render:

Change its `render(...)` call to include `founder={founder}` (and keep `currentHeir={null}`). The four `getByText('12'|'3'|'4'|'47')` assertions then hold.

(c) The two existing tests that pass `founder={null} currentHeir={heir}` (`renders the Now & then card when only heir is provided`, `drops the generation suffix...`) still work: with no founder we are in state 1, but a non-null `currentHeir` should still render the real heir column. Confirm the component (Step 3) renders the real heir column whenever `currentHeir !== null`, regardless of founder. These tests assert `Current heir · Gen III` / `Current heir` text — keep them as-is.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "src/app/app/legacies/[slug]/_components/__tests__/hero.test.tsx"`
Expected: FAIL — `Founder · Gen I` / `No heir yet` / `—` not found (current Hero omits the card and renders numeric `0`s).

- [ ] **Step 3: Rewrite the component**

Replace the entire contents of `src/app/app/legacies/[slug]/_components/hero/hero.tsx`:

```tsx
import {
  Eyebrow,
  StatBlock,
  PortraitAvatar,
  GhostCircle,
  ButtonLink,
  UserPlusIcon,
  ArrowRightIcon,
} from '@/components/ui'
import { roman } from '@/lib/legacy-format'
import type { ChronicleSim, LegacyStats } from '../../lib/types'
import { splitLegacyName } from '../../lib/legacy-title'
import styles from './hero.module.css'

// ---------------------------------------------------------------------------
// NowThenColumn — a filled founder/heir column
// ---------------------------------------------------------------------------

interface NowThenColumnProps {
  label: string
  sim: ChronicleSim
  ring: 'founder' | 'heir'
  href: string
}

function NowThenColumn({ label, sim, ring, href }: NowThenColumnProps) {
  return (
    <div className={styles.nowThenColumn}>
      <Eyebrow color={ring === 'heir' ? 'var(--amber-text)' : undefined}>
        {label}
      </Eyebrow>
      <PortraitAvatar
        imageUrl={sim.imageUrl}
        firstName={sim.firstName}
        lastName={sim.lastName}
        size={96}
        ring={ring}
        href={href}
      />
      <div className={styles.nowThenNameBlock}>
        <span className={styles.nowThenName}>
          {sim.firstName} {sim.lastName}
        </span>
        {sim.aspirationName && (
          <span className={styles.nowThenAspiration}>{sim.aspirationName}</span>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// FounderGhost — empty founder slot with an "Add your founder" CTA
// ---------------------------------------------------------------------------

function FounderGhost({ slug }: { slug: string }) {
  return (
    <div className={styles.nowThenColumn}>
      <Eyebrow color="var(--amber-text)">Founder · Gen I</Eyebrow>
      <GhostCircle size={96} accent>
        <UserPlusIcon size={22} />
      </GhostCircle>
      <div className={styles.nowThenCta}>
        <ButtonLink
          variant="primary"
          size="sm"
          href={`/app/legacies/${slug}/sims/new`}
        >
          Add your founder <ArrowRightIcon size={14} />
        </ButtonLink>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// HeirGhost — empty heir slot ("No heir yet")
// ---------------------------------------------------------------------------

function HeirGhost({ accent, hint }: { accent: boolean; hint: string }) {
  return (
    <div className={styles.nowThenColumn}>
      <Eyebrow color={accent ? 'var(--amber-text)' : undefined}>
        Current heir
      </Eyebrow>
      <GhostCircle size={96} accent={accent}>
        <UserPlusIcon size={22} />
      </GhostCircle>
      <div className={styles.nowThenNameBlock}>
        <span className={styles.nowThenNameEmpty}>No heir yet</span>
        <span className={styles.nowThenHint}>{hint}</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Hero — exported section component
// ---------------------------------------------------------------------------

export interface HeroProps {
  name: string
  description: string | null
  slug: string
  stats: LegacyStats
  founder: ChronicleSim | null
  currentHeir: ChronicleSim | null
  treeSlot?: React.ReactNode
}

/**
 * Renders the name with the trailing word "Legacy" in amber `<em>` if present.
 */
function LegacyTitle({ name }: { name: string }) {
  const parts = splitLegacyName(name)
  if (parts) {
    return (
      <h1 className={styles.title}>
        {parts.before} <em className={styles.titleAccent}>{parts.legacy}</em>
      </h1>
    )
  }
  return <h1 className={styles.title}>{name}</h1>
}

const BRAND_NEW_BLURB =
  'Add your founder to begin — the succession line, the milestones, and the family roster all fill in from here.'

export function Hero({
  name,
  description,
  slug,
  stats,
  founder,
  currentHeir,
  treeSlot,
}: HeroProps) {
  // A legacy with no founder is "brand new": em-dash stats + a dashed card.
  const isBrandNew = founder === null
  const blurb = description ?? (isBrandNew ? BRAND_NEW_BLURB : null)

  return (
    <div className={styles.grid}>
      {/* LEFT — chronicle info */}
      <div className={styles.left}>
        <Eyebrow>Legacy · Chronicle</Eyebrow>
        <LegacyTitle name={name} />
        {blurb && <p className={styles.blurb}>{blurb}</p>}

        <div className={styles.statRow}>
          {isBrandNew ? (
            <>
              <StatBlock value="—" label="Sims" accent="var(--text-subtle)" />
              <StatBlock
                value="—"
                label="Generations"
                accent="var(--text-subtle)"
              />
              <StatBlock
                value="—"
                label="Households"
                accent="var(--text-subtle)"
              />
              <StatBlock
                value="—"
                label="Milestones"
                accent="var(--text-subtle)"
              />
            </>
          ) : (
            <>
              <StatBlock value={stats.sims} label="Sims" />
              <StatBlock
                value={stats.generations}
                label="Generations"
                accent="var(--amber-text)"
              />
              <StatBlock value={stats.households} label="Households" />
              <StatBlock value={stats.milestones} label="Milestones" />
            </>
          )}
        </div>

        {treeSlot && <div className={styles.buttonRow}>{treeSlot}</div>}
      </div>

      {/* RIGHT — Now & then card (always rendered) */}
      <div className={styles.right}>
        <Eyebrow>Now &amp; then</Eyebrow>
        <div
          className={isBrandNew ? styles.nowThenCardEmpty : styles.nowThenCard}
        >
          {founder ? (
            <NowThenColumn
              label={
                founder.generationNumber !== null
                  ? `Founder · Gen ${roman(founder.generationNumber)}`
                  : 'Founder'
              }
              sim={founder}
              ring="founder"
              href={`/app/legacies/${slug}/sims/${founder.id}`}
            />
          ) : (
            <FounderGhost slug={slug} />
          )}

          <div className={styles.nowThenDivider} aria-hidden="true" />

          {currentHeir ? (
            <NowThenColumn
              label={
                currentHeir.generationNumber !== null
                  ? `Current heir · Gen ${roman(currentHeir.generationNumber)}`
                  : 'Current heir'
              }
              sim={currentHeir}
              ring="heir"
              href={`/app/legacies/${slug}/sims/${currentHeir.id}`}
            />
          ) : (
            <HeirGhost
              accent={!isBrandNew}
              hint={
                isBrandNew
                  ? 'Named once the line begins.'
                  : 'Named when the next generation comes of age.'
              }
            />
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Add the new hero styles**

In `src/app/app/legacies/[slug]/_components/hero/hero.module.css`, add these rules at the end of the file (keep all existing rules unchanged):

```css
/* Dashed variant of the Now & then card, for a brand-new legacy. */
.nowThenCardEmpty {
  background: var(--bg);
  border: 1px dashed var(--border-bright);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  display: flex;
  align-items: stretch;
  gap: 18px;
}

/* CTA wrapper inside an empty founder slot. */
.nowThenCta {
  margin-top: 2px;
}

/* "No heir yet" — italic display, muted (decorative accent only). */
.nowThenNameEmpty {
  font-family: var(--font-display);
  font-style: italic;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-muted);
  line-height: 1.1;
}

.nowThenHint {
  font-size: 11px;
  color: var(--text-subtle);
  line-height: 1.4;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run "src/app/app/legacies/[slug]/_components/__tests__/hero.test.tsx"`
Expected: PASS (all tests, including the updated `renders all four stat values` and the new brand-new/ghost-slot tests).

- [ ] **Step 6: Run the chronicle-sections test (the hero renders inside it)**

Run: `npx vitest run "src/app/app/legacies/[slug]/_components/__tests__/chronicle-sections.test.tsx"`
Expected: PASS. If it asserted the old "card omitted when empty" behavior, update that assertion to the new ghost-slot behavior (do not weaken — assert the ghost slots render). Re-run until green.

- [ ] **Step 7: Validate types + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors, no warnings.

- [ ] **Step 8: Commit**

```bash
git add "src/app/app/legacies/[slug]/_components/hero/hero.tsx" \
  "src/app/app/legacies/[slug]/_components/hero/hero.module.css" \
  "src/app/app/legacies/[slug]/_components/__tests__/hero.test.tsx"
git commit -m "feat(legacy): brand-new hero with em-dash stats and ghost slots"
```

(If you edited `chronicle-sections.test.tsx` in Step 6, include it.)

---

## Task 9: Full validation + visual verification

**Files:** none (verification only).

- [ ] **Step 1: Type-check the whole project**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Lint the whole project**

Run: `npm run lint`
Expected: no errors, no warnings.

- [ ] **Step 3: Run the full unit/integration test suite**

Run: `npm test`
Expected: all tests pass. Pay attention to any test that referenced the old empty-state copy (`No sims yet.`, `No milestones recorded yet.`, `No succession line yet — name an heir to begin.`) and update it to the new designed copy — without weakening the assertion.

- [ ] **Step 4: Run the E2E suite**

Run: `npm run test:e2e`
Expected: all pass. If any E2E spec locates the old empty-state text or the old roster CTA "Add your first sim", update the locator (prefer `getByTestId` / role + accessible name over CSS selectors, per project convention).

- [ ] **Step 5: Visual verification against the design**

Start the dev server and sign in via the magic-link flow (see `AGENTS.md`):
1. `docker compose up -d` (MinIO for uploads), then `npm run dev`.
2. Visit `http://localhost:3000/auth/signin`, send a magic link, grep the dev log: `grep "Magic link" .next/dev/logs/next-development.log`, open the callback URL.
3. Create a brand-new legacy (no sims) and open its chronicle page (`/app/legacies/<slug>`).

Confirm visually:
- Hero shows four em-dash (`—`) muted stats and a **dashed** "Now & then" card with an amber founder ghost slot ("Add your founder →") and a neutral "No heir yet" slot.
- Succession shows the git-branch dashed card, "No succession to *trace* yet." (amber italic accent), and a "Name an heir →" button.
- Milestones shows the feather dashed card, "No moments *recorded* yet." (green italic accent), a "Record a moment →" button, and **no white composer box**.
- Roster shows the users dashed card, "No Sims *named* yet." (green italic accent), and a working "Add your founder →" link to the add-Sim page.
- Then add a founder and confirm the page transitions to the founder-added state (solid hero card, real founder column, "No heir yet" heir ghost slot) and the milestones section shows the derived "founds the legacy" row with no white composer box.

- [ ] **Step 6: Final branch wrap-up**

Use the `superpowers:finishing-a-development-branch` skill to decide how to integrate the work (PR / merge / cleanup). Do not merge without the user's go-ahead.

---

## Self-review (performed while writing this plan)

**Spec coverage:**
- New empty states for Succession / Milestones / Roster → Tasks 5, 6, 7. ✅
- Hero brand-new treatment (decided in scope) → Task 8. ✅
- Remove the white box in milestones → Task 6 deliberately omits the `MilestoneComposerEmpty` white card and pins it with a test. ✅
- Shared building blocks (icons, GhostCircle, EmptyState upgrade) → Tasks 1–4. ✅
- Filtered-roster quiet empty → out of scope (no gen filter shipped); documented. ✅

**Type/name consistency:** `EmptyState` props (`icon`, `title`, `accent`, `action`, `children`) are defined in Task 3 and used identically in Tasks 5–7. `GhostCircle` (`size`, `accent`) defined in Task 2, used in Task 3 (via EmptyState) and Task 8 (hero). Icons (`ArrowRightIcon`, `GitBranchIcon`, `FeatherIcon`, `UsersIcon`, `UserPlusIcon`) defined in Task 1, exported in Task 4, consumed in Tasks 5–8. `StatBlock`'s existing `accent` prop reused for muted em-dashes (no signature change). All section components remain RSC (no `'use client'`).

**No placeholders:** every code step shows complete code; every run step shows the command + expected result.

---

## Open decisions for the user (do not block; confirm at review)

1. **Inert CTAs.** ~~"Name an heir →" (Succession)~~ and "Record a moment →" (Milestones) were originally rendered as buttons with no action. **Resolved for Succession:** the empty state only appears when there is no founder, so its CTA is now **"Add your founder →"** → `/sims/new`; heirs are designated via a new "Make heir" toggle on the sim detail page (see *Post-plan addition* below). The Milestones "Record a moment →" CTA remains inert — milestones are auto-derived and there is no manual-entry feature. If a manual-entry flow is ever built, wire it then.
2. **Heir-ghost hint copy.** Used generic "Named when the next generation comes of age." instead of the mock's literal "Named when Gen II comes of age." to avoid hard-coding a generation number. Swap if you want the literal mock copy.
3. **Default brand-new blurb.** When a brand-new legacy has no description, the hero shows the mock's guidance sentence. If you'd rather show nothing, drop the `BRAND_NEW_BLURB` fallback.

---

## Post-plan addition: heir designation

Added after the original plan, at the user's request to make the Succession "Name an heir" CTA functional. This was a genuine gap — nothing in the app surfaced heir designation, even though the `sims.update({ isHeir })` mutation already existed and clears the previous heir in the same generation server-side.

**The flow:** the Succession empty state only shows when a legacy has no founder, so its CTA is "Add your founder →" (→ `/sims/new`). Once a founder exists but no heir is designated yet (the design's *page-in-progress* state), the Succession line renders the founder + a dashed connector + a **"Name an heir" ghost slot** (`NameHeirDialog`, a client component). Clicking it opens an **in-place dialog** (Radix `Dialog`) listing the **next generation's** sims (`generationNumber === highestGen + 1`); picking one calls `sims.update({ isHeir: true })` and `router.refresh()`, so the line populates and the slot disappears — no navigation. If there are no next-gen sims yet, the dialog prompts "Add a Sim". The per-sim **"Make heir" toggle** on the sim detail page remains a second way to designate. Both make `deriveSuccession` return the heir.

**Changes (commits `261590f`, `01118f5`):**
- `sims/[id]/identity-section.tsx` — `SimProp` gains `isHeir`; a `HeirToggle` (`<button type="button" aria-pressed>` labelled "Heir") in the identity chip row, with optimistic local state + revert-on-error, persisting via the section's existing `sims.update` mutateAsync.
- `sims/[id]/page.module.css` — `.heirField` / `.heirToggle` styles; active state uses the amber-tint lineage recipe (`rgba(217,165,65,0.18)` — the one raw value, with an explanatory comment, as no token exists for that wash).
- `sims/[id]/sim-detail-client.tsx` — `sim` Props type gains `isHeir` (the page already provides it via Prisma `include`).
- `_components/succession/succession.tsx` — CTA switched from an inert `Button` to `<ButtonLink href="/app/legacies/[slug]/sims/new">Add your founder →</ButtonLink>` (the empty state only renders sans founder); component stays an RSC.
- Tests: new `sims/[id]/__tests__/identity-section.test.tsx` (toggle set/unset/initial-state/save-failure-revert, tRPC mocked, `Combobox` stubbed); updated `succession.test.tsx` (CTA asserted as an "Add your founder" `link` to `/sims/new`).

**Verified:** `tsc` + `lint` clean; full unit suite green; e2e `add-sims-to-legacy`, `legacy-wizard`, and `sim-detail` (17 tests) pass.

**Founder designation (commit `6dc0a2e`).** Adding a sim previously never set the legacy's `founderSimId` (it was only set by the creation wizard), so "Add your founder" produced no actual founder. Fixed in `sims.create`: a legacy with no founder adopts its first **parentless** sim as the founder, assigning generation 1 when none was given (matching the wizard and the domain invariant that founders are Gen 1). Sims with parents, and legacies that already have a founder, are untouched. Covered by three `sims.test.ts` integration tests.
