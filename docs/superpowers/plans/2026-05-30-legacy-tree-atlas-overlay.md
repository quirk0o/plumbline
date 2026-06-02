# Legacy Tree Atlas — Overlay (Plan 2 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **DEPENDS ON Plan 1** (`2026-05-30-legacy-tree-rendering-engine.md`): this plan imports `usePanZoom` + `computeFit` math, passes `dimmedIds` to `<LineageTree>`, and relies on the intrinsic-size SVG. Do not start until Plan 1 is committed and green.

**Goal:** Rebuild the "View family tree" overlay to match the handoff mock — a Radix `Dialog` (no header bar) over a dot-grid pan/zoom canvas, with a floating legacy capsule (back affordance), a functional top toolbar (search, generation pills, Add sim), and a bottom legend + zoom bar — while removing the duplicated app-nav landmark.

**Architecture:** Radix `Dialog` portals the overlay to `<body>` and `aria-hidden`s the background (kills the duplicate "Main navigation" landmark). The tree sits in a transformed viewport driven by `usePanZoom`. Generation pills + search are local overlay state deriving a filtered sim/edge set and a `dimmedIds` set.

**Tech Stack:** Next.js 16, React, TypeScript, `@radix-ui/react-dialog` (existing dep), CSS Modules, Vitest + RTL (jsdom), Playwright. No ReactFlow, no new pan/zoom dependency.

**Worktree:** Work in `.claude/worktrees/legacy-chronicle-redesign` (branch `worktree-legacy-chronicle-redesign`); run commands from its root.

**Decisions locked with the user:** full pan+zoom; functional Gen pills + Search + Add sim; **omit + Milestone**; **remove** the header bar (close via Esc + capsule back); keep the Radix AppNav a11y fix.

**Out of scope:** `src/components/family-tree/FamilyTree.tsx`; the pre-existing stale legacy-page E2E specs; any milestone data model.

**Reference:** `design_handoff_legacy_redesign/combined.jsx` (`AtlasLegacy`) + the user's target screenshot.

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `src/test/setup.ts` | jsdom test setup. | No-op Pointer Capture polyfills for Radix. |
| `…/tree-overlay/atlas-toolbar.tsx` | **New.** Top-right toolbar (search + gen pills + Add sim). | Create. |
| `…/tree-overlay/atlas-toolbar.module.css` | **New.** Toolbar styling. | Create. |
| `…/tree-overlay/__tests__/atlas-toolbar.test.tsx` | **New.** Toolbar tests. | Create. |
| `…/tree-overlay/tree-overlay.tsx` | The fullscreen overlay. | Major rebuild: Radix Dialog, pan/zoom canvas, capsule+back, bottom zoom bar, filtering/search. |
| `…/tree-overlay/tree-overlay.module.css` | Overlay styling. | Remove `.header`; add `.surface`/`.viewport`/`.bottomBar`/zoom controls/capsule back. |
| `…/view-tree/view-tree.tsx` | Trigger + overlay owner. | Own the Radix `Dialog.Root`; capture trigger for focus-restore. |
| `…/tree-overlay/__tests__/tree-overlay.test.tsx` | Overlay tests. | Rewrite for Radix + toolbar + capsule. |
| `…/_components/__tests__/view-tree.test.tsx` | Overlay-via-trigger tests. | Update name + Escape assertions. |

(`…` = `src/app/app/legacies/[slug]/_components`.)

---

## Task 1: Pointer Capture polyfill for Radix-in-jsdom

Radix Dialog's dismissable layer touches Pointer Capture APIs jsdom lacks. Add no-op polyfills next to the existing guards.

**Files:** Modify `src/test/setup.ts`.

- [ ] **Step 1: Add the polyfills**

In `src/test/setup.ts`, immediately after the existing `ResizeObserver` guard (before the `beforeAll(...)` line):

```ts
// jsdom does not implement the Pointer Capture API; Radix Dialog's dismissable
// layer touches it. No-op it so modal tests don't throw.
if (typeof Element !== 'undefined' && !Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.setPointerCapture = () => {}
  Element.prototype.releasePointerCapture = () => {}
}
```

- [ ] **Step 2: Verify no regressions, commit**

```bash
npm test
git add src/test/setup.ts
git commit -m "test: polyfill Pointer Capture for Radix Dialog in jsdom"
```

---

## Task 2: Atlas top-right toolbar (search + gen pills + Add sim)

Controlled presentational component. Search/gen raise callbacks; "Add sim" is a `ButtonLink` to `/app/legacies/<slug>/sims/new`. Pills derive from the generations present.

**Files:**
- Create: `…/tree-overlay/atlas-toolbar.tsx`
- Create: `…/tree-overlay/atlas-toolbar.module.css`
- Test: `…/tree-overlay/__tests__/atlas-toolbar.test.tsx`

- [ ] **Step 1: Write the failing toolbar test**

Create `src/app/app/legacies/[slug]/_components/tree-overlay/__tests__/atlas-toolbar.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

import { AtlasToolbar } from '../atlas-toolbar'

const baseProps = {
  legacySlug: 'caliente',
  generations: [1, 2, 3],
  genFilter: 'all' as const,
  query: '',
}

describe('AtlasToolbar', () => {
  it('renders a pill per present generation plus All, with the active one pressed', () => {
    render(<AtlasToolbar {...baseProps} genFilter={2} onGenChange={() => {}} onQueryChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Gen II' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Gen III' })).toBeInTheDocument()
  })

  it('raises onGenChange with the chosen generation', async () => {
    const onGenChange = vi.fn()
    const user = userEvent.setup()
    render(<AtlasToolbar {...baseProps} onGenChange={onGenChange} onQueryChange={() => {}} />)
    await user.click(screen.getByRole('button', { name: 'Gen I' }))
    expect(onGenChange).toHaveBeenCalledWith(1)
  })

  it('raises onQueryChange as the user types', async () => {
    const onQueryChange = vi.fn()
    const user = userEvent.setup()
    render(<AtlasToolbar {...baseProps} onGenChange={() => {}} onQueryChange={onQueryChange} />)
    await user.type(screen.getByRole('searchbox', { name: /search this lineage/i }), 'Re')
    expect(onQueryChange).toHaveBeenLastCalledWith('Re')
  })

  it('links Add sim to the new-sim route', () => {
    render(<AtlasToolbar {...baseProps} onGenChange={() => {}} onQueryChange={() => {}} />)
    expect(screen.getByRole('link', { name: /add sim/i })).toHaveAttribute(
      'href',
      '/app/legacies/caliente/sims/new',
    )
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/app/app/legacies/'[slug]'/_components/tree-overlay/__tests__/atlas-toolbar.test.tsx`
Expected: FAIL — `../atlas-toolbar` does not exist.

- [ ] **Step 3: Implement the toolbar**

Create `src/app/app/legacies/[slug]/_components/tree-overlay/atlas-toolbar.tsx`:

```tsx
'use client'
import { ButtonLink } from '@/components/ui'
import { roman } from '@/lib/legacy-format'
import { cn } from '@/lib/utils'
import styles from './atlas-toolbar.module.css'

export type GenFilter = number | 'all'

export interface AtlasToolbarProps {
  legacySlug: string
  /** Distinct generation numbers present, ascending. */
  generations: number[]
  genFilter: GenFilter
  query: string
  onGenChange: (gen: GenFilter) => void
  onQueryChange: (query: string) => void
}

export function AtlasToolbar({
  legacySlug,
  generations,
  genFilter,
  query,
  onGenChange,
  onQueryChange,
}: AtlasToolbarProps) {
  const pills: { key: string; label: string; value: GenFilter }[] = [
    { key: 'all', label: 'All', value: 'all' },
    ...generations.map((g) => ({ key: String(g), label: `Gen ${roman(g)}`, value: g })),
  ]

  return (
    <div className={styles.toolbar}>
      <div className={styles.searchWrap}>
        <svg
          className={styles.searchIcon}
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <circle cx="6" cy="6" r="4.5" />
          <path d="M9.5 9.5L13 13" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          className={styles.searchInput}
          placeholder="Search this lineage…"
          aria-label="Search this lineage"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
        />
      </div>

      <span className={styles.divider} aria-hidden="true" />

      <div className={styles.pills} role="group" aria-label="Filter by generation">
        {pills.map((pill) => {
          const active = pill.value === genFilter
          return (
            <button
              key={pill.key}
              type="button"
              className={cn(styles.pill, active && styles.pillActive)}
              aria-pressed={active}
              onClick={() => onGenChange(pill.value)}
            >
              {pill.label}
            </button>
          )
        })}
      </div>

      <span className={styles.divider} aria-hidden="true" />

      <ButtonLink href={`/app/legacies/${legacySlug}/sims/new`} variant="primary" size="sm">
        Add sim
      </ButtonLink>
    </div>
  )
}
```

- [ ] **Step 4: Implement the toolbar CSS**

Create `src/app/app/legacies/[slug]/_components/tree-overlay/atlas-toolbar.module.css`:

```css
.toolbar {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: color-mix(in srgb, var(--bg-card) 92%, transparent);
  backdrop-filter: blur(14px);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
}

.searchWrap {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-left: 4px;
}

.searchIcon {
  color: var(--text-subtle);
  flex-shrink: 0;
}

.searchInput {
  border: none;
  outline: none;
  background: transparent;
  font-family: var(--font-body);
  font-size: 13px;
  color: var(--text);
  width: 160px;
}

.searchInput::placeholder {
  color: var(--text-subtle);
}

.divider {
  width: 1px;
  height: 20px;
  background: var(--border);
}

.pills {
  display: flex;
  align-items: center;
  gap: 6px;
}

.pill {
  padding: 3px 10px;
  border-radius: var(--radius-full);
  font-family: var(--font-body);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  background: transparent;
  color: var(--text-muted);
  border: 1px solid var(--border);
  cursor: pointer;
  transition: background var(--transition-base), color var(--transition-base),
    border-color var(--transition-base);
}

.pill:hover {
  border-color: var(--border-bright);
  color: var(--text);
}

.pillActive,
.pillActive:hover {
  background: var(--green-glow);
  color: var(--green);
  border-color: var(--green);
}

.pill:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
```

- [ ] **Step 5: Run the toolbar test, type-check, lint, commit**

```bash
npm test -- src/app/app/legacies/'[slug]'/_components/tree-overlay/__tests__/atlas-toolbar.test.tsx
npx tsc --noEmit
npm run lint
git add src/app/app/legacies/'[slug]'/_components/tree-overlay/atlas-toolbar.tsx \
        src/app/app/legacies/'[slug]'/_components/tree-overlay/atlas-toolbar.module.css \
        src/app/app/legacies/'[slug]'/_components/tree-overlay/__tests__/atlas-toolbar.test.tsx
git commit -m "feat(legacy-tree): atlas top-right toolbar (search, gen pills, add sim)"
```

---

## Task 3: Rebuild the overlay (Radix Dialog, pan/zoom canvas, capsule+back, bottom zoom bar) + ViewTree

**Files:**
- Modify: `…/view-tree/view-tree.tsx`
- Modify: `…/tree-overlay/tree-overlay.tsx`
- Modify: `…/tree-overlay/tree-overlay.module.css`

- [ ] **Step 1: Rewrite `view-tree.tsx`**

Replace the entire contents of `src/app/app/legacies/[slug]/_components/view-tree/view-tree.tsx`:

```tsx
'use client'
import { useRef, useState } from 'react'
import * as RadixDialog from '@radix-ui/react-dialog'
import { Button, TreeIcon } from '@/components/ui'
import { TreeOverlay } from '../tree-overlay/tree-overlay'

export interface ViewTreeProps {
  legacySlug: string
  legacyName: string
  founderSimId?: string
  name: string | null
  email: string | null
  image: string | null
}

export function ViewTree({
  legacySlug,
  legacyName,
  founderSimId,
  name,
  email,
  image,
}: ViewTreeProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  return (
    <RadixDialog.Root open={open} onOpenChange={setOpen}>
      <Button
        variant="outline"
        onClick={(e) => {
          triggerRef.current = e.currentTarget
          setOpen(true)
        }}
      >
        <TreeIcon />
        View family tree
      </Button>
      {open && (
        <TreeOverlay
          legacySlug={legacySlug}
          legacyName={legacyName}
          founderSimId={founderSimId}
          name={name}
          email={email}
          image={image}
          onClose={() => setOpen(false)}
          returnFocusRef={triggerRef}
        />
      )}
    </RadixDialog.Root>
  )
}
```

- [ ] **Step 2: Rewrite `tree-overlay.tsx`**

Replace the entire contents of `src/app/app/legacies/[slug]/_components/tree-overlay/tree-overlay.tsx`:

```tsx
'use client'
import { useMemo, useRef, useState, type RefObject } from 'react'
import * as RadixDialog from '@radix-ui/react-dialog'
import { useRouter } from 'next/navigation'
import { trpc } from '@/trpc/client'
import { AppNav } from '@/app/app/components/app-nav'
import { LineageTree } from '@/components/lineage-tree/lineage-tree'
import { computeLineageLayout } from '@/components/lineage-tree/layout'
import { usePanZoom } from '@/components/lineage-tree/use-pan-zoom'
import { Plumbob } from '@/components/plumbob'
import { splitLegacyName } from '../../lib/legacy-title'
import { AtlasToolbar, type GenFilter } from './atlas-toolbar'
import styles from './tree-overlay.module.css'

export interface TreeOverlayProps {
  legacySlug: string
  legacyName: string
  founderSimId?: string
  name: string | null
  email: string | null
  image: string | null
  onClose: () => void
  returnFocusRef?: RefObject<HTMLButtonElement | null>
}

/** Top-left glass capsule: an accessible back button + the legacy identity. */
function LegacyCapsule({
  name,
  simCount,
  generationCount,
  backButtonRef,
  onClose,
}: {
  name: string
  simCount: number
  generationCount: number
  backButtonRef: RefObject<HTMLButtonElement | null>
  onClose: () => void
}) {
  const parts = splitLegacyName(name)
  const simLabel = `${simCount} ${simCount === 1 ? 'sim' : 'sims'}`
  const genLabel = `${generationCount} ${generationCount === 1 ? 'generation' : 'generations'}`
  return (
    <div className={styles.capsule}>
      <button
        ref={backButtonRef}
        type="button"
        className={styles.capsuleBack}
        onClick={onClose}
        aria-label="Back to legacy"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M10 3L5 8l5 5" />
        </svg>
      </button>
      <Plumbob size={12} />
      <div className={styles.capsuleText}>
        <span className={styles.capsuleEyebrow} aria-hidden="true">
          Legacy
        </span>
        <RadixDialog.Title className={styles.capsuleTitle}>
          {parts ? (
            <>
              {parts.before}{' '}
              <span className={styles.capsuleAccent}>{parts.legacy}</span>
            </>
          ) : (
            name
          )}
        </RadixDialog.Title>
        <span className={styles.capsuleMeta} aria-hidden="true">
          {simLabel} · {genLabel}
        </span>
      </div>
    </div>
  )
}

/** Bottom glass bar: colour key + zoom controls. */
function AtlasBottomBar({
  zoomPercent,
  onZoomIn,
  onZoomOut,
  onFit,
}: {
  zoomPercent: number
  onZoomIn: () => void
  onZoomOut: () => void
  onFit: () => void
}) {
  return (
    <div className={styles.bottomBar}>
      <div className={styles.legend} aria-hidden="true">
        <span className={styles.legendItem}>
          <span className={styles.legendDotHeir} />
          Heir
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendDotSim} />
          Sim
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendLineMarriage} />
          Marriage
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendLineLineage} />
          Lineage
        </span>
      </div>
      <span className={styles.divider} aria-hidden="true" />
      <div className={styles.zoomControls}>
        <button type="button" className={styles.zoomButton} onClick={onZoomOut} aria-label="Zoom out">
          −
        </button>
        <span className={styles.zoomReadout} aria-live="polite">
          {zoomPercent}%
        </span>
        <button type="button" className={styles.zoomButton} onClick={onZoomIn} aria-label="Zoom in">
          +
        </button>
        <button type="button" className={styles.zoomFit} onClick={onFit}>
          Fit
        </button>
      </div>
    </div>
  )
}

export function TreeOverlay({
  legacySlug,
  legacyName,
  founderSimId,
  name,
  email,
  image,
  onClose,
  returnFocusRef,
}: TreeOverlayProps) {
  const router = useRouter()
  const backButtonRef = useRef<HTMLButtonElement>(null)
  const surfaceRef = useRef<HTMLDivElement>(null)

  const { data, isLoading, isError } = trpc.sims.getTreeData.useQuery({ legacySlug })

  const allSims = useMemo(() => data?.sims ?? [], [data])
  const generations = useMemo(
    () =>
      Array.from(
        new Set(allSims.map((s) => s.generationNumber).filter((g): g is number => g !== null)),
      ).sort((a, b) => a - b),
    [allSims],
  )

  const [genFilter, setGenFilter] = useState<GenFilter>('all')
  const [query, setQuery] = useState('')

  const visibleSims = useMemo(
    () => (genFilter === 'all' ? allSims : allSims.filter((s) => s.generationNumber === genFilter)),
    [allSims, genFilter],
  )
  const visibleIds = useMemo(() => new Set(visibleSims.map((s) => s.id)), [visibleSims])
  const familyEdges = useMemo(
    () => (data?.familyEdges ?? []).filter((e) => visibleIds.has(e.parentId) && visibleIds.has(e.childId)),
    [data, visibleIds],
  )
  const partnerEdges = useMemo(
    () => (data?.partnerEdges ?? []).filter((e) => visibleIds.has(e.simAId) && visibleIds.has(e.simBId)),
    [data, visibleIds],
  )

  const dimmedIds = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return undefined
    const ids = new Set<string>()
    for (const s of visibleSims) {
      if (!`${s.firstName} ${s.lastName}`.toLowerCase().includes(q)) ids.add(s.id)
    }
    return ids
  }, [query, visibleSims])

  const layout = useMemo(
    () => computeLineageLayout(visibleSims, familyEdges, partnerEdges),
    [visibleSims, familyEdges, partnerEdges],
  )
  const { transform, zoomPercent, fit, zoomIn, zoomOut, surfaceProps } = usePanZoom(
    surfaceRef,
    layout.viewBox.width,
    layout.viewBox.height,
  )

  const simCount = allSims.length
  const generationCount = generations.length

  function handleSelectSim(simId: string) {
    router.push(`/app/legacies/${legacySlug}/sims/${simId}`)
  }

  return (
    <RadixDialog.Portal>
      <RadixDialog.Content
        className={styles.overlay}
        aria-describedby={undefined}
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          backButtonRef.current?.focus()
        }}
        onCloseAutoFocus={(e) => {
          if (returnFocusRef?.current) {
            e.preventDefault()
            returnFocusRef.current.focus()
          }
        }}
      >
        <AppNav name={name} email={email} image={image} />

        <div className={styles.body}>
          {isLoading && (
            <div role="status" aria-live="polite" className={styles.message}>
              Loading the family tree…
            </div>
          )}
          {isError && (
            <div role="alert" className={styles.message}>
              Could not load the family tree.
            </div>
          )}
          {!isLoading && !isError && allSims.length === 0 && (
            <p className={styles.message}>No sims to chart yet.</p>
          )}

          {!isLoading && !isError && allSims.length > 0 && (
            <div className={styles.canvas}>
              <LegacyCapsule
                name={legacyName}
                simCount={simCount}
                generationCount={generationCount}
                backButtonRef={backButtonRef}
                onClose={onClose}
              />
              <AtlasToolbar
                legacySlug={legacySlug}
                generations={generations}
                genFilter={genFilter}
                query={query}
                onGenChange={setGenFilter}
                onQueryChange={setQuery}
              />

              <div ref={surfaceRef} className={styles.surface} {...surfaceProps}>
                <div
                  className={styles.viewport}
                  style={{
                    transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                  }}
                >
                  {visibleSims.length > 0 ? (
                    <LineageTree
                      sims={visibleSims}
                      familyEdges={familyEdges}
                      partnerEdges={partnerEdges}
                      founderSimId={founderSimId}
                      legacyName={legacyName}
                      dimmedIds={dimmedIds}
                      onSelectSim={handleSelectSim}
                    />
                  ) : null}
                </div>
              </div>

              {visibleSims.length === 0 && (
                <p className={styles.emptyFilter}>No sims in this generation.</p>
              )}

              <AtlasBottomBar
                zoomPercent={zoomPercent}
                onZoomIn={zoomIn}
                onZoomOut={zoomOut}
                onFit={fit}
              />
            </div>
          )}
        </div>
      </RadixDialog.Content>
    </RadixDialog.Portal>
  )
}
```

Notes:
- The capsule's `RadixDialog.Title` is the dialog's accessible name (= the legacy name); eyebrow/meta are `aria-hidden`; `Plumbob` is already `aria-hidden`.
- When a gen filter empties the tree, the canvas/toolbar/zoom-bar stay mounted and an inline "No sims in this generation." shows.

- [ ] **Step 3: Restructure `tree-overlay.module.css`**

a) **Delete** the `.header`, `.backButton`, `.headerTitle`, `.titleAccent`, and `.treeContainer` rules.

b) Keep `@keyframes legacy-tree-in`, the reduced-motion block, `.message`, and the capsule/legend item rules. Change `.overlay` to hook its animation to the open state — replace the bare `animation:` line on `.overlay` with:

```css
.overlay[data-state='open'] {
  animation: legacy-tree-in 320ms cubic-bezier(0.16, 1, 0.3, 1) both;
}
```
(keep `@media (prefers-reduced-motion: reduce) { .overlay { animation: none; } }`.)

c) Replace `.body`'s flex-centering with a plain relative fill:

```css
.body {
  flex: 1;
  min-height: 0;
  position: relative;
}
```

d) Replace `.canvas` with the static dot-grid stage:

```css
.canvas {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--bg);
  background-image: radial-gradient(
    circle at 1px 1px,
    color-mix(in srgb, var(--text) 8%, transparent) 1px,
    transparent 0
  );
  background-size: 20px 20px;
}
```

e) Add the pan surface + transformed viewport:

```css
.surface {
  position: absolute;
  inset: 0;
  touch-action: none;
  cursor: grab;
}

.surface:active {
  cursor: grabbing;
}

.viewport {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: 0 0;
  will-change: transform;
}
```

f) Ensure `.capsule { z-index: 2 }` and add the capsule back button:

```css
.capsuleBack {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  background: none;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  cursor: pointer;
  flex-shrink: 0;
  transition: background var(--transition-fast), border-color var(--transition-fast),
    color var(--transition-fast);
}

.capsuleBack:hover {
  background: var(--bg-card-hover);
  border-color: var(--border-bright);
  color: var(--text);
}

.capsuleBack:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
```

g) Replace the old standalone `.legend` positioning with a `.bottomBar` wrapper + zoom controls (keep the existing `.legendItem`/dot/line rules):

```css
.bottomBar {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 8px 14px;
  background: color-mix(in srgb, var(--bg-card) 92%, transparent);
  backdrop-filter: blur(14px);
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  box-shadow: var(--shadow-md);
}

.legend {
  display: flex;
  align-items: center;
  gap: 14px;
}

.divider {
  width: 1px;
  height: 18px;
  background: var(--border);
}

.zoomControls {
  display: flex;
  align-items: center;
  gap: 4px;
}

.zoomButton {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  font-size: 16px;
  line-height: 1;
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
}

.zoomButton:hover {
  background: var(--bg-card-hover);
  color: var(--text);
}

.zoomFit {
  padding: 4px 10px;
  font-family: var(--font-body);
  font-size: 12px;
  font-weight: 600;
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
}

.zoomFit:hover {
  background: var(--bg-card-hover);
  color: var(--text);
}

.zoomButton:focus-visible,
.zoomFit:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.zoomReadout {
  min-width: 44px;
  text-align: center;
  font-family: var(--font-body);
  font-size: 12px;
  color: var(--text-muted);
}

.emptyFilter {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1;
  color: var(--text-muted);
  font-family: var(--font-body);
  font-size: 14px;
  font-style: italic;
}
```

- [ ] **Step 4: Type-check, lint, commit**

```bash
npx tsc --noEmit
npm run lint
git add src/app/app/legacies/'[slug]'/_components/view-tree/view-tree.tsx \
        src/app/app/legacies/'[slug]'/_components/tree-overlay/tree-overlay.tsx \
        src/app/app/legacies/'[slug]'/_components/tree-overlay/tree-overlay.module.css
git commit -m "feat(legacy-tree): atlas overlay — Radix dialog, pan/zoom canvas, capsule, zoom bar"
```

---

## Task 4: Update the overlay tests

**Files:**
- Modify: `…/tree-overlay/__tests__/tree-overlay.test.tsx`
- Modify: `…/_components/__tests__/view-tree.test.tsx`

- [ ] **Step 1: Rewrite the `tree-overlay.test.tsx` behaviour block**

Add `within` to the testing-library import (`import { render, screen, within } from '@testing-library/react'`) and, if not already present, a `next/link` mock at the top:

```tsx
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))
```

Replace the `describe('TreeOverlay focus trap', …)` block with (keep the other `vi.mock`s, the `mockUseQuery` hoist, `openOverlay`, and `defaultProps`):

```tsx
describe('TreeOverlay (Radix modal atlas)', () => {
  beforeEach(() => {
    mockPush.mockReset()
    mockUseQuery.mockReturnValue({
      data: {
        sims: [
          { id: 's1', firstName: 'Dina', lastName: 'Caliente', imageUrl: null, generationNumber: 1, lifeStage: 'ADULT', isHeir: false, href: '/app/legacies/caliente/sims/s1' },
          { id: 's2', firstName: 'Reed', lastName: 'Caliente', imageUrl: null, generationNumber: 2, lifeStage: 'TEEN', isHeir: true, href: '/app/legacies/caliente/sims/s2' },
        ],
        familyEdges: [],
        partnerEdges: [],
      },
      isLoading: false,
      isError: false,
    })
  })

  it('exposes a modal dialog named by its visible legacy title', async () => {
    await openOverlay()
    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog).toHaveAccessibleName('The Caliente Legacy')
  })

  it('keeps the atlas AppNav inside the dialog', async () => {
    await openOverlay()
    expect(within(screen.getByRole('dialog')).getByTestId('app-nav')).toBeInTheDocument()
  })

  it('hides the rest of the page from assistive tech while open', async () => {
    const user = userEvent.setup()
    render(
      <div>
        <nav aria-label="Main navigation" data-testid="page-nav">
          <a href="/app">Home</a>
        </nav>
        <ViewTree {...defaultProps} />
      </div>,
    )
    await user.click(screen.getByRole('button', { name: /view family tree/i }))
    expect(screen.getByTestId('page-nav').closest('[aria-hidden="true"]')).not.toBeNull()
  })

  it('renders the floating capsule with sim + generation counts', async () => {
    await openOverlay()
    expect(screen.getByText(/2 sims · 2 generations/i)).toBeInTheDocument()
  })

  it('renders the generation filter pills and the Add sim link', async () => {
    await openOverlay()
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(dialog).getByRole('button', { name: 'Gen I' })).toBeInTheDocument()
    expect(within(dialog).getByRole('link', { name: /add sim/i })).toHaveAttribute(
      'href',
      '/app/legacies/caliente/sims/new',
    )
  })

  it('closes via the capsule back button', async () => {
    const user = await openOverlay()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /back to legacy/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
```

The `LineageTree` is mocked in this file, so the real `usePanZoom`/`computeLineageLayout` do not run here.

- [ ] **Step 2: Update `view-tree.test.tsx`**

a) "opens the overlay" name → `'The Caliente Legacy'`:

```tsx
  it('opens the overlay when the trigger button is clicked', async () => {
    const user = userEvent.setup()
    render(<ViewTree {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /view family tree/i }))
    expect(screen.getByRole('dialog', { name: 'The Caliente Legacy' })).toBeInTheDocument()
  })
```

b) Escape-close → `userEvent` (Radix listens on the document, not `window`):

```tsx
  it('closes the overlay when Escape is pressed', async () => {
    const user = userEvent.setup()
    render(<ViewTree {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /view family tree/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
```

c) Widen this file's `LineageTree` mock prop type to accept `dimmedIds?: Set<string>` if TS narrows it. The loading/error/empty tests, the amber `<em>`/`em` title tests (the `<em>` now lives in the capsule via `splitLegacyName`), and the node-selection navigation test remain valid; the "closes when Back to legacy clicked" test still resolves the back button (now in the capsule, `aria-label="Back to legacy"`). Adjust any assertion that looked for the old header `<h2>` to look within the dialog instead.

- [ ] **Step 3: Run overlay tests, type-check, lint, commit**

```bash
npm test -- src/app/app/legacies/'[slug]'/_components/__tests__/view-tree.test.tsx src/app/app/legacies/'[slug]'/_components/tree-overlay/__tests__/tree-overlay.test.tsx
npx tsc --noEmit
npm run lint
git add src/app/app/legacies/'[slug]'/_components/tree-overlay/__tests__/tree-overlay.test.tsx \
        src/app/app/legacies/'[slug]'/_components/__tests__/view-tree.test.tsx
git commit -m "test(legacy-tree): cover Radix atlas overlay (dialog, toolbar, capsule, background-hidden)"
```

---

## Task 5: Full validation + live verification against the target screenshot

**Files:** none (verification only).

- [ ] **Step 1: Static + full suite**

```bash
npx tsc --noEmit
npm run lint
npm test
```
Expected: tsc clean, lint clean, all tests pass.

- [ ] **Step 2: Dev server + sign in**

```bash
npm run dev
```
Magic link: open `http://localhost:3000/auth/signin`, submit any email, then `grep "Magic link" .next/dev/logs/next-development.log`, open the callback URL.

- [ ] **Step 3: Visual match vs. the screenshot (light + dark), screenshot each**

Open a legacy with several sims → **View family tree**. Confirm: AppNav at top; **no** header bar; dot-grid canvas; top-left capsule (back arrow, plumbob, `LEGACY`, "The Caliente *Legacy*" upright amber, "N sims · M generations"); top-right toolbar (search, `All/Gen I/II/III` pills, green **Add sim**); Crest medallions at sensible scale with GEN labels, amber marriage diamonds, tan lineage, heir crown + glow; bottom bar (legend + `−  NN%  +  Fit`).

- [ ] **Step 4: Interactions**

Drag-pan; wheel-zoom toward cursor; `−`/`+`/`Fit` and % readout; gen pills filter + re-fit (empty gen shows "No sims in this generation."); search dims non-matches; node click → sim detail; Add sim → `…/sims/new`.

- [ ] **Step 5: Keyboard + a11y**

Esc and capsule back close → focus returns to "View family tree"; Tab stays within the dialog; background unreachable; exactly **one** "Main navigation" landmark while open; zoom buttons + pills keyboard-operable.

- [ ] **Step 6: E2E + status doc**

```bash
npm run test:e2e
```
Expected: no **new** regressions vs. the known stale legacy-page specs.

Update `docs/legacy-chronicle-redesign-status.md`: move "tree visual match", "tree initial scroll", and "AppNav rendered inside the tree dialog" to "Completed"; record the shipped toolbar + pan/zoom; note the remaining follow-up (keyboard focus on an off-screen node does not auto-pan into view). Commit:

```bash
git add docs/legacy-chronicle-redesign-status.md
git commit -m "docs(legacy-chronicle): record tree atlas completion (toolbar, pan/zoom, a11y)"
```

---

## Self-Review

- **Coverage:** Radix dialog + background-hidden (Tasks 3–4); pan/zoom canvas (Task 3 consuming Plan 1's hook); toolbar search/pills/Add sim (Tasks 2–3); header removed + capsule back (Task 3); + Milestone omitted (no task adds it); live visual match (Task 5).
- **Type consistency:** `GenFilter` from `atlas-toolbar.tsx` is the `useState`/`onGenChange` type in `tree-overlay.tsx`; `usePanZoom(...)` shape from Plan 1 is consumed exactly; `dimmedIds?: Set<string>` flows overlay → `LineageTree`; `returnFocusRef: RefObject<HTMLButtonElement | null>` flows ViewTree → TreeOverlay.
- **No placeholders:** every code step complete; run steps have exact commands + expected results.
