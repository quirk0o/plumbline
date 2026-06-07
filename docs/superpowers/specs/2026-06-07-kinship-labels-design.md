# Kinship Labels on the Lineage Tree — Design Spec

**Date:** 2026-06-07

## Context

Every crest in the lineage tree shows the sim's life stage as its caption
(`crest-flow-node.tsx`). When a sim is selected in the Tree Atlas, the
selection highlights the medallion and opens the inspector, but the rest of
the tree gives no sense of *how everyone relates to the selected sim*. This
spec adds kinship labels: with a sim selected, other crests swap their
life-stage caption for a relationship term computed relative to that sim —
"Mother", "Grandfather", "First cousin", "Sister-in-law".

## Scope

Two surfaces, both already rendering through the shared `LineageFlow`
component with the same inputs (`sims`, `familyEdges`, `partnerEdges`):

1. **Tree Atlas** (`/app/legacies/[slug]/tree`) — labels appear while a sim
   is selected (`selectedId`), and revert to life stages on deselect.
2. **Mini tree** (sim detail page) — labels are always on, relative to the
   page's sim, which is the tree's fixed focus.

Read-only display change. Partner labels (wife, fiancé, divorced, widow…)
are derived from the relationship data, which is reshaped by its prerequisite
spec, [Romantic Status Model Redesign](2026-06-08-romantic-status-model-design.md):
partner edges carry `romanticStatus` (the bond) + `endedAt`, and tree sims
carry their deceased signal. This spec consumes `deriveRomanticState` from
that work; it adds no schema of its own.

## Architecture

### New pure module: `src/components/lineage-tree/kinship.ts`

```ts
computeKinshipLabels(
  focusId: string,
  sims: KinshipSim[],            // { id, gender, isDeceased }
  familyEdges: LineageFamilyEdge[],   // parent → child (biological + adoptive)
  partnerEdges: { simAId: string; simBId: string; romanticStatus: RomanticStatus; endedAt: Date | null }[],
): Map<string, string>           // simId → label; absent = no relation
```

Pure, deterministic, no React, no DOM — same character as `layout.ts` and
`to-flow-graph.ts`. Biological and adoptive edges are treated identically
(step edges never reach the tree data).

### Algorithm

1. **Adjacency.** Build `parentsOf`, `childrenOf` from `familyEdges`;
   `partnersOf` from `partnerEdges`.
2. **Blood relations.** From the focus sim, find for every reachable sim the
   shortest *(up, down)* path — `up` steps to a common ancestor, then `down`
   steps to the relative. Implemented as: BFS upward from the focus recording
   ancestor depths, then BFS downward from each ancestor recording descendant
   depths; each sim keeps the minimal (up + down) pair. Ties prefer direct
   lines (pure-up or pure-down) over collateral paths.
3. **Term mapping** — see vocabulary table below.
4. **Partner layer**, applied after blood relations and never overwriting
   them. Each partner edge is first reduced to a `RomanticState` via
   `deriveRomanticState(romanticStatus, endedAt, partnerDeceased)` (the
   labeled partner's `isDeceased` supplies `partnerDeceased`):
   - the focus sim's partner(s) → a label specific to the derived state
     (active / ended / widowed × bond — see partner vocabulary below)
   - **in-laws come only through a marriage that was never deliberately
     ended**: derivation follows edges whose derived state is a MARRIED
     `active` or `widowed` (widowhood = a marriage ended by death; in-law
     terms survive it). A MARRIED `ended` (divorce), and any ENGAGED or
     DATING edge, yield only the direct partner label and are never
     followed — a fiancé's mother, a girlfriend's brother, or an ex-wife's
     mother gets no kinship label and keeps showing life stage.
   - through such a marriage edge, the partner's blood relatives (one hop) →
     in-law of the corresponding term: Mother-in-law, Brother-in-law, …
   - blood relatives' married (active/widowed) partners → Daughter-in-law
     (child's wife), Sister-in-law (sibling's husband), etc. The same
     marriage-only rule applies in this direction: a child's girlfriend, or
     a child's ex-wife, is not "Daughter-in-law" and gets no label.
   - chains through two or more partner edges are not followed.
5. **No path, no partner link** → sim absent from the map → crest keeps
   showing its life stage.

Memoized on the focus id (`useMemo` keyed on `selectedId` + graph inputs):
O(sims + edges) per selection.

### Vocabulary

| (up, down) | FEMALE | MALE | NON_BINARY |
|---|---|---|---|
| (1,0) | Mother | Father | Parent |
| (2,0) | Grandmother | Grandfather | Grandparent |
| (3,0) | Great-grandmother | Great-grandfather | Great-grandparent |
| (n≥4,0) | (n−2)× great-grandmother | …grandfather | …grandparent |
| (0,1) | Daughter | Son | Child |
| (0,2) | Granddaughter | Grandson | Grandchild |
| (0,3) | Great-granddaughter | Great-grandson | Great-grandchild |
| (0,n≥4) | (n−2)× great-granddaughter | …grandson | …grandchild |
| (1,1) both parents shared | Sister | Brother | Sibling |
| (1,1) one parent shared | Half-sister | Half-brother | Half-sibling |
| (2,1) | Aunt | Uncle | Parent's sibling |
| (3,1) | Great-aunt | Great-uncle | Grandparent's sibling |
| (1,2) | Niece | Nephew | Sibling's child |
| (1,3) | Great-niece | Great-nephew | Sibling's grandchild |
| (m,m), m∈{2,3,4} | First / Second / Third cousin (all genders) | | |
| (m,n), m,n≥2, \|m−n\|∈{1,2} | Nth cousin once/twice removed (N = min(m,n)−1) | | |
| anything more distant | Distant cousin / Distant relative¹ | | |

¹ "Distant relative" when one leg of the path is ≥4 generations off the
collateral pattern (e.g. (5,1)); "Distant cousin" for deep symmetric paths.

**Partner vocabulary** (direct partner of the focus sim, by the derived
`RomanticState` `{kind, bond}`; gendered by the *labeled* sim's gender):

| State | FEMALE | MALE | NON_BINARY |
|---|---|---|---|
| active · MARRIED | Wife | Husband | Spouse |
| active · ENGAGED | Fiancée | Fiancé | Fiancé |
| active · PARTNER | Partner | Partner | Partner |
| active · DATING | Girlfriend | Boyfriend | Partner |
| widowed · MARRIED | Late wife | Late husband | Late partner |
| widowed · ENGAGED | Late fiancée | Late fiancé | Late partner |
| widowed · PARTNER | Late partner | Late partner | Late partner |
| widowed · DATING | Late girlfriend | Late boyfriend | Late partner |
| ended · MARRIED | Ex-wife | Ex-husband | Ex-spouse |
| ended · ENGAGED | Ex-fiancée | Ex-fiancé | Ex-partner |
| ended · PARTNER | Ex-partner | Ex-partner | Ex-partner |
| ended · DATING | Ex-girlfriend | Ex-boyfriend | Ex-partner |

`PARTNER` is a committed unmarried bond; its label is the gender-neutral
"Partner" / "Late partner" / "Ex-partner" across all genders. The `ended` row
carries the divorce/break-up distinction the new model makes possible: an
ended MARRIED bond is the only place "Ex-wife/Ex-husband" appears (a divorce
the data can now assert), while ended PARTNER/DATING/ENGAGED read as a plain
break-up. `widowed` labels the deceased partner from the living
focus sim's perspective ("Late husband"); when the focus sim is the deceased
one, the living partner is still labeled by the active bond ("Wife"), since
"Late wife" only fits a *dead* labeled sim.

In-law forms append "-in-law" to the gendered base term (Mother-in-law,
Son-in-law, Sister-in-law); NON_BINARY uses Parent-in-law / Child's spouse /
Sibling's spouse.

The compact "(n−2)× great-" prefix (e.g. "4× great-grandmother") keeps
captions short on the 140 px crest, per the agreed distance handling.

### Rendering changes

- `CrestNodeData` (`to-flow-graph.ts`) gains `kinshipLabel?: string`;
  `toFlowGraph` accepts `kinshipLabels?: Map<string, string>` in
  `FlowGraphOptions` and threads each sim's entry through.
- `CrestFlowNode` caption renders `kinshipLabel ?? lifeStageLabel`
  (still uppercased, same `styles.stage` slot). The accessible name becomes
  `"{name}, {kinship label}"` when a label is present, else the current
  `"{name}, {life stage}"`.
- **The focus sim itself keeps its life-stage caption** — it already has the
  selected/focused medallion treatment; a "Selected" caption is noise.
- `LineageFlow` computes the label map via the memoized hook when a focus id
  is active (`selectedId` in the Atlas, the page sim in the mini tree) and
  passes it to `toFlowGraph`.
- Interplay with search-dimming: dimmed crests still receive labels; the two
  states are independent.

## Error handling / edge cases

- **Cycles** (bad data, e.g. a sim accidentally its own ancestor): BFS visit
  sets make traversal terminate; labels still resolve from shortest paths.
- **Multiple paths** (intermarriage): shortest (up + down) wins; tie → direct
  line beats collateral.
- **Generation filter in the Atlas**: edges are pre-filtered to visible sims,
  so kinship is computed on the filtered graph — a sim whose connecting
  parent is filtered out simply shows life stage. Acceptable: the visible
  tree and the labels stay consistent with each other.
- **Multiple partners**: each gets its own derived-state label (e.g. one
  "Wife" and one "Ex-husband"); in-law derivation runs only through the
  married active/widowed edges among them.

## Testing

Trophy style — integration tests on the pure module plus one render-level
test; no trivial-function unit tests.

1. **`kinship.test.ts`** — one 4-generation fixture with re-partnering and
   an in-law branch, asserting the full label map for a chosen focus:
   grandparent, half-sibling vs full sibling, aunt/uncle, first cousin,
   first cousin once removed, niece, partner labels per derived state
   (active wife/boyfriend, ended ex-wife vs ex-girlfriend, widowed late
   husband), in-laws only through a married active/widowed edge (a divorced
   ex-wife's mother, a fiancé's mother, and a child's girlfriend get no
   label), mother-in-law, sibling's husband as brother-in-law, gendered vs
   NON_BINARY terms, compact "×great" form, unrelated sim absent from map,
   tie-breaking on intermarriage.
2. **Render test** (`lineage-flow.test.tsx` or atlas test): selecting a sim
   shows "MOTHER" on the right crest and restores the life stage on
   deselect; accessible name includes the kinship term.
3. Existing tree tests must stay green (no behavioural change with no focus
   id).

## Out of scope

- Step-relationships (excluded from tree data upstream).
- Labels in the SimInspector or relationships editor.
- Localisation of kinship terms.
