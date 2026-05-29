# Create Sim from Relationship Modal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When adding a relationship, allow creating a brand-new sim inline via a stacked modal, which auto-pre-selects the new sim in the relationship picker upon return.

**Architecture:** Add a `Dialog` component to the UI library (Radix Dialog), refactor `AddRelationshipModal` to use it and replace the portrait grid with a `Combobox` (sim picker + "Create new sim…" option), and introduce a new `CreateSimModal` that fetches reference data client-side and stacks on top of the relationship modal. After the sim is created it is handed back via a callback and pre-selected in the combobox.

**Tech Stack:** `@radix-ui/react-dialog`, Radix Popover (already installed), cmdk (already installed), tRPC, React Testing Library, Vitest, jsdom

---

## File Map

| Action | Path |
|--------|------|
| Create | `src/components/ui/dialog/dialog.tsx` |
| Create | `src/components/ui/dialog/dialog.module.css` |
| Create | `src/components/ui/dialog/__tests__/dialog.test.tsx` |
| Modify | `src/components/ui/index.ts` |
| Create | `src/app/components/create-sim-modal.tsx` |
| Create | `src/app/components/__tests__/create-sim-modal.test.tsx` |
| Modify | `src/app/app/legacies/[slug]/sims/[id]/add-relationship-modal.tsx` |
| Create | `src/app/app/legacies/[slug]/sims/[id]/__tests__/add-relationship-modal.test.tsx` |
| Modify | `src/app/app/legacies/[slug]/sims/[id]/relationships-editor.tsx` |

---

## Task 1: Install @radix-ui/react-dialog

**Files:** none (package install)

- [ ] **Step 1: Install the package**

```bash
npm install @radix-ui/react-dialog
```

Expected: package added to `node_modules` and `package.json`.

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install @radix-ui/react-dialog"
```

---

## Task 2: Dialog design system component

**Files:**
- Create: `src/components/ui/dialog/dialog.tsx`
- Create: `src/components/ui/dialog/dialog.module.css`
- Create: `src/components/ui/dialog/__tests__/dialog.test.tsx`
- Modify: `src/components/ui/index.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/components/ui/dialog/__tests__/dialog.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Dialog } from '../dialog'

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
})

function Simple({ open = true, onOpenChange = vi.fn() }: { open?: boolean; onOpenChange?: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content>
          <Dialog.Title>Test dialog</Dialog.Title>
          <Dialog.Description>Subtitle here</Dialog.Description>
          <p>Body content</p>
          <Dialog.Close>Close</Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  )
}

describe('Dialog', () => {
  it('renders title and body when open', () => {
    render(<Simple open />)
    expect(screen.getByRole('dialog', { name: 'Test dialog' })).toBeInTheDocument()
    expect(screen.getByText('Body content')).toBeInTheDocument()
    expect(screen.getByText('Subtitle here')).toBeInTheDocument()
  })

  it('does not render content when closed', () => {
    render(<Simple open={false} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('calls onOpenChange(false) when Escape is pressed', async () => {
    const onOpenChange = vi.fn()
    const user = userEvent.setup()
    render(<Simple open onOpenChange={onOpenChange} />)
    await user.keyboard('{Escape}')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('calls onOpenChange(false) when Close is clicked', async () => {
    const onOpenChange = vi.fn()
    const user = userEvent.setup()
    render(<Simple open onOpenChange={onOpenChange} />)
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
```

- [ ] **Step 2: Run tests — expect failures**

```bash
npm test src/components/ui/dialog/__tests__/dialog.test.tsx
```

Expected: `FAIL — Cannot find module '../dialog'`

- [ ] **Step 3: Implement dialog.module.css**

Create `src/components/ui/dialog/dialog.module.css`:

```css
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(42, 31, 14, 0.45);
  z-index: 100;
}

.overlay[data-state='open'] {
  animation: fadeIn var(--transition-base) ease;
}

.overlay[data-state='closed'] {
  animation: fadeOut var(--transition-base) ease;
}

.content {
  position: fixed;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  padding: 1.5rem;
  max-height: 90vh;
  overflow-y: auto;
  z-index: 101;
  width: 520px;
}

.content[data-state='open'] {
  animation: slideIn var(--transition-base) ease;
}

.content[data-state='closed'] {
  animation: slideOut var(--transition-base) ease;
}

.sm { width: 400px; }
.lg { width: 640px; }

.title {
  font-family: var(--font-display);
  font-size: var(--text-xl);
  font-weight: var(--weight-semibold);
  color: var(--text);
  margin: 0 0 0.25rem;
}

.description {
  font-size: var(--text-sm);
  color: var(--text-muted);
  margin: 0 0 1.25rem;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes fadeOut {
  from { opacity: 1; }
  to { opacity: 0; }
}

@keyframes slideIn {
  from { opacity: 0; transform: translate(-50%, -48%); }
  to { opacity: 1; transform: translate(-50%, -50%); }
}

@keyframes slideOut {
  from { opacity: 1; transform: translate(-50%, -50%); }
  to { opacity: 0; transform: translate(-50%, -48%); }
}
```

- [ ] **Step 4: Implement dialog.tsx**

Create `src/components/ui/dialog/dialog.tsx`:

```tsx
'use client'

import * as RadixDialog from '@radix-ui/react-dialog'
import { cn } from '@/lib/utils'
import styles from './dialog.module.css'

export type DialogContentProps = RadixDialog.DialogContentProps & {
  size?: 'sm' | 'base' | 'lg'
}

function DialogOverlay({ className, ...props }: RadixDialog.DialogOverlayProps) {
  return <RadixDialog.Overlay className={cn(styles.overlay, className)} {...props} />
}

function DialogContent({ size = 'base', className, children, ...props }: DialogContentProps) {
  return (
    <RadixDialog.Content
      className={cn(styles.content, size !== 'base' && styles[size], className)}
      {...props}
    >
      {children}
    </RadixDialog.Content>
  )
}

function DialogTitle({ className, ...props }: RadixDialog.DialogTitleProps) {
  return <RadixDialog.Title className={cn(styles.title, className)} {...props} />
}

function DialogDescription({ className, ...props }: RadixDialog.DialogDescriptionProps) {
  return <RadixDialog.Description className={cn(styles.description, className)} {...props} />
}

export const Dialog = Object.assign(RadixDialog.Root, {
  Trigger: RadixDialog.Trigger,
  Portal: RadixDialog.Portal,
  Overlay: DialogOverlay,
  Content: DialogContent,
  Title: DialogTitle,
  Description: DialogDescription,
  Close: RadixDialog.Close,
})
```

- [ ] **Step 5: Export from ui/index.ts**

Add to the bottom of `src/components/ui/index.ts`:

```ts
export { Dialog } from './dialog/dialog'
export type { DialogContentProps } from './dialog/dialog'
```

- [ ] **Step 6: Run tests — expect pass**

```bash
npm test src/components/ui/dialog/__tests__/dialog.test.tsx
```

Expected: 4 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/dialog/ src/components/ui/index.ts
git commit -m "feat(ui): add Dialog component wrapping Radix Dialog"
```

---

## Task 3: CreateSimModal

**Files:**
- Create: `src/app/components/create-sim-modal.tsx`
- Create: `src/app/components/__tests__/create-sim-modal.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/app/components/__tests__/create-sim-modal.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CreateSimModal } from '../create-sim-modal'

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

const mockMutateAsync = vi.fn()
const mockUseMutation = vi.fn(() => ({ mutateAsync: mockMutateAsync, isPending: false }))

vi.mock('@/trpc/client', () => ({
  trpc: {
    traits: { getAll: { useQuery: vi.fn(() => ({ data: [{ id: 't1', name: 'Creative', category: 'HOBBY', conflictsWith: [] }], isLoading: false })) } },
    aspirations: { getAll: { useQuery: vi.fn(() => ({ data: [{ id: 'a1', name: 'Painter Extraordinaire', category: 'CREATIVITY' }], isLoading: false })) } },
    careers: { getAll: { useQuery: vi.fn(() => ({ data: [{ id: 'c1', name: 'Painter', type: 'STANDARD' }], isLoading: false })) } },
    sims: { create: { useMutation: mockUseMutation } },
  },
}))

vi.mock('../image-upload', () => ({ ImageUpload: () => null }))
vi.mock('../trait-picker', () => ({
  TraitPicker: ({ onChange }: { onChange: (ids: string[]) => void }) => (
    <button type="button" onClick={() => onChange([])}>Traits</button>
  ),
}))

describe('CreateSimModal', () => {
  it('shows loading state while queries are pending', () => {
    const { trpc } = require('@/trpc/client')
    trpc.traits.getAll.useQuery.mockReturnValueOnce({ data: undefined, isLoading: true })
    render(<CreateSimModal legacyId="leg-1" onCreated={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('renders the sim form when data is loaded', () => {
    render(<CreateSimModal legacyId="leg-1" onCreated={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByRole('dialog', { name: 'Create new sim' })).toBeInTheDocument()
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument()
  })

  it('calls onClose when Back is clicked', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<CreateSimModal legacyId="leg-1" onCreated={vi.fn()} onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: /back/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls sims.create and then onCreated with the new sim on submit', async () => {
    const newSim = { id: 'sim-new', firstName: 'Nina', lastName: 'Caliente', imageUrl: null, gender: 'FEMALE', lifeStage: 'YOUNG_ADULT' }
    mockMutateAsync.mockResolvedValueOnce(newSim)
    const onCreated = vi.fn()
    const user = userEvent.setup()
    render(<CreateSimModal legacyId="leg-1" onCreated={onCreated} onClose={vi.fn()} />)

    await user.type(screen.getByLabelText(/first name/i), 'Nina')
    await user.type(screen.getByLabelText(/last name/i), 'Caliente')

    await user.click(screen.getByRole('button', { name: /create sim/i }))

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ legacyId: 'leg-1', firstName: 'Nina', lastName: 'Caliente' })
      )
      expect(onCreated).toHaveBeenCalledWith({
        id: 'sim-new', firstName: 'Nina', lastName: 'Caliente', imageUrl: null,
      })
    })
  })
})
```

- [ ] **Step 2: Run tests — expect failures**

```bash
npm test src/app/components/__tests__/create-sim-modal.test.tsx
```

Expected: `FAIL — Cannot find module '../create-sim-modal'`

- [ ] **Step 3: Implement CreateSimModal**

Create `src/app/components/create-sim-modal.tsx`:

```tsx
'use client'

import { trpc } from '@/trpc/client'
import { Dialog } from '@/components/ui'
import { SimForm, type SimFormData } from './sim-form'

type SimMini = { id: string; firstName: string; lastName: string; imageUrl: string | null }

interface CreateSimModalProps {
  legacyId: string
  onCreated: (sim: SimMini) => void
  onClose: () => void
}

export function CreateSimModal({ legacyId, onCreated, onClose }: CreateSimModalProps) {
  const traitsQuery = trpc.traits.getAll.useQuery()
  const aspirationsQuery = trpc.aspirations.getAll.useQuery()
  const careersQuery = trpc.careers.getAll.useQuery()
  const createSim = trpc.sims.create.useMutation()

  const isLoading = traitsQuery.isLoading || aspirationsQuery.isLoading || careersQuery.isLoading

  async function handleSubmit(data: SimFormData) {
    const sim = await createSim.mutateAsync({ legacyId, ...data })
    onCreated({ id: sim.id, firstName: sim.firstName, lastName: sim.lastName, imageUrl: sim.imageUrl ?? null })
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content size="lg">
          <Dialog.Title>Create new sim</Dialog.Title>
          <Dialog.Description>They&apos;ll be linked automatically after you save.</Dialog.Description>
          {isLoading ? (
            <p>Loading…</p>
          ) : (
            <SimForm
              traits={traitsQuery.data ?? []}
              aspirations={aspirationsQuery.data ?? []}
              careers={careersQuery.data ?? []}
              submitLabel="Create sim"
              onBack={onClose}
              onSubmit={handleSubmit}
              isSubmitting={createSim.isPending}
            />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  )
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npm test src/app/components/__tests__/create-sim-modal.test.tsx
```

Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/components/create-sim-modal.tsx src/app/components/__tests__/create-sim-modal.test.tsx
git commit -m "feat: add CreateSimModal for inline sim creation"
```

---

## Task 4: AddRelationshipModal — replace overlay, portrait grid, add create mode

**Files:**
- Modify: `src/app/app/legacies/[slug]/sims/[id]/add-relationship-modal.tsx`
- Create: `src/app/app/legacies/[slug]/sims/[id]/__tests__/add-relationship-modal.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/app/app/legacies/[slug]/sims/[id]/__tests__/add-relationship-modal.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FamilyRelationshipType, RomanticStatus } from '@prisma/client'
import { AddRelationshipModal } from '../add-relationship-modal'

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

vi.mock('@/app/components/create-sim-modal', () => ({
  CreateSimModal: ({
    onCreated,
    onClose,
  }: {
    onCreated: (sim: { id: string; firstName: string; lastName: string; imageUrl: null }) => void
    onClose: () => void
  }) => (
    <div role="dialog" aria-label="Create new sim mock">
      <button onClick={() => onCreated({ id: 'sim-new', firstName: 'Nina', lastName: 'Caliente', imageUrl: null })}>
        Confirm create
      </button>
      <button onClick={onClose}>Cancel create</button>
    </div>
  ),
}))

const partnerAvailable = [
  { id: 'sim-a', firstName: 'Aria', lastName: 'Bell', imageUrl: null },
  { id: 'sim-b', firstName: 'Bob', lastName: 'Stone', imageUrl: null },
]
const familyAvailable = [
  { id: 'sim-c', firstName: 'Clara', lastName: 'Day', imageUrl: null },
]

function renderModal(overrides?: Partial<React.ComponentProps<typeof AddRelationshipModal>>) {
  const props = {
    legacyId: 'leg-1',
    partnerAvailable,
    familyAvailable,
    onAddPartner: vi.fn(),
    onAddFamily: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  }
  render(<AddRelationshipModal {...props} />)
  return props
}

async function openCombobox(user: ReturnType<typeof userEvent.setup>, label: RegExp | string) {
  await user.click(screen.getByRole('button', { name: label }))
}

describe('AddRelationshipModal', () => {
  it('renders as a dialog with the title "Add relationship"', () => {
    renderModal()
    expect(screen.getByRole('dialog', { name: 'Add relationship' })).toBeInTheDocument()
  })

  it('lists available partner sims in the combobox', async () => {
    const user = userEvent.setup()
    renderModal()
    await openCombobox(user, /select sim/i)
    expect(screen.getByText('Aria Bell')).toBeVisible()
    expect(screen.getByText('Bob Stone')).toBeVisible()
  })

  it('includes "Create new sim…" in the combobox', async () => {
    const user = userEvent.setup()
    renderModal()
    await openCombobox(user, /select sim/i)
    expect(screen.getByText(/create new sim/i)).toBeVisible()
  })

  it('opens CreateSimModal when "Create new sim…" is selected', async () => {
    const user = userEvent.setup()
    renderModal()
    await openCombobox(user, /select sim/i)
    await user.click(screen.getByText(/create new sim/i))
    expect(screen.getByRole('dialog', { name: /create new sim mock/i })).toBeInTheDocument()
  })

  it('pre-selects the new sim in the combobox after creation', async () => {
    const user = userEvent.setup()
    renderModal()
    await openCombobox(user, /select sim/i)
    await user.click(screen.getByText(/create new sim/i))
    await user.click(screen.getByRole('button', { name: 'Confirm create' }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Nina Caliente' })).toBeInTheDocument()
    })
  })

  it('calls onAddPartner with SimMini and romantic status on confirm', async () => {
    const user = userEvent.setup()
    const { onAddPartner } = renderModal()
    await openCombobox(user, /select sim/i)
    await user.click(screen.getByText('Aria Bell'))
    await user.click(screen.getByRole('button', { name: /add/i }))
    expect(onAddPartner).toHaveBeenCalledWith(
      { id: 'sim-a', firstName: 'Aria', lastName: 'Bell', imageUrl: null },
      RomanticStatus.DATING,
    )
  })

  it('calls onAddFamily with SimMini, role, and relType on confirm', async () => {
    const user = userEvent.setup()
    const { onAddFamily } = renderModal()
    await user.click(screen.getByRole('button', { name: /family/i }))
    await openCombobox(user, /select sim/i)
    await user.click(screen.getByText('Clara Day'))
    await user.click(screen.getByRole('button', { name: /add/i }))
    expect(onAddFamily).toHaveBeenCalledWith(
      { id: 'sim-c', firstName: 'Clara', lastName: 'Day', imageUrl: null },
      'child',
      FamilyRelationshipType.BIOLOGICAL,
    )
  })

  it('calls onClose when Cancel is clicked', async () => {
    const user = userEvent.setup()
    const { onClose } = renderModal()
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onClose).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests — expect failures**

```bash
npm test "src/app/app/legacies/\[slug\]/sims/\[id\]/__tests__/add-relationship-modal.test.tsx"
```

Expected: `FAIL` — multiple failures because the component still uses the old portrait-grid UI and raw overlay.

- [ ] **Step 3: Rewrite add-relationship-modal.tsx**

Replace the entire contents of `src/app/app/legacies/[slug]/sims/[id]/add-relationship-modal.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { FamilyRelationshipType, RomanticStatus } from '@prisma/client'
import { Combobox, Dialog } from '@/components/ui'
import { CreateSimModal } from '@/app/components/create-sim-modal'
import styles from './page.module.css'

type SimMini = { id: string; firstName: string; lastName: string; imageUrl: string | null }

const ROMANTIC_STATUS_OPTIONS: RomanticStatus[] = [
  RomanticStatus.DATING,
  RomanticStatus.ENGAGED,
  RomanticStatus.MARRIED,
  RomanticStatus.EX_PARTNER,
  RomanticStatus.WIDOWED,
]

function formatStatus(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

interface Props {
  legacyId: string
  familyAvailable: SimMini[]
  partnerAvailable: SimMini[]
  onAddFamily: (sim: SimMini, role: 'parent' | 'child', relType: FamilyRelationshipType) => void
  onAddPartner: (sim: SimMini, status: RomanticStatus) => void
  onClose: () => void
}

export function AddRelationshipModal({
  legacyId,
  familyAvailable,
  partnerAvailable,
  onAddFamily,
  onAddPartner,
  onClose,
}: Props) {
  const [tab, setTab] = useState<'partner' | 'family'>('partner')
  const [pickedSim, setPickedSim] = useState<SimMini | null>(null)
  const [role, setRole] = useState<'parent' | 'child'>('child')
  const [relType, setRelType] = useState<FamilyRelationshipType>(FamilyRelationshipType.BIOLOGICAL)
  const [romanticStatus, setRomanticStatus] = useState<RomanticStatus>(RomanticStatus.DATING)
  const [showCreate, setShowCreate] = useState(false)
  const [extraSims, setExtraSims] = useState<SimMini[]>([])

  function handleTabChange(next: 'partner' | 'family') {
    setTab(next)
    setPickedSim(null)
  }

  function handleSimSelect(value: string) {
    if (value === '__create__') {
      setShowCreate(true)
      return
    }
    const allSims = [...partnerAvailable, ...familyAvailable, ...extraSims]
    setPickedSim(allSims.find((s) => s.id === value) ?? null)
  }

  function handleCreated(newSim: SimMini) {
    setExtraSims((prev) => [...prev, newSim])
    setPickedSim(newSim)
    setShowCreate(false)
  }

  function handleConfirm() {
    if (!pickedSim) return
    if (tab === 'partner') {
      onAddPartner(pickedSim, romanticStatus)
    } else {
      onAddFamily(pickedSim, role, relType)
    }
  }

  const availableSims = [...(tab === 'partner' ? partnerAvailable : familyAvailable), ...extraSims]

  return (
    <>
      <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content size="sm">
            <Dialog.Title>Add relationship</Dialog.Title>

            <div className={styles.relTabRow}>
              <button
                className={`${styles.relTab} ${tab === 'partner' ? styles.relTabActive : ''}`}
                onClick={() => handleTabChange('partner')}
              >
                Partner
              </button>
              <button
                className={`${styles.relTab} ${tab === 'family' ? styles.relTabActive : ''}`}
                onClick={() => handleTabChange('family')}
              >
                Family
              </button>
            </div>

            <Combobox
              value={pickedSim?.id ?? ''}
              onChange={handleSimSelect}
              placeholder="Select sim…"
              aria-label="Select sim"
            >
              {availableSims.map((sim) => (
                <Combobox.Item
                  key={sim.id}
                  value={sim.id}
                  textValue={`${sim.firstName} ${sim.lastName}`}
                >
                  {sim.firstName} {sim.lastName}
                </Combobox.Item>
              ))}
              <Combobox.Item value="__create__" textValue="Create new sim">
                <span style={{ color: 'var(--green)', fontWeight: 600 }}>+ Create new sim…</span>
              </Combobox.Item>
            </Combobox>

            {tab === 'partner' ? (
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.75rem', marginTop: '0.75rem' }}>
                Romantic status
                <Combobox
                  value={romanticStatus}
                  onChange={(v) => setRomanticStatus(v as RomanticStatus)}
                  size="sm"
                  aria-label="Romantic status"
                >
                  {ROMANTIC_STATUS_OPTIONS.map((s) => (
                    <Combobox.Item key={s} value={s}>{formatStatus(s)}</Combobox.Item>
                  ))}
                </Combobox>
              </label>
            ) : (
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.75rem' }}>
                  Role
                  <Combobox
                    value={role}
                    onChange={(v) => setRole(v as 'parent' | 'child')}
                    size="sm"
                    aria-label="Role"
                  >
                    <Combobox.Item value="parent">This sim is the parent</Combobox.Item>
                    <Combobox.Item value="child">This sim is the child</Combobox.Item>
                  </Combobox>
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.75rem' }}>
                  Relationship type
                  <Combobox
                    value={relType}
                    onChange={(v) => setRelType(v as FamilyRelationshipType)}
                    size="sm"
                    aria-label="Relationship type"
                  >
                    <Combobox.Item value={FamilyRelationshipType.BIOLOGICAL}>Biological</Combobox.Item>
                    <Combobox.Item value={FamilyRelationshipType.ADOPTIVE}>Adoptive</Combobox.Item>
                    <Combobox.Item value={FamilyRelationshipType.STEP}>Step</Combobox.Item>
                  </Combobox>
                </label>
              </div>
            )}

            <div className={styles.modalActions}>
              <button className={styles.modalCancelBtn} onClick={onClose}>Cancel</button>
              <button
                className={styles.editableChip}
                style={{ background: 'var(--green)', color: 'white', borderColor: 'var(--green)' }}
                onClick={handleConfirm}
                disabled={!pickedSim}
              >
                Add
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>

      {showCreate && (
        <CreateSimModal
          legacyId={legacyId}
          onCreated={handleCreated}
          onClose={() => setShowCreate(false)}
        />
      )}
    </>
  )
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npm test "src/app/app/legacies/\[slug\]/sims/\[id\]/__tests__/add-relationship-modal.test.tsx"
```

Expected: 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/app/app/legacies/[slug]/sims/[id]/add-relationship-modal.tsx" "src/app/app/legacies/[slug]/sims/[id]/__tests__/"
git commit -m "feat: replace portrait grid with combobox and add inline sim creation"
```

---

## Task 5: RelationshipsEditor — wire legacyId and update callback types

**Files:**
- Modify: `src/app/app/legacies/[slug]/sims/[id]/relationships-editor.tsx`

- [ ] **Step 1: Update handleAddPartner to accept SimMini**

In `relationships-editor.tsx`, update the handler signature and remove the `legacySims.find()` lookup. The component already has a prop named `sim` (the current sim), so name the parameter `picked` to avoid shadowing it. Replace lines 108–119:

```tsx
function handleAddPartner(picked: SimMini, romanticStatus: RomanticStatus) {
  const [a, b] = [sim.id, picked.id].sort()
  const rel: SocialRel = { sim: picked, romanticStatus, simAId: a, simBId: b }
  setPartners((prev) => [...prev, rel])
  addSocial.mutate(
    { simAId: a, simBId: b, romanticStatus },
    { onError: () => setPartners((prev) => prev.filter((r) => r.sim.id !== picked.id)) },
  )
  setAdding(false)
}
```

- [ ] **Step 2: Update handleAddFamily to accept SimMini**

Replace lines 121–132:

```tsx
function handleAddFamily(picked: SimMini, role: 'parent' | 'child', relType: FamilyRelationshipType) {
  const parentId = role === 'parent' ? picked.id : sim.id
  const childId = role === 'parent' ? sim.id : picked.id
  setMembers((prev) => [...prev, { sim: picked, relType, role, parentId, childId }])
  addFamily.mutate(
    { parentId, childId, type: relType },
    { onError: () => setMembers((prev) => prev.filter((m) => m.sim.id !== picked.id)) },
  )
  setAdding(false)
}
```

- [ ] **Step 3: Pass legacyId and updated props to AddRelationshipModal**

The `AddRelationshipModal` JSX is inside the `{adding && (...)}` block at the bottom of the component. Update it:

```tsx
{adding && (
  <AddRelationshipModal
    legacyId={sim.legacyId}
    familyAvailable={familyAvailable}
    partnerAvailable={partnerAvailable}
    onAddFamily={handleAddFamily}
    onAddPartner={handleAddPartner}
    onClose={() => setAdding(false)}
  />
)}
```

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit
```

Expected: zero errors. If TypeScript reports a mismatch between the old `(pickedId: string)` signatures and the new `(sim: SimMini)` ones, verify that both the handler functions and the `Props` interface in `add-relationship-modal.tsx` were updated in Task 4.

- [ ] **Step 5: Commit**

```bash
git add "src/app/app/legacies/[slug]/sims/[id]/relationships-editor.tsx"
git commit -m "feat: wire legacyId into relationship modal and update callback types to SimMini"
```

---

## Task 6: Final validation

- [ ] **Step 1: TypeScript**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 2: Lint**

```bash
npm run lint
```

Expected: zero errors, zero warnings.

- [ ] **Step 3: Full test suite**

```bash
npm test
```

Expected: all tests pass, including the new Dialog, CreateSimModal, and AddRelationshipModal tests.

- [ ] **Step 4: Manual smoke test**

1. Start the dev server: `npm run dev`
2. Sign in via magic link (see AGENTS.md for instructions).
3. Open any sim's detail page.
4. Click **Add** in the Relationships section — confirm a proper modal opens with a searchable combobox.
5. Open the combobox — existing sims listed, "Create new sim…" at bottom in green.
6. Select "Create new sim…" — a second modal opens on top; the first remains visible.
7. Fill in first name, last name, gender; click "Create sim".
8. Second modal closes; first modal still open; new sim pre-selected in combobox.
9. Click Add — relationship saved; new sim card appears in the list.
10. Navigate to new sim — confirm reverse relationship is present.
