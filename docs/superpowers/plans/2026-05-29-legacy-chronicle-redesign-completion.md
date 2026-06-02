# Legacy Chronicle Redesign — Completion Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the deferred work on the legacy "chronicle" redesign — make the fullscreen family-tree overlay visually match the Atlas design, close the three Critical tree-accessibility gaps, fix the two app-wide contrast tokens to WCAG AA, and land the remaining small a11y polish.

**Architecture:** The chronicle page (`src/app/(app)/legacies/[slug]/page.tsx`) is an RSC that derives view data and renders presentational sections plus client islands. The fullscreen tree is a pure-SVG component (`src/components/lineage-tree/`) using the **Crest** node renderer, opened by the `TreeOverlay` client island. This pass adds over-canvas chrome (dot-grid, floating capsule, legend) and SVG-native accessibility to the overlay, darkens two design tokens in `globals.css`, and adds a skip-link / nav label to the app shell.

**Tech Stack:** Next.js 16 (App Router, RSC), TypeScript (strict, **no suppressions**), Tailwind utility classes + CSS custom-property design tokens (parchment & forest theme), pure inline-SVG for the tree, Vitest + Testing Library (jsdom) for unit/integration tests, Playwright for E2E.

---

## ⚠️ AUTHORITATIVE PATH & TOKEN CORRECTIONS (verified against the worktree — these OVERRIDE any path/name below)

The first draft of this plan was written with corrupted file metadata. The **real** paths, filenames (all kebab-case), and tokens are:

Route base is **`src/app/app/legacies/[slug]/`** (literal `app/app`, **no `(app)` route group**). `_components/` is **subdir-per-component**.

| Plan body says | Reality (use this) |
|---|---|
| `src/components/lineage-tree/LineageTree.tsx` | `src/components/lineage-tree/lineage-tree.tsx` — exports `LineageTree`, type `LineageTreeProps` |
| `…/lineage-tree/types.ts` | **No such file** — types are inline in `layout.ts` |
| `lineage-tree.module.css` *(create)* | **Already exists** (325 B) — **edit** it, don't recreate |
| `TreeOverlay.tsx` at `…/lib/components/` | `src/app/app/legacies/[slug]/_components/tree-overlay/tree-overlay.tsx` |
| `SectionNav.tsx` | `src/app/app/legacies/[slug]/_components/section-nav/section-nav.tsx` |
| `ChronicleSections.tsx` | `src/app/app/legacies/[slug]/_components/chronicle-sections/chronicle-sections.tsx` |
| `HeroSection.tsx` | `src/app/app/legacies/[slug]/_components/hero/hero.tsx` |
| `sections.tsx` | **No plain file** — sections live in `chronicle-sections/chronicle-sections.tsx`; the "View tree" trigger is `_components/view-tree/view-tree.tsx` |
| `PortraitAvatar.tsx` | `src/components/ui/portrait-avatar/portrait-avatar.tsx` (+ `index.ts` barrel) |
| plumbob | `src/components/plumbob.tsx` |
| app shell + top nav | `src/app/app/layout.tsx`; top nav at `src/app/app/components/app-nav.tsx` |
| component tests | `src/app/app/legacies/[slug]/_components/__tests__/` |

**`.sr-only` already ships via Tailwind v4** (noted in `globals.css` ~line 221) — do NOT add a duplicate; a `.skip-link` style block already exists (~lines 233–240). Real light tokens: `--text` #2a1f0e, `--text-muted` #5c5446, `--text-subtle` #6f6657, `--bg` #faf7f0, `--bg-surface` #fefcf7, `--bg-card` #ffffff. Dark: `--text` #f0ede8, `--text-muted` #a09488, `--text-subtle` #a89e8a, `--bg` #0c1510, `--bg-surface` #111d14, `--bg-card` #162219. (The B1 test parses these live — trust the test's printed ratios over any value quoted here, since reads have been flaky.)

**CrestNode real signature** (`crest-node.tsx`): props `{ sim, x, y, isHeir, isFounder, isSelected, plumbobGradientId, onSelect }`; handler is `onSelect(id)` (not `onActivate`). It **already has** `role="button"` + `tabIndex` + `onKeyDown` + `aria-label`, and **already uses per-node clip ids via `useId`** (Task A2 item 4 is done). Remaining in crest-node: de-italic the monogram, add the `crest-lift` filter, extend `aria-label` to include life stage.

**Real design tokens** (in `src/app/globals.css`; dark selector is `[data-theme="dark"]`): `--text` #2d2a24, `--text-muted` #6b6456, `--text-subtle` #9a8f7a, `--bg` #faf7f0, `--bg-surface` #f4eee1, `--bg-card` #fdfbf6 (light); `--text-muted` #b8ab92, `--text-subtle` #8a7f6a (dark). Plus `--amber`, `--color-amber-700`, `--green`/`--green-glow`, `--border`, `--border-bright`, `--font-display`, `--font-body`, `--radius-lg`, `--shadow-md`. **Ignore the `--surface-*` / `--text-default` mapping table below** — those names do not exist. The contrast test (B1) checks `--text-muted`/`--text-subtle` against `--bg`/`--bg-surface`/`--bg-card`. Sanity: light `--text-muted` ≈5:1 (passes); light `--text-subtle` ≈2.8–3.0:1 (fails) — the main fix is darkening `--text-subtle`.

> **Tooling note:** raw Bash stdout is being intermittently duplicated/garbled/dropped in this environment. The Read tool on files is reliable. For command output, redirect to a temp file (`cmd > /tmp/out.txt 2>&1`) and Read it.

---

## Ground rules (read before any task)

- **No lint or TS suppressions, ever** (`// eslint-disable`, `// @ts-ignore`, `// @ts-expect-error`, `// @ts-nocheck`). Fix the root cause. (AGENTS.md)
- **Conventional commits**, and stage only your own files with explicit `git add <file>` — never `git add .` / `-A`. (AGENTS.md)
- **Follow the existing codebase style**: the shipped redesign uses **Tailwind utilities + design-token CSS vars**, *not* CSS Modules — ignore the handoff prose that says "CSS Modules." The one exception in this plan is a single co-located CSS module for the SVG focus ring (Task A4), because `:focus-visible` styling of an SVG child can't be expressed cleanly in Tailwind.
- **Use the existing design tokens** in `src/app/globals.css`; never invent new hex values except where this plan explicitly changes a token (Task B1/B2).
- **No emoji.** The only decorative mark is the plumbob.
- **Testing philosophy:** Testing Trophy — favor integration/component tests over unit tests for trivial functions. Test behavior and accessibility semantics, not visual pixels. Visual-only details (dot-grid, shadows) are verified by browser QA, not assertions.
- Validate after each chunk: `npx tsc --noEmit` and `npm run lint` must both be clean. The full `npm test` + `npm run test:e2e` run happens once at the very end (the lead runs it).

## Token mapping (design spec → this codebase)

The handoff JSX/HTML uses the **old** design-system token names. Map them to the parchment-forest tokens that actually exist in `src/app/globals.css`. **Read `globals.css` first and confirm the exact names**, then use this mapping:

| Design-spec name | This codebase (verify in globals.css) | Meaning |
|---|---|---|
| `--text` | `--text-default` | primary text |
| `--text-muted` | `--text-muted` | secondary text |
| `--text-subtle` | `--text-subtle` | tracked caption/label |
| `--bg` / `#faf7f0` | `--surface-base` | page background |
| `--bg-card` | `--surface-raised` | raised surface |
| `--surface-sunken` | `--surface-sunken` | sunken canvas |
| `--border` | `--border-subtle` | hairline border |
| `--border-bright` | `--border-strong` (lineage connectors) | brighter border / lineage lines |
| `--green` / `--green-glow` | `--accent-forest` (+ its glow variant) | forest accent / focus glow |
| `--amber` | `--accent-amber` | amber accent (marriage, heir ring) |
| `--color-amber-700` | the darker amber token in globals.css | amber text on light bg |

If a needed variant (e.g. a forest "glow" or darker amber) does not exist, prefer an existing token over inventing one; if truly absent, derive it with `color-mix(in srgb, var(--accent-forest) 35%, transparent)` rather than a raw hex.

## Atlas tree-overlay visual spec (authoritative)

From the design handoff (`02-tree-atlas.png`, `component-floating-capsule.html`, `component-family-tree.html`). **In scope:** dot-grid canvas, top-left floating capsule, node lift-shadow, bottom legend. **Explicitly OUT of scope** (intentionally cut earlier — do NOT build): search box, generation-filter pills, "+ Milestone"/"Add sim" buttons, floating sim inspector, quick-milestone modal, zoom controls.

1. **Dot-grid canvas** (the scroll area behind the tree):
   - background: `var(--surface-base)`
   - `background-image: radial-gradient(circle at 1px 1px, <dot> 1px, transparent 0);`
   - `background-size: 20px 20px;`
   - `<dot>` = `rgba(60, 50, 30, 0.08)` in light theme. For dark theme use a light low-alpha dot (e.g. `rgba(255, 250, 235, 0.06)`) — express both via a token-aware CSS var so the dark theme overrides it.

2. **Top-left floating "glass" capsule** (legacy identity):
   - `position: absolute; top: 16px; left: 16px;`
   - `background: color-mix(in srgb, var(--surface-raised) 92%, transparent); backdrop-filter: blur(14px);`
   - `border: 1px solid var(--border-subtle); border-radius: var(--radius-lg, 16px); box-shadow: <shadow-md>;`
   - `padding: 12px 18px; display: flex; align-items: center; gap: 12px;`
   - Contents: a **plumbob** (12px, reuse the existing plumbob component/`TreeIcon` if present) + a column:
     - eyebrow `LEGACY` — `10px / 600 / letter-spacing .16em / uppercase / var(--text-subtle)`
     - title — `font-display, 17px, 600, var(--text-default)`, e.g. `The Caliente ` with `Legacy` in `var(--color-amber-700)` (upright, **not** italic — see [[feedback_no_italic]])
     - a second line: `N sims · M generations` — `12px / var(--text-muted)`

3. **Node lift-shadow** (Crest medallion): add a soft drop shadow so medallions sit above the dot-grid. Use an SVG filter (preferred — works on the medallion shape):
   ```
   <filter id="crest-lift" x="-30%" y="-30%" width="160%" height="160%">
     <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="rgba(20,15,5,0.10)" />
   </filter>
   ```
   Apply to the outer medallion `<circle>` only (not to text).

4. **Bottom legend pill**:
   - `position: absolute; bottom: 16px; left: 50%; transform: translateX(-50%);`
   - same glass recipe but `border-radius: 999px; padding: 8px 14px;` and `display: flex; gap: 16px;`
   - four items (`11px / var(--text-muted)`, 6px gap between swatch and label):
     - **Heir** — 10px amber circle (`var(--accent-amber)`)
     - **Sim** — 10px forest circle (`var(--accent-forest)`)
     - **Marriage** — 14×2px amber line
     - **Lineage** — 14×2px line in `var(--border-strong)`

Crest medallion geometry (already shipped, for reference): outer circle `r=22`, fill `var(--surface-base)`, stroke amber for founder/heir else `var(--text-default)`, `stroke-width 1.5`; portrait clipped at `r-3` with a thin inner ring; monogram fallback = inner ring `r-5` + initials (**upright**, `font-display 16/600`); caption = amber divider line + `name` (`13/600`) + `LIFE STAGE` (`8.5`, tracked `.22em`, `var(--text-subtle)`).

---

## File ownership (three parallel workstreams — disjoint files, no overlap)

| Workstream | Owns (edits) | Creates |
|---|---|---|
| **A — Tree atlas overlay** (visual match + tree a11y) | `src/components/lineage-tree/LineageTree.tsx`, `crest-node.tsx`, `tree-defs.tsx`, `connectors.tsx`, `layout.ts`, `types.ts`; `src/app/(app)/legacies/[slug]/lib/components/TreeOverlay.tsx` | `src/components/lineage-tree/lineage-tree.module.css`; tests under `src/components/lineage-tree/__tests__/` and next to `TreeOverlay.tsx` |
| **B — Contrast tokens + app-shell a11y** | `src/app/globals.css`, `src/app/(app)/layout.tsx` | `src/app/__tests__/contrast.test.ts`; a layout a11y test |
| **C — Chronicle a11y polish** | `src/components/ui/PortraitAvatar.tsx`, `src/app/(app)/legacies/[slug]/lib/components/SectionNav.tsx` (+ decorative `aria-hidden` audit in `sections.tsx` / `HeroSection.tsx` only if gaps remain) | component tests next to the files touched |

These three sets do not share a file, so the three agents can run concurrently in the same worktree. **Agents do not commit** — each implements, runs `npx tsc --noEmit` + `npm run lint` + its own targeted tests, then reports. The lead reviews, runs the full suite + E2E, and makes the commits.

---

# Workstream A — Tree atlas overlay (visual match + accessibility)

**Read first:** `src/components/lineage-tree/LineageTree.tsx`, `crest-node.tsx`, `connectors.tsx`, `tree-defs.tsx`, `layout.ts`, `types.ts`; `src/app/(app)/legacies/[slug]/lib/components/TreeOverlay.tsx`; and the spec above. Confirm current props (`TreeOverlay` currently receives `title`, `subtitle`, and tree data) and how `LineageTree` renders the `<svg>` and nodes.

### Task A1: Make the tree SVG accessible (remove the "opaque image" gap)

**Files:**
- Modify: `src/components/lineage-tree/LineageTree.tsx`
- Test: `src/components/lineage-tree/__tests__/LineageTree.a11y.test.tsx`

The shipped tree wraps everything in `<svg role="img">`, which collapses it to one opaque image for screen readers and hides the interactive nodes. Fix: the `<svg>` becomes a labelled group, and each interactive node is a real button-role element with an accessible name. (The per-node button semantics live in `crest-node.tsx`; this task wires the container + asserts the whole.)

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/lineage-tree/__tests__/LineageTree.a11y.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { LineageTree } from "../LineageTree";

// Minimal tree data shaped like what getTreeData returns. Adjust the import/
// shape to match types.ts after reading it — keep two related sims.
const data = {
  nodes: [
    { id: "a", name: "Dina Caliente", initials: "DC", lifeStage: "Adult", isHeir: false, isFounder: true, portraitUrl: null, x: 0, y: 0, generation: 1 },
    { id: "b", name: "Reed Caliente", initials: "RC", lifeStage: "Teen", isHeir: true, isFounder: false, portraitUrl: null, x: 200, y: 200, generation: 3 },
  ],
  connectors: [],
  marriages: [],
  width: 400,
  height: 400,
} as const;

describe("LineageTree accessibility", () => {
  it("is not exposed as a single opaque image", () => {
    const { container } = render(<LineageTree data={data} />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("role")).not.toBe("img");
  });

  it("labels the tree as a group", () => {
    render(<LineageTree data={data} />);
    // role="group" with an accessible name describing the tree
    const group = screen.getByRole("group", { name: /family tree|lineage/i });
    expect(group).toBeTruthy();
  });

  it("exposes each sim as a button with its name", () => {
    render(<LineageTree data={data} />);
    expect(screen.getByRole("button", { name: /Dina Caliente/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Reed Caliente/ })).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run it — verify it fails**

Run: `npx vitest run src/components/lineage-tree/__tests__/LineageTree.a11y.test.tsx`
Expected: FAIL (svg still `role="img"`, no `group`, nodes not buttons).

- [ ] **Step 3: Implement**

In `LineageTree.tsx`, change the root `<svg>`: remove `role="img"`; add `role="group"` and `aria-label={`${legacyName ?? "Family"} tree — ${nodes.length} sims`}` (thread a `legacyName`/`label` prop, or reuse an existing title prop; if none exists, default the label to `"Family tree"`). Ensure node rendering delegates to `CrestNode` (Task A2/A4 give each node `role="button"`, `tabIndex={0}`, and an accessible name). Keep the visual output identical.

- [ ] **Step 4: Run it — verify it passes**

Run: `npx vitest run src/components/lineage-tree/__tests__/LineageTree.a11y.test.tsx`
Expected: PASS.

### Task A2: Crest node — button semantics, upright monogram, lift-shadow, per-node portrait clip

**Files:**
- Modify: `src/components/lineage-tree/crest-node.tsx`, `src/components/lineage-tree/tree-defs.tsx`
- Test: `src/components/lineage-tree/__tests__/crest-node.test.tsx`

Four changes in one node-renderer pass:
1. **Button semantics:** the node `<g>` gets `role="button"`, `tabIndex={0}`, `aria-label={name}` (include life stage, e.g. `"Reed Caliente, Teen"`), and an `onKeyDown` that fires the click handler on Enter/Space. (Needed by A1's test and the a11y gap.)
2. **Upright monogram:** remove `font-style="italic"` / any `italic` from the monogram initials — entity initials must be upright per [[feedback_no_italic]]. (Deviates from the handoff JSX, which used italic; this is an intentional, documented brand override.)
3. **Lift-shadow:** apply `filter="url(#crest-lift)"` to the outer medallion `<circle>` (filter defined in A3).
4. **Per-node portrait clip:** if the shipped code uses a single shared `clipPath` id at a fixed center, give each node a unique clip id (`crest-clip-${treeId}-${id}`) whose circle is centered on that node's medallion, so portraits on non-first nodes clip correctly. (Match the design's `crest-clip-${treeId}-${sim.id}` pattern.)

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/lineage-tree/__tests__/crest-node.test.tsx
import { render } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { CrestNode } from "../crest-node";

const base = { id: "reed", name: "Reed Caliente", initials: "RC", lifeStage: "Teen", isHeir: true, isFounder: false, portraitUrl: null, x: 10, y: 20, generation: 3 } as const;

function renderNode(props = {}) {
  return render(
    <svg><CrestNode node={{ ...base, ...props }} treeId="t" onActivate={() => {}} /></svg>,
  );
}

describe("CrestNode", () => {
  it("renders as a button with an accessible name", () => {
    const { getByRole } = renderNode();
    const btn = getByRole("button", { name: /Reed Caliente.*Teen/ });
    expect(btn).toBeTruthy();
    expect(btn.getAttribute("tabindex")).toBe("0");
  });

  it("activates on Enter and Space", () => {
    const onActivate = vi.fn();
    const { getByRole } = render(
      <svg><CrestNode node={base} treeId="t" onActivate={onActivate} /></svg>,
    );
    const btn = getByRole("button");
    btn.focus();
    btn.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    btn.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    expect(onActivate).toHaveBeenCalledTimes(2);
  });

  it("renders the monogram fallback upright (no italic)", () => {
    const { container } = renderNode({ portraitUrl: null });
    const monogram = [...container.querySelectorAll("text")].find((t) => t.textContent === "RC");
    expect(monogram).toBeTruthy();
    expect(monogram?.getAttribute("font-style")).not.toBe("italic");
    // also guard against inline style italic
    expect((monogram as SVGTextElement | undefined)?.style.fontStyle).not.toBe("italic");
  });

  it("applies the lift-shadow filter to the medallion", () => {
    const { container } = renderNode();
    const filtered = container.querySelector('circle[filter*="crest-lift"]');
    expect(filtered).toBeTruthy();
  });
});
```

> NOTE: adjust the `CrestNode` prop names (`node`, `onActivate`, `treeId`) to match the real signature you read in `crest-node.tsx`. If the current handler prop is named differently (e.g. `onClick`/`href`), keep that name and update the test to match — but the node MUST be keyboard-activatable.

- [ ] **Step 2: Run it — verify it fails**

Run: `npx vitest run src/components/lineage-tree/__tests__/crest-node.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement** the four changes in `crest-node.tsx` (and define the filter in A3). If a node currently navigates via a wrapping `<a>`/link, preserve navigation but ensure `role`/`tabIndex`/keyboard activation are present and the accessible name is correct.

- [ ] **Step 4: Run it — verify it passes**

Run: `npx vitest run src/components/lineage-tree/__tests__/crest-node.test.tsx`
Expected: PASS. Then `npx tsc --noEmit` and `npm run lint` clean.

### Task A3: Add the lift-shadow filter to tree defs

**Files:** Modify `src/components/lineage-tree/tree-defs.tsx`

- [ ] **Step 1:** Add the `crest-lift` filter inside the existing `<defs>` block:

```tsx
<filter id="crest-lift" x="-30%" y="-30%" width="160%" height="160%">
  <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="rgba(20,15,5,0.10)" />
</filter>
```

(Use the JSX camelCase `floodColor`.) Keep all existing defs (gradients, the plumbob grad, any existing shadow) intact.

- [ ] **Step 2:** `npx tsc --noEmit` clean. (Visual; covered by the A2 filter test + browser QA.)

### Task A4: SVG-native keyboard focus ring on nodes

**Files:**
- Create: `src/components/lineage-tree/lineage-tree.module.css`
- Modify: `src/components/lineage-tree/crest-node.tsx`
- Test: extend `src/components/lineage-tree/__tests__/crest-node.test.tsx`

CSS `outline` does not render on SVG `<g>` in most browsers, so keyboard focus is invisible. Fix with an SVG focus halo (`<circle>`/`<rect>`) that is shown only on `:focus-visible`, driven by a CSS module class.

- [ ] **Step 1: Write the focus-ring test (extend the crest-node test)**

```tsx
  it("includes a focus-ring element that is hidden by default", () => {
    const { container } = render(
      <svg><CrestNode node={base} treeId="t" onActivate={() => {}} /></svg>,
    );
    const ring = container.querySelector('[data-focus-ring]');
    expect(ring).toBeTruthy(); // present in the DOM; visibility is CSS-driven
  });
```

- [ ] **Step 2:** Run it — FAIL (no `[data-focus-ring]` yet).

- [ ] **Step 3: Implement**

Create `lineage-tree.module.css`:

```css
.node {
  outline: none;
}
.focusRing {
  opacity: 0;
  pointer-events: none;
}
.node:focus-visible .focusRing {
  opacity: 1;
}
```

In `crest-node.tsx`, import the module (`import styles from "./lineage-tree.module.css";`), add `className={styles.node}` to the node `<g>`, and render a halo as the first child of the `<g>`:

```tsx
<circle
  data-focus-ring
  className={styles.focusRing}
  cx={CX}
  cy={CY}
  r={OUTER_R + 6}
  fill="none"
  stroke="var(--accent-forest)"
  strokeWidth={3}
/>
```

(Use the node's actual medallion center/radius constants. The forest stroke matches the design's green focus halo. If a forest-glow token exists, prefer it.)

- [ ] **Step 4:** Run it — PASS. `npx tsc --noEmit` + `npm run lint` clean. Browser-verify: Tab through nodes shows a forest ring; mouse click does not.

### Task A5: TreeOverlay — dot-grid canvas, floating capsule, legend

**Files:** Modify `src/app/(app)/legacies/[slug]/lib/components/TreeOverlay.tsx`

Add the over-canvas chrome per the Atlas spec. Keep the existing behavior (opens from hero, Esc closes, entrance animation, reduced-motion aware, body-scroll lock, focus restore).

- [ ] **Step 1:** Wrap the scroll/canvas area with the dot-grid background. Add a token-aware dot color: in `TreeOverlay` use an inline style referencing a CSS var you set on the element, e.g.
  ```tsx
  <div
    className="..."
    style={{
      background: "var(--surface-base)",
      backgroundImage:
        "radial-gradient(circle at 1px 1px, var(--tree-dot, rgba(60,50,30,0.08)) 1px, transparent 0)",
      backgroundSize: "20px 20px",
    }}
  >
  ```
  and add a `--tree-dot` override for dark mode in `globals.css`? — **No.** globals.css is Workstream B's file. Instead, set the dot color inline based on theme if the app exposes a theme flag, OR keep the single light-friendly value and confirm with B that a `--tree-dot` token (light + dark) is added in B's globals pass. **Coordinate:** if cross-file, ask the lead; otherwise use a `color-mix` that reads acceptably on both surfaces: `color-mix(in srgb, var(--text-default) 8%, transparent)` — this tracks the theme automatically and needs no globals edit. Prefer the `color-mix` form to stay within file ownership.

- [ ] **Step 2:** Add the **top-left floating capsule** (plumbob + `LEGACY` eyebrow + title + `N sims · M generations`). Reuse the `title`/`subtitle` props already passed to `TreeOverlay` (title ≈ "{name} family tree", subtitle ≈ "N sims · M generations"); render the legacy name + amber "Legacy" upright, and the subtitle line. Use the glass recipe from the spec. Mark the capsule `aria-hidden` only if its text duplicates the dialog's accessible name; otherwise leave it readable.

- [ ] **Step 3:** Add the **bottom legend pill** with the four items (Heir / Sim / Marriage / Lineage) per the spec. Decorative — wrap in a container with `aria-hidden="true"` (it's a visual key; the nodes themselves carry the semantics).

- [ ] **Step 4:** `npx tsc --noEmit` + `npm run lint` clean. Browser-verify against `02-tree-atlas.png`: dot-grid, top-left capsule, bottom legend, lifted medallions — light AND dark mode.

### Task A6: Focus trap in the overlay dialog

**Files:**
- Modify: `src/app/(app)/legacies/[slug]/lib/components/TreeOverlay.tsx`
- Test: `src/app/(app)/legacies/[slug]/lib/components/__tests__/TreeOverlay.test.tsx`

The dialog shipped without a focus trap. Add one: when open, the container has `role="dialog"` + `aria-modal="true"` + an `aria-label`; Tab/Shift+Tab cycle within the dialog's focusable elements; Esc still closes; focus restores to the trigger on close (keep existing restore logic).

- [ ] **Step 1: Write the failing test**

```tsx
// __tests__/TreeOverlay.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { TreeOverlay } from "../TreeOverlay";

const treeProps = { /* minimal valid props: title, subtitle, tree data — match the real signature */ } as never;

describe("TreeOverlay focus trap", () => {
  it("exposes a modal dialog with an accessible name", async () => {
    render(<TreeOverlay {...treeProps} defaultOpen />); // add a test-only `defaultOpen`, or open via the trigger
    const dialog = await screen.findByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog).toHaveAccessibleName();
  });

  it("traps Tab within the dialog", async () => {
    const user = userEvent.setup();
    render(<TreeOverlay {...treeProps} defaultOpen />);
    const dialog = await screen.findByRole("dialog");
    const focusables = dialog.querySelectorAll<HTMLElement>(
      'a[href], button, [tabindex]:not([tabindex="-1"])',
    );
    const last = focusables[focusables.length - 1];
    last.focus();
    await user.tab(); // should wrap to the first focusable, not escape the dialog
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    render(<TreeOverlay {...treeProps} defaultOpen />);
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
```

> NOTE: prefer opening via the real trigger (`userEvent.click(screen.getByRole("button", { name: /view family tree/i }))`) if `TreeOverlay` renders its own trigger. Only add a `defaultOpen` test affordance if opening via the trigger isn't feasible in jsdom — and if you add it, keep it a real prop, not a test hack.

- [ ] **Step 2:** Run it — FAIL (no trap / dialog semantics incomplete).

- [ ] **Step 3: Implement** a focus trap. Either a tiny self-contained handler (on `keydown`, when `key === "Tab"`, compute the focusable list within the dialog and wrap at the ends) or a vetted hook if one already exists in the repo. Add `role="dialog"`, `aria-modal="true"`, `aria-label` (e.g. the legacy name + "family tree"). On open, move focus into the dialog (e.g. the close button); on close, restore to the trigger (keep existing logic). Respect `prefers-reduced-motion` (already handled — don't regress).

- [ ] **Step 4:** Run it — PASS. `npx tsc --noEmit` + `npm run lint` clean. Browser-verify keyboard-only: open → Tab cycles inside → Esc closes → focus returns to "View family tree".

---

# Workstream B — Contrast tokens + app-shell accessibility

**Read first:** `src/app/globals.css` (token blocks for light + dark), `src/app/(app)/layout.tsx`, and `vitest.config.ts` (confirm test glob + jsdom). Confirm exact token names and current hex values before editing.

### Task B1: Automated WCAG contrast test (RED)

**Files:**
- Create: `src/app/__tests__/contrast.test.ts`

The test parses `globals.css` (single source of truth), extracts the relevant token hexes per theme, and asserts WCAG AA (≥4.5:1) for the muted/subtle text colors against the realistic surface backgrounds. Writing it first makes the failure explicit, then B2 tunes tokens to green.

- [ ] **Step 1: Write the test**

```ts
// src/app/__tests__/contrast.test.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

/** Extract `--name: #hex;` declarations from the first CSS block matching `selector`. */
function tokensIn(selector: RegExp): Record<string, string> {
  const block = css.match(new RegExp(selector.source + "\\s*\\{([\\s\\S]*?)\\}"));
  const out: Record<string, string> = {};
  if (!block) return out;
  for (const m of block[1].matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{3,8})/g)) {
    out[m[1]] = m[2];
  }
  return out;
}

function toRgb(hex: string): [number, number, number] {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function lin(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}
function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map(lin) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a: string, b: string): number {
  const la = luminance(a), lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

// Adjust selectors to match globals.css (e.g. :root and [data-theme="dark"] or .dark).
const light = tokensIn(/:root/);
const dark = tokensIn(/\[data-theme="dark"\]|\.dark/);

const AA = 4.5;
const surfaces = ["--surface-base", "--surface-raised", "--surface-sunken"];
const texts = ["--text-muted", "--text-subtle"];

describe.each([
  ["light", light],
  ["dark", dark],
])("WCAG AA — %s theme", (_name, tok) => {
  it("resolved the token set from globals.css", () => {
    expect(Object.keys(tok).length).toBeGreaterThan(0);
    for (const t of [...texts, ...surfaces]) expect(tok[t], `${t} missing`).toBeTruthy();
  });

  it.each(texts)("%s meets 4.5:1 on every surface", (text) => {
    for (const surf of surfaces) {
      const r = ratio(tok[text], tok[surf]);
      expect(r, `${text} on ${surf} = ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA);
    }
  });
});
```

- [ ] **Step 2: Run it — verify it fails**

Run: `npx vitest run src/app/__tests__/contrast.test.ts`
Expected: FAIL — `--text-subtle` (and possibly `--text-muted`) below 4.5:1 on one or more surfaces. Capture the printed ratios.

### Task B2: Darken the two tokens to AA (GREEN)

**Files:** Modify `src/app/globals.css`

- [ ] **Step 1:** Darken `--text-muted` and `--text-subtle` in **both** light and dark blocks until B1 is green, keeping the warm parchment hue. Starting candidates (tune to the test's printed ratios — these are warm browns, not greys):
  - Light: `--text-muted: #5c5446;` `--text-subtle: #6e6555;`
  - Dark: `--text-muted: #b3a890;` `--text-subtle: #8f8574;`

  Adjust ±a few steps until every pair is ≥4.5:1. Preserve the visual hierarchy (default darker than muted; muted darker than subtle in light, lighter in dark). Do **not** change `--text-default` or any surface token.

- [ ] **Step 2: Run it — verify it passes**

Run: `npx vitest run src/app/__tests__/contrast.test.ts`
Expected: PASS for both themes.

- [ ] **Step 3:** `npx tsc --noEmit` + `npm run lint` clean. Browser-verify the chronicle in light + dark: subtitles/labels are legible and still read as "muted," not full-strength.

### Task B3: `.sr-only` utility + skip-to-content link styles

**Files:** Modify `src/app/globals.css`

- [ ] **Step 1:** If no visually-hidden utility exists, add one (check first — Tailwind's `sr-only` may already be available via the framework; if so, skip adding a duplicate and note that in the commit). If adding, use the standard recipe:

```css
.sr-only {
  position: absolute;
  width: 1px; height: 1px;
  padding: 0; margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
.skip-link {
  position: absolute;
  left: 8px; top: -40px;
  z-index: 100;
  padding: 8px 16px;
  background: var(--surface-raised);
  color: var(--text-default);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  transition: top 0.15s ease;
}
.skip-link:focus { top: 8px; }
@media (prefers-reduced-motion: reduce) {
  .skip-link { transition: none; }
}
```

- [ ] **Step 2:** `npm run lint` clean. (Behavior verified in B4.)

### Task B4: Skip-to-content link + nav aria-label + main id (app shell)

**Files:**
- Modify: `src/app/(app)/layout.tsx`
- Test: `src/app/(app)/__tests__/layout.a11y.test.tsx`

**Read first** to confirm the top-nav markup. The shipped `SectionNav` already labels its own rail; this is about the **top app nav** + the page `<main>`. If the top nav lives in a separate component (e.g. `app-nav.tsx`), edit that file instead and record the swap in your report (it then becomes part of B's ownership — confirm with the lead it's not touched elsewhere).

- [ ] **Step 1: Write the failing test**

```tsx
// src/app/(app)/__tests__/layout.a11y.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import AppLayout from "../layout";

describe("app shell accessibility", () => {
  it("renders a skip-to-content link targeting #main-content", () => {
    render(<AppLayout><div /></AppLayout>);
    const skip = screen.getByRole("link", { name: /skip to (main )?content/i });
    expect(skip.getAttribute("href")).toBe("#main-content");
  });

  it("labels the top navigation", () => {
    render(<AppLayout><div /></AppLayout>);
    const navs = screen.getAllByRole("navigation");
    expect(navs.some((n) => /main|primary/i.test(n.getAttribute("aria-label") ?? ""))).toBe(true);
  });

  it("marks the main content region with a matching id", () => {
    const { container } = render(<AppLayout><div /></AppLayout>);
    const main = container.querySelector("main#main-content");
    expect(main).toBeTruthy();
  });
});
```

> NOTE: `AppLayout` is an RSC; if it's `async` or pulls server-only data, render its presentational shell directly or extract the chrome into a testable client/presentational sub-component. If rendering the layout in jsdom isn't feasible, assert against the extracted nav/shell component instead and keep the assertions equivalent.

- [ ] **Step 2:** Run it — FAIL.

- [ ] **Step 3: Implement**
  - Add as the first child of the shell: `<a href="#main-content" className="skip-link">Skip to main content</a>`.
  - Give the top `<nav>` `aria-label="Main navigation"` (or `aria-label="Primary"`).
  - Ensure the page content is wrapped in `<main id="main-content">` (add `id` if missing; if there's already a `<main>`, just add the id).

- [ ] **Step 4:** Run it — PASS. `npx tsc --noEmit` + `npm run lint` clean. Browser-verify: load any app page, press Tab once — the skip link appears; activating it moves focus to the main region.

---

# Workstream C — Chronicle a11y polish

**Read first:** `src/components/ui/PortraitAvatar.tsx`, `src/app/(app)/legacies/[slug]/lib/components/SectionNav.tsx`, `sections.tsx`, `HeroSection.tsx`.

### Task C1: PortraitAvatar — upright monogram fallback

**Files:**
- Modify: `src/components/ui/PortraitAvatar.tsx`
- Test: `src/components/ui/__tests__/PortraitAvatar.test.tsx`

The monogram fallback currently renders italic initials; entity initials must be upright per [[feedback_no_italic]]. (Intentional override of the handoff, which specified italic.)

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/ui/__tests__/PortraitAvatar.test.tsx
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { PortraitAvatar } from "../PortraitAvatar";

describe("PortraitAvatar monogram fallback", () => {
  it("renders the monogram upright (no italic) when there is no photo", () => {
    const { getByText } = render(<PortraitAvatar name="Reed Caliente" src={null} />);
    const monogram = getByText("RC");
    const cs = getComputedStyle(monogram);
    expect(cs.fontStyle === "" || cs.fontStyle === "normal").toBe(true);
    expect(monogram.className).not.toMatch(/\bitalic\b/);
  });

  it("still exposes the name to assistive tech", () => {
    const { getByLabelText } = render(<PortraitAvatar name="Reed Caliente" src={null} />);
    expect(getByLabelText("Reed Caliente")).toBeTruthy();
  });
});
```

> NOTE: match the real prop names (`name`, `src`/`photoUrl`, etc.) read from the component. The monogram element may be a `<span>` with an `aria-label` — keep that label.

- [ ] **Step 2:** Run it — FAIL (currently italic).

- [ ] **Step 3:** Remove the `italic` Tailwind class / `font-style: italic` from the monogram fallback in `PortraitAvatar.tsx`. Leave photo rendering and the `aria-label` untouched.

- [ ] **Step 4:** Run it — PASS. `npx tsc --noEmit` + `npm run lint` clean.

### Task C2: SectionNav — ≥44px tap targets

**Files:**
- Modify: `src/app/(app)/legacies/[slug]/lib/components/SectionNav.tsx`
- Test: `src/app/(app)/legacies/[slug]/lib/components/__tests__/SectionNav.test.tsx`

The rail links currently use `px-3 py-2 text-sm` (~36px tall) — they pass the AA 24px minimum but miss the 44px comfortable target. Bump to ≥44px without breaking the active/scroll-spy styling.

- [ ] **Step 1: Write the failing test**

```tsx
// __tests__/SectionNav.test.tsx
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { SectionNav } from "../SectionNav";

describe("SectionNav", () => {
  it("gives each rail item a >=44px tap target via a min-height class", () => {
    const { container } = render(
      <SectionNav items={[{ id: "chronicle", label: "Chronicle" }, { id: "family", label: "Family" }]} />,
    );
    const links = container.querySelectorAll("a");
    expect(links.length).toBeGreaterThan(0);
    links.forEach((a) => {
      // min-h-11 = 2.75rem = 44px in Tailwind's default scale
      expect(a.className).toMatch(/min-h-11|min-h-\[44px\]|min-h-\[2\.75rem\]/);
    });
  });
});
```

> NOTE: match `SectionNav`'s real props/items shape. If it derives items internally rather than via a prop, render it with whatever the real API requires and assert on the rendered `<a>` classes.

- [ ] **Step 2:** Run it — FAIL.

- [ ] **Step 3:** Add `min-h-11` (and `flex items-center` if needed so the larger height stays vertically centered) to each rail link in `SectionNav.tsx`. Keep `aria-current`/active styling intact.

- [ ] **Step 4:** Run it — PASS. `npx tsc --noEmit` + `npm run lint` clean. Browser-verify the rail still looks right and active state works.

### Task C3: Decorative `aria-hidden` audit

**Files:** Modify `sections.tsx` and/or `HeroSection.tsx` **only if gaps remain**

The earlier polish pass already added `aria-hidden="true"` to the succession connector and milestone marker. Verify there are no remaining purely-decorative SVG marks (plumbob markers, divider glyphs, the hero "Now & then" connector) that are still exposed to AT, and add `aria-hidden="true"` to any that are.

- [ ] **Step 1:** Grep the chronicle section components for inline `<svg>`/decorative marks; for each, decide: does it convey info, or is it purely visual? Add `aria-hidden="true"` to the purely-visual ones. If everything is already covered, make **no change** and note "no gaps found" in your report (do not add empty churn).
- [ ] **Step 2:** `npx tsc --noEmit` + `npm run lint` clean.

---

## Final integration (lead, after all three workstreams report)

- [ ] **Step 1:** `npx tsc --noEmit` — clean across the whole repo.
- [ ] **Step 2:** `npm run lint` — zero errors/warnings.
- [ ] **Step 3:** `npm test` — full unit/integration suite green (the 385 existing + the new tests).
- [ ] **Step 4:** `npm run test:e2e` — Playwright suite green.
- [ ] **Step 5:** Manual browser QA (real data, light + dark): open a legacy → "View family tree" → confirm dot-grid, top-left capsule, lifted medallions, bottom legend match `02-tree-atlas.png`; keyboard-only: Tab cycles inside the dialog with a visible forest focus ring on nodes, Esc closes, focus returns to the trigger; skip link works on an app page; muted/subtle text is legible.
- [ ] **Step 6:** Commit per workstream (conventional commits, explicit `git add <file>` lists):
  - `feat(legacy-tree): match Atlas overlay design — dot-grid, glass capsule, lift nodes, legend`
  - `fix(legacy-tree): accessible tree — focus trap, SVG focus ring, node button semantics`
  - `fix(a11y): meet WCAG AA contrast for muted/subtle text app-wide`
  - `feat(a11y): skip-to-content link, nav label, upright monograms, larger rail targets`
- [ ] **Step 7:** Update `docs/legacy-chronicle-redesign-status.md` — move items 1, 2, 4 and the contrast item from "Not completed / deferred" to "Completed"; note responsive + next/image (already covered by `**.public.blob.vercel-storage.com`) status.

---

## Out of scope (confirmed)

- **Responsive breakpoint** for the `200px 1fr` grid — user chose to keep desktop-first.
- **Overlay extras** intentionally cut earlier: search, generation-filter pills, "+ Milestone"/"Add sim", floating sim inspector, quick-milestone modal, zoom controls.
- **Milestone write-path / composer / generation filter** — cut earlier; still cut.
- **next/image `remotePatterns`** — already covered by `**.public.blob.vercel-storage.com` in `next.config.ts`; no change needed (verify and note).

## Self-review notes

- **Spec coverage:** deferred items 1 (visual match → A1–A5), 2 (tree a11y → A1, A2, A4, A6), 3 (contrast → B1–B2), 4 (small a11y → B3–B4, C1–C3). ✓
- **File ownership** is disjoint across A/B/C — safe for parallel execution; only the lead commits.
- **Type/name consistency:** every test carries a NOTE to reconcile prop names with the real component signatures before asserting — the agent must read the file first. The `#main-content` id is used identically in B4's link, main, and test.
