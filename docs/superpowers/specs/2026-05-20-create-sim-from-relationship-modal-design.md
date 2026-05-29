# Create Sim from Relationship Modal

## Context

When adding a relationship for a sim, the user must currently have the other sim already created. This creates friction when tracking a new relationship with someone not yet in the legacy — the user has to abandon the relationship flow, create the sim separately, then come back. This spec adds a "Create new sim…" option directly within the relationship modal so both actions complete in one flow.

The existing `AddRelationshipModal` uses raw overlay divs. As part of this work we introduce a proper `Dialog` component to the UI library using Radix Dialog, then migrate the relationship modal and build the new create modal on top of it.

---

## User Flow

1. User opens the "Add relationship" modal on a sim's detail page.
2. Instead of the portrait grid, a searchable **combobox** lets them pick an existing sim.
3. At the bottom of the dropdown a distinguished **"Create new sim…"** item appears.
4. Selecting it opens a second **CreateSimModal** stacked on top (nested Radix Dialog).
5. User fills in the full sim creation form and clicks **"Create sim"**.
6. `CreateSimModal` closes. The relationship modal remains open with the **new sim pre-selected** in the combobox.
7. User confirms relationship type/status and clicks **Add** as normal.

---

## Part 1: Dialog design system component

### Package
Install `@radix-ui/react-dialog`.

### Files
- `src/components/ui/dialog/dialog.tsx`
- `src/components/ui/dialog/dialog.module.css`
- `src/components/ui/index.ts` — add export

### API

Compound component following the same pattern as `Combobox`:

```tsx
<Dialog.Root open={open} onOpenChange={setOpen}>
  <Dialog.Trigger asChild><Button>Open</Button></Dialog.Trigger>
  <Dialog.Portal>
    <Dialog.Overlay />
    <Dialog.Content size="sm">
      <Dialog.Title>Title</Dialog.Title>
      <Dialog.Description>Optional subtitle</Dialog.Description>
      {/* body */}
      <Dialog.Close asChild><Button variant="outline">Cancel</Button></Dialog.Close>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
```

`Dialog.Root`, `Dialog.Trigger`, `Dialog.Portal`, `Dialog.Close` — re-exports of the Radix primitives, no wrapper needed.

`Dialog.Overlay` — `forwardRef` div with `data-state` animation support:
- `position: fixed; inset: 0`
- `background: rgba(42, 31, 14, 0.45)` (warm-tinted, matching parchment palette)
- `z-index: 100`
- Fade in/out via `data-state` (`open` / `closed`) + CSS `@keyframes`

`Dialog.Content` — `forwardRef` with `size` prop (`'sm' | 'base' | 'lg'`, default `'base'`):
- `position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%)`
- `background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-lg)`
- `box-shadow: var(--shadow-lg)`
- `padding: 1.5rem`
- `max-height: 90vh; overflow-y: auto`
- `z-index: 101`
- Widths: `sm` → 400px, `base` → 520px, `lg` → 640px
- Slide-in + fade via `data-state` animation

`Dialog.Title` — wraps Radix `DialogTitle`:
- `font-family: var(--font-display); font-size: var(--text-xl); font-weight: var(--weight-semibold); color: var(--text); margin: 0 0 0.25rem`

`Dialog.Description` — wraps Radix `DialogDescription`:
- `font-size: var(--text-sm); color: var(--text-muted); margin: 0 0 1.25rem`

Nested dialogs stack naturally because Radix portals each dialog independently into `document.body`.

---

## Part 2: AddRelationshipModal

**File:** `src/app/app/legacies/[slug]/sims/[id]/add-relationship-modal.tsx`

### Props changes

```typescript
// Before
interface Props {
  familyAvailable: SimMini[]
  partnerAvailable: SimMini[]
  onAddFamily: (pickedId: string, role: 'parent' | 'child', relType: FamilyRelationshipType) => void
  onAddPartner: (pickedId: string, status: RomanticStatus) => void
  onClose: () => void
}

// After
interface Props {
  legacyId: string
  familyAvailable: SimMini[]
  partnerAvailable: SimMini[]
  onAddFamily: (sim: SimMini, role: 'parent' | 'child', relType: FamilyRelationshipType) => void
  onAddPartner: (sim: SimMini, status: RomanticStatus) => void
  onClose: () => void
}
```

### Implementation changes

- Replace outer `<div className={styles.modalOverlay}>` with `Dialog.Root` (open=true, onOpenChange calls onClose), `Dialog.Overlay`, `Dialog.Content size="sm"`, `Dialog.Title`.
- Replace portrait grid with `Combobox` for each tab:
  - Each existing sim is a `Combobox.Item value={sim.id} textValue={sim.firstName + ' ' + sim.lastName}` showing initials + name.
  - A final `Combobox.Item value="__create__"` at the bottom of the list, styled with `color: var(--green); font-weight: var(--weight-semibold)`, showing `+ Create new sim…`.
  - Since `Combobox.Item` renders `children` directly, the create item needs a `textValue="Create new sim"` so it doesn't interfere with search filtering.
- Add `showCreate: boolean` state; selecting `'__create__'` sets it to `true` without updating `pickedSim`.
- `pickedSim: SimMini | null` replaces `pickedId: string | null` — makes the confirm handler self-contained.
- When `showCreate` is true, render `<CreateSimModal legacyId={legacyId} onCreated={handleCreated} onClose={() => setShowCreate(false)} />`.
- `handleCreated(newSim: SimMini)`: add `newSim` to a local `extraSims` state (so the combobox label resolves), set `pickedSim` to `newSim`, set `showCreate` to false.
- `handleConfirm`: calls `onAddPartner(pickedSim, romanticStatus)` or `onAddFamily(pickedSim, role, relType)`.

---

## Part 3: CreateSimModal

**File:** `src/app/components/create-sim-modal.tsx`

```typescript
interface CreateSimModalProps {
  legacyId: string
  onCreated: (sim: SimMini) => void
  onClose: () => void
}
```

- Rendered with `Dialog.Root` (open=true, onOpenChange calls onClose when closing), `Dialog.Overlay`, `Dialog.Content size="lg"`, `Dialog.Title "Create new sim"`, `Dialog.Description "They'll be linked automatically after you save."`.
- Fetches: `trpc.traits.getAll.useQuery()`, `trpc.aspirations.getAll.useQuery()`, `trpc.careers.getAll.useQuery()`.
- Shows a loading state (spinner or disabled form) while any query is `isLoading`.
- Renders `<SimForm traits aspirations careers submitLabel="Create sim" onBack={onClose} onSubmit={handleSubmit} isSubmitting={isPending} />`.
- `handleSubmit(data: SimFormData)`: calls `trpc.sims.create.mutateAsync({ legacyId, ...data })`, then calls `onCreated({ id, firstName, lastName, imageUrl: imageUrl ?? null })`.

---

## Part 4: RelationshipsEditor

**File:** `src/app/app/legacies/[slug]/sims/[id]/relationships-editor.tsx`

- Pass `legacyId={sim.legacyId}` to `<AddRelationshipModal>`.
- `handleAddPartner(sim: SimMini, romanticStatus)` — use `sim` directly instead of `legacySims.find(pickedId)`.
- `handleAddFamily(sim: SimMini, role, relType)` — same.

---

## Data Flow

```
RelationshipsEditor
  └─ AddRelationshipModal  (legacyId, onAddPartner(SimMini,…), onAddFamily(SimMini,…))
      └─ CreateSimModal  [showCreate=true, nested Radix Dialog]
            trpc.traits.getAll
            trpc.aspirations.getAll
            trpc.careers.getAll
            trpc.sims.create
          → onCreated(SimMini) → combobox pre-selects new sim
```

---

## Verification

1. Navigate to a sim's detail page. Click **Add** in the Relationships section — modal opens as a proper Radix Dialog with focus trap and Esc-to-close.
2. Open the combobox — existing sims are listed and filterable by name. "Create new sim…" appears at the bottom in green.
3. Select **"Create new sim…"** — a second modal opens on top (focus moves into it; first modal remains visible behind overlay).
4. Fill in the form and click **Create sim** — second modal closes, first modal still open, new sim pre-selected in combobox.
5. Click **Add** — relationship saved, new sim appears in the relationships section.
6. Navigate to the new sim — confirm the reverse relationship exists.
7. `npx tsc --noEmit` — zero errors.
8. `npm run lint` — zero errors/warnings.
9. `npm test` — all tests pass.
