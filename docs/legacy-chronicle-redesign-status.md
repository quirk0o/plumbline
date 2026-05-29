# Legacy Chronicle redesign — status

**Branch:** `worktree-legacy-chronicle-redesign` (includes a merge of `master` through `5f69445`)
**Last updated:** 2026-05-29
**Source design:** `design_handoff_legacy_redesign/` (handoff README + JSX prototypes)

The legacy detail page (`src/app/app/legacies/[slug]/page.tsx`) was rebuilt from a
short hero + founder card + flat sim list + inline ReactFlow tree into a
**journal-style long-scroll "chronicle"** with an on-demand fullscreen family-tree
overlay. This document records what shipped, what was intentionally cut, and what
remains open.

---

## 🔀 Merged from `master` — 2026-05-29

`master` advanced 3 commits since this branch diverged; merged in cleanly
(auto-merged `src/server/routers/sims.ts`, no conflicts). What it brought:

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

Post-merge check: `tsc --noEmit` clean, `lint` clean, **384/385 tests pass**. The
one failure — `add-relationship-modal.test.tsx › "pre-selects the new sim in the
combobox after creation"` — is a **pre-existing master-side failure** (verified
failing on `master`@`5f69445` in the main checkout); it is unrelated to this
branch.

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

## ⛔ Not completed / deferred

### 1. Tree overlay visual match to the design (deferred)
The shipped overlay is functional but simplified: app nav + a plain header bar +
the tree on a plain background. The `AtlasLegacy` mock (`combined.jsx`) has a
**parchment dot-grid canvas, a floating glass title/back capsule (plumbob + title
+ "N sims · M generations"), drop-shadow ("lift") nodes, and a bottom legend**
(Heir / Sim / Marriage / Lineage). Not yet implemented.

### 2. Tree accessibility (open; belongs with the deferred tree work)
Full QA flagged three **Critical** a11y gaps, all in the tree overlay:
- Focus is **not trapped** in the dialog (shipped v1 without a full focus-trap).
- Tree nodes (`<g role="button">`) have **no visible focus ring** (CSS `outline`
  doesn't render on SVG groups — needs an SVG-native focus stroke).
- The `<svg role="img">` wrapper makes the tree **one opaque image to screen
  readers**, hiding the interactive nodes.

### 3. Contrast (token-level; app-wide decision)
`--text-subtle` labels (~2.18:1) and `--text-muted` blurbs (~3.88:1) fail WCAG AA
in both themes, pervasively. These are the exact tokens the handoff mandated;
remediation is a brand-token decision affecting the whole app, not the chronicle.

### 4. Smaller a11y polish (not yet done)
Skip-to-content link; `aria-label` on the top app nav; a few decorative bits
(`aria-hidden` on the succession connector / milestone marker / roster monogram);
sub-44px tap targets on the rail buttons (still pass the AA 24px minimum).

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
