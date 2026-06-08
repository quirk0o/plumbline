---
name: project-lineage-tree-tokens
description: Design token and amber usage patterns established in the lineage tree component (feat/lineage-layout-d3dag review)
metadata:
  type: project
---

The lineage tree uses `--amber` for four distinct visual roles, all sanctioned by the approved spec:

1. **Marriage bond line (MarriageEdge)** — solid amber for MARRIED/ENGAGED/PARTNER; dashed + opacity 0.7 for WIDOWED. In-row horizontal line only. Uses shared constants `AMBER_STROKE_WIDTH='1.5'`, `AMBER_DASH_ARRAY='4 3'`, `AMBER_DASHED_OPACITY=0.7`.
2. **Cross-generation bond line (BondEdge)** — routed amber polyline for cross-row current partners. Solid for MARRIED/ENGAGED/PARTNER, dashed for WIDOWED. Same shared constants as MarriageEdge.
3. **Union diamond** — 8×8px rotated amber span rendered by UnionNode when `data.diamond === true`. Diamond rule: only appears when a union node is a parents-to-children junction. Never on childless couples. CSS Module `.unionDiamond { background: var(--amber) }`.
4. **Gen pill** — amber border + `--amber-text` color in `.genPill` CSS Module class. Pre-existing.

Connector/edge lines (descent + coParent elbows) use `stroke="var(--border-bright)"` — the warm tan token, not green and not amber. `strokeWidth="1.5"` is hardcoded (not a constant) on descent/coParent edges — this is a pre-existing pattern, not introduced by this PR.

The `--amber-text` token (darker, AA-legible, #b45309 light / #fbbf24 dark) is used for gen pill text. The raw `--amber` token is used only for graphical/fill/stroke roles where legibility thresholds differ.

**Partnership milestone** — renders the string "Partnership" directly as the `kind` label in `milestone-row.tsx`. The `.kind` CSS class applies `text-transform: uppercase`, so it will display as "PARTNERSHIP" — visually consistent with Birth, Marriage, Death etc. No icon map exists; milestone kind is rendered as text only.

**formatStatus in add-relationship-modal + relationships-editor** — produces Title Case: "Dating", "Engaged", "Married", "Partner", "Ex Partner", "Widowed". This was a deliberate fix (old code left all-caps because `\b\w` on an uppercase string keeps the uppercase char). Combobox item CSS has no `text-transform`; only group headings are uppercased.

**Why:** The spec explicitly calls the diamond and bond a "lineage callout" for generational junctions and current-partner relationships. These are in the semantic space amber is reserved for.

**How to apply:** Future lineage features using amber must stay in this same semantic space (marking generational junctions, heir status, lineage milestones). Amber must never be used for UI chrome, navigation accents, or status indicators in the tree.
