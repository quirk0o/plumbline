# Design System Audit — Legacy Detail & Sim Detail Pages

**Date:** 2026-05-13
**Pages audited:**
- `/app/legacies/the-lemons-legacy` — [screenshot](../screenshots/2026-05-13-legacy-detail.png)
- `/app/legacies/the-lemons-legacy/sims/cmozxzd1800020du558q1vug7` — [screenshot](../screenshots/2026-05-13-sim-detail.png)

---

## Critical — Brand violations

### 1. Green used for non-interactive elements

The brand guide is explicit: *green is for interactive elements only.*

- `sim detail` — `.simPortraitWrap { background: var(--green) }` in `page.module.css` — avatar background is decorative, not interactive
- `legacy page` — `.simInitials { color: var(--green) }` in `page.module.css` — initials text is decorative

Fix: use `--text-muted` or `--bg-surface` for decorative avatar fills/initials.

### 2. Amber used for skill pip hover

`sim detail/page.module.css` — `.pip:hover { background: var(--amber) }` — amber is reserved strictly for heir/legacy callouts. Skill pip hover should use `--green-bright` or `--border-bright`.

### 3. `--destructive` token does not exist

`sim detail/page.module.css` uses `var(--destructive, #b91c1c)` with a hardcoded fallback throughout. The actual token is `--error: #b91c1c`. Every reference to `--destructive` should be replaced with `--error`.

---

## Consistency — Section title treatment diverges between pages

The legacy page uses large serif `<h2>` headings (`var(--font-display)`, `var(--text-xl)`) for section titles. The sim detail page uses tiny uppercase `<p>` labels (`0.6875rem`, `var(--text-muted)`). These are the same semantic concept and look completely different.

Proposal: keep each page's visual style (the sim detail's micro-labels suit its dense, form-like content) but align the semantics — both should use `<h2>` elements, not `<p>`, for correct document structure.

---

## Token hygiene — Hardcoded values and missing tokens

### `--space-7` is not in the token scale

`sim detail/page.module.css` uses `var(--space-7)` heavily, but `globals.css` skips from `--space-6` (1.5rem) to `--space-8` (2rem). Either add `--space-7: 1.75rem` to `globals.css` or change usages to `--space-6` / `--space-8`.

### Hardcoded font sizes with no token

| Value | Occurrences | Closest token | Recommendation |
|---|---|---|---|
| `0.6875rem` | ×4 | `--text-xs` (0.75rem) | Add `--text-2xs: 0.6875rem` or round up to `--text-xs` |
| `0.8125rem` | ×3 | between `--text-xs` and `--text-sm` | Add `--text-xs-plus` or use `--text-sm` |
| `1.625rem` | ×1 | `--text-xl` (1.5rem) / `--text-2xl` (2rem) | Pick the closer token |
| `border-radius: 99px` | ×3 | `--radius-xl` (20px) | Add `--radius-full: 9999px` or use `--radius-xl` |
| `border-radius: 3px` | ×1 | `--radius-xs` (4px) | Use `var(--radius-xs)` |

---

## Accessibility

### Section titles use `<p>` instead of `<h2>`

`SimDetailClient` renders all five sections with `<p className={styles.sectionTitle}>`. Screen readers see no document structure. Should be `<h2>`.

### Breadcrumb uses `<p>` instead of `<nav>`

`sim detail` breadcrumb should be a semantic landmark:

```html
<nav aria-label="Breadcrumb">
  <ol>…</ol>
</nav>
```

### No `:focus-visible` ring on `.editableChip` and `.addChip`

`sim detail/page.module.css` defines only `:hover` states for these elements. Keyboard users get no visible focus indicator, failing WCAG 2.4.7. Both should gain a `:focus-visible { box-shadow: var(--focus-ring); }` rule.

### `simCardLink` uses `display: contents`

`legacy/page.module.css` — `display: contents` removes the element from the accessibility tree in some browsers, breaking keyboard activation. The link should wrap the whole card with `display: block`.

---

## Component reuse gap

The legacy page hand-rolls the "Add sim" button as a styled `<Link>`. The sim detail page also hand-rolls its action buttons. The `Button` component at `src/components/ui/button/button.tsx` exists but is not being used on either page.

---

## Minor

### Sim portrait card style diverges between pages

- Legacy page: rectangular cards, square portrait (aspect-ratio: 1), name below
- Sim detail family/social sections: circular 72px avatars

These represent the same concept (a sim portrait card) and should share a reusable component.

### `display: contents` collapses hover target on touch

`legacy/page.module.css` — `.simCardLink { display: contents }` means there is no box to receive touch events. The link should be `display: block` wrapping the card contents.
