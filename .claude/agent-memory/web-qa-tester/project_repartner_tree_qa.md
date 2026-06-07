---
name: repartner-tree-qa
description: QA results for lineage-tree descent-line fix when a sim re-partners — 2026-06-07 (to-flow-graph.ts fix)
metadata:
  type: project
---

## Fix verified: 2026-06-07

Scenario: Alpha (A) + Beta B1 → married, child Charlie C; then A–B1 partnership removed, A + Delta B2 added.

### PRIMARY FIX: PASS

- Before re-partnering (baseline): Charlie descends from A–B1 marriage bond midpoint via single line. CORRECT.
- After re-partnering: Charlie has TWO separate descent lines — one from Alpha (x=158) and one from Beta (x=498). Neither passes through the Alpha–Delta bond midpoint (x≈238). CORRECT.
- SVG path evidence: `M 158 208.5 V 117 H 158 V 25.5` (to Alpha) and `M 158 208.5 V 117 H 498 V 25.5` (to Beta).
- Charlie does NOT hang from Alpha–Delta bond. The amber bond renders normally. PASS.

### REGRESSION: PASS (via baseline)

- Baseline tree (Alpha+Beta still married, both parents of Charlie): single descent from bond midpoint. PASS.

### MINI TREE (Charlie's detail page): PASS

- Mini tree correctly shows Alpha and Beta as two separate nodes (no marriage bond between them — correct since bond was removed).
- Charlie has two descent lines forming a "V" shape up to both parents. PASS.

### INTERACTIVITY: PASS

- No console errors on tree page.
- Pan and zoom work (wheel: 100%→152%, drag pan verified by transform change).
- Fit button resets to 100%. PASS.
- Nodes clickable: Charlie, Alpha nodes open inspector correctly. PASS.
- Esc closes inspector. PASS.

### UNRELATED BUG FOUND

- `listRef is not defined` crash in `ComboboxRoot` (`src/components/ui/combobox/combobox.tsx:182`) — occurs when HMR fast-refresh fires while the sim detail page re-renders. Not related to tree fix. Stack: ComboboxRoot → IdentitySection → SimDetailClient → SimDetailPage. Triggered by concurrent file saves from other agents.

### Environment

- Test legacy: "Repartner Test Legacy" (slug: `repartner-test-legacy`)
- Sims: Alpha Simkin (founder, was married to Beta, now married to Delta), Beta Simkin (original partner, still Charlie's parent), Charlie Simkin (child of Alpha+Beta), Delta Newkin (Alpha's new partner)
- IDs: Alpha=cmq3fgh560004kuu5iwfw1tnr, Beta=cmq3fhxma0006kuu5rs3g9vjp, Charlie=cmq3fkry10008kuu5qyk78d73, Delta=cmq3fo3e9000bkuu58ye521gd

**Why:** Verifying fix in src/components/lineage-tree/to-flow-graph.ts — child of re-partnered sim must show two descent lines, not hang from new marriage bond.
**How to apply:** This is a completed fix verification; use scenario details to re-test if tree edge logic changes.
