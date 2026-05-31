# Legacy Chronicle redesign — status

**Branch:** `worktree-legacy-chronicle-redesign` (includes a merge of `master` through `e942af7`)
**Last updated:** 2026-05-29
**Source design:** `design_handoff_legacy_redesign/` (handoff README + JSX prototypes)

The legacy detail page (`src/app/app/legacies/[slug]/page.tsx`) was rebuilt from a
short hero + founder card + flat sim list + inline ReactFlow tree into a
**journal-style long-scroll "chronicle"** with an on-demand fullscreen family-tree
overlay. This document records what shipped, what was intentionally cut, and what
remains open.

---

## 🔀 Merged from `master` — 2026-05-29

`master` advanced several commits since this branch diverged; all merged cleanly
(no conflicts). What it brought:

- **Generation auto-assignment** (`88fff3f`, `5f69445`) — founder is now created
  with `generationNumber: 1` (`legacies.ts`); `addFamilyRelationship` derives a
  child's gen = min(parent gens)+1 (and recomputes on delete);
  `addSocialRelationship` gives a no-gen partner their spouse's gen. Plus a
  **`prisma/backfill-generations.ts`** script — run it once to clear "Unassigned"
  on existing legacies.
- **E2E / combobox repair** (`8fae11e`) — fixes the combobox and updates the
  Playwright suite (add-sims-to-legacy, legacy-wizard, sim-detail) + adds
  `e2e/add-relationship-modal.spec.ts`. Resolves the pre-existing combobox
  `selectOption` E2E drift previously flagged here.
- **E2E stability** (`ef72625`, `9e73afd`) — guards the legacy-wizard E2E against a
  hydration race and isolates the test-server build dir so dev + test servers can
  run concurrently.
- **Combobox accessible-name fix** (`207b842`) — the combobox `aria-label` no
  longer overrides the selected value's accessible name; this fixed the lingering
  `add-relationship-modal` unit test.

Post-merge check: `tsc --noEmit` clean, `lint` clean, **385/385 tests pass** — the
full suite is green.

---

## ✅ Completed

### Page & sections
- **Long-scroll chronicle shell** with a two-column grid and a **sticky left
  SectionNav rail** (Chronicle / Succession / Milestones / Family) driven by an
  `IntersectionObserver` scroll-spy (active item = highest intersection ratio;
  last item activates at page bottom; green-glow active state).
- **Hero** — eyebrow, legacy title (trailing "Legacy" accented amber), blurb,
  four **live** stat blocks (Sims / Generations / Households / Milestones), a
  "View family tree" button, and a "Now & then" card (founder + current heir).
- **Succession line** — founder → heirs, portrait + name + role, amber connectors,
  empty-state sentence.
- **Milestones** — **derived, read-only** timeline: births (founder row =
  "Founding") + marriages (from `SocialRelationship` MARRIED), newest-first, with
  plumbob markers and involved-sim avatars.
- **Roster ("All sims")** — sims grouped by generation (badge + count), clickable
  cards → sim detail, "Add sim" link.

### Design-system primitives (`src/components/ui/`)
- `Eyebrow`, `StatBlock`, `SectionHeading`, `PortraitAvatar` (photo → italic
  monogram fallback, optional link), `GenerationBadge`, `TreeIcon`.
- Pure helpers: `roman`, `formatLifeStage` (`src/lib/legacy-format.ts`);
  `splitLegacyName` (`…/[slug]/lib/legacy-title.ts`).

### Data layer
- Pure, tested derivations + view types in `…/[slug]/lib/` (`derive.ts`,
  `types.ts`): `toChronicleSim`, `ringFor`, `computeStats`, `deriveSuccession`,
  `deriveMilestones`, `groupByGeneration`.
- Page is an RSC: one Prisma query → typed `FetchedLegacy` → derivations →
  presentational `ChronicleSections` + client islands.

### Family tree (new, separate from the ReactFlow tree)
- **Pure-SVG tree** with the **Crest** node renderer in `src/components/lineage-tree/`
  (`layout.ts` computes positions + content-sized viewBox; `crest-node`,
  `connectors`, `tree-defs`). `getTreeData` extended with `isHeir` + `lifeStage`.
- **Fullscreen tree overlay** opened from the hero ("View family tree"), Esc /
  "Back to legacy" closes, entrance animation, reduced-motion aware, body-scroll
  lock, focus moved to/restored from the trigger.

### Polish fixes (second pass)
- Succession + Milestones sections are parchment (no white bands).
- Succession portrait amber ring no longer clipped by the scroll container.
- Left rail is genuinely sticky (`html, body` switched `overflow-x: hidden` →
  `clip`, which no longer breaks `position: sticky`).
- Removed the hero breadcrumb (and the now-unused `Breadcrumb` primitive).
- Portraits (hero, succession, milestone rows) are links to the sim page.

### Verification
- `tsc --noEmit` clean, `npm run lint` clean, **375 unit/integration tests pass**.
  Every build task went through spec + code-quality review.
- Browser QA (real data) confirms all sections, interactions, the tree overlay,
  and the five polish fixes work in light **and** dark mode.

---

## ✂️ Intentionally cut (scope decisions locked with the user)

These were in the original handoff but deliberately removed for this pass:
- **Milestone composer / write path** — milestones are derived read-only; no
  `Milestone` DB model, no "Add milestone" button.
- **Generation filter** (the `?gen=` capsule), filtered empty states, and the
  "Show N earlier milestones" paginator.
- **Auto-captured age-ups** in the timeline (not derivable — no event history).
- Overlay extras from the `AtlasLegacy` mock: **search, generation-filter pills,
  floating sim inspector, quick-milestone modal, zoom controls.**

---

## ✅ Completed in the 2026-05-29 completion pass

The four deferred items below were all addressed (plan:
`docs/superpowers/plans/2026-05-29-legacy-chronicle-redesign-completion.md`).
Three parallel workstreams; `tsc` + `lint` clean; unit/integration suite
**411/411 green**; full browser QA (light + dark, keyboard-only) passed.

### 1. Tree overlay visual match — DONE
The Atlas chrome now ships: **dot-grid parchment canvas** (theme-tracking),
**top-left floating glass capsule** (plumbob + `LEGACY` eyebrow + title with
upright amber "Legacy" + "N sims · M generations"), **lift drop-shadow** on the
Crest medallions (SVG filter), and the **bottom legend pill** (Heir / Sim /
Marriage / Lineage). Lives in `tree-overlay.tsx` + `.module.css`.

### 2. Tree accessibility — DONE (all three Criticals fixed)
- Focus is now **trapped** in the dialog; Esc closes and restores focus to the
  "View family tree" trigger.
- Nodes have a **visible green SVG focus ring** on `:focus-visible` (module CSS;
  works around `outline` not rendering on `<g>`).
- The tree `<svg>` is now `role="group"` with a label (was `role="img"`); each
  sim node is a keyboard-activatable button with name + life stage.

### 3. Contrast — DONE (app-wide)
`--text-muted` and `--text-subtle` darkened in both themes to meet WCAG AA
(now ≥4.66:1 light, ≥7.24:1 dark across every surface). Locked by
`src/app/__tests__/contrast.test.ts`, which parses `globals.css`.

### 4. Smaller a11y polish — DONE
Skip-to-content link + labelled top nav (`app-shell.tsx`); rail buttons bumped
to ≥44px; portrait/crest monograms now **upright** (brand: no italic for entity
names). Decorative-mark `aria-hidden` audit found no remaining gaps.

## ✅ Completed in the 2026-05-30 Tree Atlas completion pass

The tree overlay was promoted from a static, over-zoomed chart into the full
**interactive Atlas** from the handoff mock (plans:
`docs/superpowers/plans/2026-05-30-legacy-tree-rendering-engine.md` +
`…-legacy-tree-atlas-overlay.md`). Executed subagent-driven with per-task
spec + code-quality review; `tsc` + `lint` clean; unit/integration suite
**424/424 green**; full live browser QA (light + dark, keyboard-only, axe: 0
violations) passed.

- **Correct scale + interactive pan/zoom.** The SVG now renders at intrinsic
  size; a hand-rolled `usePanZoom` hook (`src/components/lineage-tree/use-pan-zoom.ts`)
  drives drag-to-pan, wheel-zoom-toward-cursor, `−`/`+`/`Fit`, and a live %
  readout. Opens fit-to-viewport capped at 100% (small legacies ~1:1, large
  scale down) — the old "way too zoomed in" bug and the Gen I initial-crop are
  both resolved. The wheel listener attaches via a callback ref so it wires up
  when the surface mounts (after data loads).
- **Functional top-right toolbar** (`atlas-toolbar.tsx`): search ("Search this
  lineage…") that dims non-matching medallions (with a "No sims match your
  search." pill on zero matches), generation filter pills (All / Gen I / …)
  that filter the rendered tree and re-fit, and an **Add sim** link to
  `…/sims/new`. (Per the locked scope, **+ Milestone is intentionally omitted** —
  no milestone backend.)
- **No header bar.** The "Back to legacy" bar was removed to match the mock; the
  back affordance now lives in the floating capsule and the dialog closes on Esc.
  The capsule (with the `Dialog.Title` and back button) renders in every state,
  so the dialog is always named and closable.
- **AppNav duplication resolved.** The overlay is rebuilt on the Radix `Dialog`
  primitive (portal + focus trap + scroll-lock + `aria-hidden` on the
  background), so there is now exactly **one** "Main navigation" landmark while
  the tree is open and keyboard focus can't reach the page behind. The bespoke
  focus-trap/Escape/scroll-lock/focus-restore code was deleted.
- Drag no longer selects SVG text (`user-select: none` on the pan surface).

## ✅ Completed in the 2026-05-31 route + inspector pass

Driven by the design bundle (`Legacy Redesign Pages.html` → `combined.jsx`) and the
target screenshot. `tsc`+`lint` clean; suite **424/424**; live browser QA (light +
dark, keyboard) passed.

- **Atlas is now a route, not a dialog.** New page `…/legacies/[slug]/tree`
  renders `TreeAtlas` full-bleed below the app-shell nav. Radix Dialog removed
  entirely (no second AppNav, no focus trap); "View family tree" is a `ButtonLink`
  to the route; the capsule's back arrow is a `Link` to the chronicle; browser
  back works. Folder renamed `tree-overlay/` → `tree-atlas/`.
- **Capsule matches the design:** the sim · generation counts sit to the right of
  the title behind a vertical divider (was stacked below).
- **Selected-sim inspector** (the design's `FloatingSimInspector`): clicking a
  node selects it (visible green selection halo) and floats in a card —
  portrait, name, life-stage · aspiration, traits, parents, partner, and
  "Open profile →" (the navigation affordance). Lazy-fetches via `sims.getById`.
  Esc / ✕ close; focus moves into the panel on open. New `sim-inspector.tsx`.
- **Node click no longer navigates** — selection drives the inspector; the
  inspector's "Open profile →" navigates.

## 🔭 Follow-ups (tracked, not blocking)

- **Inspector focus is not returned to the activating node on close.** Focus
  moves *into* the panel on open (fixed), but on ✕/Esc it lands on `<body>`
  rather than the tree node that opened it (returning focus to a specific SVG
  `<g>` needs node-ref tracking). Non-modal panel, so not a blocker.
- **Inspector "Parents" lists every parent edge** (incl. non-biological/odd data
  — e.g. a Lemons sim shows 3 parents, one of them an unassigned-generation sim).
  `sims.getById.childOf` returns all parent relationships without type filtering;
  consider filtering to BIOLOGICAL/ADOPTIVE if that proves to be a data issue.
- **Sim portraits with a stale/missing `imageUrl` show a broken image** rather
  than falling back to the monogram (the Crest fallback only triggers on a
  *null* `imageUrl`). Surfaced by a Lemons-legacy sim whose DB `imageUrl` points
  at a file absent from the worktree's `public/uploads/`. Data/env issue, but a
  `<image onError>` → monogram fallback would harden it.
- **Keyboard focus on an off-screen tree node does not pan it into view.** The
  zoom controls are keyboard-operable, but focusing a node that's currently
  panned/zoomed out of frame won't bring it on-screen (SVG `<g>` has no
  `scrollIntoView`). A future enhancement could pan the viewport to a focused node.
- **No filter pill for null-generation ("GEN —") sims.** Sims without a
  generation appear in a trailing row but can't be isolated via the pills.
- **Skip-link focus management.** The link appears on Tab and scrolls to
  `#main-content`, but `<main>` lacks `tabindex="-1"`, so focus lands on `<body>`
  rather than moving into main (WCAG 2.4.1 met via anchor scroll, but focus
  management is incomplete).
- **E2E specs stale vs. the chronicle redesign (pre-existing).** 16 Playwright
  tests in `add-relationship-modal`, `add-sims-to-legacy`, `legacy-wizard`, and
  `sim-detail` assert against the *old* legacy page (e.g. a `"Sims"` heading now
  renamed "All sims"; a single `"Bella Goth"` link that now resolves to the
  hero/succession/milestone portrait links + roster card). These predate and are
  independent of this pass; the unit/integration suite is fully green.

---

## ⚠️ Known risks / notes
- **`next/image` remote hosts:** `next.config.ts` `remotePatterns` lacks
  `*.vercel-storage.com` (pre-existing); vercel-blob portraits would error in
  production. The chronicle uses portraits heavily, so the blast radius is larger.
- **Desktop-first layout:** the `200px 1fr` grid has no responsive breakpoint.
- **Italic monogram:** PortraitAvatar/Crest initials are italic per the handoff,
  which tensions with the "no italic for entity names" brand note. (The title's
  "Legacy" accent is upright.)
- **Local env gap:** the worktree's `public/uploads/` is empty, so the one
  uploaded portrait (Lana/Julia Lemons) 404s locally — resolves in environments
  that have the uploads.
