---
paths:
  - "src/**/*.css"
  - "src/components/**"
  - "src/app/**/*.tsx"
---

# SimTrack Brand Direction

**A living reference for designers and developers.**

---

## What SimTrack Is

SimTrack is a dedicated chronicle for players running The Sims Legacy Challenges — most prominently the 10-Generation Legacy Challenge. It gives players a place to track every Sim, every generation, every relationship, and every milestone their stories produce.

The product exists because Legacy Challenge players care deeply about narrative continuity. They name heirs, record births and deaths, document personality quirks, and mourn Sims who aged out. SimTrack is the keeper of those records.

**Taglines in use:**
- "Your Sims universe, tracked"
- "Chronicle your Sims legacies"

---

## Audience

Players running multi-generational challenges who want more than a screenshot folder. They are detail-oriented, story-minded, and invested in preserving the texture of their gameplay. They appreciate craft — a well-kept journal, a well-designed interface. They do not want clinical software. They want something that feels like it belongs in the same emotional register as the game itself.

---

## Brand Personality

SimTrack should feel like a beautifully kept journal — warm, literary, and refined. The aesthetic reference is a leather-bound field notebook or a handsome reference volume, not a dashboard or a game client.

What that means in practice:

- **Warm, not clinical.** No stark whites, no dark editorial mode, no neon. The product should feel inviting at any hour.
- **Literary, not game-y.** Typography leans toward the serif tradition. Prose in the UI can have a slight narrative register — "Begin your legacy" lands better than "Create account."
- **Refined, not precious.** Elegance should serve usability. Decorative elements earn their place. Nothing is ornamental for its own sake.

The Sims franchise has always had a charming, personal, slightly whimsical quality. SimTrack should feel like a natural companion to that — not a fansite, not a corporate product, but a thoughtful tool made by someone who plays and cares.

---

## Visual Identity: Parchment & Forest

The theme name describes its two poles: **parchment** (the warm cream of paper and light) and **forest** (the deep green of nature and depth). Together they evoke the feeling of writing in a journal outdoors — grounded, calm, and specific.

### Light Mode (Parchment)

The default experience. A warm cream base that reads as natural and analog without feeling aged or sepia-toned. Deep forest green anchors interactive elements. Honey amber appears as an accent, reserved strictly for heir and legacy callouts — it should feel like a gold seal on an important document.

### Dark Mode (Forest Night)

The forest continues at night. Dark mode backgrounds use deep forest green (`#0c1510`), not black. This is intentional: the user is still inside the same world. However, text in dark mode is warm neutral, not green-tinted — this solves the green-on-green readability problem that would arise if text inherited the green palette. In dark mode, green is reserved exclusively for interactive elements, where it glows against the dark forest background.

---

## Color Tokens

### Light Mode

| Token | Value | Use |
|---|---|---|
| `--bg` | `#faf7f0` | Warm parchment page base |
| `--bg-card` | `#ffffff` | Card and surface background |
| `--text` | `#2a1f0e` | Rich dark brown body text |
| `--text-muted` | `#8c7a5e` | Secondary text, captions |
| `--green` | `#1a5c35` | Deep forest green — interactive elements |
| `--amber` | `#d4a017` | Honey amber — heir and legacy callouts only |
| `--border` | `#e8dfc8` | Warm tan border |

### Dark Mode (Forest Night)

| Token | Value | Use |
|---|---|---|
| `--bg` | `#0c1510` | Deep forest — not black |
| `--text` | `#f0ede8` | Warm off-white — not green-tinted |
| `--text-muted` | `#a09488` | Warm medium gray — not green-tinted |
| `--green` | `#4aaf72` | Brighter green for interactive elements |

### Rules for Color Use

- **Green is for interactive elements only.** Do not use green for decorative elements, static text, or illustration fills.
- **Amber is for heir and legacy callouts only.** It signals something important in the lineage. Do not repurpose it as a general accent.
- **Text-muted is for secondary information** — captions, labels, timestamps. `--text-subtle` (lighter still) is for uppercase metadata labels only and must never be used for body copy.
- The green-on-green problem in dark mode is solved architecturally: green belongs to interactive elements, text belongs to the warm neutral family. Never cross these wires.

---

## Pack Type Badge Colors

Content packs in The Sims have distinct types. SimTrack uses a dedicated color per type so players can scan their packs at a glance. These colors are vivid and distinct — they intentionally break from the green/amber palette to be immediately readable as category signals.

| Pack Type | Light Mode | Dark Mode |
|---|---|---|
| Expansion Pack | `#4aaf72` (forest green) | same |
| Game Pack | `#fbbf24` (amber) | same |
| Stuff Pack | `#c4b5fd` (lavender) | `#a78bfa` (deeper) |
| Kit | `#fda4af` (rose) | `#fb7185` (deeper) |

---

## Typography

### Display: Cormorant Garamond

Used for headings, the wordmark, and any large text that sets the tone. Cormorant Garamond is an elegant literary serif with roots in the French Renaissance type tradition. It has excellent optical size range — it can be monumental at large display sizes and still legible at moderate sizes.

The **italic weight** adds personality without sacrificing formality. Use it for taglines, pull quotes, and the wordmark. It is not decorative for its own sake — italic in this typeface has a specific warmth.

### Body: Plus Jakarta Sans

Used for all body copy, UI labels, navigation, and form elements. Plus Jakarta Sans is a humanist geometric sans-serif — clean and modern, but with enough warmth to sit comfortably next to Cormorant Garamond without creating friction.

The pairing works because both faces have a slightly humanist quality. Neither is cold. Together they convey: sophisticated, readable, designed with care.

---

## The Plumbob

The plumbob is the iconic green diamond that floats above Sims in the game. It is SimTrack's brand symbol.

### Where it appears

- **Nav wordmark** — small, inline with the logotype
- **Landing page hero** — large and floating, as a centerpiece illustration
- **Sign-in card** — as a welcoming decorative mark
- **Section dividers** — as a visual pause between content areas

### How it works technically

The plumbob is built from four CSS triangles, each receiving its own color token (`--plumbob-tl`, `--plumbob-tr`, `--plumbob-bl`, `--plumbob-br`). This allows the facets to shift between light and dark mode — in dark mode the plumbob brightens to glow against the deep green background.

It is always marked `aria-hidden="true"`. The plumbob is decorative, not content. Screen readers should never encounter it.

---

## Shadows and Depth

The design uses a three-level shadow system:

- `--shadow-sm` — small elements: chips, badges, small buttons
- `--shadow-md` — hover and focus states on cards and interactive surfaces
- `--shadow-lg` — modals, drawers, floating cards

Shadows use warm-tinted darkness (not pure black) to stay consistent with the parchment palette. They should create gentle lift, not dramatic depth.

Card hover states combine a subtle background shift with border brightening. They do not use heavy drop shadows — the effect should feel like a page being held up to the light, not an element floating off the screen.

---

## Focus and Accessibility

- All text/background color pairs target WCAG AA minimum contrast.
- Focus rings use `var(--green-glow)` — visible and clearly purposeful, but not harsh or jarring.
- Interactive green in dark mode (`#4aaf72` on `#0c1510`) is chosen specifically for contrast against the dark forest background.
- `--text-subtle` is reserved for uppercase metadata labels where context provides additional legibility support. It must never appear as running body copy.

---

## Anti-patterns

Avoid these — they undermine the brand even when individually they seem harmless:

- **Pure white backgrounds in light mode.** Use `--bg` (`#faf7f0`), not `#ffffff`. Cards can be white; the page should not be.
- **Black in dark mode.** `--bg` in dark mode is `#0c1510`. True black breaks the forest metaphor and makes the interface feel generic.
- **Green text.** Green is interactive. If you reach for green to make text feel "on-brand," use `--text` or `--text-muted` instead.
- **Amber as a general accent.** Amber is earned — it marks heirs and legacy milestones. Using it elsewhere devalues those moments.
- **Heavy animation or transitions.** The product should feel settled and calm. Micro-interactions are welcome; kinetic showpieces are not.
- **Neon, high-saturation, or dark-editorial palettes.** These belong to a different genre. SimTrack is a journal, not a game client.
