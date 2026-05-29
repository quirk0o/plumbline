# Custom Select / Combobox Design

**Date:** 2026-05-19

## Context

The app uses native `<select>` elements throughout — nine instances across six files for enum fields like Career, Aspiration, Gender, Occult Type, Romantic Status, and Skill. The existing `src/components/ui/select/select.tsx` wraps a native select with design-token styling, but offers no search, no custom dropdown, and limited accessibility control. A design system audit already flagged accessibility gaps.

The goal is a custom `Combobox` component that:
- Matches the Parchment & Forest design system exactly
- Supports search/filtering (type to narrow options)
- Supports grouped options with section headings
- Uses a compound component API (like `<select>` + `<option>` + `<optgroup>`) so callers compose naturally
- Has a clean "button trigger shows value / search lives in the popover" UX

## Library Choice

**cmdk** (`cmdk` package) + **`@radix-ui/react-popover`**.

- `cmdk` handles the item registry, search input, client-side filtering, keyboard navigation (arrows, Enter, Escape), and grouped item rendering via its `Command`, `Command.Input`, `Command.List`, `Command.Group`, and `Command.Item` primitives.
- `@radix-ui/react-popover` handles the floating layer: portal rendering, positioning, collision detection, click-outside dismissal, and focus trapping.

Accessibility trade-off: cmdk is not as screen-reader-tested as React Aria, but is widely used in production (shadcn/ui). Accessibility is improved over native selects for sighted keyboard users. The trigger button will carry `aria-haspopup="listbox"`, `aria-expanded`, and `aria-controls`; a live region announces filtered result counts.

## Compound Component API

```tsx
<Combobox value={value} onChange={onChange} placeholder="Search careers…">
  <Combobox.Section heading="Arts & Entertainment">
    <Combobox.Item value="ENTERTAINER_COMEDIAN">Entertainer – Comedian</Combobox.Item>
    <Combobox.Item value="ENTERTAINER_MUSICIAN">Entertainer – Musician</Combobox.Item>
  </Combobox.Section>
  <Combobox.Item value="PAINTER">Painter</Combobox.Item>
</Combobox>
```

### `Combobox` props

```ts
type ComboboxProps = {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: boolean;
  size?: 'sm' | 'base' | 'lg';   // matches existing Select
  disabled?: boolean;
  id?: string;                    // forwarded to trigger for FormField htmlFor
  'aria-label'?: string;         // when no visible label exists
  children: React.ReactNode;
};
```

### `Combobox.Item` props

```ts
type ComboboxItemProps = {
  value: string;
  disabled?: boolean;
  children: React.ReactNode;  // plain string for filtering; rich content needs explicit textValue
  textValue?: string;         // explicit filter text when children is not a plain string
};
```

### `Combobox.Section` props

```ts
type ComboboxSectionProps = {
  heading: string;
  children: React.ReactNode;
};
```

### React Hook Form integration

Callers use `Controller` (not `register`):

```tsx
<Controller
  control={control}
  name="career"
  render={({ field }) => (
    <FormField label="Career" htmlFor="career" error={errors.career?.message}>
      <Combobox
        id="career"
        value={field.value}
        onChange={field.onChange}
        placeholder="Search careers…"
      >
        {/* items */}
      </Combobox>
    </FormField>
  )}
/>
```

## UX Behaviour

**Closed state:** Trigger renders as a `<button>` styled identically to the existing Select — same padding, border, radius, font, and chevron icon. Displays the label of the selected value, or placeholder text in `--text-subtle` when empty.

**Open state:** Radix Popover opens below the trigger (flips above if no room). Inside the popover: a cmdk `Command` root containing a search `Command.Input` (focused automatically), a divider, then a `Command.List` with groups and items.

**Filtering:** cmdk filters items client-side as the user types, matching against each item's text content (case-insensitive contains). Groups whose items are all filtered out are hidden automatically.

**Selection:** Clicking or pressing Enter on an item closes the popover, calls `onChange(value)`, and updates the trigger label.

**Keyboard:** Arrow keys move through visible items, Enter selects, Escape closes and returns focus to trigger.

**Empty state:** When no items match, shows "No results for "…"" message in `--text-subtle`.

## Visual Design

All tokens from `src/app/globals.css`. No hardcoded hex values.

| Element | Tokens |
|---|---|
| Trigger button | `--bg-card`, `--border`, `--radius-base`, `--font-body`, `--text-base`, `--text` |
| Trigger placeholder | `--text-subtle` |
| Trigger focus ring | `--focus-ring` |
| Trigger error | `--error` border + error-tinted focus ring |
| Trigger chevron | `--text-muted`; rotates 180° when open |
| Popover | `--bg-card`, `--border`, `--shadow-lg`, `--radius-base`, 4px below trigger |
| Search input | borderless, `--font-body`, `--text-base`, search icon in `--text-subtle` |
| Search divider | 1px `--border` |
| Group heading | `--text-subtle`, `--text-sm`, `--weight-semibold`, uppercase, letter-spacing |
| Item default | `--text`, `--text-base` |
| Item hover | `rgba(26,92,53,0.06)` bg, `--green` text |
| Item keyboard-active | `rgba(26,92,53,0.10)` bg, `--green` text |
| Item selected | checkmark icon in `--green`, `--weight-medium` |
| Empty state | `--text-subtle`, `--text-sm`, centred |
| Transition | `--transition-fast` for popover open/close |

Size variants (`sm`/`base`/`lg`) are implemented via CSS custom properties on the root element, identical to the existing Select approach.

## File Structure

```
src/components/ui/combobox/
├── combobox.tsx
├── combobox.module.css
└── __tests__/
    └── combobox.test.tsx
```

`src/components/ui/index.ts` — add `Combobox` export.

## Migration

The existing `src/components/ui/select/select.tsx` is left in place until all callers are migrated, then deleted along with its CSS module and test file.

Files to migrate (9 native selects across 6 files):

| File | Fields |
|---|---|
| `src/app/app/legacies/[slug]/sims/[id]/identity-section.tsx` | Gender, Life Stage, Occult Type |
| `src/app/app/legacies/[slug]/sims/[id]/relationships-editor.tsx` | Romantic Status |
| `src/app/app/legacies/[slug]/sims/[id]/add-relationship-modal.tsx` | Romantic Status, Family Role, Relationship Type |
| `src/app/app/legacies/[slug]/sims/[id]/skill-editor.tsx` | Skill |
| `src/app/app/legacies/[slug]/sims/[id]/goals-section.tsx` | Aspiration, Career |
| `src/app/app/legacies/[slug]/sims/[id]/death-section.tsx` | Cause of Death |

Each caller replaces its native `<select>` + `<option>`/`<optgroup>` children with `<Combobox>` + `<Combobox.Item>`/`<Combobox.Section>`, and switches from `register()` to `Controller` where applicable.

## Testing

File: `src/components/ui/combobox/__tests__/combobox.test.tsx`
Pattern: React Testing Library + jsdom (matching `select.test.tsx`)

Tests:
- Renders trigger with placeholder when no value
- Renders trigger with selected item label when value provided
- Opens popover on trigger click
- Search input is focused when popover opens
- Typing filters items (matching items visible, non-matching hidden)
- Group headings hidden when all their items are filtered out
- Clicking an item calls `onChange` with the correct value and closes popover
- Arrow keys navigate through visible items; Enter selects
- Escape closes popover and returns focus to trigger
- `id` prop forwarded to trigger button
- `disabled` prop disables trigger
- `error` prop applies error styling class
- Empty state shown when search matches nothing

## Verification

1. `npm install cmdk @radix-ui/react-popover` — confirm packages install cleanly
2. `npx tsc --noEmit` — no type errors
3. `npm run lint` — no warnings
4. `npm test` — all tests pass including the new combobox suite
5. Manual: open the sim form, confirm all nine selects work — search filters correctly, keyboard navigation works, selected value persists, FormField error messages display
6. Manual: check dark mode — all tokens resolve correctly
