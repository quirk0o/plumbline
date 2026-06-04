# Milestone Composer → Slide-Over Drawer — Design

**Date:** 2026-06-03
**Status:** Approved (design); pending implementation plan
**Worktree:** `legacy-milestones`
**Builds on:** `2026-05-31-milestones-system-design.md`

## Problem

The shipped milestone composer expands a form **inline** inside the chronicle
(a dashed card that grows in place). Per the design exploration
(`Milestone Composer Options` → Direction A, the designer's pick "for parity"),
this should become a **right-side slide-over drawer**, reusing the household
slide-over pattern so the interaction is consistent app-wide. Writing a story no
longer competes with reading the timeline, and the form gets real room plus a
sticky save footer.

## Decisions (from brainstorming)

- **New reusable `Drawer` primitive** on Radix Dialog (not a one-off, not a
  `Dialog` variant) — gives focus-trap / Escape / scroll-lock / ARIA for free and
  establishes the slide-over pattern for the future household drawer.
- **Sim tagging switches to avatar chips** (PortraitAvatar + "First L." pill,
  green-glow when selected), replacing the current checkbox list.
- **No dot textures anywhere.** The mock's parchment header used a radial-dot
  texture; we use the flat parchment token (`var(--bg)`) instead.

## Drawer spec (from `milestone-composer-options.jsx`, Direction A)

- Right-side, full-height fixed panel, width ~`360px`, `var(--bg-card)`,
  `border-left: 1px solid var(--border)`, `box-shadow: var(--shadow-lg)`.
- Scrim/overlay: `rgba(20,15,5,0.30)` with a 1px backdrop blur.
- Slide-in: `translateX(24px) → 0` + opacity, `280ms cubic-bezier(0.16,1,0.3,1)`;
  symmetric slide-out on close (driven by Radix `data-[state]`).
- Header: flat parchment `var(--bg)` (NO texture), `border-bottom: 1px solid
  var(--border)`; eyebrow "Record a moment" + ✕ close (right); `<h3>` title.
- Body: scrollable, `flex: 1`; the form fields.
- Footer: sticky, `border-top: 1px solid var(--border)`, right-aligned actions.

## Section 1 — `Drawer` primitive

New `src/components/ui/drawer/drawer.tsx` (+ `drawer.module.css`), exported from
`src/components/ui/index.ts`. Mirrors the existing `Dialog` composition:

```tsx
export const Drawer = Object.assign(RadixDialog.Root, {
  Trigger, Portal, Overlay, Content, Title, Description, Close,
})
```

- `Drawer.Content` props: `RadixDialog.DialogContentProps & { side?: 'right' }`
  (default `'right'`). Fixed full-height panel pinned to the chosen side, width
  token, slide + fade keyed off `data-[state=open|closed]`.
- `Drawer.Overlay`: the scrim (`rgba(20,15,5,0.30)` + 1px backdrop blur), fading
  with `data-[state]`.
- `Drawer.Title` is always rendered by consumers (Radix requires a title or
  `aria-label`), so we don't reproduce the "Missing Description/aria-describedby"
  warning seen on the older modal. `Drawer.Description` optional.
- Reduced-motion: respect `prefers-reduced-motion` (no transform animation),
  matching how the codebase handles motion elsewhere if applicable; otherwise a
  plain fade.

**Rationale for a separate primitive:** centered modal (`Dialog`) and slide-over
(`Drawer`) are distinct patterns in the design; keeping them separate keeps each
component single-purpose and lets the household drawer reuse `Drawer` later.

## Section 2 — `SimTagChips`

New `_components/milestones/sim-tag-chips.tsx`: a controlled multi-select.

- Props: `{ sims: ChronicleSim[]; value: string[]; onToggle: (id: string) => void }`.
- Renders each sim as a `<button type="button">` pill: `PortraitAvatar`
  (`ring={ringFor(sim)}`, no `href`) + "First L." label. Selected → green-glow
  background + green border + green text; unselected → transparent + `--border`.
- `aria-pressed` reflects selection (accessible toggle); each button has an
  accessible name (the sim's name).
- Extracted as its own unit for isolated testing and reuse.

## Section 3 — `milestone-composer.tsx` refactor

- Keep the timeline **trigger card** ("Record a moment of your own." +
  "+ Add milestone"); it renders when the drawer is closed and there is no
  `editing` target.
- Render the form inside `<Drawer open={showForm} onOpenChange=…>` where
  `showForm = open || editing !== null` (unchanged open logic). The inner
  `ComposerForm` keeps its **key-remount on `editing?.id ?? 'new'`** so state
  resets cleanly per open.
- Drawer chrome:
  - **Header**: eyebrow "Record a moment", `Drawer.Close` ✕, and a `Drawer.Title`
    = **"Edit milestone"** when editing else **"New milestone"**.
  - **Body**: Title input (display font), Story textarea (~4 rows), label
    "Tag the sims involved" → `SimTagChips` (replaces the checkbox `fieldset`).
  - **Footer**: Cancel (ghost) + Save milestone (primary; disabled on empty
    title or pending).
- Closing via ✕ / Cancel / Escape / overlay-click all route through the existing
  cancel path: discard, and call `onCancelEdit()` only when editing (no needless
  `router.refresh()` for a brand-new unsaved note).
- Mutation wiring (`trpc.milestones.create` / `update`, trim, `onDone`) is
  unchanged. Props from `milestones-client.tsx` are unchanged.

The old inline-form CSS (`.composer`, `.field`, `.input`, `.textarea`, `.tags`,
`.tag`, `.actions`, `.trigger`, `.triggerText`) is replaced/trimmed to the drawer
header/body/footer + field styles; chip styles live with `SimTagChips`.

## Section 4 — Integration & data flow

Unchanged from the milestones system: `milestones-client.tsx` still passes
`legacyId`, `simsById`, `editing`, `onDone`, `onCancelEdit`; Edit on a user row
sets `editing`, which now opens the drawer pre-filled. The drawer `Content`
portals to `document.body`, so the optimistic-update + `router.refresh()`
reconciliation in the client is untouched, and existing `screen`/e2e locators
(button names, field labels, `#milestones`) still resolve.

## Section 5 — Testing

- **`drawer/__tests__/drawer.test.tsx`**: renders children when `open`; calls
  `onOpenChange(false)` on Close/Escape; `Drawer.Content` has an accessible name
  via `Drawer.Title`.
- **`sim-tag-chips` test**: clicking a chip toggles selection (fires `onToggle`,
  reflects `aria-pressed`); selected vs unselected render distinguishably (assert
  `aria-pressed`, not CSS source).
- **Update `milestone-composer.test.tsx`**: opening shows the form in the drawer;
  Save calls `create` (new) / `update` (editing, pre-filled); empty title
  disables Save; chips drive `simIds`. Queries use `screen` (portal-safe).
- **`milestones-client.test.tsx`**: edit/delete affordance tests keep passing
  (adjust only if the portal changes a query).
- **E2E**: no new spec; re-run `e2e/milestones.spec.ts` (create / edit / delete)
  and fix locators only if the drawer changes a label/role.

**Gates** (AGENTS.md): `npx tsc --noEmit` + `npm run lint` after each chunk;
`npm test` + `npm run test:e2e` at the end. No lint/TS suppressions.

## Out of scope (YAGNI)

- The other four composer directions (modal, quick-capture, contextual insert,
  docked rail).
- A general multi-side drawer (`left`/`bottom`) — only `side="right"` is needed
  now; the prop leaves room without building unused variants.
- Building the household drawer (separate future work that will reuse `Drawer`).
- Any dot/paper texture (explicitly excluded).
