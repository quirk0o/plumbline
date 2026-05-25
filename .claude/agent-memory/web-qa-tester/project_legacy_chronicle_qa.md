---
name: legacy-chronicle-qa
description: Known issues from QA pass of the legacy-chronicle-redesign branch, tested 2026-05-25
metadata:
  type: project
---

Scroll-spy never activates the "Family" nav item even when scrolled to the bottom. The sims section (id=sims) at ~1152px is below the max scroll position (~787px at 1507px page height / 720px viewport), which means it can never reach the intersection threshold — the scroll-spy needs a "last section always wins at scroll-end" fallback.

Portrait for Julia Lemons (`/uploads/1778442481319-Julia_Lemons.png`) returns 500 in the worktree because the worktree's `public/uploads/` directory is empty. The main project has the file at `/Users/beatka/Projects/simstrack-526/public/uploads/`. Not a code bug; an environment gap.

The DB in the test environment has Lana Lemons as the `founderSimId`, not Julia Lemons. The spec/brief says Julia is the founder. This needs verification — either the data is stale or the spec is wrong.

Contrast failures (light mode): eyebrow labels (`rgb(184,168,138)` at 11–12px on `rgb(250,247,240)`) = 2.18:1. Section description text (`rgb(140,122,94)` at 15px) = 3.88:1. Both fail WCAG AA 4.5:1. Top nav links same color: 3.88:1. Unassigned badge amber on amber tint: 4.36:1 (needs 4.5:1).

Contrast failures (dark mode): same eyebrow labels in dark mode (`rgb(110,98,88)` at 12px on `rgb(12,21,16)`) = 3.14:1, fails.

Top-level `<nav>` has no `aria-label`. When multiple nav landmarks exist, each must be labelled per WCAG.

Tap targets: dark mode toggle button 24x24px (needs 44x44), Sign out 69x27px, SectionNav buttons 168x34px — all below the 44px minimum height.

No skip-to-content link exists on the page.

**Why:** First QA pass of rebuilt Legacy Chronicle page.
**How to apply:** When returning to this page for follow-up fixes, check these specific items first.
