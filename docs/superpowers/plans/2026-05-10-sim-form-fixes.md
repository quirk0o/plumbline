# SimForm High & Medium Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two bugs (dark-mode chevron, pronounPreset init) and three design-system gaps (Select component, responsive breakpoints, back button accessibility) in SimForm.

**Architecture:** Extract a `Select` UI component (wrapper div + select + aria-hidden chevron span) that replaces all raw `<select>` elements in SimForm. Fix `pronounPreset` initialization with a lazy `useState`. Add a single `@media (max-width: 640px)` block to the form CSS. Wrap the back button arrow in an `aria-hidden` span.

**Tech Stack:** React, TypeScript, CSS Modules, Vitest + Testing Library, `cn` utility from `@/lib/utils`

**All paths are relative to:** `.claude/worktrees/feat+legacy-creation-wizard/`

---

## File Map

| File | Action |
|------|--------|
| `src/components/ui/select/select.tsx` | Create — Select component |
| `src/components/ui/select/select.module.css` | Create — Select styles |
| `src/components/ui/select/__tests__/select.test.tsx` | Create — Select unit tests |
| `src/components/ui/index.ts` | Modify — export Select |
| `src/app/components/sim-form.tsx` | Modify — use Select, fix pronounPreset, fix back button |
| `src/app/components/sim-form.module.css` | Modify — remove .select/.selectError, add 640px breakpoints |

---

## Task 1: Select component

**Files:**
- Create: `src/components/ui/select/__tests__/select.test.tsx`
- Create: `src/components/ui/select/select.tsx`
- Create: `src/components/ui/select/select.module.css`
- Modify: `src/components/ui/index.ts`

- [ ] **Step 1: Write failing tests**

Create `src/components/ui/select/__tests__/select.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Select } from '../select'

describe('Select', () => {
  it('renders a combobox with children', () => {
    render(
      <Select id="test">
        <option value="a">Alpha</option>
        <option value="b">Beta</option>
      </Select>
    )
    expect(screen.getByRole('combobox')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Alpha' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Beta' })).toBeInTheDocument()
  })

  it('forwards id so a label can associate with it', () => {
    render(
      <>
        <label htmlFor="my-select">Colour</label>
        <Select id="my-select">
          <option value="red">Red</option>
        </Select>
      </>
    )
    expect(screen.getByLabelText('Colour')).toBeInTheDocument()
  })

  it('forwards disabled attribute', () => {
    render(
      <Select id="test" disabled>
        <option value="x">X</option>
      </Select>
    )
    expect(screen.getByRole('combobox')).toBeDisabled()
  })

  it('renders an aria-hidden decorative chevron', () => {
    const { container } = render(
      <Select id="test">
        <option value="x">X</option>
      </Select>
    )
    const chevron = container.querySelector('[aria-hidden="true"]')
    expect(chevron).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd .claude/worktrees/feat+legacy-creation-wizard && npx vitest run src/components/ui/select
```

Expected: `Cannot find module '../select'`

- [ ] **Step 3: Create the CSS module**

Create `src/components/ui/select/select.module.css`:

```css
.wrapper {
  position: relative;
  display: block;
  width: 100%;
  --_padding-y: var(--space-2);
  --_padding-x: var(--space-3);
  --_font-size: var(--text-sm);
}

.sm {
  --_padding-y: var(--space-1);
  --_padding-x: var(--space-2);
  --_font-size: var(--text-xs);
}

.lg {
  --_padding-y: var(--space-3);
  --_padding-x: var(--space-4);
  --_font-size: var(--text-base);
}

.select {
  width: 100%;
  padding: var(--_padding-y) var(--_padding-x);
  padding-right: 2.25rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-base);
  background: var(--bg-card);
  color: var(--text);
  font-size: var(--_font-size);
  font-family: inherit;
  appearance: none;
  transition: border-color var(--transition-base), box-shadow var(--transition-base);
  outline: none;
}

.select:focus-visible {
  border-color: var(--green);
  box-shadow: var(--focus-ring);
}

.error {
  border-color: var(--error);
}

.error:focus-visible {
  border-color: var(--error);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--error) 30%, transparent);
}

.chevron {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  color: var(--text-muted);
  display: flex;
  align-items: center;
}
```

- [ ] **Step 4: Create the component**

Create `src/components/ui/select/select.tsx`:

```tsx
import { cn } from '@/lib/utils'
import styles from './select.module.css'

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean
  size?: 'sm' | 'base' | 'lg'
}

export function Select({ error = false, size = 'base', className, children, ...props }: SelectProps) {
  return (
    <div className={cn(styles.wrapper, size !== 'base' && styles[size])}>
      <select
        className={cn(styles.select, error && styles.error, className)}
        {...props}
      >
        {children}
      </select>
      <span className={styles.chevron} aria-hidden="true">
        <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M1 1l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </span>
    </div>
  )
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd .claude/worktrees/feat+legacy-creation-wizard && npx vitest run src/components/ui/select
```

Expected: 4 tests pass.

- [ ] **Step 6: Export from the UI index**

In `src/components/ui/index.ts`, add after the `FormField` export lines:

```ts
export { Select } from './select/select'
export type { SelectProps } from './select/select'
```

- [ ] **Step 7: TypeScript check**

```bash
cd .claude/worktrees/feat+legacy-creation-wizard && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
cd .claude/worktrees/feat+legacy-creation-wizard && git add src/components/ui/select src/components/ui/index.ts && git commit -m "feat(ui): add Select component with size and error props"
```

---

## Task 2: Migrate SimForm to Select

**Files:**
- Modify: `src/app/components/sim-form.tsx`
- Modify: `src/app/components/sim-form.module.css`

- [ ] **Step 1: Run existing SimForm tests to establish baseline**

```bash
cd .claude/worktrees/feat+legacy-creation-wizard && npx vitest run src/app/components/__tests__/sim-form.test.tsx
```

Expected: 9 tests pass.

- [ ] **Step 2: Update the import in sim-form.tsx**

In `src/app/components/sim-form.tsx`, replace lines 8–10:

```ts
// Before:
import { FormField } from '@/components/ui/form-field/form-field'
import { Input } from '@/components/ui/input/input'
import { Button } from '@/components/ui/button/button'

// After:
import { FormField, Input, Button, Select } from '@/components/ui'
```

The `import styles from './sim-form.module.css'` import stays — it is still needed for layout classes.

- [ ] **Step 3: Replace all raw `<select>` elements**

Replace the gender field (lines 211–221):

```tsx
<FormField label="Gender" htmlFor="gender" required error={formErrors.gender?.message}>
  <Select
    id="gender"
    {...register('gender')}
    error={!!formErrors.gender}
  >
    <option value="">Select gender</option>
    <option value={Gender.FEMALE}>Female</option>
    <option value={Gender.MALE}>Male</option>
    <option value={Gender.NON_BINARY}>Non-Binary</option>
  </Select>
</FormField>
```

Replace the lifeStage field (lines 223–233):

```tsx
<FormField label="Life stage" htmlFor="lifeStage">
  <Select id="lifeStage" {...register('lifeStage')}>
    {LIFE_STAGES.map((s) => (
      <option key={s.value} value={s.value}>{s.label}</option>
    ))}
  </Select>
</FormField>
```

Replace the pronounPreset field (lines 237–247):

```tsx
<FormField label="Pronouns" htmlFor="pronounPreset">
  <Select
    id="pronounPreset"
    value={pronounPreset}
    onChange={(e) => handlePronounPreset(e.target.value)}
  >
    <option value="">— optional —</option>
    {PRONOUN_PRESETS.map((p) => (
      <option key={p.label} value={p.label}>{p.label}</option>
    ))}
  </Select>
</FormField>
```

Replace the aspirationId field (lines 289–298):

```tsx
<FormField label="Aspiration" htmlFor="aspiration">
  <Select id="aspiration" {...register('aspirationId')}>
    <option value="">None</option>
    {Object.entries(groupedAspirations).map(([category, items]) => (
      <optgroup key={category} label={category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}>
        {items.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </optgroup>
    ))}
  </Select>
</FormField>
```

Replace the careerId field (lines 300–309):

```tsx
<FormField label="Career" htmlFor="career">
  <Select id="career" {...register('careerId')}>
    <option value="">Unemployed</option>
    {Object.entries(groupedCareers).map(([type, items]) => (
      <optgroup key={type} label={CAREER_TYPE_LABELS[type] ?? type}>
        {items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </optgroup>
    ))}
  </Select>
</FormField>
```

Replace the occultType field (lines 319–324):

```tsx
<FormField label="Occult type" htmlFor="occultType">
  <Select id="occultType" {...register('occultType')}>
    <option value="">None</option>
    {OCCULT_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
  </Select>
</FormField>
```

- [ ] **Step 4: Remove .select and .selectError from sim-form.module.css**

Delete the following three blocks from `src/app/components/sim-form.module.css`:

```css
.select {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-base);
  background: var(--bg-card);
  color: var(--text);
  font-size: var(--text-sm);
  font-family: inherit;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%238c7a5e' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  padding-right: 2.25rem;
}

.select:focus-visible {
  outline: none;
  border-color: var(--green);
  box-shadow: var(--focus-ring);
}

.selectError {
  border-color: var(--error);
}
```

- [ ] **Step 5: Run SimForm tests**

```bash
cd .claude/worktrees/feat+legacy-creation-wizard && npx vitest run src/app/components/__tests__/sim-form.test.tsx
```

Expected: all 9 tests pass.

- [ ] **Step 6: TypeScript check**

```bash
cd .claude/worktrees/feat+legacy-creation-wizard && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
cd .claude/worktrees/feat+legacy-creation-wizard && git add src/app/components/sim-form.tsx src/app/components/sim-form.module.css && git commit -m "refactor(sim-form): replace raw selects with Select component"
```

---

## Task 3: Fix pronounPreset initialization from defaultValues

**Files:**
- Modify: `src/app/components/__tests__/sim-form.test.tsx`
- Modify: `src/app/components/sim-form.tsx`

- [ ] **Step 1: Write failing tests**

Add two tests to the `describe('SimForm')` block in `src/app/components/__tests__/sim-form.test.tsx`:

```tsx
it('shows matching preset in pronoun selector when defaultValues has preset pronouns', () => {
  renderForm({
    defaultValues: {
      pronounSubject: 'she',
      pronounObject: 'her',
      pronounPossessive: 'hers',
    },
  })
  expect(screen.getByLabelText<HTMLSelectElement>(/pronouns/i).value).toBe('She / Her / Hers')
})

it('shows custom pronoun inputs immediately when defaultValues has non-preset pronouns', () => {
  renderForm({
    defaultValues: {
      pronounSubject: 'xe',
      pronounObject: 'xem',
      pronounPossessive: 'xyr',
    },
  })
  expect(screen.getByLabelText(/subject/i)).toBeInTheDocument()
  expect(screen.getByLabelText(/object/i)).toBeInTheDocument()
  expect(screen.getByLabelText(/possessive/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd .claude/worktrees/feat+legacy-creation-wizard && npx vitest run src/app/components/__tests__/sim-form.test.tsx
```

Expected: 2 new tests fail; the existing 9 pass.

- [ ] **Step 3: Replace the pronounPreset useState in sim-form.tsx**

Replace line 127 in `src/app/components/sim-form.tsx`:

```tsx
// Before:
const [pronounPreset, setPronounPreset] = useState('')

// After:
const [pronounPreset, setPronounPreset] = useState(() => {
  if (!defaultValues?.pronounSubject) return ''
  const match = PRONOUN_PRESETS.find(
    (p) =>
      p.subject === defaultValues.pronounSubject &&
      p.object === defaultValues.pronounObject
  )
  return match ? match.label : 'Custom'
})
```

- [ ] **Step 4: Run all SimForm tests**

```bash
cd .claude/worktrees/feat+legacy-creation-wizard && npx vitest run src/app/components/__tests__/sim-form.test.tsx
```

Expected: all 11 tests pass.

- [ ] **Step 5: TypeScript check**

```bash
cd .claude/worktrees/feat+legacy-creation-wizard && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd .claude/worktrees/feat+legacy-creation-wizard && git add src/app/components/sim-form.tsx src/app/components/__tests__/sim-form.test.tsx && git commit -m "fix(sim-form): initialise pronounPreset from defaultValues"
```

---

## Task 4: Responsive breakpoints

**Files:**
- Modify: `src/app/components/sim-form.module.css`

(No automated test — CSS media queries are not evaluated in jsdom.)

- [ ] **Step 1: Add the breakpoint block to sim-form.module.css**

Append to the end of `src/app/components/sim-form.module.css`:

```css
@media (max-width: 640px) {
  .identityRow {
    flex-direction: column;
  }

  .identityGrid {
    grid-template-columns: 1fr;
  }

  .twoCol {
    grid-template-columns: 1fr;
  }

  .customPronouns {
    grid-template-columns: 1fr;
  }

  .halfCol {
    max-width: 100%;
  }
}
```

- [ ] **Step 2: Run SimForm tests to confirm no regressions**

```bash
cd .claude/worktrees/feat+legacy-creation-wizard && npx vitest run src/app/components/__tests__/sim-form.test.tsx
```

Expected: all 11 tests pass.

- [ ] **Step 3: Commit**

```bash
cd .claude/worktrees/feat+legacy-creation-wizard && git add src/app/components/sim-form.module.css && git commit -m "feat(sim-form): collapse grids to single column below 640px"
```

---

## Task 5: Back button accessibility

**Files:**
- Modify: `src/app/components/__tests__/sim-form.test.tsx`
- Modify: `src/app/components/sim-form.tsx`

- [ ] **Step 1: Write a failing test**

Add to the `describe('SimForm')` block in `src/app/components/__tests__/sim-form.test.tsx`:

```tsx
it('back button accessible name is "Back" — arrow character is decorative', () => {
  renderForm({ onBack: vi.fn() })
  // Exact name match: fails if the arrow is included in the accessible name
  expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd .claude/worktrees/feat+legacy-creation-wizard && npx vitest run src/app/components/__tests__/sim-form.test.tsx
```

Expected: 1 new test fails (accessible name is currently "← Back", not "Back").

- [ ] **Step 3: Fix the back button in sim-form.tsx**

Replace the Back button (around line 332) in `src/app/components/sim-form.tsx`:

```tsx
// Before:
<Button type="button" variant="outline" onClick={onBack}>
  ← Back
</Button>

// After:
<Button type="button" variant="outline" onClick={onBack}>
  <span aria-hidden="true">← </span>Back
</Button>
```

- [ ] **Step 4: Run all SimForm tests**

```bash
cd .claude/worktrees/feat+legacy-creation-wizard && npx vitest run src/app/components/__tests__/sim-form.test.tsx
```

Expected: all 12 tests pass.

- [ ] **Step 5: TypeScript check**

```bash
cd .claude/worktrees/feat+legacy-creation-wizard && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Run lint**

```bash
cd .claude/worktrees/feat+legacy-creation-wizard && npm run lint
```

Expected: no errors or warnings.

- [ ] **Step 7: Commit**

```bash
cd .claude/worktrees/feat+legacy-creation-wizard && git add src/app/components/sim-form.tsx src/app/components/__tests__/sim-form.test.tsx && git commit -m "fix(sim-form): make back button arrow decorative for screen readers"
```
