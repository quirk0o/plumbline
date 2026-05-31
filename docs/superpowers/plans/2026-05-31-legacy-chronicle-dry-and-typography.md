# Legacy Chronicle — DRY Extractions & Typography Sweep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the duplication and magic-number debt the design review flagged on the `legacy-chronicle-redesign` branch — extract the repeated glass surface, empty-state, and icon-button patterns, and put hardcoded font sizes on the design-token scale.

**Architecture:** Four sequential tasks. Tasks 7–9 are the DRY extractions (glass via shared CSS-Modules `composes`, EmptyState as a React component, icon buttons unified onto the existing `Button`/`ButtonLink` primitive). Task 10 is the typography token sweep, run LAST so it tokenizes the final consolidated CSS (including the new EmptyState component). This continues the numbering from the prior review-fix plan (Tasks 1–6).

**Tech Stack:** Next.js 16, React 19, TypeScript, CSS Modules (with `composes`), Vitest + RTL, ESLint. No lint/TS suppressions.

**Parity rule (applies to every task):** These are refactors. Unless a step explicitly says otherwise, the rendered result must be **value-for-value identical** — CSS declarations are *relocated or token-substituted*, never changed in value. The one intentional visual change is Task 9 (icon buttons adopt the design-system button look + larger hit area); it is called out explicitly there.

**Decision (typography), confirmed with the user — "Hybrid":** snap font sizes within ~1px to the existing `--text-*` ramp; add a small number of new tokens for genuinely distinct sizes. Net effect ≈ pixel-identical (max ±1px on snapped values, 0px on the new display tokens).

**Scope boundary:** Only the redesign surface is touched: `legacies/[slug]/_components/*`, `components/lineage-tree/*`, and the redesign UI primitives (`stat-block`, `section-heading`, `eyebrow`, `generation-badge`, `portrait-avatar`). **Exclude** pre-existing `components/ui/button`, `components/ui/combobox`, and the separate `legacies/[slug]/sims/[id]/*` detail page from the typography sweep.

**Worktree & tooling for all subagents:**
`W=/Users/beatka/Projects/simstrack-526/.claude/worktrees/legacy-chronicle-redesign` (separate checkout, own node_modules). Do NOT use `cd`. Commands:
- tsc: `$W/node_modules/.bin/tsc --noEmit -p $W/tsconfig.json`
- vitest (one file): `$W/node_modules/.bin/vitest run <relative/path> --root $W`  · whole suite: `$W/node_modules/.bin/vitest run --root $W`
- eslint: `$W/node_modules/.bin/eslint <absolute paths>`
- git: `git -C $W <args>` (stage specific files only). The `[slug]` path segment has brackets — quote paths in shell.

---

## File Structure

| File | Task | Responsibility |
|---|---|---|
| `src/components/ui/surfaces/surfaces.module.css` | 7 | NEW — shared `.glass` / `.glassPanel` treatments (composed into consumers) |
| `tree-atlas/tree-atlas.module.css` | 7, 10 | consume `.glass` via `composes`; later font-size tokens |
| `tree-atlas/atlas-toolbar.module.css` | 7, 9, 10 | consume `.glass`; remove migrated icon-button CSS; tokens |
| `tree-atlas/sim-inspector.module.css` | 7, 9, 10 | consume `.glassPanel`; remove `.close` CSS; tokens |
| `src/components/ui/empty-state/empty-state.tsx` | 8 | NEW — `EmptyState` component |
| `src/components/ui/empty-state/empty-state.module.css` | 8 | NEW — dashed-box styles |
| `src/components/ui/empty-state/__tests__/empty-state.test.tsx` | 8 | NEW — component test |
| `src/components/ui/index.ts` | 8 | export `EmptyState` |
| `roster/roster.tsx` + `roster.module.css` | 8, 10 | use `EmptyState`; drop local empty CSS |
| `succession/succession.tsx` + `succession.module.css` | 8, 10 | use `EmptyState`; drop local empty CSS |
| `milestones/milestones.tsx` + `milestones.module.css` | 8, 10 | use `EmptyState`; drop local empty CSS |
| `src/components/ui/button/button.tsx` | 9 | add `'icon'` to `ButtonLink` size union |
| `tree-atlas/tree-atlas.tsx` | 9 | zoom/back controls → `Button`/`ButtonLink` |
| `tree-atlas/sim-inspector.tsx` | 9 | close control → `Button` |
| `src/app/globals.css` | 10 | add `--text-xs` + 3 display tokens |
| all redesign `*.module.css` | 10 | font-size px → tokens (mapping table) |

---

## Task 7: Extract the glass surface into a shared CSS-Modules treatment

**Problem:** The frosted-glass treatment (`color-mix` bg + `blur(14px)` + border + shadow) is copy-pasted across 5 class blocks in 3 files: `tree-atlas.module.css` `.capsule` (L78-91), `.bottomBar` (L166-181), `.searchEmpty` (L266-281); `atlas-toolbar.module.css` `.toolbar` (L1-15); `sim-inspector.module.css` `.inspector` (L6-20). The first four share the 92%/`shadow-md` variant; the inspector uses 96%/`shadow-lg`. Consolidate via CSS-Modules `composes` (no markup change, exact parity).

**Files:** Create `src/components/ui/surfaces/surfaces.module.css`; modify the 3 CSS modules above.

- [ ] **Step 1: Create the shared treatment module**

Create `src/components/ui/surfaces/surfaces.module.css`:

```css
/* Frosted-glass surfaces for floating overlays (atlas toolbar, capsule, inspector).
   Consumed via CSS Modules `composes` so the treatment lives in one place while
   each consumer keeps its own positioning, radius, and layout. */

.glass {
  background: color-mix(in srgb, var(--bg-card) 92%, transparent);
  backdrop-filter: blur(14px);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-md);
}

/* Heavier variant for the inspector panel: more opaque, larger lift. */
.glassPanel {
  background: color-mix(in srgb, var(--bg-card) 96%, transparent);
  backdrop-filter: blur(14px);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-lg);
}
```

- [ ] **Step 2: Compose `.glass` into the four 92%/shadow-md consumers**

In each of these blocks, REMOVE the four declarations `background: color-mix(... 92% ...)`, `backdrop-filter: blur(14px)`, `border: 1px solid var(--border)`, `box-shadow: var(--shadow-md)` and ADD a `composes` line as the FIRST declaration in the block. The remaining declarations (position, radius, padding, layout) stay exactly as-is.

`tree-atlas.module.css` `.capsule` — add `composes: glass from '@/components/ui/surfaces/surfaces.module.css';` as the first line; keep `border-radius: var(--radius-lg)` and all layout. Repeat for `.bottomBar` (keep `border-radius: var(--radius-full)`) and `.searchEmpty` (keep `border-radius: var(--radius-full)`).

`atlas-toolbar.module.css` `.toolbar` — same; keep `border-radius: var(--radius-lg)`.

> Example — `.capsule` becomes:
> ```css
> .capsule {
>   composes: glass from '@/components/ui/surfaces/surfaces.module.css';
>   position: absolute;
>   top: 16px;
>   left: 16px;
>   z-index: 2;
>   display: flex;
>   align-items: center;
>   gap: 12px;
>   padding: 12px 18px;
>   border-radius: var(--radius-lg);
> }
> ```
> Verify the `composes ... from` path resolves (this project aliases `@/` → `src/`; confirm by checking an existing `@/`-aliased import compiles). If `composes` with the `@/` alias does not resolve in CSS Modules, use a correct relative path instead (e.g. `../../../../../../components/ui/surfaces/surfaces.module.css` — count the depth) and report which form you used.

- [ ] **Step 3: Compose `.glassPanel` into the inspector**

`sim-inspector.module.css` `.inspector` — add `composes: glassPanel from '...';` as the first line; remove the 96% background, blur, border, and `box-shadow: var(--shadow-lg)`; keep position, width, max-height, overflow, `border-radius: var(--radius-lg)`, and the `animation`.

- [ ] **Step 4: Validate (CSS-only — parity check by the full suite + visual reasoning)**

Run `tsc --noEmit` → no errors. Run `eslint` on any changed `.tsx` (none expected here) — skip if only CSS changed. Run the whole suite `vitest run --root $W` → all pass (atlas/inspector component tests must still pass; CSS Modules class names are hashed but `composes` preserves the same applied styles).

Manually confirm parity: each consumer now resolves to the SAME four glass declarations plus its own layout — no value changed.

- [ ] **Step 5: Commit**

```bash
git -C $W add src/components/ui/surfaces/surfaces.module.css \
  "src/app/app/legacies/[slug]/_components/tree-atlas/tree-atlas.module.css" \
  "src/app/app/legacies/[slug]/_components/tree-atlas/atlas-toolbar.module.css" \
  "src/app/app/legacies/[slug]/_components/tree-atlas/sim-inspector.module.css"
git -C $W commit -m "refactor(ui): extract shared glass surface treatment (composes)"
```

---

## Task 8: Extract the dashed-box empty state into an `EmptyState` component

**Problem:** Three sections repeat the same dashed-box empty state: `roster.module.css` `.emptyState` (L27-36) + `.emptyText` (L38-43, with a CTA, `flex` column, gap 16px), `succession.module.css` `.emptyState` (L69-77, text only), `milestones.module.css` `.emptyState` (L20-28, text only). Same box recipe (`margin-top: 24px; padding: 24px 28px; border: 1px dashed var(--border-bright); border-radius: var(--radius-lg)`), same italic muted text. Extract a real component (it has structure + an optional CTA).

> Preserve the existing `font-style: italic` on the empty text — italic is intentional here per the project's current typography direction. Do NOT remove it.

**Files:** Create `empty-state.tsx`, `empty-state.module.css`, `__tests__/empty-state.test.tsx`; export from `index.ts`; modify the 3 sections.

- [ ] **Step 1: Write the failing component test**

Create `src/components/ui/empty-state/__tests__/empty-state.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EmptyState } from '../empty-state'

describe('EmptyState', () => {
  it('renders the message text', () => {
    render(<EmptyState>No sims yet.</EmptyState>)
    expect(screen.getByText('No sims yet.')).toBeInTheDocument()
  })

  it('renders an optional action alongside the message', () => {
    render(
      <EmptyState action={<a href="/x">Add a sim</a>}>No sims yet.</EmptyState>
    )
    expect(screen.getByText('No sims yet.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Add a sim' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run it, expect FAIL** (module not found): `$W/node_modules/.bin/vitest run src/components/ui/empty-state/__tests__/empty-state.test.tsx --root $W`

- [ ] **Step 3: Create the component**

Create `src/components/ui/empty-state/empty-state.module.css`:

```css
.root {
  margin-top: 24px;
  padding: 24px 28px;
  border: 1px dashed var(--border-bright);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 16px;
}

.text {
  margin: 0;
  font-size: 14px;
  color: var(--text-muted);
  font-style: italic;
}
```

Create `src/components/ui/empty-state/empty-state.tsx`:

```tsx
import { cn } from '@/lib/utils'
import styles from './empty-state.module.css'

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Optional call-to-action rendered below the message (e.g. a ButtonLink). */
  action?: React.ReactNode
}

export function EmptyState({ children, action, className, ...props }: EmptyStateProps) {
  return (
    <div className={cn(styles.root, className)} {...props}>
      <p className={styles.text}>{children}</p>
      {action}
    </div>
  )
}
```

- [ ] **Step 4: Export it.** In `src/components/ui/index.ts`, add (following the existing direct re-export pattern): `export { EmptyState } from './empty-state/empty-state'` and `export type { EmptyStateProps } from './empty-state/empty-state'`.

- [ ] **Step 5: Run the test, expect PASS.**

- [ ] **Step 6: Migrate the three sections.** For each, replace the bespoke empty-state markup with `<EmptyState>`, preserving the message text and (roster) the CTA, then DELETE the now-unused `.emptyState`/`.emptyText` classes from that section's `.module.css`.
  - `roster.tsx`: read the current empty block; render `<EmptyState action={<ButtonLink ...>…</ButtonLink>}>…message…</EmptyState>` using the existing CTA. Remove `.emptyState`/`.emptyText` from `roster.module.css`.
  - `succession.tsx`: replace with `<EmptyState>…message…</EmptyState>`. Remove `.emptyState` from `succession.module.css`.
  - `milestones.tsx`: same. Remove `.emptyState` from `milestones.module.css`.
  > Note: the standalone sections previously rendered the message directly in the box (no inner `<p>` for succession/milestones); `EmptyState` wraps the message in a `<p class=text>`. This is the intended unification — the box gets a `gap` only when an `action` is present (gap on an only-child `<p>` is inert), so the single-child layout is visually identical (same padding/border/italic-muted text). Confirm visually that succession/milestones empties look unchanged.

- [ ] **Step 7: Validate.** `tsc --noEmit` → clean; `eslint` on the changed `.tsx` + new files → clean; whole suite → pass (incl. the new EmptyState test and any roster/succession/milestones tests).

- [ ] **Step 8: Commit**

```bash
git -C $W add src/components/ui/empty-state/ src/components/ui/index.ts \
  "src/app/app/legacies/[slug]/_components/roster/roster.tsx" \
  "src/app/app/legacies/[slug]/_components/roster/roster.module.css" \
  "src/app/app/legacies/[slug]/_components/succession/succession.tsx" \
  "src/app/app/legacies/[slug]/_components/succession/succession.module.css" \
  "src/app/app/legacies/[slug]/_components/milestones/milestones.tsx" \
  "src/app/app/legacies/[slug]/_components/milestones/milestones.module.css"
git -C $W commit -m "refactor(ui): extract EmptyState component for the chronicle sections"
```

---

## Task 9: Unify the bespoke icon buttons onto the `Button` primitive

**Problem:** Four near-identical hand-rolled icon buttons re-implement the ghost-icon pattern (transparent bg, `--radius-sm`, `--text-muted`→`--text` hover, `box-shadow: var(--focus-ring)` on focus): `tree-atlas.module.css` `.capsuleBack` (28×28, a link), `.zoomButton` (26×26), `.zoomFit` (text pill); `sim-inspector.module.css` `.close` (26×26). The design system already ships `Button size="icon" variant="ghost"`; `ButtonLink` lacks the `'icon'` size.

> **Intentional visual change (the one exception to the parity rule):** these controls adopt the design-system icon-button appearance, and their hit area should meet the WCAG ≥24px (target ≥44px) touch-target guideline the a11y review flagged. Keep each control's **accessible name identical** (e.g. the close button's `aria-label`, the zoom buttons' labels) so role/name-based tests and screen-reader behavior are unchanged.

**Files:** `button/button.tsx`; `tree-atlas/tree-atlas.tsx` + `tree-atlas.module.css`; `sim-inspector/sim-inspector.tsx` + `sim-inspector.module.css`.

- [ ] **Step 1: Add `'icon'` to the `ButtonLink` size union.** In `src/components/ui/button/button.tsx`, change `ButtonLinkProps.size` from `'sm' | 'base' | 'lg'` to `'sm' | 'base' | 'lg' | 'icon'`. (`Button` already supports `'icon'`, and `button.module.css` already defines `.icon`.)

- [ ] **Step 2: Inspect the existing `.icon` size.** Read `button/button.module.css` `.icon`. Note its dimensions. If the icon button's hit area is < 24px, report it (do not globally resize `.icon` without flagging — it affects every icon button app-wide). Prefer achieving ≥44px via the migration (e.g. `size="icon"` plus the surrounding control padding) rather than changing the shared token; if a shared change is truly needed, report it as DONE_WITH_CONCERNS for the controller to decide.

- [ ] **Step 3: Migrate the controls** (read each consumer's current JSX first to preserve props/handlers/aria):
  - `tree-atlas.tsx`: the back link (`.capsuleBack`) → `<ButtonLink href={…} size="icon" variant="ghost" aria-label={…}>`; the zoom in/out buttons (`.zoomButton`) → `<Button size="icon" variant="ghost" aria-label={…} onClick={…}>`; the "Fit" pill (`.zoomFit`) → `<Button size="sm" variant="ghost" onClick={…}>Fit</Button>`. Preserve every existing `aria-label`, `onClick`, `disabled`, and icon child.
  - `sim-inspector.tsx`: the close button (`.close`) → `<Button size="icon" variant="ghost" aria-label={…} onClick={…}>` with the same icon child.
  - Then DELETE the now-unused `.capsuleBack`, `.capsuleBack:hover`, `.capsuleBack:focus-visible`, `.zoomButton`, `.zoomButton:hover`, `.zoomFit`, `.zoomFit:hover`, `.zoomButton:focus-visible, .zoomFit:focus-visible` rules from `tree-atlas.module.css`, and `.close`, `.close:hover`, `.close:focus-visible` from `sim-inspector.module.css`. Keep any layout wrappers (`.zoomControls`, `.header`) intact; if the close button needs `margin-left: auto`, move that onto the Button via `className` (the modules can keep a small positioning class) — do not lose the layout.

- [ ] **Step 4: Validate and reconcile tests.** `tsc --noEmit` → clean; `eslint` on changed `.tsx` → clean; whole suite → pass. The atlas/inspector tests likely query these controls by role/name (`getByRole('button', { name: … })`) — if any test selected a bespoke class or testid that no longer exists, update it to a role/name query (the accessible names are unchanged). Report any test you change and why.

- [ ] **Step 5: Commit**

```bash
git -C $W add src/components/ui/button/button.tsx \
  "src/app/app/legacies/[slug]/_components/tree-atlas/tree-atlas.tsx" \
  "src/app/app/legacies/[slug]/_components/tree-atlas/tree-atlas.module.css" \
  "src/app/app/legacies/[slug]/_components/tree-atlas/sim-inspector.tsx" \
  "src/app/app/legacies/[slug]/_components/tree-atlas/sim-inspector.module.css"
git -C $W commit -m "refactor(legacy-tree): unify atlas icon buttons onto the Button primitive"
```

---

## Task 10: Typography token sweep (font sizes onto the scale)

**Problem:** ~40 hardcoded `font-size` declarations across the redesign CSS bypass the `--text-*` ramp. Put them on the scale using the approved **hybrid** policy.

**Files:** `src/app/globals.css` (add tokens) + every redesign `*.module.css` in scope (see boundary above). Note: Tasks 8 & 9 already removed several font-size sites (empty-state text, the icon buttons); only the remaining ones are swept here.

- [ ] **Step 1: Add the new tokens to `globals.css`.** In the `Typography scale` block, add `--text-xs` before `--text-sm`, and three role-named display tokens after `--text-3xl`:

```css
  /* Typography scale */
  --text-xs:   0.625rem;   /* 10px — tiny uppercase metadata */
  --text-sm:   0.75rem;    /* 12px — labels, badges */
  --text-base: 0.875rem;   /* 14px — body text */
  --text-md:   1.0625rem;  /* 17px — slightly larger body */
  --text-lg:   1.25rem;    /* 20px */
  --text-xl:   1.5rem;     /* 24px */
  --text-2xl:  2rem;       /* 32px */
  --text-3xl:  2.75rem;    /* 44px */

  /* Display sizes (fixed Cormorant headings, named by role) */
  --text-stat:    1.75rem;  /* 28px — stat-block numerals */
  --text-heading: 2.25rem;  /* 36px — section headings */
  --text-hero:    3.5rem;   /* 56px — hero display title */
```

(Leave the existing `--heading-sm/md/lg` fluid clamps as-is.)

- [ ] **Step 2: Replace every in-scope hardcoded `font-size: <px>` with the mapped token**, per this table (max ±1px on snaps; 0px on display tokens):

| px | token | px | token | px | token |
|----|-------|----|-------|----|-------|
| 10 | `--text-xs` | 14 | `--text-base` | 19 | `--text-lg` |
| 11 | `--text-sm` | 15 | `--text-base` | 20 | `--text-lg` |
| 12 | `--text-sm` | 16 | `--text-md` | 28 | `--text-stat` |
| 13 | `--text-base` | 17 | `--text-md` | 36 | `--text-heading` |
|    |             | 18 | `--text-md` | 56 | `--text-hero` |

Apply to these declarations (from the inventory; Task 8/9 may have already removed some — skip any that no longer exist):
- `hero.module.css`: L20 `56px`→`var(--text-hero)`, L35 `17px`→`var(--text-md)`, L100 `19px`→`var(--text-lg)`, L107 `11px`→`var(--text-sm)`
- `section-heading.module.css`: L9 `36px`→`var(--text-heading)`, L18 `15px`→`var(--text-base)`
- `stat-block.module.css`: L9 `28px`→`var(--text-stat)`, L21 `11px`→`var(--text-sm)`
- `section-nav.module.css`: `15px`→`var(--text-base)`
- `roster-card.module.css`: `16px`→`var(--text-md)`, `11px`→`var(--text-sm)`
- `roster.module.css`: `14px`→`var(--text-base)`, `12px`→`var(--text-sm)`
- `succession.module.css`: `16px`→`var(--text-md)`, `10px`→`var(--text-xs)`, `14px`→`var(--text-base)` (skip any removed by Task 8)
- `milestones.module.css` / `milestone-row.module.css`: `14px`→`var(--text-base)`, `10px`→`var(--text-xs)` (×2 in milestone-row), `18px`→`var(--text-md)`, `13px`→`var(--text-base)` (skip any removed by Task 8)
- `tree-atlas.module.css`: `10px`→`var(--text-xs)`, `17px`→`var(--text-md)`, `12px`→`var(--text-sm)` (×3), `16px`→`var(--text-md)`, `14px`→`var(--text-base)`, `13px`→`var(--text-base)`, `11px`→`var(--text-sm)` (skip any removed by Task 9)
- `sim-inspector.module.css`: `20px`→`var(--text-lg)`, `12px`→`var(--text-sm)`, `13px`→`var(--text-base)` (×2)
- `atlas-toolbar.module.css`: `13px`→`var(--text-base)`, `11px`→`var(--text-sm)`

After editing, run `grep -rn "font-size:.*px" $W/src/app/app/legacies $W/src/components/lineage-tree $W/src/components/ui/stat-block $W/src/components/ui/section-heading $W/src/components/ui/empty-state` and confirm NO `px` font-sizes remain in scope (only `var(--text-*)`). The excluded files (button, combobox, sims/[id]) may still show px — that is expected and out of scope.

- [ ] **Step 3: (Spacing — exact-match only, no snapping.)** Optionally, in the same files, replace `padding`/`gap`/`margin`/`border-radius` px values that EXACTLY equal a token's px with that token (`4→--space-1, 8→--space-2, 12→--space-3, 16→--space-4, 20→--space-5, 24→--space-6, 28→--space-7, 32→--space-8`; radius `4→--radius-xs, 6→--radius-sm, 8→--radius-base, 10→--radius-md, 14→--radius-lg, 20→--radius-xl`; `line-height: 1.55`→`var(--leading-snug)`). Do NOT snap non-matching spacing values (e.g. 18px gaps, 76px offsets, 14px gaps) — leave bespoke layout numbers untouched to avoid layout shifts. This step is best-effort; skip it if uncertain and report so.

- [ ] **Step 4: Validate.** `tsc --noEmit` → clean; `eslint $W/src` → clean; `vitest run --root $W` → all pass, INCLUDING `src/app/__tests__/contrast.test.ts` (the new tokens are values, not colors — the contrast test must stay green). Confirm parity: every changed font-size's token resolves to within ±1px of the original (display tokens exact).

- [ ] **Step 5: Commit**

```bash
git -C $W add src/app/globals.css \
  "src/app/app/legacies/[slug]/_components" \
  src/components/lineage-tree src/components/ui/stat-block \
  src/components/ui/section-heading src/components/ui/empty-state
# (stage only the .module.css files you actually changed; list them explicitly if `git add` of a dir would catch unrelated files)
git -C $W commit -m "refactor(ui): put redesign font sizes on the --text-* token scale"
```

---

## Final Verification (after Tasks 7–10)

- [ ] `tsc --noEmit` → no errors.
- [ ] `eslint $W/src` → no errors/warnings.
- [ ] `vitest run --root $W` → all suites pass (incl. EmptyState test + contrast test).
- [ ] `grep -rn "eslint-disable\|@ts-ignore\|@ts-expect-error\|@ts-nocheck" $W/src` → none.
- [ ] `grep -rn "backdrop-filter" $W/src` → only `surfaces.module.css` (the 5 consumers now compose it).
- [ ] In-scope `*.module.css` have no `px` font-sizes remaining.
- [ ] Spot-check the legacy page + atlas render: glass overlays, empty states, icon buttons, and headings look unchanged (except the intentional icon-button restyle in Task 9).

## Self-Review notes (author)

- **Spec coverage:** glass (Task 7), EmptyState (Task 8), icon Button (Task 9), typography sweep (Task 10) — the four Tier-3 items from the design review. The off-scale **spacing** sweep is intentionally scoped to exact-matches only (Step 10.3) to avoid layout regressions; aggressive spacing-scale work is out of scope.
- **Parity:** every task except Task 9 is value-for-value identical; Task 9's visual change is explicit and bounded.
- **Ordering:** 7→8→9→10 so the sweep tokenizes the final consolidated CSS; 7/8/9 touch overlapping files (tree-atlas, sim-inspector) but run sequentially with commits between.
- **Type consistency:** `EmptyState` follows the `HTMLAttributes`+spread convention established in Tasks 4–5; `ButtonLink` icon size mirrors `Button`.
