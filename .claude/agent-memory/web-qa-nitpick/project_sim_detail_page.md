---
name: sim-detail-page-reviewed
description: Visual QA review of the sim detail page (/app/legacies/[slug]/sims/[id]) — what was checked and what issues were found
metadata:
  type: project
---

The sim detail page at `/app/legacies/the-lemons-legacy/sims/cmozxzd1800020du558q1vug7` (Lana Lemon) was reviewed on 2026-05-15.

**Why:** First visual QA pass against the approved mockup at `.superpowers/brainstorm/87423-1778660498/content/unified-return.html`.

**Key findings:**
- Portrait ring lacks a visible border ring in light mode (mockup has `2px solid #c8b896`); the button uses `background: var(--border)` with `border: none` — only fill color, no ring stroke
- Name fields have a `0.75rem` gap between first and last name, rendering as "Lana  Lemon" with a noticeable word-gap
- Portrait size: 88px (live) vs 96px (mockup) — minor but smaller than spec
- Hero portrait has no hover "Upload" hint overlay (mockup shows a frosted overlay on hover)
- Identity chips (FEMALE, YOUNG ADULT, None) render in ALL-CAPS from the enum values; mockup shows title-case ("Female", "Young Adult")
- "Add family" / "Add connection" cards render as rectangular cards (no `border-radius` on the `.simCard` container), not compact portrait cards. The surrounding container has a hard rectangular border
- Skills pip dimensions: live is `14px × 14px` squares; mockup uses `14px × 5px` flat horizontal bars — significant shape mismatch
- `--green-bright` resolves to `#22874c` (darker green), used for pip hover — correct per brand (green, not amber)
- Dark mode: "Add family" and "Add connection" cards show as stark white rectangles on dark forest background (`.simCard` background comes from `--bg-card` = `#162219` in dark mode but card container isn't using it)
- Section spacing and borders consistent; headings use Cormorant Garamond 20px/600 weight, left-aligned — correct

**How to apply:** When making changes to this page, prioritize: portrait ring border, name gap, chip text casing, card container border-radius, and pip bar shape.
