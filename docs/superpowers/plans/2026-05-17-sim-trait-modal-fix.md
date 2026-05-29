# Sim Trait Modal Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the trait picker modal on the sim detail page so it has a fixed height — search, tabs, and chips stay pinned while only the trait grid scrolls, preventing the dialog from jumping as the user filters.

**Architecture:** Add a `scrollableGrid` prop to `TraitPicker`. When true, the grid is wrapped in a scrollable flex child and the container becomes a flex column. The modal's `.pickerBox` gets a fixed height and `display: flex; flex-direction: column` to drive the layout.

**Tech Stack:** React/TSX, CSS Modules

---

### Task 1: Add `scrollableGrid` layout mode to `TraitPicker`

**Files:**
- Modify: `src/app/components/trait-picker.tsx`
- Modify: `src/app/components/trait-picker.module.css`

- [ ] **Step 1: Add `.containerScrollable` and `.gridScroll` to `trait-picker.module.css`**

Append these classes to the end of the file:
```css
.containerScrollable {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.gridScroll {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}
```

- [ ] **Step 2: Add the `scrollableGrid` prop to `TraitPicker`**

In `trait-picker.tsx`, update the `TraitPickerProps` interface and the component signature:

```tsx
interface TraitPickerProps {
  traits: Trait[]
  selected: string[]
  onChange: (ids: string[]) => void
  max?: number
  scrollableGrid?: boolean
}

export function TraitPicker({ traits, selected, onChange, max = 6, scrollableGrid = false }: TraitPickerProps) {
```

- [ ] **Step 3: Apply the layout classes conditionally**

In the `TraitPicker` return, make two targeted changes:

**Change 1** — outer container div: add `containerScrollable` when `scrollableGrid` is true:
```tsx
<div className={`${styles.container} ${scrollableGrid ? styles.containerScrollable : ''}`}>
```

**Change 2** — wrap `.grid` in the scrollable wrapper when `scrollableGrid` is true. The current grid is:
```tsx
<div className={styles.grid}>
  {visible.map((trait) => { ... })}
  {visible.length === 0 && <p className={styles.noResults}>No traits match</p>}
</div>
```

Replace with:
```tsx
<div className={scrollableGrid ? styles.gridScroll : undefined}>
  <div className={styles.grid}>
    {visible.map((trait) => { ... })}
    {visible.length === 0 && <p className={styles.noResults}>No traits match</p>}
  </div>
</div>
```

The counter (`<p className={styles.counter}>`) stays outside the `gridScroll` wrapper — it remains pinned below the scroll area.

- [ ] **Step 4: Type-check and lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: no errors or warnings.

- [ ] **Step 5: Commit**

```bash
git add src/app/components/trait-picker.tsx \
        src/app/components/trait-picker.module.css
git commit -m "feat(trait-picker): add scrollableGrid prop for fixed-height modal layout"
```

---

### Task 2: Apply fixed-height layout to the trait picker modal

**Files:**
- Modify: `src/app/app/legacies/[slug]/sims/[id]/page.module.css:425-433`
- Modify: `src/app/app/legacies/[slug]/sims/[id]/trait-editor.tsx:79-84`

- [ ] **Step 1: Update `.pickerBox` in `page.module.css`**

Current (lines 425–433):
```css
.pickerBox {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  width: min(560px, calc(100vw - var(--space-8)));
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: var(--shadow-lg);
}
```

Replace with:
```css
.pickerBox {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  width: min(560px, calc(100vw - var(--space-8)));
  height: min(600px, 85vh);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: var(--shadow-lg);
}
```

- [ ] **Step 2: Pass `scrollableGrid` to `TraitPicker` in `trait-editor.tsx`**

In `trait-editor.tsx`, the `<TraitPicker>` is currently rendered as:
```tsx
<TraitPicker
  traits={traits}
  selected={localTraitIds}
  onChange={handlePickerChange}
  max={6}
/>
```

Add the `scrollableGrid` prop:
```tsx
<TraitPicker
  traits={traits}
  selected={localTraitIds}
  onChange={handlePickerChange}
  max={6}
  scrollableGrid
/>
```

- [ ] **Step 3: Type-check and lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: no errors or warnings.

- [ ] **Step 4: Commit**

```bash
git add src/app/app/legacies/[slug]/sims/[id]/page.module.css \
        src/app/app/legacies/[slug]/sims/[id]/trait-editor.tsx
git commit -m "feat(sim-detail): fix trait picker modal to static height with scrollable grid"
```
