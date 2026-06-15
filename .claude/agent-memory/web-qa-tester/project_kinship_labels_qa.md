---
name: kinship-labels-qa
description: QA findings from 2026-06-10 kinship labels feature review (Atlas + mini tree)
metadata:
  type: project
---

Key feature findings from kinship labels QA:

**Feature works correctly (Atlas tree):**
- Labels compute and update on sim selection: HUSBAND, WIFE, MOTHER, FATHER, DAUGHTER, SON, GREAT-AUNT, GREAT-GRANDMOTHER, HALF-BROTHER, MOTHER-IN-LAW, FATHER-IN-LAW, BROTHER-IN-LAW all render correctly
- Selected sim keeps life stage (not a relationship term)
- Labels recompute immediately on sim switch without inspector close
- Deselect via Escape key reverts all labels to life stage
- Deselect via X button reverts all labels to life stage
- Keyboard Enter on a focused crest activates kinship labels
- Long labels (GREAT-GRANDMOTHER, GREAT-AUNT, HALF-BROTHER) render without overflow
- Accessible button names update to include relationship term (e.g., "Bruno Founder, Husband")
- Light mode contrast ~5.3:1, dark mode ~7.2:1 — both pass WCAG AA

**Bug: Mini tree vs Atlas kinship discrepancy for Elias Cross → Alma Founder:**
- Atlas tree (7 sims): Elias shows "HALF-BROTHER" from Alma's perspective
- Mini tree (6 sims, no Grace Cross): Elias shows "GRANDFATHER" from Alma's perspective
- Root cause: graph-based shortest-path finds different routes depending on which sims are included in the graph. The presence of Grace Cross changes which path is found.
- Test URL: http://localhost:3000/app/legacies/partner-qa-test-legacy/sims/cmq5nzwqt001dkuu5vatzkwh0 (Alma's detail page)

**Pre-existing a11y issues (not new to this feature):**
- application element has tabindex=-1 and no aria-label; tree crests unreachable via Tab from page start
- Focus not returned to crest button when inspector closed via keyboard
- application role missing aria-label (parent group has it, but application itself doesn't)

**Why:** The mini tree loads only sims related to the page sim, which is a subset of the full tree. The kinship path algorithm finds different shortest paths depending on the available graph nodes.

**How to apply:** When reviewing kinship computation bugs, check whether the issue is a graph-subset problem (mini tree vs Atlas) or a pure computation error.
