# Milestone Composer Drawer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the inline milestone composer with a right-side slide-over **drawer**, add a reusable `Drawer` primitive, and switch sim-tagging to avatar chips — with no dot/paper textures.

**Architecture:** A new `Drawer` UI primitive wraps `@radix-ui/react-dialog` (same foundation as the existing `Dialog`) styled as a full-height right panel. The milestone composer renders its form inside the drawer (header / scrollable body / sticky footer) and tags sims via a new `SimTagChips` component. Mutation wiring and the parent `milestones-client` are unchanged.

**Tech Stack:** Next.js 16 (App Router, client components), `@radix-ui/react-dialog`, CSS Modules, Vitest + Testing Library.

**Reference spec:** `docs/superpowers/specs/2026-06-03-milestone-composer-drawer-design.md`

**Conventions (AGENTS.md):** never `cd` (run from worktree root with explicit paths); conventional commits; stage only the specific files (`git add <file>`); no `eslint-disable` / `@ts-ignore` / `@ts-expect-error` / `@ts-nocheck`; after each task `npx tsc --noEmit` and `npm run lint` must be clean; `npm test` + `npm run test:e2e` at the end.

---

## File Structure

**Create:**
- `src/components/ui/drawer/drawer.tsx` — the `Drawer` primitive (Radix-based slide-over)
- `src/components/ui/drawer/drawer.module.css` — overlay/panel/animation styles
- `src/components/ui/drawer/__tests__/drawer.test.tsx` — primitive tests
- `src/app/app/legacies/[slug]/_components/milestones/sim-tag-chips.tsx` — avatar-chip multi-select
- `src/app/app/legacies/[slug]/_components/milestones/sim-tag-chips.module.css`
- `src/app/app/legacies/[slug]/_components/milestones/__tests__/sim-tag-chips.test.tsx`

**Modify:**
- `src/components/ui/index.ts` — export `Drawer`
- `src/app/app/legacies/[slug]/_components/milestones/milestone-composer.tsx` — render form inside `Drawer`, use `SimTagChips`
- `src/app/app/legacies/[slug]/_components/milestones/milestone-composer.module.css` — drawer header/body/footer + field styles
- `src/app/app/legacies/[slug]/_components/milestones/__tests__/milestone-composer.test.tsx` — drawer-aware queries + jsdom mocks
- `src/app/app/legacies/[slug]/_components/milestones/__tests__/milestones-client.test.tsx` — add jsdom mocks (Radix needs `matchMedia`/`ResizeObserver`) so the edit-opens-drawer test still passes

---

## Task 1: `Drawer` primitive (TDD)

**Files:**
- Create: `src/components/ui/drawer/drawer.tsx`
- Create: `src/components/ui/drawer/drawer.module.css`
- Create: `src/components/ui/drawer/__tests__/drawer.test.tsx`
- Modify: `src/components/ui/index.ts`

- [ ] **Step 1: Write the failing test**

Create `src/components/ui/drawer/__tests__/drawer.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Drawer } from '../drawer'

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false, media: query, onchange: null,
      addListener: vi.fn(), removeListener: vi.fn(),
      addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
    })),
  })
})

function Simple({ open = true, onOpenChange = vi.fn() }: { open?: boolean; onOpenChange?: (v: boolean) => void }) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay />
        <Drawer.Content side="right" aria-describedby={undefined}>
          <Drawer.Title>Test drawer</Drawer.Title>
          <p>Body content</p>
          <Drawer.Close>Close</Drawer.Close>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer>
  )
}

describe('Drawer', () => {
  it('renders title and body when open', () => {
    render(<Simple open />)
    expect(screen.getByRole('dialog', { name: 'Test drawer' })).toBeInTheDocument()
    expect(screen.getByText('Body content')).toBeInTheDocument()
  })

  it('does not render content when closed', () => {
    render(<Simple open={false} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('calls onOpenChange(false) when Escape is pressed', async () => {
    const onOpenChange = vi.fn()
    render(<Simple open onOpenChange={onOpenChange} />)
    await userEvent.keyboard('{Escape}')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('calls onOpenChange(false) when Close is clicked', async () => {
    const onOpenChange = vi.fn()
    render(<Simple open onOpenChange={onOpenChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/ui/drawer/__tests__/drawer.test.tsx`
Expected: FAIL — `../drawer` does not exist.

- [ ] **Step 3: Create the primitive**

Create `src/components/ui/drawer/drawer.tsx`:

```tsx
'use client'

import * as RadixDialog from '@radix-ui/react-dialog'
import { cn } from '@/lib/utils'
import styles from './drawer.module.css'

export type DrawerContentProps = RadixDialog.DialogContentProps & {
  side?: 'right'
}

function DrawerOverlay({ className, ...props }: RadixDialog.DialogOverlayProps) {
  return <RadixDialog.Overlay className={cn(styles.overlay, className)} {...props} />
}

function DrawerContent({ side = 'right', className, children, ...props }: DrawerContentProps) {
  return (
    <RadixDialog.Content className={cn(styles.content, styles[side], className)} {...props}>
      {children}
    </RadixDialog.Content>
  )
}

function DrawerTitle({ className, ...props }: RadixDialog.DialogTitleProps) {
  return <RadixDialog.Title className={cn(styles.title, className)} {...props} />
}

function DrawerDescription({ className, ...props }: RadixDialog.DialogDescriptionProps) {
  return <RadixDialog.Description className={cn(styles.description, className)} {...props} />
}

export const Drawer = Object.assign(RadixDialog.Root, {
  Trigger: RadixDialog.Trigger,
  Portal: RadixDialog.Portal,
  Overlay: DrawerOverlay,
  Content: DrawerContent,
  Title: DrawerTitle,
  Description: DrawerDescription,
  Close: RadixDialog.Close,
})
```

Create `src/components/ui/drawer/drawer.module.css`:

```css
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(20, 15, 5, 0.3);
  backdrop-filter: blur(1px);
  z-index: 100;
}

.overlay[data-state='open'] { animation: drawerFadeIn var(--transition-base) ease; }
.overlay[data-state='closed'] { animation: drawerFadeOut var(--transition-base) ease; }

.content {
  position: fixed;
  top: 0;
  bottom: 0;
  width: 360px;
  max-width: 100vw;
  display: flex;
  flex-direction: column;
  background: var(--bg-card);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  z-index: 101;
}

.right {
  right: 0;
  border-left: 1px solid var(--border);
}

.right[data-state='open'] { animation: drawerSlideIn 280ms cubic-bezier(0.16, 1, 0.3, 1); }
.right[data-state='closed'] { animation: drawerSlideOut 200ms cubic-bezier(0.16, 1, 0.3, 1); }

.title {
  font-family: var(--font-display);
  font-size: var(--text-xl);
  font-weight: var(--weight-semibold);
  color: var(--text);
  margin: 0;
}

.description {
  font-size: var(--text-sm);
  color: var(--text-muted);
  margin: 0;
}

@keyframes drawerFadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes drawerFadeOut { from { opacity: 1; } to { opacity: 0; } }
@keyframes drawerSlideIn { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: translateX(0); } }
@keyframes drawerSlideOut { from { opacity: 1; transform: translateX(0); } to { opacity: 0; transform: translateX(24px); } }

@media (prefers-reduced-motion: reduce) {
  .overlay[data-state='open'], .overlay[data-state='closed'],
  .content[data-state='open'], .content[data-state='closed'] { animation: none; }
}
```

Add to `src/components/ui/index.ts` (after the `Dialog` export lines):

```ts
export { Drawer } from './drawer/drawer'
export type { DrawerContentProps } from './drawer/drawer'
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/ui/drawer/__tests__/drawer.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Type-check & lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/drawer/drawer.tsx src/components/ui/drawer/drawer.module.css "src/components/ui/drawer/__tests__/drawer.test.tsx" src/components/ui/index.ts
git commit -m "feat(ui): add Drawer slide-over primitive on Radix Dialog"
```

---

## Task 2: `SimTagChips` component (TDD)

**Files:**
- Create: `src/app/app/legacies/[slug]/_components/milestones/sim-tag-chips.tsx`
- Create: `src/app/app/legacies/[slug]/_components/milestones/sim-tag-chips.module.css`
- Create: `src/app/app/legacies/[slug]/_components/milestones/__tests__/sim-tag-chips.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `__tests__/sim-tag-chips.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SimTagChips } from '../sim-tag-chips'
import type { ChronicleSim } from '../../../lib/types'

const sims: ChronicleSim[] = [
  { id: 's1', firstName: 'Reed', lastName: 'Caliente', imageUrl: null, generationNumber: 3, lifeStage: 'TEEN', isHeir: true, isFounder: false, aspirationName: null },
  { id: 's2', firstName: 'Don', lastName: 'Lothario', imageUrl: null, generationNumber: 2, lifeStage: 'ADULT', isHeir: false, isFounder: false, aspirationName: null },
]

describe('SimTagChips', () => {
  it('reflects selection with aria-pressed', () => {
    render(<SimTagChips sims={sims} value={['s1']} onToggle={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Reed/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /Don/ })).toHaveAttribute('aria-pressed', 'false')
  })

  it('fires onToggle with the sim id when a chip is clicked', async () => {
    const onToggle = vi.fn()
    render(<SimTagChips sims={sims} value={[]} onToggle={onToggle} />)
    await userEvent.click(screen.getByRole('button', { name: /Don/ }))
    expect(onToggle).toHaveBeenCalledWith('s2')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- "src/app/app/legacies/[slug]/_components/milestones/__tests__/sim-tag-chips.test.tsx"`
Expected: FAIL — `../sim-tag-chips` does not exist.

- [ ] **Step 3: Implement the component**

Create `sim-tag-chips.tsx`:

```tsx
'use client'

import { cn } from '@/lib/utils'
import { PortraitAvatar } from '@/components/ui'
import { ringFor } from '../../lib/derive'
import type { ChronicleSim } from '../../lib/types'
import styles from './sim-tag-chips.module.css'

export interface SimTagChipsProps {
  sims: ChronicleSim[]
  value: string[]
  onToggle: (id: string) => void
}

export function SimTagChips({ sims, value, onToggle }: SimTagChipsProps) {
  return (
    <div className={styles.chips}>
      {sims.map((sim) => {
        const selected = value.includes(sim.id)
        return (
          <button
            key={sim.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onToggle(sim.id)}
            className={cn(styles.chip, selected && styles.selected)}
          >
            <PortraitAvatar
              imageUrl={sim.imageUrl}
              firstName={sim.firstName}
              lastName={sim.lastName}
              size={20}
              ring={ringFor(sim)}
            />
            <span>
              {sim.firstName} {sim.lastName.charAt(0)}.
            </span>
          </button>
        )
      })}
    </div>
  )
}
```

Create `sim-tag-chips.module.css`:

```css
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.chip {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 3px 10px 3px 3px;
  border-radius: 999px;
  cursor: pointer;
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-muted);
  font-family: var(--font-body);
  font-size: var(--text-xs);
  font-weight: 600;
  transition: background var(--transition-base), border-color var(--transition-base), color var(--transition-base);
}

.selected {
  background: var(--green-glow);
  border-color: var(--green);
  color: var(--green);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- "src/app/app/legacies/[slug]/_components/milestones/__tests__/sim-tag-chips.test.tsx"`
Expected: PASS (2 tests).

- [ ] **Step 5: Type-check & lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add "src/app/app/legacies/[slug]/_components/milestones/sim-tag-chips.tsx" "src/app/app/legacies/[slug]/_components/milestones/sim-tag-chips.module.css" "src/app/app/legacies/[slug]/_components/milestones/__tests__/sim-tag-chips.test.tsx"
git commit -m "feat(legacy): SimTagChips avatar-chip multi-select for milestones"
```

---

## Task 3: Refactor the composer into the drawer

**Files:**
- Modify: `src/app/app/legacies/[slug]/_components/milestones/milestone-composer.tsx`
- Modify: `src/app/app/legacies/[slug]/_components/milestones/milestone-composer.module.css`
- Modify: `src/app/app/legacies/[slug]/_components/milestones/__tests__/milestone-composer.test.tsx`
- Modify: `src/app/app/legacies/[slug]/_components/milestones/__tests__/milestones-client.test.tsx`

- [ ] **Step 1: Update the composer test to expect the drawer**

Replace the body of `__tests__/milestone-composer.test.tsx` with (keeps the trpc mock pattern; adds jsdom mocks Radix needs; queries are portal-safe via `screen`):

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MilestoneComposer } from '../milestone-composer'
import type { ChronicleSim, Milestone } from '../../../lib/types'

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false, media: query, onchange: null,
      addListener: vi.fn(), removeListener: vi.fn(),
      addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
    })),
  })
  class MockResizeObserver { observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn() }
  global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver
})

const { mockCreate, mockUpdate } = vi.hoisted(() => ({
  mockCreate: vi.fn().mockResolvedValue({ id: 'm-new' }),
  mockUpdate: vi.fn().mockResolvedValue({ id: 'm1' }),
}))

vi.mock('@/trpc/client', () => ({
  trpc: {
    milestones: {
      create: { useMutation: vi.fn(() => ({ mutateAsync: mockCreate, isPending: false })) },
      update: { useMutation: vi.fn(() => ({ mutateAsync: mockUpdate, isPending: false })) },
    },
  },
}))

const simsById: Record<string, ChronicleSim> = {
  s1: { id: 's1', firstName: 'Reed', lastName: 'Caliente', imageUrl: null, generationNumber: 3, lifeStage: 'TEEN', isHeir: true, isFounder: false, aspirationName: null },
}

function base() {
  return { legacyId: 'leg-1', simsById, onDone: vi.fn(), onCancelEdit: vi.fn() }
}

describe('MilestoneComposer (drawer)', () => {
  it('opens the drawer and creates a milestone', async () => {
    render(<MilestoneComposer {...base()} editing={null} />)
    await userEvent.click(screen.getByRole('button', { name: /add milestone/i }))
    expect(screen.getByRole('dialog', { name: 'New milestone' })).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText(/title/i), 'The feud begins')
    await userEvent.click(screen.getByRole('button', { name: /save milestone/i }))
    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1))
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ legacyId: 'leg-1', title: 'The feud begins' }))
  })

  it('disables save when the title is empty', async () => {
    render(<MilestoneComposer {...base()} editing={null} />)
    await userEvent.click(screen.getByRole('button', { name: /add milestone/i }))
    expect(screen.getByRole('button', { name: /save milestone/i })).toBeDisabled()
  })

  it('opens pre-filled for editing and calls update', async () => {
    const editing: Milestone = { id: 'm1', kind: 'Note', gen: 3, simIds: ['s1'], title: 'Old title', blurb: 'old', userAuthored: true, sortOrder: 100 }
    render(<MilestoneComposer {...base()} editing={editing} />)
    expect(screen.getByRole('dialog', { name: 'Edit milestone' })).toBeInTheDocument()
    expect(screen.getByLabelText(/title/i)).toHaveValue('Old title')
    await userEvent.click(screen.getByRole('button', { name: /save milestone/i }))
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ id: 'm1', title: 'Old title' })))
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- "src/app/app/legacies/[slug]/_components/milestones/__tests__/milestone-composer.test.tsx"`
Expected: FAIL — there's no `role="dialog"` yet (form is still inline).

- [ ] **Step 3: Rewrite `milestone-composer.tsx`**

Replace the whole file with:

```tsx
'use client'

import { useState } from 'react'
import { trpc } from '@/trpc/client'
import { Button, Drawer, Eyebrow } from '@/components/ui'
import type { Milestone, ChronicleSim } from '../../lib/types'
import { SimTagChips } from './sim-tag-chips'
import styles from './milestone-composer.module.css'

export interface MilestoneComposerProps {
  legacyId: string
  simsById: Record<string, ChronicleSim>
  /** When set, the composer opens pre-filled to edit this milestone. */
  editing: Milestone | null
  onDone: () => void
  onCancelEdit: () => void
}

interface ComposerFormProps {
  legacyId: string
  simsById: Record<string, ChronicleSim>
  editing: Milestone | null
  onDone: () => void
  /** Cancel without persisting. */
  onCancel: () => void
}

/** Inner stateful form rendered inside the drawer. Key-remounted when `editing`
 *  changes so its state resets cleanly per open. */
function ComposerForm({ legacyId, simsById, editing, onDone, onCancel }: ComposerFormProps) {
  const [title, setTitle] = useState(editing?.title ?? '')
  const [blurb, setBlurb] = useState(editing?.blurb ?? '')
  const [simIds, setSimIds] = useState<string[]>(editing?.simIds ?? [])

  const create = trpc.milestones.create.useMutation()
  const update = trpc.milestones.update.useMutation()
  const isEditing = editing !== null
  const pending = create.isPending || update.isPending

  async function handleSave() {
    if (title.trim().length === 0) return
    if (isEditing && editing) {
      await update.mutateAsync({ id: editing.id, title: title.trim(), blurb: blurb.trim() || undefined, simIds })
    } else {
      await create.mutateAsync({ legacyId, title: title.trim(), blurb: blurb.trim() || undefined, simIds })
    }
    onDone()
  }

  function toggleSim(id: string) {
    setSimIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const allSims = Object.values(simsById)

  return (
    <>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <Eyebrow>Record a moment</Eyebrow>
          <Drawer.Close className={styles.close} aria-label="Close">✕</Drawer.Close>
        </div>
        <Drawer.Title className={styles.headerTitle}>
          {isEditing ? 'Edit milestone' : 'New milestone'}
        </Drawer.Title>
      </header>

      <div className={styles.body}>
        <label className={styles.field}>
          <span className={styles.label}>Title</span>
          <input
            className={styles.input}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. The Caliente–Lothario feud begins"
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Story</span>
          <textarea
            className={styles.textarea}
            rows={4}
            value={blurb}
            onChange={(e) => setBlurb(e.target.value)}
            placeholder="Tell the story in your own words…"
          />
        </label>

        <div className={styles.field}>
          <span className={styles.label}>Tag the sims involved</span>
          <SimTagChips sims={allSims} value={simIds} onToggle={toggleSim} />
        </div>
      </div>

      <footer className={styles.footer}>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="button" onClick={handleSave} disabled={title.trim().length === 0 || pending}>
          Save milestone
        </Button>
      </footer>
    </>
  )
}

export function MilestoneComposer({
  legacyId, simsById, editing, onDone, onCancelEdit,
}: MilestoneComposerProps) {
  const [open, setOpen] = useState(false)
  const showForm = open || editing !== null

  function handleOpenChange(next: boolean) {
    if (!next) {
      setOpen(false)
      // Editing: clear the parent's editing target. A brand-new unsaved note
      // just closes — no router.refresh().
      if (editing !== null) onCancelEdit()
    }
  }

  return (
    <>
      <div className={styles.trigger}>
        <span className={styles.triggerText}>Record a moment of your own.</span>
        <Button type="button" onClick={() => setOpen(true)}>+ Add milestone</Button>
      </div>

      <Drawer open={showForm} onOpenChange={handleOpenChange}>
        <Drawer.Portal>
          <Drawer.Overlay />
          <Drawer.Content side="right" aria-describedby={undefined}>
            <ComposerForm
              key={editing?.id ?? 'new'}
              legacyId={legacyId}
              simsById={simsById}
              editing={editing}
              onDone={() => {
                setOpen(false)
                onDone()
              }}
              onCancel={() => handleOpenChange(false)}
            />
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer>
    </>
  )
}
```

> `aria-describedby={undefined}` is the documented Radix way to opt out of the optional description without a console warning (NOT a suppression). `Eyebrow` is the existing UI primitive.

- [ ] **Step 4: Replace the composer CSS**

Replace the whole `milestone-composer.module.css` with:

```css
/* MilestoneComposer — timeline trigger + slide-over drawer form */

.trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-4) 0;
  border-bottom: 1px solid var(--border);
  margin-bottom: var(--space-4);
}

.triggerText {
  font-size: var(--text-sm);
  color: var(--text-muted);
  font-style: italic;
  font-family: var(--font-display);
}

/* Drawer header — flat parchment, NO texture */
.header {
  padding: var(--space-5) var(--space-5) var(--space-4);
  background: var(--bg);
  border-bottom: 1px solid var(--border);
}

.headerTop {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.close {
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--text-subtle);
  font-size: var(--text-base);
  line-height: 1;
  padding: var(--space-1);
  border-radius: 6px;
}

.close:hover { color: var(--text); }

.headerTitle {
  margin-top: var(--space-2);
}

/* Scrollable body */
.body {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.label {
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.input,
.textarea {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg);
  color: var(--text);
  font-size: var(--text-base);
  font-family: inherit;
}

.input { font-family: var(--font-display); font-weight: var(--weight-semibold); }
.textarea { resize: vertical; min-height: 96px; }

.input:focus,
.textarea:focus {
  outline: 2px solid var(--green-glow, var(--green));
  outline-offset: 1px;
}

/* Sticky footer (Content is a flex column; body flex:1 pins this to bottom) */
.footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  border-top: 1px solid var(--border);
}
```

- [ ] **Step 5: Add jsdom mocks to the milestones-client test**

The client test now mounts the drawer (Radix) when the edit test runs. At the top of `__tests__/milestones-client.test.tsx`, ensure a `beforeAll` sets `window.matchMedia` and `global.ResizeObserver` (same block as in Task 1/Task 3 Step 1). If the file already has a `beforeAll`, add the two mocks there; otherwise add:

```tsx
import { beforeAll } from 'vitest'

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false, media: query, onchange: null,
      addListener: vi.fn(), removeListener: vi.fn(),
      addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
    })),
  })
  class MockResizeObserver { observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn() }
  global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver
})
```

(Import `vi`/`beforeAll` from `vitest` if not already imported.)

- [ ] **Step 6: Run the composer + client tests**

Run: `npm test -- "src/app/app/legacies/[slug]/_components/milestones/__tests__/milestone-composer.test.tsx" "src/app/app/legacies/[slug]/_components/milestones/__tests__/milestones-client.test.tsx"`
Expected: PASS. If a client-test query that previously matched the inline form now needs the drawer open, confirm the test clicks Edit/Add first; adjust the query (via `screen`, portal-safe) only as needed — do not weaken assertions.

- [ ] **Step 7: Type-check, lint, full unit suite**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: all clean / all pass.

- [ ] **Step 8: Commit**

```bash
git add "src/app/app/legacies/[slug]/_components/milestones/milestone-composer.tsx" "src/app/app/legacies/[slug]/_components/milestones/milestone-composer.module.css" "src/app/app/legacies/[slug]/_components/milestones/__tests__/milestone-composer.test.tsx" "src/app/app/legacies/[slug]/_components/milestones/__tests__/milestones-client.test.tsx"
git commit -m "feat(legacy): milestone composer as a slide-over drawer with sim-tag chips"
```

---

## Task 4: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Type-check & lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 errors, no warnings.

- [ ] **Step 2: Full unit/integration suite**

Run: `npm test`
Expected: all pass (drawer, sim-tag-chips, composer, milestones-client, derive, router).

- [ ] **Step 3: E2E**

Run: `npm run test:e2e -- milestones.spec.ts`
Expected: PASS. The create/edit/delete flows now go through the drawer. The composer opens via the same "+ Add milestone" button and the form fields keep their labels ("Title") and the "Save milestone" button, so existing locators should resolve (the form is portaled to `document.body`). If a locator broke because a row's Edit now opens a portal, fix the selector (prefer role/label/testid) — do not skip the assertion.

- [ ] **Step 4: Full e2e suite (no regressions)**

Run: `npm run test:e2e`
Expected: all pass (the local gitignored `.env` already supplies `AUTH_SECRET`). A single flaky legacy-wizard timeout can occur under parallel load — re-run once to confirm before treating as real.

- [ ] **Step 5: Final commit (only if anything was adjusted)**

```bash
git add -p
git commit -m "chore(legacy): finalize milestone composer drawer"
```

---

## Self-review notes (addressed)

- **Spec coverage:** Drawer primitive (Task 1), SimTagChips/avatar chips (Task 2), composer refactor with parchment header/body/sticky footer + create/edit titles + no texture (Task 3), testing + e2e (Tasks 1–4). All five spec sections map to tasks.
- **No dot texture:** the header uses `background: var(--bg)` with no `background-image`; verified absent from the CSS in Task 3 Step 4.
- **Type consistency:** `Drawer` composition (`Content`/`Title`/`Overlay`/`Portal`/`Close`) and `DrawerContentProps` match across Task 1 and Task 3; `SimTagChips` props (`sims`/`value`/`onToggle`) match between Task 2 and its use in Task 3; `MilestoneComposerProps` unchanged so `milestones-client.tsx` needs no edit.
- **A11y:** `Drawer.Title` always rendered (accessible dialog name + avoids the missing-title warning); `aria-describedby={undefined}` opts out of the optional description cleanly; chips use `aria-pressed`; close button has `aria-label`.
- **Portal safety:** drawer content portals to `document.body`; RTL `screen` queries and e2e locators still resolve.
```
