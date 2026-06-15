---
name: lineage-relationships-qa
description: QA results for lineage-relationships feature (feat/lineage-layout-d3dag) — PARTNER status, cross-gen bonds, dashed widowed, descent-over-text, DATING no bond, Partnership milestone, regressions
metadata:
  type: project
---

PARTNER status was initially rejected by the server (stale Turbopack bundle from before the migration). After a fresh server start (rm -rf .next && npm run dev), PARTNER saves correctly with HTTP 200. The Prisma client already had PARTNER; only the compiled route bundle was stale.

**Why:** The migration file timestamp (Jun 8 20:58) was after the last server bundle compile (Jun 7 22:19). Zod evaluates z.nativeEnum(RomanticStatus) at bundle-compile time. A fresh build resolves this without any code changes.

**How to apply:** If PARTNER status returns 400 in dev, restart the dev server (rm -rf .next is optional but safe). The e2e suite runs against a fresh build and should not hit this.

## Final test results (all 7 checks verified)

- Check 1 (PARTNER E2E save): PASS — fresh server accepts PARTNER, HTTP 200, romanticStatus:"PARTNER" in response, persists after reload
- Check 2 (cross-gen PARTNER bond): PASS — single amber polyline routes from Gen I to Gen III around Gen II crest; child descends from hanging union (diamond) at lower parent
- Check 3 (dashed WIDOWED bond): PASS — stroke-dasharray="4 3" and opacity=0.7 applied to WIDOWED bond path; visually confirmed dashed and faded
- Check 4 (descent-over-text): PASS — visual inspection on multi-gen tree shows no descent lines crossing sim name/life-stage text
- Check 5 (DATING no bond): PASS — DATING relationship saved fine; confirmed no bond line rendered
- Check 6 (Partnership milestone): PASS — "PARTNERSHIP / Alma Founder partners with Elias Cross" entry appears in chronicle; title format correct
- Check 7 (MARRIED regression): PASS — amber bond between Alma+Bruno renders correctly

## Cross-gen bond layout constraint (important)

The `listDrawableBondPairs` function filters cross-gen bonds to only sims in single-member clusters (no same-row partner). If a sim is already in a couple cluster (e.g., MARRIED to a same-gen partner), the cross-gen bond to that sim will NOT be rendered as a polyline bond. To get a drawable cross-gen bond, at least one partner must be a single-member cluster (unmatched in the greedy same-row matching).

Example: Alma MARRIED to Bruno → Alma is in a couple cluster → Alma+Elias cross-gen bond is NOT drawn. Clara (no same-gen partner) PARTNER with Elias → Clara and Elias are both single clusters → bond IS drawn.

## Pre-existing accessibility issues logged (not regressions of this feature)

- `role=application` missing aria-label (WCAG 4.1.2 fail — same as prior sessions)
- Focus after inspector close goes to document.body not the triggering node button (WCAG 2.4.3 fail)
- Tab escapes AddRelationshipModal — focus reaches elements outside the dialog (WCAG 2.1.1 fail)
- Focus not returned to trigger button after modal close (WCAG 2.4.3 fail)
- Dialog missing aria-describedby pointing to a real element
- sim-inspector.tsx line 149: always renders Partner label regardless of actual status
- Legend label says "Marriage" only — stale when PARTNER bonds are rendered
- Fit button functionally broken (zoom stays at 100%)
- Gen I label clips behind toolbar on tree load
