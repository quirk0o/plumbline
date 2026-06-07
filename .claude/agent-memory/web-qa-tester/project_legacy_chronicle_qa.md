---
name: legacy-chronicle-qa
description: Known issues from QA passes of the legacy-chronicle-redesign branch; last verified 2026-06-06 (eleventh pass — XYFlow migration final visual regression)
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
- URL changes to `/app/legacies/<slug>/tree` on "View family tree" click (real navigation, NOT modal)
- Global AppNav present at top (SimTrack / Dashboard / Settings / theme / avatar / Sign out)
- No `role="dialog"` element on the tree page
- No separate "Back to legacy" header bar
- Back arrow in capsule: `aria-label="Back to legacy"`, `href="/app/legacies/<slug>"` → navigates to chronicle. PASS.
- Browser Back also returns to chronicle. PASS.

### Change 2: Capsule layout — PASS
- Horizontal layout confirmed: back-arrow · plumbob · [LEGACY / Lemons] · thin divider · "6 sims · 3 generations"
- All elements at same vertical center (y ~86-94px). No stacking.

### Change 3: Sim inspector popup — MOSTLY PASS
- ✕ button closes inspector. PASS.
- Esc closes inspector. PASS.
- "Open profile →" navigates to `/app/legacies/<slug>/sims/<id>`. PASS.
- Clicking a different node swaps the card + halo. PASS.

## Verified FIXED (2026-05-31 eighth pass — halo + focus)

1. **Selection halo**: Two-layer treatment — inner solid ring `stroke="var(--green)"` r=26 sw=2 (fully opaque) + outer glow `stroke="var(--green-glow)"` r=29 sw=6. Light and dark modes pass.
2. **Inspector focus on open**: After clicking or Enter-activating a sim node, `document.activeElement` = `BUTTON[aria-label="Close sim details"]`. PASS.

## Verified from ninth pass (2026-06-05 — LineageFlow/XYFlow full QA)

### PASS

- Initial zoom 100% on small legacy (3 sims). PASS.
- Wheel zoom toward cursor works (44% → 200%). PASS.
- − / + buttons work and update % readout. PASS.
- Search dims non-matching medallions. PASS.
- "No sims match your search." pill appears on zero matches. PASS.
- Clearing search restores all medallions. PASS.
- Gen I filter pill filters tree and re-fits. PASS.
- Bottom zoom bar hidden when visibleSims.length === 0 (code-verified). PASS.
- Click medallion → green selection halo (visible in both themes). PASS.
- Inspector shows "FOUNDER" eyebrow for founder, "CURRENT HEIR" for heir. PASS.
- Esc closes inspector. PASS.
- ✕ button closes inspector. PASS.
- "Open profile →" navigates to sim page. PASS.
- Enter/Space activates focused node and opens inspector. PASS.
- Focus moves to Close button when inspector opens. PASS.
- Tab order is correct: skip link → nav → back → search → all/gen pills → add sim → sim nodes → react flow attribution → zoom controls. PASS.
- Edges (marriage bond) have `aria-hidden="true"`. PASS.
- Edge g elements have `aria-hidden="true"`. PASS.
- GEN pills have `aria-hidden="true"`. PASS.
- Tree group has `aria-label="<Legacy Name> tree — N sims"`. PASS.
- Filter group has `aria-label="Filter by generation"`. PASS.
- Dark mode: deep forest background (#0c1510), not black; all text readable; amber rings and bonds remain amber. PASS.
- Mini tree: 280px height. PASS.
- Mini tree: focused sim has `aria-current="location"`. PASS.
- Mini tree: clicking other sim navigates. PASS.
- Mini tree: group label is "Treeston tree — 3 sims". PASS.
- ADD SIM button: 8.0:1 contrast (WCAG AAA). PASS.
- Sim name text in dark mode: rgb(240,237,232) on #0c1510 — excellent contrast. PASS.
- axe-core: **1 violation**, 35 passes, 1 incomplete.

## Verified FIXED (2026-06-05 tenth pass — commit 77e94b8 re-verification)

1. **axe-core: 0 violations** (was 1 serious `aria-roledescription`). 35 passes. PASS.
2. **React Flow attribution absent from DOM** — `proOptions` hides it; `document.querySelector('[href="https://reactflow.dev"]')` returns null. Tab order is now: sim nodes → Zoom out → Zoom in → Fit (no attribution stop). PASS.
3. **Fit button works**: 200% → 100%; 33% → 100%. Both zoomed-in and zoomed-out states re-fit correctly. PASS.
4. **Inspector "Open profile" accessible name**: `aria-label="Open Alice Treeston's profile"` on Alice's link; `aria-label="Open Charlie Treeston's profile"` on Charlie's link. Name is unique per sim. PASS.

### OPEN BUGS (still open after tenth pass)

#### High

- **Inspector: focus not returned on close**: Closing the inspector (✕ click or Esc) sends focus to BODY. Fix: store a ref to the activating node, call `.focus()` on it when `onClose` is invoked. WCAG 2.4.3.

- **"Open profile" accessible name is ambiguous**: The "Open profile" link in the inspector has no sim name in its accessible name (just "Open profile" + a separate span "→"). Multiple inspectors opened sequentially would announce the same link name. Better: `aria-label="Open Alice Treeston profile"`.

#### Low/Nitpick

- **Double amber ring on founder + heir medallions**: Alice (founder) and Charlie (heir) show 3 concentric rings in the medallion: outer medallion border ring (amber) + inner PortraitAvatar accent ring (amber) + monogram circle. Regular sims (Bob) show only 2 rings. This may be intentional (founder/heir visual distinction) but creates a visually crowded appearance at small sizes. Design confirmation needed.

- **Wheel scroll over mini tree hijacks page scroll**: When hovering over the mini tree on the sim detail page, mouse wheel zoom is captured by XYFlow and the page does not scroll. Noting per checklist — don't fix without design decision.

- **No "Unassigned" (GEN —) filter pill**: Sims in unassigned generation show a GEN — label in the left gutter but there is no filter pill for them in the toolbar. They are always shown in "All" view but cannot be isolated.

- **React Flow attribution contrast fails WCAG AA**: `rgb(153,153,153)` on `rgba(255,255,255,0.5)` = ~2.85:1 (fails 4.5:1 minimum). Third-party branding, likely cannot be changed, but worth noting.

## Verified from eleventh pass (2026-06-06 — XYFlow final visual regression, commit d6d596e)

### PASS

- Light mode visual: pixel-identical to tenth pass (no unintended delta).
- Dark mode visual: identical to tenth pass. "React Flow" watermark absent (removed by XYFlow migration). PASS.
- Heir medallion (Charlie): green pip + gold rings + circle clip all present. PASS.
- Fit regression: 200% → Fit → 100%; zoom readout sane. PASS.
- + and - buttons work after Fit. PASS.
- **Focus-pan zoom clamp**: Tab at 100% after Fit — zoom stays at 100%, then wheel 100%→107%→115%→123% (smooth, no snap). PASS.
- **Zoom floor at 20%**: wheel-out from 200% → floor hits 20% and holds there. PASS.
- **Portrait upload**: uploaded 20×20 green PNG; /api/upload → 200 OK, sims.update → 200 OK; portrait renders in circle on sim detail page, in tree medallion, and in inspector panel. All clipped to circle shape. PASS.
- **axe-core: 0 violations** (35 passes). PASS (same as tenth pass).
- Mini-tree focused ring: clear dark green circular ring on focused node. PASS.
- Mini-tree captions legible (Alice Treeston / YOUNG ADULT, etc.). PASS.

### RETRACTED false bug (eleventh pass, corrected same session)

- **Mini-tree: marriage bond line "missing"** — RETRACTED. The bond renders correctly on Alice's page and is correctly absent on Charlie's page. getMiniTreeData only collects partner edges for the focused sim and its parents, never its children — so on Charlie's page (no partners) partnerEdges is empty; correct per data model. The eleventh pass screenshot `10-mini-tree-closeup.png` was taken on Charlie's page; yesterday's `16-mini-tree.png` was taken on Alice's page. Not a regression.

### EXISTING OPEN BUGS (carried from tenth pass)

#### High

- **Inspector: focus not returned on close**: Closing the inspector (✕ click or Esc) sends focus to BODY. Fix: store a ref to the activating node, call `.focus()` on it when `onClose` is invoked. WCAG 2.4.3.

- **"Open profile" accessible name is ambiguous**: The "Open profile" link in the inspector has no sim name in its accessible name (just "Open profile" + a separate span "→"). Better: `aria-label="Open Alice Treeston profile"`.

#### Low/Nitpick

- **Wheel scroll over mini tree hijacks page scroll**: When hovering over the mini tree on the sim detail page, mouse wheel zoom is captured by XYFlow and the page does not scroll.

- **No "Unassigned" (GEN —) filter pill**: Sims in unassigned generation show a GEN — label in the left gutter but there is no filter pill for them in the toolbar.

## Environment notes

- Test legacy: "QA Tree Legacy" (slug: `qa-tree-legacy`), user: `qa-tree@example.com`
- 3 sims: Alice Treeston (Gen I, founder), Bob Treeston (Gen I, partner/married), Charlie Treeston (GEN —, heir)
- Charlie now has portrait (green test PNG) after eleventh pass upload
- Charlie is in GEN— (unassigned), so no descent lines render from the marriage bond

**Why:** Ongoing QA of rebuilt Legacy Chronicle page + family tree Atlas (now LineageFlow/XYFlow). Eleventh pass is final visual regression pass for XYFlow migration (commit d6d596e).
**How to apply:** Critical previously-open bugs now confirmed fixed (Fit, axe). New Important bug: mini-tree marriage bond regression. Focus-return-on-close (High) still open.
