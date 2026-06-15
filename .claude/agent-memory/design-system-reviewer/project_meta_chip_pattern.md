---
name: meta-chip-pattern
description: Shared .metaChip base class in the sim detail identity row — how chip controls (heir toggle, read-only gen, editable gen Combobox) compose it
metadata:
  type: project
---

The sim detail page's identity meta row (`src/app/app/legacies/[slug]/sims/[id]/`) uses a shared `.metaChip` base class composed via CSS Modules `composes:`. It carries `--font-body`, `--text-sm`, `font-weight: 600` (hardcoded — `--weight-semibold` would be the token form), `letter-spacing: 0.04em`, `padding: 0.3rem 0.75rem`, `border-radius: var(--radius-xl)`, `color: var(--text-muted)`.

- `.heirToggle` composes it and adds `--border-bright` border + interactive hover/amber-active states.
- `.metaChipReadOnly` composes it and adds a quieter `--border` border. No hover/focus states — it is pure display text.
- Editable generation uses the `Combobox variant="chip"` inside a `.generationField` wrapper (no `.metaChip` compose because Combobox owns its own chip styling).

**Why:** separation of shape from interactivity. Shape lives in `.metaChip`; affordance-specific borders and transitions live in each composer.

**How to apply:** when adding future meta-row controls, compose `.metaChip` for non-interactive chips; use `Combobox variant="chip"` for interactive selects.
