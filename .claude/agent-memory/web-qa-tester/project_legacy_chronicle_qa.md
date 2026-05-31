---
name: legacy-chronicle-qa
description: Known issues from QA passes of the legacy-chronicle-redesign branch; last verified 2026-05-31 (seventh pass — atlas route, capsule layout, sim inspector)
metadata:
  type: project
---

## Verified FIXED (2026-05-29 fourth QA pass — tree atlas + contrast + a11y)

1. Focus trap works: Tab cycles through Back to legacy → sim nodes → AppNav items inside dialog → back to Back to legacy. WCAG 2.1 SC 2.1.2 PASS.
2. SVG focus ring visible: `.focusRing` circle with `stroke="var(--green)"` on `:focus-visible`. WCAG 2.1 SC 2.4.7 PASS.
3. SVG is `role="group"` with individual `role="button"` sim nodes. WCAG 2.1 SC 4.1.2 PASS.
4. Contrast tokens: light eyebrow 4.66:1, light section blurbs 5.99:1, dark text-muted 7.24:1. All pass.
5. AppNav `aria-label="Main navigation"`. Section nav `aria-label="Sections"`. Skip link visible on first Tab. axe-core: 0 violations, 23 passes.

## Verified FIXED (2026-05-30 sixth QA pass — re-verify three fixes)

1. Mouse-wheel zoom: works, 98% → 108% → 131%.
2. Text selection during drag: `user-select: none` works.
3. Empty-search message: shows glass pill "No sims match your search."

## Verified from seventh pass (2026-05-31 — atlas route + inspector)

### Change 1: Atlas is now a separate ROUTE — PASS
- URL changes to `/app/legacies/lemons/tree` on "View family tree" click (real navigation, NOT modal)
- Global AppNav present at top (SimTrack / Dashboard / Settings / theme / avatar / Sign out)
- No `role="dialog"` element on the tree page
- No separate "Back to legacy" header bar
- Back arrow in capsule: `aria-label="Back to legacy"`, `href="/app/legacies/lemons"` → navigates to chronicle. PASS.
- Browser Back also returns to chronicle. PASS.

### Change 2: Capsule layout — PASS
- Horizontal layout confirmed: back-arrow · plumbob · [LEGACY / Lemons] · thin divider · "6 sims · 3 generations"
- All elements at same vertical center (y ~86-94px). No stacking.
- Screenshot: `14-capsule-full.png`

### Change 3: Sim inspector popup — MOSTLY PASS, two defects
- Clicking a node opens the inspector panel (`<aside>`) with the correct content.
- Eyebrow: "Founder" for founder, "Current heir" for heir, "Selected · Gen N" for others. PASS.
- Portrait/monogram, name, lifeStage shown. PASS.
- Aspiration line only shown if aspiration exists (code correct, test data has no aspirations). PASS.
- Traits chips only shown if traits exist (code correct, test data has no traits). PASS.
- Parents section shown with parent names. PASS.
- Partner section shown. PASS.
- "Open profile →" navigates to `/app/legacies/<slug>/sims/<id>`. PASS.
- Clicking a different node swaps the card + halo. PASS.
- ✕ button closes inspector. PASS.
- Esc closes inspector. PASS.
- Clicking a node does NOT navigate (stays on tree route). PASS.
- **DEFECT (High) — selection halo nearly invisible**: The halo circle uses `stroke="var(--green-glow)"` = `#1a5c351f` (12% opacity) with stroke-width 6px. At this opacity on the parchment background, the ring is functionally invisible. Users cannot visually determine which node is selected. The spec calls for "a green ring/glow."
- **DEFECT (High) — focus not moved to inspector on open**: When a node is clicked or activated via Enter, focus stays on the sim node `<g>` element. The inspector (`<aside>`) appears but receives no focus. Keyboard users must Tab through all remaining sim nodes before reaching the inspector ✕ button. WCAG 2.4.3 focus order concern.
- **DEFECT (Medium) — focus not returned on inspector close**: After pressing ✕ or Escape to close the inspector, focus lands on BODY instead of the originating sim node. WCAG 2.4.3.

### Sanity checks — all PASS
- Pan (drag): tree repositions correctly. PASS.
- Wheel zoom: wheel-up zooms in (98% → 108%), wheel-down zooms out. PASS.
- −/+/Fit buttons: all work. PASS.
- Generation filter pills: Gen II filter shows only Alicia Lemons correctly. PASS.
- Search dims non-matches: "Alicia" dims all except Alicia Lemons. PASS.
- Dark mode: tree, capsule, inspector all themed correctly. PASS.
- Light mode: all correct. PASS.
- Initial scale: 98% on first load, full tree visible without scrolling. Previously-open issue (Gen I cropped) appears resolved.

## Verified FIXED (2026-05-31 eighth pass — halo + focus)

1. **Selection halo**: Now two-layer treatment — inner solid ring `stroke="var(--green)"` r=26 sw=2 (fully opaque) + outer glow `stroke="var(--green-glow)"` r=29 sw=6. Light mode green = `#1a5c35`, dark mode = `#4aaf72`. Crisp ring clearly visible in both themes. PASS.

2. **Inspector focus on open**: After clicking or keyboard-activating (Enter) a sim node, `document.activeElement` = `BUTTON[aria-label="Close sim details"]`. Works for both mouse click and keyboard. PASS.

## Still open after eighth pass

### High

- **Inspector: focus not returned on close**: Closing the inspector (✕ click or Esc) sends focus to BODY. Fix: store a ref to the activating node, call `.focus()` on it when `onClose` is invoked.

- **No green plumbob crown/glow on heir node**: `linearGradient` `_r_0_-plumbob` defined in SVG `<defs>` but never referenced. Heir (Lana Lemons) distinguished only by amber crest circle. No plumbob SVG shape rendered.

### Medium

- **Alicia Lemons shows 3 parents**: "Lana Lemons · John Lemons · Jared Lemons". John Lemons is in GEN— (unassigned). Jared Lemons is Lana's husband. Three `family_relationship` records exist for Alicia in test DB — likely test data artifact, but worth verifying the data is correct.

- **Skip link focus not programmatically moved**: `<main id="main-content">` lacks `tabindex="-1"`. Activating the skip link doesn't move focus. WCAG 2.4.1.

- **"Open profile →" link text is ambiguous for screen readers**: The `→` arrow character is read by some screen readers. Better: "View [Sim Name] profile" or aria-label override.

### Low

- **No generation filter pill for "Unassigned" / "GEN —" row**: John Lemons and Adaś Zima in GEN — row have no corresponding filter pill.

- **"YOUNG ADULT" caption is 8.5px SVG text**: Passes contrast (5.28:1) but extremely small.

- `aria-current="true"` on section nav buttons — `aria-current="location"` would be more precise.

- Keyboard-focused sim nodes may be off-screen (no `scrollIntoView` on SVG `<g>`).

## Environment gaps (not code bugs)

- Portrait for Lana Lemons: `/uploads/1780036751587-Jessica_Lemons.png` missing from worktree → HTTP 500/404 (4-16 console errors per tree session).

## Data notes

- Lemons legacy: 6 sims, 3 generations (+1 unassigned), 1 household, 6 milestones. Lana Lemons is founderSimId.
- Sims: Lana (Gen I, founder), Jared (Gen I, partner), Alicia (Gen II), Bob (Gen III), John (GEN—), Adaś Zima (GEN—).

**Why:** Ongoing QA of rebuilt Legacy Chronicle page + family tree Atlas. Eighth pass confirms halo visibility and inspector focus management are fixed. Remaining open items: focus-not-returned-on-close, skip link, "Open profile →" arrow in accessible name.
**How to apply:** The two previously-critical items (halo, focus-on-open) are resolved. Remaining open: focus not returned to node on inspector close (BODY receives focus instead).
