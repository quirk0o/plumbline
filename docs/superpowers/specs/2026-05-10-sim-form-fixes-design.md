# SimForm: High & Medium Issue Fixes

**Date:** 2026-05-10  
**Scope:** Fix two bugs and three design-system gaps in `SimForm` and extract a shared `Select` UI component.

---

## Issues addressed

| # | Severity | Issue |
|---|----------|-------|
| 1 | High | Dark-mode chevron color hardcoded in SVG data URI |
| 2 | High | `pronounPreset` state not initialized from `defaultValues` |
| 3 | Medium | No shared `Select` UI component |
| 4 | Medium | No responsive breakpoints in form grids |
| 5 | Medium | Inaccessible back button arrow character |

---

## Fix 1 + 3 — `Select` component (combined)

Fixes 1 and 3 are solved together by extracting a proper `Select` component.

### New files

- `src/components/ui/select/select.tsx`
- `src/components/ui/select/select.module.css`

### API

```tsx
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean
  size?: 'sm' | 'base' | 'lg'  // mirrors Button size scale
}
```

### Structure

```tsx
<div className={styles.wrapper}>
  <select className={styles.select} ...>{children}</select>
  <span className={styles.chevron} aria-hidden="true">
    {/* inline SVG chevron */}
  </span>
</div>
```

- The wrapper is `position: relative` and handles sizing via the `size` prop.
- The `<select>` has `appearance: none` and full-width fill of the wrapper.
- The `<span>` is absolutely positioned in the top-right, `pointer-events: none`, `color: var(--text-muted)`. Because it is a real DOM node, `color` resolves CSS custom properties directly — no data URI, no mask, no `currentColor` workaround.
- The inline SVG chevron within the span uses `stroke="currentColor"`, inheriting the span's `color: var(--text-muted)` which updates automatically in dark mode.

### SimForm migration

- All 6 raw `<select>` elements in `sim-form.tsx` replaced with `<Select>`.
- `.select` and `.selectError` classes removed from `sim-form.module.css`.
- `<Select error={!!formErrors.gender}>` on the gender field (the only validated select).

---

## Fix 2 — `pronounPreset` initialization from `defaultValues`

### Problem

`useState('')` ignores `defaultValues`. Editing a sim with existing pronouns:
- Never shows the matching preset label in the dropdown.
- Never reveals the custom inputs when pronouns don't match a preset.

### Solution

Replace `useState('')` with a lazy initializer:

```tsx
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

- Stored pronouns match a preset exactly → show that preset label.
- Stored pronouns set but don't match any preset → `'Custom'` (reveals the three input fields).
- No pronouns set → `''` (original behaviour).

---

## Fix 4 — Responsive breakpoints

Single `@media (max-width: 640px)` block added to `sim-form.module.css`:

| Class | Change |
|-------|--------|
| `.identityRow` | `flex-direction: column` — photo stacks above fields |
| `.identityGrid` | `grid-template-columns: 1fr` |
| `.twoCol` | `grid-template-columns: 1fr` |
| `.customPronouns` | `grid-template-columns: 1fr` |
| `.halfCol` | `max-width: 100%` |

---

## Fix 5 — Back button accessibility

Wrap the arrow character in an `aria-hidden` span so screen readers announce only "Back":

```tsx
<Button type="button" variant="outline" onClick={onBack}>
  <span aria-hidden="true">← </span>Back
</Button>
```

---

## Files changed

| File | Change |
|------|--------|
| `src/components/ui/select/select.tsx` | New — Select component |
| `src/components/ui/select/select.module.css` | New — Select styles |
| `src/app/components/sim-form.tsx` | Use Select, fix pronounPreset init, fix back button |
| `src/app/components/sim-form.module.css` | Remove .select/.selectError, add 640px breakpoints |

---

## Out of scope

Low-priority items from the audit (section header component, lifeStage required indicator, pronoun preset matched by label) are deferred.
