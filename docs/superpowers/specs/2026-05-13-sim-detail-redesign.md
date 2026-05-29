# Sim Detail Page Redesign

**Date:** 2026-05-13
**Page:** `/app/legacies/[slug]/sims/[id]`
**Files:** `src/app/app/legacies/[slug]/sims/[id]/page.module.css`, `sim-detail-client.tsx`, and section sub-components

---

## Context

The sim detail page is functional but visually undercooked. It uses tiny uppercase `<p>` labels as section titles, misuses design tokens (green on decorative elements, amber on skill pip hover, missing `--error` references), and has accessibility gaps (no focus rings on chips, no semantic heading or nav structure). This redesign fixes all audit violations and elevates the visual presentation to better reflect the Parchment & Forest brand — while keeping the same inline-editing interaction model.

---

## Approved Design

**Mockup:** `.superpowers/brainstorm/87423-1778660498/content/unified-return.html`

### Layout

Single-column, max-width 680px, centered.

**Hero block** (centered): portrait ring → sim name → identity chips → pronouns chip. Separated from the rest of the page by a full-width border and bottom margin. This is the only centered block — it acts as a deliberate page header.

**Body sections** (left-aligned): Personality Traits, Goals & Career, Skills, Family, Relationships. Each section uses a consistent serif heading and is separated by a bottom border. No alternating alignment — everything below the hero follows one left-aligned rhythm.

### Typography

| Element | Treatment |
|---|---|
| Sim name | `Cormorant Garamond` 2.375rem / 600 / line-height 1.05 |
| Section headings | `Cormorant Garamond` 1.25rem / 600 |
| Body / labels | `Plus Jakarta Sans` (unchanged) |
| Sub-labels (Aspiration, Career) | `Plus Jakarta Sans` 0.6875rem / 700 / uppercase |

Section headings replace the current tiny uppercase `<p>` labels. The serif weight gives each section a name without fighting the sim's name for attention.

### Token fixes (from design system audit)

| Issue | Fix |
|---|---|
| `.simPortraitWrap { background: var(--green) }` | Change to `var(--border)` — decorative, not interactive |
| `.simInitials { color: var(--green) }` on legacy page | Change to `var(--text-muted)` |
| `.pip:hover { background: var(--amber) }` | Change to `var(--green-bright)` |
| `var(--destructive, #b91c1c)` throughout | Replace all with `var(--error)` |
| `var(--space-7)` used but not defined | Add `--space-7: 1.75rem` to `globals.css` (between `--space-6` and `--space-8`) |
| Hardcoded `border-radius: 3px` | Replace with `var(--radius-xs)` |
| Hardcoded `border-radius: 99px` | Add `--radius-full: 9999px` to `globals.css` and use it |

### Semantic / accessibility fixes

| Issue | Fix |
|---|---|
| Section titles are `<p>` elements | Change to `<h2>` |
| Breadcrumb is a `<p>` | Wrap in `<nav aria-label="Breadcrumb"><ol>…</ol></nav>` |
| `.editableChip` / `.addChip` have no `:focus-visible` | Add `box-shadow: var(--focus-ring)` on `:focus-visible` |
| Portrait card `display: contents` on legacy page | Change to `display: block` |

---

## Scope

This spec covers only the sim detail page (`/app/legacies/[slug]/sims/[id]`) and the two global token additions to `globals.css`. The legacy page sim card fix (`simCardLink display: contents`) is included because it is a one-line change identified in the same audit.

Out of scope: reusable sim portrait card component (noted in audit as a future improvement, not needed now).

---

## Verification

1. Run `npm run dev`, sign in, navigate to `/app/legacies/the-lemons-legacy/sims/cmozxzd1800020du558q1vug7`
2. Check visual against the mockup: centered hero, serif section headings, consistent left-aligned sections
3. Inspect portrait background — must not be green
4. Hover over skill pips — must turn `--green-bright`, not amber
5. Tab through the page — chips and add buttons must show a visible focus ring
6. Run a screen reader or axe audit — breadcrumb must be a `<nav>`, sections must have `<h2>` headings
7. `npx tsc --noEmit` — no errors
8. `npm run lint` — no warnings
