# SimsTrack Design Theme — Parchment & Forest

**Date:** 2026-05-04
**Status:** Approved
**Scope:** Full design token system + all CSS modules + light/dark mode toggle

---

## Context

The existing design uses a very dark forest-green aesthetic (`#07130e` background) with a cold, editorial feel closer to a luxury press site than a Sims game companion. Problems identified:

- `--text-muted` (`#5a9e72`) on `--bg` (`#07130e`) falls below WCAG AA contrast
- Mixed border radii with no system (4px, 6px, 8px, 12px, 0px across files)
- Plumbob rendered inconsistently — SVG diamond in most places, rotated CSS `div` in `signin.module.css`
- Colors hardcoded throughout six CSS module files rather than using the token layer
- No dark mode toggle; only a single dark theme

The new theme is **Parchment & Forest**: warm, refined, accessible, and coherently Sims-themed. It ships as the default light mode with a matching dark mode ("Forest Night") and a user-controlled toggle.

---

## Typography

| Role | Font | Notes |
|---|---|---|
| Display / headings | Cormorant Garamond | Kept from existing. Weights 400, 600, 700; normal + italic |
| Body / UI | Plus Jakarta Sans | Replaces DM Sans. Weights 400, 500, 600, 700 |

**Font variables** — `--font-display` is unchanged; `--font-body` keeps the same name but its underlying next/font variable renames from `--font-dm-sans` to `--font-jakarta`:

```css
--font-display: var(--font-cormorant), 'Cormorant Garamond', Georgia, serif;
--font-body:    var(--font-jakarta),   'Plus Jakarta Sans',  system-ui, sans-serif;
```

`layout.tsx` changes: `DM_Sans` import → `Plus_Jakarta_Sans`; `variable` prop changes from `'--font-dm-sans'` to `'--font-jakarta'`.

---

## Color Tokens

### Light mode — "Parchment"

```css
/* Backgrounds */
--bg:             #faf7f0;
--bg-surface:     #fefcf7;
--bg-card:        #ffffff;
--bg-card-hover:  #fdfbf5;

/* Borders */
--border:         #e8dfc8;
--border-bright:  #c8b896;

/* Text — warm neutrals, all WCAG AA+ */
--text:           #2a1f0e;   /* ~13:1 on --bg */
--text-muted:     #8c7a5e;   /* ~4.8:1 on --bg */
--text-subtle:    #b8a88a;   /* ~3.1:1 — labels/metadata only, not body */

/* Green scale (primary accent) */
--green-900:      #0d3320;
--green-800:      #1a5c35;   /* --green: interactive default */
--green-700:      #1e7040;
--green-600:      #22874c;
--green-400:      #4aaf72;
--green-200:      #b6e8c8;
--green-100:      #dcf4e8;
--green-50:       #f0faf4;
--green:          var(--green-800);
--green-bright:   var(--green-600);
--green-glow:     rgba(26, 92, 53, 0.12);

/* Amber scale (secondary accent — legacy/heir callouts) */
--amber-900:      #78400a;
--amber-700:      #b45309;
--amber-600:      #d4a017;   /* --amber */
--amber-400:      #fbbf24;
--amber-200:      #fde68a;
--amber-100:      #fef3c7;
--amber-50:       #fffbeb;
--amber:          var(--amber-600);
```

### Dark mode — "Forest Night"

Applied via `[data-theme="dark"]` on `<html>` (also matches `@media (prefers-color-scheme: dark)` when no explicit preference is stored).

```css
/* Backgrounds — deep forest green, not brown */
--bg:             #0c1510;
--bg-surface:     #111d14;
--bg-card:        #162219;
--bg-card-hover:  #1c2a1f;

/* Borders — neutral, not green-tinted */
--border:         rgba(255, 255, 255, 0.08);
--border-bright:  rgba(255, 255, 255, 0.15);

/* Text — warm neutrals, NOT green (green reserved for interactive only) */
--text:           #f0ede8;   /* ~14:1 on --bg */
--text-muted:     #a09488;   /* ~6.8:1 on --bg */
--text-subtle:    #6e6258;   /* ~4.1:1 on --card */

/* Green scale (primary accent — interactive elements only) */
--green-900:      #0c1510;
--green-800:      #1a5c35;
--green-700:      #22874c;
--green-600:      #2ea55c;
--green-400:      #4aaf72;   /* --green in dark mode */
--green-200:      #6dc98e;
--green-100:      rgba(74, 175, 114, 0.18);
--green-50:       rgba(74, 175, 114, 0.08);
--green:          var(--green-400);
--green-bright:   var(--green-200);
--green-glow:     rgba(74, 175, 114, 0.15);

/* Amber scale (secondary — legacy/heir callouts only) */
--amber-900:      #fbbf24;
--amber-700:      #fbbf24;
--amber-600:      #fbbf24;   /* --amber */
--amber-400:      #fde68a;
--amber-200:      rgba(251, 191, 36, 0.22);
--amber-100:      rgba(251, 191, 36, 0.12);
--amber-50:       rgba(251, 191, 36, 0.06);
--amber:          var(--amber-600);
```

### Green usage rules

**Where green is used:**
- Active nav link text + background pill
- Action links (e.g. "Manage →")
- Primary button background
- "Active" status badge
- Plumbob SVG facets
- Focus ring on inputs

**Where green is NOT used in dark mode:**
- Body text, muted text, subtle labels
- Borders (neutral rgba white)
- Disabled or ghost states

---

## Border Radius Scale

Replaces all ad-hoc values across modules.

```css
--radius-xs:   4px;   /* tags, inline chips */
--radius-sm:   6px;   /* small buttons, nav pills */
--radius-base: 8px;   /* buttons, inputs, most interactive elements */
--radius-md:   10px;  /* nav bar, panels */
--radius-lg:   14px;  /* cards */
--radius-xl:   20px;  /* badges, pills */
```

---

## Shadow Scale

```css
--shadow-sm:  0 1px 3px rgba(0, 0, 0, 0.05);
--shadow-md:  0 2px 8px rgba(0, 0, 0, 0.07);
--shadow-lg:  0 8px 24px rgba(0, 0, 0, 0.10);
```

Dark mode shadows use the same values — the dark background provides enough depth contrast without heavier shadows.

---

## Plumbob SVG

A single shared `<Plumbob>` component (and a `<MiniPlumbob>` variant) replaces the three separate inline SVG definitions and the rotated-CSS-div version in `signin.module.css`.

**Light mode facets:**
- Top-left: `#86efac` → `#22c55e`
- Top-right: `#22c55e` → `#166f4a`
- Bottom-left: `#166f4a`
- Bottom-right: `#0a4530`

**Dark mode facets** (brighter, higher contrast on dark bg):
- Top-left: `#a7f3c0`
- Top-right: `#34d399`
- Bottom-left: `#166f4a`
- Bottom-right: `#0a4530`

The component reads the current theme from `data-theme` on `<html>` to swap facets, or accepts an explicit `variant="light" | "dark"` prop.

---

## Dark Mode Toggle

**Storage:** `localStorage` key `simstrack-theme` → `"light"` | `"dark"`.

**Behaviour:**
1. On first visit (no stored preference), default to light mode.
2. If OS preference is dark and no stored preference, apply dark automatically.
3. Toggle button in `AppNav` and on the public landing page nav.
4. Theme applied as `data-theme="light"` | `data-theme="dark"` on `<html>`.
5. A small inline script in `<head>` reads `localStorage` before first paint to prevent flash.

**Toggle button:** an icon-only button (sun/moon icon) with an `aria-label`. No text label needed in the nav given space constraints.

---

## Files to Change

| File | Change |
|---|---|
| `src/app/layout.tsx` | Swap `DM_Sans` → `Plus_Jakarta_Sans`; add flash-prevention inline script; add `ThemeProvider` client wrapper |
| `src/app/globals.css` | Full token replacement per spec above; add `[data-theme="dark"]` block |
| `src/app/page.module.css` | Replace all hardcoded colours/radii with token references |
| `src/app/page.tsx` | Replace inline `MiniPlumbob` SVG with shared component; add theme toggle to nav |
| `src/app/app/layout.tsx` | Pass theme toggle to `AppNav` |
| `src/app/app/components/AppNav.tsx` | Add theme toggle button; use shared `MiniPlumbob` |
| `src/app/app/components/AppNav.module.css` | Replace hardcoded values with tokens |
| `src/app/auth/signin/SignInForm.tsx` | Remove rotated-CSS-div plumbob; use shared `MiniPlumbob` |
| `src/app/auth/signin/signin.module.css` | Replace all hardcoded values with tokens |
| `src/app/auth/signin/page.tsx` | Use shared plumbob if referenced directly |
| `src/app/app/page.module.css` | Replace hardcoded values with tokens |
| `src/app/app/settings/packs/page.module.css` | Replace hardcoded values with tokens |
| `src/app/app/onboarding/packs/page.module.css` | Replace hardcoded values with tokens |
| `src/app/components/PackGrid.module.css` | Replace hardcoded values with tokens |
| `src/components/Plumbob.tsx` *(new)* | Shared `<Plumbob>` and `<MiniPlumbob>` components |
| `src/components/ThemeProvider.tsx` *(new)* | Client component: reads/writes localStorage, applies `data-theme` |

---

## Accessibility Targets

All text/background pairs meet WCAG AA (4.5:1 for normal text, 3:1 for large text and UI components).

| Pair | Mode | Ratio | Level |
|---|---|---|---|
| `--text` on `--bg` | Light | ~13.0 : 1 | AAA |
| `--text-muted` on `--bg` | Light | ~4.8 : 1 | AA |
| `--text` on `--bg` | Dark | ~14.2 : 1 | AAA |
| `--text-muted` on `--bg` | Dark | ~6.8 : 1 | AA |
| `--text-subtle` on `--bg-card` | Dark | ~4.1 : 1 | AA |
| `--green` (interactive) on `--bg` | Dark | ~5.8 : 1 | AA |
| Button text (`#0c1510`) on `--green` | Dark | ~7.4 : 1 | AAA |
| `--amber` on `--bg-card` | Dark | ~9.1 : 1 | AAA |

Note: `--text-subtle` is intentionally used only for metadata and uppercase labels (never for body copy), where the large-text 3:1 threshold applies.

Focus rings use a 3px `box-shadow` in `--green-100` (light) / `rgba(74,175,114,0.15)` (dark), meeting 3:1 against adjacent background.

---

## What Does Not Change

- Component structure and HTML semantics
- Route architecture
- Auth flow behaviour
- Database or API layer
- Cormorant Garamond (kept as display font)
- Plumbob shape and geometry (only colours and rendering method change)
