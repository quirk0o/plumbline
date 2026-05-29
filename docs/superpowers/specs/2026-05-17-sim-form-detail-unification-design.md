# Sim Form & Detail Page — Design Unification

**Date:** 2026-05-17
**Scope:** Sim creation form (`sim-form.tsx`) and sim detail page (`sim-detail-client.tsx` and related section components)

---

## Context

The sim creation form and sim detail page were built independently and have accumulated visual and structural inconsistencies. This spec unifies them across seven specific areas: section header style, field placement, traits UX, relationships, skill bar alignment, identity spacing, and inline editing design.

---

## 1. Section Headers

**Problem:** The detail page uses large display-font `<h2>` headings (`font-family: var(--font-display); font-size: 1.375rem`). The form uses a small uppercase label + horizontal rule (`text-xs`, bold, `--text-muted`, with a `sectionLine` div). These read as two different products.

**Decision:** Update all detail page section headings to match the form's header pattern — small uppercase label with a horizontal rule extending to the right edge.

**Implementation:**
- In `sim-detail-client.tsx`, wrap each `<h2 className={styles.sectionHeading}>` with a `<div className={styles.sectionHeader}>` and add `<div className={styles.sectionLine} />` after it.
- Update `page.module.css`: remove the current `.sectionHeading` display-font styles; add `.sectionHeader` (flex, align-items center, gap), `.sectionLabel` (text-xs, bold, uppercase, letter-spacing, `--text-muted`), and `.sectionLine` (flex:1, height 1px, `--border`). These are identical to the form's existing classes.
- `IdentitySection` has its own heading treatment — leave it unchanged (it is the page's primary heading area, not a section header).

---

## 2. Occult Type → Identity Section (Form)

**Problem:** Occult Type sits in a standalone "Special" section at the bottom of the creation form. On the detail page it already lives in the identity area (the `.metaRow`). This inconsistency means the field is in different conceptual locations depending on which view you're using.

**Decision:** Move Occult Type into the Identity section of the creation form. Remove the "Special" section entirely.

**Implementation:**
- In `sim-form.tsx`, add the Occult Type `<FormField>` inside the Identity section's `identityGrid`, after Life Stage. Wrap it in `styles.halfCol` to match the existing field width pattern.
- Delete the entire "Special" `<div className={styles.section}>` block (lines 314–327).
- No CSS changes needed — `halfCol` already exists.

---

## 3. Traits UX

### Creation form

**Problem:** The Personality section is the second section in the form (immediately after Identity) and renders the full trait grid immediately — overwhelming given ~80 traits.

**Decision:** Move the Personality section to last in the form (after Goals & Career). No changes to the picker UI itself.

**New form order:**
1. Identity (with Occult Type)
2. Goals & Career
3. Personality Traits

### Detail page modal

**Problem:** The trait picker modal (`pickerBox`) has `max-height: 80vh; overflow-y: auto` on the whole modal. When traits are filtered down, the modal shrinks to the height of the result set, causing the dialog to jump as the user types.

**Decision:** Fix the modal to a static height. Pin the header, chips, tabs, and search at the top; make only the trait grid scroll.

**Implementation:**
- In `page.module.css`, give `.pickerBox` `display: flex; flex-direction: column; height: min(600px, 85vh)`. Remove `overflow-y: auto` from the box itself.
- Add a `scrollableGrid` boolean prop to `TraitPicker`. When true, wrap the `.grid` div in `<div style={{ flex: 1, overflowY: 'auto' }}>`. All other elements (chips, tabs, search, counter) remain outside that wrapper and stay pinned.
- In `trait-editor.tsx`, pass `scrollableGrid` to the `<TraitPicker>` rendered inside the modal.
- The TraitPicker's container also needs `display: flex; flex-direction: column; height: 100%` when `scrollableGrid` is true, so it fills the modal and the grid takes remaining space.

---

## 4. Relationships — Unified Section, No Friends, Partner Badge

**Problem:** There are two separate sections — "Family" (`FamilyEditor`) and "Social Relationships" (`SocialEditor`). Social includes both friends (`RomanticStatus.NONE`) and romantic partners. The user wants one section, no friends, and a visual distinction between partner and family.

**Decision:**
- Merge into a single "Relationships" section containing both `FamilyEditor` and `SocialEditor` output.
- Remove `RomanticStatus.NONE` entirely from `social-editor.tsx` — both from the add flow and from display. Existing `NONE` relationships are hidden (not rendered); they remain in the database but are not surfaced until the feature is revisited.
- All remaining social relationships are partner relationships. Every `SocialEditor` card gets the partner badge treatment — no conditional needed.
- Separate "Add family" and "Add partner" buttons remain; they are placed below their respective card groups.

**Implementation in `sim-detail-client.tsx`:**
- Replace the two `<section>` elements (Family + Social Relationships) with a single `<section>` with heading "Relationships".
- Render `FamilyEditor` first, then `SocialEditor` below it.

**Implementation in `social-editor.tsx`:**
- Remove `RomanticStatus.NONE` from `ROMANTIC_STATUS_OPTIONS`.
- Filter out `NONE` relationships from the initial `rels` state (don't render them).
- Change `newStatus` default to `RomanticStatus.DATING`.
- All rendered cards are partner cards — apply badge and ring to all `simCard` portraits in this component:
  - Portrait: `border: 2px solid var(--border-bright)` ring
  - Overlay badge: absolutely-positioned `<span>` with text "Partner", styled as a small uppercase label (`text-xs`, `--text-subtle`, uppercase, letter-spacing)

**CSS additions to `page.module.css`:**
- `.simCardPartnerRing`: ring border variant for the portrait
- `.simCardPartnerBadge`: small absolute badge positioned below the portrait

---

## 5. Skill Bars — Right-Aligned Pips

**Problem:** The pip bar uses `display: flex` with default `justify-content: flex-start`. All bars are left-aligned within their grid column, so shorter bars leave empty space on the right rather than the left.

**Decision:** Right-align the pips so all bars end at the same right edge.

**Implementation:**
- In `page.module.css`, on `.pipBar` add `justify-content: flex-end`.

---

## 6. Identity Section — Reduce Row Spacing

**Problem:** The rows within the identity section (name row → pronouns → meta row) have too much vertical space between them (`var(--space-3)` margin-bottom on each row, plus `gap: var(--space-4)` in `.hero`).

**Decision:** Reduce inter-row spacing to feel tighter and more like a cohesive block.

**Implementation:**
- In `page.module.css`, reduce `.heroMeta` gap or reduce margin-bottom on `.pronounLine` and `.metaRow` from `var(--space-3)` to `var(--space-2)`.
- Reduce `.hero` gap from `var(--space-4)` to `var(--space-3)` (portrait to meta block).
- Exact values to tune visually during implementation.

---

## 7. Inline Editing Redesign

### Goals & Career

**Problem:** Aspiration and Career use `editableChip` — a native `<select>` styled as a rounded pill/tag. The affordance is confusing: it looks like a static label but is actually a select. The styling is dishonest about what the element is.

**Decision:** Replace `editableChip` with honest, properly styled form fields. Keep auto-save on change behavior (no Save button needed). Add a subtle "Saved" confirmation.

**Implementation in `goals-section.tsx`:**
- Remove `editableChip` class from both selects.
- Apply a new `.goalSelect` class: a standard-looking select with border, `var(--radius-sm)`, padding `var(--space-2) var(--space-3)`, full width within its column.
- Keep the `onChange → trpc update` pattern unchanged.
- Optionally show a brief "Saved" text beside the field on successful mutation (using mutation state).

### Death

**Problem 1:** "+ Mark as deceased" immediately defaults to `OLD_AGE` with no confirmation — a one-click destructive action with no undo.

**Problem 2:** The deceased state shows a bare `editableChip` select with no context — it looks identical to Goals & Career but is semantically different.

**Decision:**

**Alive state:** Keep the "+ Mark as deceased" button but have it open a small confirmation dialog (not a full modal overlay) anchored inline. The dialog has: title "Mark as deceased", a cause-of-death select, and Confirm/Cancel buttons.

**Deceased state:** Replace the bare select with a death card:
```
✦  Cause of death
   Old Age
   [Change cause]  ·  [Mark as alive]
```
"Change cause" reveals an inline select to update the cause. "Mark as alive" clears `causeOfDeath` (sets to null).

**Implementation:**
- Extract `DeathSection` (already its own function in `sim-detail-client.tsx`) into its own file `death-section.tsx`.
- Add `useState` for `confirming: boolean` to control the confirmation UI.
- The confirmation UI is rendered inline below the button (not a portal modal) — a small card-style `<div>` that appears on click.
- "Mark as alive" calls `update.mutate({ id: sim.id, causeOfDeath: null })`. The router already declares `causeOfDeath: z.nativeEnum(CauseOfDeath).nullable().optional()` — no backend changes needed.

---

## Grouping for Implementation Plans

Given scope, split into four separate plans:

| Plan | Items | Files Affected |
|------|-------|----------------|
| **Quick polish** | 1 (headers), 5 (skill bars), 6 (identity spacing) | `page.module.css`, `sim-detail-client.tsx` |
| **Form restructure** | 2 (Occult Type), 3-form (traits order) | `sim-form.tsx` |
| **Traits modal fix** | 3-detail (fixed height modal) | `page.module.css`, `trait-editor.tsx`, `trait-picker.tsx` |
| **Relationships + editing** | 4 (relationships), 7 (Goals & Career, Death) | `sim-detail-client.tsx`, `social-editor.tsx`, `goals-section.tsx`, new `death-section.tsx` |

---

## Verification

After each plan:
- `npx tsc --noEmit` — no type errors
- `npm run lint` — no warnings
- Visual check: load the creation form and detail page in the browser, verify each changed area matches the spec
- After all plans: `npm test` and `npm run test:e2e`
