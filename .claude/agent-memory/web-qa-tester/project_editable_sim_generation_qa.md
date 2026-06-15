---
name: editable-sim-generation-qa
description: QA findings from 2026-06-10 review of the editable-sim-generation feature on sim detail pages
metadata:
  type: project
---

QA completed 2026-06-10. Generation control on sim detail pages (`/app/legacies/<slug>/sims/<id>`).

**Passing behaviors:**
- Root sim (no parents in family_relationships as child): shows editable chip-dropdown "Gen I" style button with chevron. Persists after reload.
- Derived sim (has a "Parent · Biological" entry in relationships): shows read-only SPAN with "Gen IV" text, no chevron, tabIndex -1, cursor auto.
- Escape from dropdown returns focus to trigger button.
- Unset generation shows "Select..." button with aria-label="Generation".
- Gen I–X options all present in dropdown.
- Contrast passes WCAG AA in both light and dark modes.
- Focus ring is visible on the editable chip (green box-shadow).
- Family tree shows "GEN —" for unassigned generation sims.

**Known issues found:**
1. Combobox search field aria-labelledby points to an empty hidden label element — no accessible name on the search input when dropdown is open (pre-existing combobox pattern issue, see [[romantic-status-qa]]).
2. Editable Gen button accessible name is just "Gen I" (the current value), not "Generation: Gen I" — screen readers lose the field label once a value is set. The unset state correctly has aria-label="Generation".
3. Dark mode chip border `rgba(255,255,255,0.08)` may fail WCAG 3:1 for UI component contrast — not verified with calculator but visually very faint.

**Why:** Tracking these issues for future fixes; issues 1 and 2 are consistent with other combobox chips on the page (aspiration, career pattern shared).

**How to apply:** When QA-ing other combobox-style chips, expect the same aria-label-drop pattern when a value is selected.
