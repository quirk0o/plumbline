---
name: cross-gen-coparent-qa
description: QA of cross-generation co-parent junction routing fix — 2026-06-13; regression confirmed fixed on Kinship QA Test legacy
metadata:
  type: project
---

Cross-generation co-parent junction routing fix verified 2026-06-13 on the Kinship QA Test legacy.

**Why:** The bug caused co-parent connector lines to run straight down the child's column, painting through unrelated intervening medallions and making those sims appear to be children of the distant parent.

**How to apply:** The Kinship QA Test legacy is the canonical test family for this scenario. Use `Sam Kinship (Gen II) + Eva Kinship (Gen IV)` as co-parents of `Maya Kinship (Gen V)`, with `Leo Kinship (Gen III)` as the unrelated sim that formerly had a line drawn through it.

## Test family structure (Kinship QA Test legacy)
- Adam Kinship (Gen I) — married to Maya (Gen V), present as bond rectangle
- Sam Kinship (Gen II) — co-parent of Maya
- Leo Kinship (Gen III) — child of Adam? No — child of [someone]; parent of Eva; UNRELATED to Sam/Eva co-parentage
- Eva Kinship (Gen IV) — co-parent of Maya (with Sam), child of Leo
- Maya Kinship (Gen V) — heir, child of Sam+Eva

Canvas coordinates confirmed:
- Sam center: (158, 274); co-parent edge runs at x=158 — well LEFT of Leo/Eva (x=270-410)
- Co-parent line routes: Sam at x=158 straight down; Eva at x=340 down to junction; junction at (248.5, 758); single descent to Maya

## Results — PASS
- Single diamond junction at (248.5, 758) between Gen IV and Gen V: CONFIRMED
- Co-parent line from Sam runs at x=158, Leo/Eva are at x=270-410: DOES NOT INTERSECT
- Leo Kinship's mini tree shows only Leo→Eva parent-child, no ghost lines: CONFIRMED
- Leo's inspector shows no Adam relationship: CONFIRMED
- Eva shows "DAUGHTER" and Maya shows "GRANDDAUGHTER" from Leo's perspective: CONFIRMED
- Both Atlas and mini tree use identical edge paths: CONFIRMED

## Bond rectangle observation (non-critical)
The marriage bond between Adam (Gen I) and Maya (Gen V) renders as a tall amber rectangle from y=48 to y=868. Its right vertical edge (canvas x=382) and left edge (canvas x=271) both pass through the Leo (270-410, 434-524) and Eva (270-410, 639-729) x-ranges. Visually the lines graze the outer edge of the medallion circles. This is the BOND (marriage) edge type — NOT a co-parent line — and is expected behavior for a Gen I↔Gen V marriage spanning the whole tree height.

## Fit button (pre-existing issue)
Fit button does not reliably zoom to show all generations at all viewport widths. At 1280px width it leaves Gen I clipped; at 1920px it works correctly. Pre-existing issue.
