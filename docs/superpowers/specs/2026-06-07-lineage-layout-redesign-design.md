# Lineage Tree Layout Redesign — Design Spec

**Date:** 2026-06-07
**Status:** Approved
**Scope:** Replace the position-calculation internals of the lineage tree layout with a
d3-dag (Sugiyama) pipeline. The React Flow rendering layer is extended, not replaced.

## Problem

`src/components/lineage-tree/layout.ts` hand-rolls generation-row placement: greedy
left-to-right cluster placement plus a best-effort "center children under parents" pass
that only shifts nodes when nothing overlaps. It cannot minimize edge crossings, drops
all but one partner per sim ("first partner wins" — which can pick an ex over the
current spouse), and produces broken positions on non-trivial families.

## Requirements (user-stated)

1. Children connect to their actual parents — both of them.
2. A parent's new partner (not the child's parent) is also connected; children still
   link to their real parents, never the step-partner.
3. Generation = row, preserved strictly.
4. Sims with no generation number and no connections get a dedicated place.
5. Sims in a generation with no connections in that row still render in that row.
6. Separate family trees (disconnected components) are drawn separately but conform to
   the same global generation rows.
7. All other current layout functionality is preserved (gen labels, orphan visibility,
   deterministic output, viewBox sizing, focus/zoom behavior, a11y).

## Decisions (clarified with user)

| Topic | Decision |
| --- | --- |
| Adjacency ("current partner") | One adjacency slot per sim. Partner edges ranked `MARRIED > ENGAGED > DATING > WIDOWED`; top-ranked same-row partner sits adjacent with a bond line. `EX_PARTNER` is never adjacent. |
| Widowed couples | Stay adjacent with their bond, rendered dashed/faded. |
| Ex/other co-parents | Connected only through shared children via below-row "hanging unions". No arcs, no ghost duplicate nodes. |
| Childless ex bonds | Not rendered at all. |
| 3+ partners | One adjacency slot per sim — only the top-ranked current partner sits adjacent with a bond. All remaining partners connect via hanging unions (if they share children) or not at all. |
| Diamond rule | The amber diamond marks a parents-to-children junction, and nothing else. Couples with children: diamond on the bond, descent from the diamond. Childless couples: plain bond line, no diamond, no union node. Hanging unions: diamond at the junction below the row. |
| Null-generation sims with a generation-bearing partner | Sit in that partner's row. Single pass, partner-only — no chained inference through other null-gen sims, no child/parent fallbacks (revised from full inference for simplicity; the common case is a townie spouse). |
| All other null-generation sims | Trailing "shelf" row at the bottom (today's behavior). A visible nudge to set the generation in the data. |
| Component arrangement | Side by side, left to right, separated by `COMPONENT_GAP` (wider than the in-row cluster gap), all aligned to global generation rows. |
| Layout engine | `d3-dag` v1.2.x (MIT, pure JS, synchronous). Chosen over dagre because custom layering pins clusters to generation rows by construction — dagre derives ranks per component and cannot pin them, which violates requirement 6. Chosen over elkjs for bundle size and config complexity. |

## Architecture

### What stays

- `to-flow-graph.ts` adapter pattern, crest medallion nodes, 1×1 union nodes (with the
  falsy-zero fixes from commit 27b0073), descent/marriage edge renderers, gen-label
  pills, focus-pan, zoom limits, a11y hiding of structural nodes.
- `computeLineageLayout` public signature and the `LineageLayout` output shape
  (extended, not changed).
- All layout constants: `NODE_WIDTH`, `NODE_HEIGHT`, `ROW_PITCH`, `CREST_ANCHORS`,
  `MARRIAGE_BOND_GAP`, `CLUSTER_GAP`, `ROW_LABEL_GUTTER`, `TREE_PADDING`.

### Layout pipeline (`layout.ts` internals)

1. **Sanitize** (preserved): drop self-edges, edges referencing unknown sims, dedupe.
2. **Row derivation:** distinct generation numbers, ascending → row indices. A null-gen
   sim with a generation-bearing partner sits in that partner's row (single pass, see
   Decisions). All other null-gen sims → shelf row appended last.
3. **Couple matching:** greedy maximum matching over partner edges, ordered by status
   rank then sim id, same-row pairs only. Produces 2-wide couple clusters and 1-wide
   singles.
4. **Cluster graph:** nodes = clusters with real widths (couple 300, single 140);
   edges = `clusterOf(parent) → clusterOf(child)`, deduped. Only edges with
   `parentRow < childRow` participate in layout; degenerate edges (same-row or
   inverted parent-child from manually edited generations) still render but do not
   constrain ordering. This also makes engine-level cycles impossible by construction.
5. **d3-dag per component:** `graph.split()` → per component,
   `sugiyama()` with a custom `Layering` that assigns each cluster its pinned row
   index, `decrossTwoLayer()`, and a callable `nodeSize`. Only x-coordinates and
   within-row ordering are taken from the engine; y is always
   `rowIndex × ROW_PITCH`, assigned by us — this guarantees strict global row
   alignment across components.
6. **Component banding:** components ordered by (lowest row index, smallest sim id),
   placed left to right; each offset by the cumulative width of prior components plus
   `COMPONENT_GAP`. Shelf row spans the bottom across the full width.
7. **Hanging unions:** for each non-adjacent co-parent pair with shared children,
   place a union point below the parents' row. Multiple hanging unions under one row
   stack into lanes (`LANE_PITCH`) so horizontal runs never overlap.
8. **Emit:** existing `LineageLayout` fields plus a `hangingUnions` collection; union
   placements only for couples/co-parent pairs with children (diamond rule); viewBox
   math preserved.

### Rendering changes (`to-flow-graph.ts`, `flow-parts.tsx`)

- **Marriage edge variants:** solid amber for `MARRIED`/`ENGAGED`/`DATING`, dashed +
  faded for `WIDOWED`. Diamond only when the couple has children; childless couples
  render the plain bond line and get no union node.
- **Hanging unions:** reuse the existing 1×1 union node type at lane positions, with
  the diamond rendered at the junction. Two new co-parent elbow edges connect each
  parent's bottom handle to the union; the union-to-child edge is the existing descent
  edge.
- **No arcs, no duplicate medallions.** Crest nodes untouched.

### API change (`src/server/routers/sims.ts`)

`getTreeData` and `getMiniTreeData` add `romanticStatus` to the social-relationship
select and include it on `partnerEdges`. Type updates ripple to
`src/app/app/legacies/[slug]/lib/types.ts` and `LineagePartnerEdge`. No schema change.

## Determinism & resilience

- All tie-breaks by sim id; component order by (lowest row, smallest sim id);
  `decrossTwoLayer` is deterministic for identical input order. Same data → same
  picture, always.
- Cycles impossible at the engine boundary (edge filter in step 4).
- Existing sanitization and orphan-visibility behavior carries over.
- d3-dag is synchronous, pure JS; no worker needed at legacy scale (hundreds of sims).

## Testing

Per the Testing Trophy, integration-level tests against the public layout API:

- `layout.test.ts` rewritten around scenarios: remarriage (ex + current spouse), 3+
  partners, widowed adjacency, childless-ex invisibility, component row alignment,
  partner-row placement for null-gen spouses, shelf row, connectionless sims within a generation,
  determinism (run twice, deep-equal), and a no-overlap invariant (no two medallions
  in any row intersect).
- `to-flow-graph.test.ts` extended for hanging-union nodes/edges and the diamond rule.
- Tests encoding "first partner wins" updated to the ranking rule.
- Existing e2e lineage specs must keep passing. Final gate: `npx tsc --noEmit`,
  `npm run lint`, `npm test`, `npm run test:e2e`, plus design-system-reviewer and
  web-qa-tester agents (UI change), per AGENTS.md.

## Related in-flight work

- Branch `fix/tree-descent-split-parents` (commit 3911cea, stacked on
  `feat/lineage-tree-xyflow`) patches the same re-partnering bug at the rendering
  layer by drawing per-parent descent lines when parents are not the adjacent couple.
  **Decision (user):** this work supersedes that branch — the implementation stacks
  on top of it and replaces its per-parent descent rendering with hanging unions.
- Branch `feat/kinship-labels` (spec-only, not in progress) will be stacked on top of
  this work once it lands.

## Out of scope

- Manual node repositioning / drag-to-rearrange.
- Rendering changes to crest medallions themselves.
- Storing layout positions in the database.
- STEP family relationships in the tree (the tree query already filters to
  BIOLOGICAL + ADOPTIVE; unchanged).
