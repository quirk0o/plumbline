---
name: lineage-layout-qa
description: QA results for feat/lineage-layout-d3dag — d3-dag rewrite, hanging unions, widowed bonds, separate family trees — 2026-06-08
metadata:
  type: project
---

## Test Date: 2026-06-08
## Branch: feat/lineage-layout-d3dag (gitbutler/workspace)

### Legacies tested
- `lemons` (beata@obrok.eu): 8 sims, Gen I–III + Gen — shelf. Has re-partnering (Lana MARRIED Todd Summer, EX with John Winters; Alicia's parents are Lana + Jared Lemons — not Todd).
- `repartner-test-legacy` (beata@obrok.eu): 7 sims, inverted test data (null-gen sims are parents of Gen I sims).
- `khj` (beata@obrok.eu): 10 sims, 4 generations + Gen —. Has WIDOWED couple (kjh khg + jgf try).

### CORE FEATURES STATUS

**Hanging unions (re-partnered parents): PASS**
- Lemons tree: Alicia's parents (Lana + Jared) are connected via hanging union at midpoint x of Lana+Jared. Co-parent elbows correctly go from each parent's bottom down-then-across to the diamond.
- Diamond at hanging union with `data-testid="union-diamond"` and `aria-hidden="true"`.
- Descent from hanging union to child Alicia confirmed by path data: `M 328.5 118.5 V 152 H 368.5 V 185.5`.
- No descent from the incorrect Lana+Todd bond to Alicia.
- Alicia's mini tree (detail page) correctly includes the Lana+Jared co-parent hanging union.

**Diamond rule: PASS**
- Childless widowed couple (kjh + jgf in khj): no diamond, no union node ✓
- Married couple with children (hfa + tresgfd in khj): diamond ✓
- Co-parent union (kjh + jgvj in khj): diamond ✓
- Single parent Alicia: no diamond ✓

**Widowed bond: PASS**
- WIDOWED bond has `stroke-dasharray: 4 3` (dashed).
- MARRIED bond has `stroke-dasharray: none` (solid).
- Both use amber color.

**EX_PARTNER bond: PASS**
- John Winters (Lana's EX_PARTNER) in Gen I row with no bond line rendered. No co-parent union (no shared children). Correctly invisible per spec.

**Generation rows: PASS**
- Rows aligned: Gen I at y=24 local, Gen II at y=184, Gen III at y=344, Gen — at y=504 (ROW_PITCH=160px).
- Gen labels (GEN I, GEN II, GEN III, GEN —) correctly positioned at row y with `aria-hidden="true"`.
- Null-gen sims (John Lemons, Adaś Zima) correctly in Gen — shelf row.

**Adjacent couple placement: PASS**
- Lana (x=88) + Todd (x=248) side by side with amber bond ✓.
- Jared (x=429) separately positioned to the right ✓.

**Accessibility (edges/diamonds): PASS**
- All edge elements have `aria-hidden="true"`.
- Union nodes have `aria-hidden="true"`.

**Keyboard navigation: PARTIAL PASS**
- All 8 sim buttons reachable by Tab in logical order ✓.
- Enter key opens inspector, focus moves to Close button ✓.
- Escape closes inspector ✓.
- Focus does NOT return to triggering sim button on close (goes to BODY) — BUG.

### KNOWN BUGS FOUND

**BUG 1 (High): Fit button restores to 100% zoom, does not actually fit tree to viewport.**
- Clicking Fit always returns to 100% regardless of content size.
- Gen I row sims are partially clipped behind the legacy capsule toolbar at 100%.
- Carried over from prior QA session — still unfixed.

**BUG 2 (High): Gen I nodes overlap with the legacy capsule toolbar at default 100% zoom.**
- Canvas top is y=48; capsule extends from y=64 to y=124; first sim nodes start at y=99.
- Lana Lemons portrait clipped behind capsule. GEN I label (at y=102) hidden by capsule.
- Direct consequence of Fit bug — proper Fit would resolve both.

**BUG 3 (Medium): Focus not returned to triggering node after inspector closes.**
- Both Escape and X button close paths return focus to BODY, not to the sim button.
- WCAG 2.4.3 violation.
- Carried over from prior QA session — still unfixed.

**BUG 4 (Medium): `role="application"` has no accessible name.**
- The ReactFlow wrapper has `role="application"` but no `aria-label` or `aria-labelledby`.
- WAI-ARIA requires `role="application"` to have an accessible name.
- WCAG 4.1.2 violation.

**Visual note (Low): Hanging union diamond appears near Todd Summer's position.**
- At 100% zoom in the lemons tree, the Lana+Jared co-parent diamond appears visually adjacent to Todd Summer's node (because Jared is placed to Todd's right, making the Lana+Jared midpoint land near Todd).
- Could be misread as a Lana+Todd child connection. Inherent layout challenge, not easily fixable without different node spacing.

**Mini tree on Lana's detail page: Jared omitted.**
- Lana's own mini tree only shows her as a solo parent of Alicia (no co-parent union).
- This may be by design (mini tree scoped to sim's direct connections), but misrepresents Alicia's parentage from Lana's view.
- Alicia's own mini tree correctly shows the Lana+Jared co-parent union.

### PASSED CHECKS
- Pan and drag: working ✓
- Zoom in/out buttons: working ✓
- Dark mode: tree renders correctly, contrast passes (stage text 7.01:1, name 15.91:1) ✓
- Light mode contrast: stage text 5.28:1 (pass), name text 15.09:1 (pass) ✓
- Node click opens inspector ✓
- Inspector shows correct partner (Todd Summer, not John Winters) ✓
- Open profile link navigates to correct URL ✓
- Search/highlight: working ✓
- Generation filter buttons: working ✓
- No console errors on tree pages ✓
- Separate components (John Lemons, Adaś Zima): correctly in Gen — shelf ✓
- Null-gen partner inference (no data for this scenario, but spec-correct for shelf) ✓

**Why:** QA session for feat/lineage-layout-d3dag branch to verify d3-dag layout rewrite correctness.
**How to apply:** Use as baseline for re-test after Fit button and focus-return fixes. Widowed/childless/co-parent diamond rules all verified correct.
