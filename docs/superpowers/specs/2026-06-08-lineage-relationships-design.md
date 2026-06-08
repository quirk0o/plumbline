  # Lineage Tree — Inter-Generational Bonds, PARTNER Status & Line Hygiene

**Date:** 2026-06-08
**Status:** Approved
**Builds on:** `2026-06-07-lineage-layout-redesign-design.md` (the d3-dag layout, already
implemented on `feat/lineage-layout-d3dag`). This spec amends that design; everything
in it not mentioned here stays as built.

## Why

Two problems surfaced after the d3-dag layout shipped on the branch:

1. **Cross-generation partnerships render as broken.** When two *current* partners are
   in different generation rows (e.g. an heir partners with someone a generation up),
   no bond is drawn and the shared child falls back to per-parent descent lines that
   span rows and cross other crests. It reads as broken.
2. **Relationship vocabulary is too thin / casual.** "Dating" is the only non-formal
   romantic status and it reads as temporary. Players want a committed, non-married
   **Partner** status that counts as a real union (and earns a milestone), while
   keeping casual Dating as a separate, lighter thing that does not clutter the tree.

A third, smaller polish item: descent lines that flow straight down out of a sim's
portrait currently cut through that sim's own name / life-stage text.

## Decisions

| Topic | Decision |
| --- | --- |
| New status | Add `PARTNER` to the `RomanticStatus` enum (committed, unmarried). `DATING` stays (casual). Prisma migration required; the enum value is `PARTNER`, displayed as "Partner" (the existing humanizer already yields that). |
| Relationship editors | Add `PARTNER` as an option in both status dropdowns (`add-relationship-modal`, `relationships-editor`). No relabel of `DATING`. |
| Tree bond set | A bond is drawn only for **MARRIED, ENGAGED, PARTNER, WIDOWED**. `DATING` is **removed** from the tree's bond/adjacency set (behavior change: today `DATING` draws a bond — it no longer will). `EX_PARTNER` and `NONE` draw nothing, as before. |
| Adjacency ranking | **MARRIED > ENGAGED > PARTNER > WIDOWED** for the single same-row adjacency slot. |
| Bond styling | Solid amber for MARRIED / ENGAGED / PARTNER; dashed + faded amber for WIDOWED. |
| Cross-generation current partners | Drawn as a **routed bond**: a current-partner edge whose two sims are in different rows becomes a multi-row edge fed to the layout engine, which reserves a clear vertical lane (the same dummy-node routing used for multi-row descent) so the bond never crosses crests or other lines. The couple's child descends from a **diamond on that bond**, at the lower partner's row. Solid/dashed by status as above. |
| Partnership milestone | Derive one milestone per unique `PARTNER` pair, mirroring the marriage rule: new milestone `kind: 'Partnership'`, title `"<A> partners with <B>"`, `gen` = min of the pair's generations, `sortOrder` = relationship `createdAt`, deduped by canonical pair. |
| Descent line vs. crest text | A descent/bond line that travels straight down through a crest's own name/life-stage band must not visibly cross the text. Knock the line out over that band via an **SVG mask on the edge or a transparent gap in the path** — NOT a hardcoded/opaque background (which breaks in dark mode and over the parchment dot-grid). The line resumes below the crest. |
| Inspector | Include `PARTNER` in the inspector's partner-status priority list so a committed partner surfaces. |

## What stays unchanged (from the 2026-06-07 design, already built)

- Strict generation rows; trailing shelf for unconnected null-generation sims.
- Same-row current partner → adjacent bond; couples cluster as one block.
- `EX_PARTNER` is never adjacent and draws no bond.
- Children of non-bond co-parents (exes, never-partnered co-parents) connect via a
  **descent junction with no relationship line** — same-row → hanging union, cross-row
  → per-parent descent lines.
- Diamond = parents-to-children junction only; childless couples = plain bond, no
  diamond, no union node.
- d3-dag pipeline, component banding, single-level-of-abstraction module structure.

## Architecture & component impact

### 1. Data model — `PARTNER` enum (migration)

- `prisma/schema.prisma`: add `PARTNER` to `enum RomanticStatus` (after `MARRIED`,
  before `EX_PARTNER` — placement is cosmetic).
- New migration `prisma/migrations/<timestamp>_add_partner_romantic_status/`. **Create
  it with a fresh, non-colliding timestamp** — other agents have concurrent migrations
  in the GitButler workspace; verify ordering before generating.
- No data backfill: existing rows keep their statuses.

### 2. Relationship editors — add the option

- `add-relationship-modal.tsx` and `relationships-editor.tsx`: add `RomanticStatus.PARTNER`
  to `ROMANTIC_STATUS_OPTIONS`. The local `formatStatus` humanizer already renders
  `PARTNER` → "Partner"; no relabel needed. (Optional cleanup: the two duplicated
  `formatStatus` helpers could move to a shared `formatRomanticStatus` in
  `@/lib/legacy-format` — do it only if cheap and in the way.)

### 3. Tree adjacency & bond set

- `layout-clusters.ts` `ADJACENCY_RANK`: becomes `{ MARRIED: 0, ENGAGED: 1, PARTNER: 2,
  WIDOWED: 3 }`. `DATING` is removed (so it is no longer an adjacency candidate and
  draws no bond); `EX_PARTNER` remains absent.
- `to-flow-graph.ts` marriage-edge styling: `dashed` for `WIDOWED`; solid otherwise —
  unchanged, and now `PARTNER` naturally renders solid.

### 4. Cross-generation routed bond (the main new mechanism)

The exact d3-dag modeling is for the implementation plan, but the shape is:

- A **current-partner edge whose two sims are in different rows** is not a same-row
  couple, so it is not clustered. Instead it becomes a directed edge in the cluster
  graph (higher-generation cluster → lower-generation cluster) so the Sugiyama engine
  routes it with dummy nodes through a reserved lane.
- The bond renders amber (solid/dashed by status). The child of the pair descends from
  a **diamond on the bond near the lower partner's row**, rather than via the
  per-parent fallback. (The per-parent fallback remains for ≥3-parent sets and for
  cross-row co-parents who are *not* a current couple, e.g. cross-gen exes.)
- Constraint: the routed bond must not cross crests or other edges — guaranteed by
  feeding it to the engine as a layered edge (crossing minimization + lane reservation),
  not by hand-routing.

### 5. Partnership milestone

- `lib/derive.ts`: add a block mirroring the marriage derivation (currently one entry
  per unique `MARRIED` pair). New block: one entry per unique `PARTNER` pair, deduped
  by canonical sorted pair key, `kind: 'Partnership'`, `title: "<A> partners with <B>"`.
- `lib/types.ts`: extend the `Milestone.kind` union with `'Partnership'`.
- Any UI that switches on milestone `kind` (icons/labels) must handle `'Partnership'`
  (e.g. reuse the marriage/heart treatment or a distinct one — pick during
  implementation; default to the marriage icon if a dedicated one is overkill).

### 6. Descent line vs. crest text (mask / gap)

- `flow-parts.tsx` `DescentEdge` (and the new cross-gen bond edge): where the line
  travels down through the source crest's name/stage band, knock it out. Prefer a
  **transparent gap in the path** (two segments around the band's y-range) for
  simplicity; fall back to an **SVG `<mask>`** on the edge if a visually continuous
  "behind the text" read is preferred. The band's y-range is a fixed offset/height
  within the 90px crest (derive from `CREST_ANCHORS` / `NODE_HEIGHT`).
- Theme-proof: nothing is painted in the band, so light mode, dark mode, and the
  dot-grid all show through correctly. No background color or token is introduced.
- Only applies to lines that originate at a portrait and travel straight down
  (lone-parent descent, cross-gen bond). Couple bonds and descents routed in the gap
  between medallions are unaffected.

## Testing

Per the Testing Trophy — assert observable behavior, never internals.

- `layout-clusters.test.ts`: `PARTNER` is rankable and beats `WIDOWED`; `DATING` is no
  longer an adjacency candidate (no couple emitted for a Dating-only pair).
- `layout.test.ts`: cross-generation current partners produce a routed bond edge and a
  single child descent from it (no per-parent fallback); cross-gen *ex* co-parents
  still fall back to per-parent lines.
- `to-flow-graph.test.ts`: a cross-gen current couple emits the bond + diamond + one
  descent; `DATING` pair emits no marriage edge; `PARTNER` pair emits a solid bond.
- `flow-parts.test.tsx`: the descent path has a gap (or mask) spanning the crest text
  band; couple-gap descents are unaffected.
- `derive.test.ts`: a `PARTNER` pair yields exactly one `'Partnership'` milestone with
  the right title/gen/dedup; `MARRIED` still yields `'Marriage'`; a pair that is both
  (shouldn't happen) is deduped sanely.
- `sims.test.ts` / router tests: `PARTNER` flows through `getTreeData` / `getMiniTreeData`
  partner edges (it is a non-NONE status, already included).
- E2E: a relationship-editor journey can select "Partner"; existing journeys still pass.
- Final gates per AGENTS.md: `tsc`, `lint`, `npm test`, `npm run test:e2e`, plus
  design-system-reviewer and web-qa-tester (UI changed).

## Out of scope

- No change to `EX_PARTNER` handling (still no bond; children via descent junction).
- No re-anchoring of the same-row hanging-union midpoint (the separate known
  limitation where a co-parent's spouse can sit between the co-parents) — tracked
  independently; not part of this spec.
- No drag/reposition, no DB-stored layout positions.
