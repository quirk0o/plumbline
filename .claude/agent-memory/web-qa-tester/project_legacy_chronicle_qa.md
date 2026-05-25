---
name: legacy-chronicle-qa
description: Known issues from QA passes of the legacy-chronicle-redesign branch; last verified 2026-05-25
metadata:
  type: project
---

## Verified FIXED (2026-05-25 second QA pass)

All 5 targeted fixes confirmed PASS:
1. Section backgrounds — both `#succession` and `#milestones` render `rgb(250,247,240)` (parchment) in light mode and `rgb(12,21,16)` (dark forest) in dark mode. Not white.
2. Founder portrait ring — the amber ring (implemented via `box-shadow: 0 0 0 2px var(--bg-card), 0 0 0 3px var(--amber)`) is a full unclipped circle in both light and dark mode. Ring is on the monogram `<div>`, not a separate element — cannot be clipped by overflow.
3. Left sidebar sticky — `position: sticky`, nav `top` stays at `48px` before and after scrolling 773px.
4. No breadcrumb in hero — `dashLinkCount: 0` in the main content; hero starts with "LEGACY · CHRONICLE" eyebrow.
5. Portraits are links — all portrait `<a>` elements in hero, milestones, and succession sections href to `/app/legacies/the-lemons-legacy/sims/<id>`. Clicking founder portrait in succession navigated correctly.

## Still open / unresolved

Scroll-spy never activates the "Family" nav item even when scrolled to the bottom. The `#sims` section is below the max scroll position at 720px viewport height.

Portrait for Julia Lemons (`/uploads/1778442481319-Julia_Lemons.png`) returns HTTP 500 — worktree `public/uploads/` is empty. Four 500 errors in the console on every page load. Not a code bug; the worktree is missing the file that lives at `/Users/beatka/Projects/simstrack-526/public/uploads/`.

The DB has Lana Lemons as `founderSimId` (shown in Succession line with monogram LL), but the spec says Julia should be founder. Data vs. spec mismatch; needs clarification.

Lana Lemons renders as a monogram (LL) in Succession even though she is the `founderSimId` — she has no `imageUrl` in the DB for this worktree's data.

Contrast failures (light mode): eyebrow labels (`rgb(184,168,138)` at 11–12px on `rgb(250,247,240)`) = 2.18:1. Section description text (`rgb(140,122,94)` at 15px) = 3.88:1. Both fail WCAG AA 4.5:1.

Contrast failures (dark mode): eyebrow labels `rgb(110,98,88)` at 12px on `rgb(12,21,16)` = 3.14:1, fails.

Top-level `<nav>` has no `aria-label`.

Tap targets: dark mode toggle 24x24px, Sign out 69x27px, SectionNav buttons 168x34px — all below 44px minimum height.

No skip-to-content link.

**Why:** Ongoing QA pass of rebuilt Legacy Chronicle page.
**How to apply:** When returning to this page for follow-up fixes, check the still-open items above.
