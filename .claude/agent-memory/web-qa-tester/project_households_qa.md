---
name: project-households-qa
description: QA findings from 2026-06-05 review of the Households section against design prototype
metadata:
  type: project
---

# Households QA — 2026-06-05

## Key structural deviations vs design prototype

**"Found a Household" dialog is a right-side panel, not a centered modal.**
Design spec: `position: fixed, display: flex, alignItems: center, justifyContent: center` (centered). App: right panel from x:820 to x:1280.

**Why:** Possibly the founding dialog was intentionally changed to match the drawer pattern, or it was an oversight.
**How to apply:** Flag in future QA sessions. This is the most significant visual deviation.

## Known bugs

1. Avatar label text "DinaUnhoused" / "DinaThe Caliente Household" — no space separator between sim first name and household name in the "Move sims in" picker.
2. Pressing Enter in the household rename input inside the management drawer appeared to also re-open or leave open the "Found a household" dialog (multi-dialog state observed with 7 dialogs in DOM). Needs investigation.
3. Compact card uses `div[role=button]` — no branded focus ring, only browser default blue outline.

## Visual matches

- Featured card: 2:1 grid split (633px:317px), 32px Cormorant Garamond title, parchment stat rail (#faf7f0 bg), §green funds, amber Gen I Founded — all match design.
- Section heading: "WHERE THEY LIVE" eyebrow + "Households" h2, correct.
- "Found a household" CTA: green primary button, uppercase lettered, plus icon — matches.
- Now Playing pill: green glow bg, plumbob icon — matches.
- Compact card: 19px Cormorant Garamond name, §green funds, "Manage →" link, "Empty lot" italic — matches.
- Drawer header: parchment bg, editable name (button → input on click), inline world/lot selects, editable italic description placeholder.
- Drawer body: white bg, centered 3-stat grid (green funds, amber founded), gem divider, resident rows with Move-to chip, ghost Move-a-sim-in row — all match design.

## Dark mode

- Greens and ambers legible on dark surface.
- The drawer body (bg-card) blends with page background in dark mode — the parchment-to-white section split is reduced because bg-card is very dark. No pure black/white surfaces, but the two-zone drawer split loses visual differentiation.

## Behavior checks passed

- Rename via Enter persists, reflected in compact card immediately.
- Escape cancels rename (reverts to previous name).
- Funds edit via click persists.
- Set as active swaps featured card.
- Move sim to Unhoused: resident removed, empty lot state shown correctly.

## Related memories

[[sim-detail-page-visual-qa]]
