# Family Tree Rendering — Design Spec

**Date:** 2026-05-18

## Context

SimsTrack currently shows a sim's relationships as a flat card grid in the relationships editor. There is no way to see the family structure at a glance — who are a sim's grandparents, which children came from which relationship, how generations connect across a legacy. This spec defines how to add interactive family tree visualisation.

---

## Library Choice

**`@xyflow/react` v12 + `@dagrejs/dagre`** — both MIT licensed, both actively maintained.

- `@xyflow/react` v12.10.2: React 19 compatible, pan/zoom built in, custom node components, official React Flow recommendation.
- `@dagrejs/dagre` v3.0.0: React Flow's own recommendation for tree layouts ("if you need to organize your flows into a tree, we highly recommend dagre"). Published 2 months ago.

Rejected alternatives:
- **ELK.js**: React Flow explicitly discourages it ("complexity makes it difficult for us to support"). ~1MB WebAssembly bundle.
- **entitree-flex**: GPL v3 license (not MIT). Honorable mention in React Flow docs, but licensing is a blocker.
- **react-family-tree**: Abandoned — last published 4 years ago, 2 dependents.
- **BALKAN FamilyTreeJS**: Commercial paid software.

---

## Scope

Two surfaces:

1. **Mini tree** — a section on the existing sim detail page showing ±2 generations around the focused sim.
2. **Full tree** — a "Family Tree" section on the existing legacy page (`/app/legacies/[slug]`), below the Sims section, showing all sims in the legacy.

Both are **read-only visualisation + navigation** only. Editing relationships stays in the existing relationships editor.

---

## Layout Algorithm

Dagre is given only **parent→child edges** (no partner edges, no junction nodes). It computes both x and y positions naturally — multiple parents of the same child end up in the same layer, children in the next. No y-position override needed.

After Dagre runs, **partner edges** are added as plain React Flow edges between the two sim nodes. Because partners are typically in the same generation, they share the same y-coordinate and the edge renders as a horizontal dashed line. This is the same approach used by production family trees built on React Flow.

**Step-parents** are excluded from the Dagre graph entirely. They remain visible in the relationships editor but do not appear in the tree.

A sim with children from multiple partners is handled correctly without any special logic: each parent→child edge is in Dagre's graph. Children of Mortimer+Bella have edges from both Mortimer and Bella; children of Mortimer+Dina have edges from both Mortimer and Dina. Dagre positions them as separate sub-trees under Mortimer.

---

## Component Structure

### New files

```
src/components/family-tree/
  FamilyTree.tsx          ← React Flow wrapper (shared by both surfaces)
  SimNode.tsx             ← custom node: portrait + name, click to navigate
  useTreeLayout.ts        ← transforms relationship data → Dagre → React Flow nodes/edges
  tree-utils.ts           ← pure functions: buildDagreGraph, buildPartnerEdges

src/app/app/legacies/[slug]/sims/[id]/
  family-tree-mini.tsx    ← 3-gen focused view, added to sim-detail-client.tsx

src/app/app/legacies/[slug]/
  legacy-tree.tsx         ← client component: full-legacy React Flow canvas + minimap
```

### Modified files

```
src/server/routers/sims.ts                                        ← add getTreeData procedure
src/app/app/legacies/[slug]/page.tsx                              ← add Family Tree section
src/app/app/legacies/[slug]/sims/[id]/sim-detail-client.tsx       ← add mini tree section
```

---

## SimNode

- **Size**: 100px wide × 80px tall
- **Portrait**: 48px circular avatar (sim image if available, else initials on `--green` background)
- **Name**: truncated, below portrait
- **Focus state** (mini tree only): green border + soft glow on the current sim
- **Click**: `router.push(/app/legacies/[slug]/sims/[id])`
- **Handles**: top (receives child-of edges) + bottom (emits parent-of edges)

## Edges

| Type | Style |
|------|-------|
| Parent → child | Vertical, solid, `--border` color |
| Partner ↔ partner | Horizontal, dashed, `--border` color |

---

## Mini Tree (sim detail page)

- Shows: grandparents → parents + their partners → focused sim + siblings + focused sim's partners → focused sim's children (4 generation levels: 2 above, the sim's own, 1 below)
- Fixed height: ~280px
- No minimap
- Starts fitted to viewport
- Data: `getById` already returns the sim's parents and children. Grandparents are fetched by following each parent's `childOf` relation — add one level of nesting to the existing `getById` include (no new procedure needed).

## Full Tree (legacy page section)

- Rendered as a `<section>` on the existing `/app/legacies/[slug]` page, below the Sims section
- Fixed height canvas (~500px), pan/zoom, minimap (bottom-right)
- Implemented as `legacy-tree.tsx` — a client component that fetches via tRPC client-side
- Data: new `sims.getTreeData({ legacySlug })` procedure

---

## New tRPC Procedure: `sims.getTreeData`

```ts
// src/server/routers/sims.ts
getTreeData: protectedProcedure
  .input(z.object({ legacySlug: z.string() }))
  .query(async ({ ctx, input }) => {
    // Returns all sims in the legacy with:
    // - id, name, imageUrl, generationNumber
    // - FamilyRelationship[] filtered to type IN [BIOLOGICAL, ADOPTIVE] — STEP excluded server-side
    // - SocialRelationship[] where romanticStatus != NONE
  })
```

Single Prisma query using nested includes — no N+1.

---

## Testing

### Unit tests (`tree-utils.ts` — pure functions)

- One couple + two children → two parent→child edges per child, one partner edge between the couple
- Sim with children from two partners → correct edges to each set of children, two partner edges
- Single parent → one parent→child edge per child, no partner edge
- STEP relationships excluded from Dagre graph
- Child with both biological and adoptive parents → edges from both parents included

### Integration tests (`useTreeLayout`)

- 3-generation family: children always positioned at a greater y than their parents
- No two sim nodes overlap (bounding box check)
- Partner nodes share the same y-coordinate

### Manual verification

1. Navigate to `/app/legacies/[slug]` and scroll to the Family Tree section — all sims render, pan/zoom works, clicking a node navigates to the sim detail page
2. Sim with two known parents: mini tree shows grandparents, parents, siblings correctly
3. Sim whose parent has children from multiple partners: correct edges, children visually distinct per family
4. Founder (no parents): mini tree shows only descendants
5. `npx tsc --noEmit` and `npm run lint` — zero errors
