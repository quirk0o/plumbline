# Legacy Chronicle Redesign — Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the correctness, dark-mode-accessibility, runtime, API-convention, and responsive/a11y issues surfaced by the 8-agent code + design review of the `legacy-chronicle-redesign` branch.

**Architecture:** Six independent, sequentially-applied tasks, each touching a disjoint (or non-overlapping-at-execution-time) set of files so a fresh subagent can own each. Tier 1 (Tasks 1–4) fixes correctness + the dark-mode AA regression + a runtime crash. Tier 2 (Tasks 5–6) aligns the new primitives to the established `Card`/`Badge` convention and fixes responsive/a11y gaps.

**Tech Stack:** Next.js 16 (App Router, `proxy.ts` not `middleware.ts`), React 19, TypeScript, CSS Modules + a design-token layer in `globals.css`, Vitest (`vitest run`) + React Testing Library (jsdom), ESLint. No lint/TS suppressions are permitted anywhere.

**Out of scope (deliberately deferred — do NOT silently drop):**
- Italics on decorative accents (amber "Legacy" word, monogram initials) are **intentional** per the brand guide and the user's confirmed preference. Do not remove them.
- `next.config.ts` `remotePatterns` for the R2/S3 image host lives on the `feat/s3-image-storage` branch; coordinate it at merge time (noted in Task 4).
- Shared-primitive extraction (`GlassSurface`, `EmptyState`, icon `Button` variant) and the off-scale-px typography sweep are a separate follow-up plan.

**Execution order matters:** Task 1 and Task 2 both edit `src/components/lineage-tree/lineage-tree.tsx` (different lines). Run them in order, committing between, so a fresh subagent always reads the committed state.

---

## File Structure

| File | Task | Responsibility |
|---|---|---|
| `src/app/globals.css` | 1 | Add `--amber-text` semantic token (light + dark) |
| `src/app/__tests__/contrast.test.ts` | 1 | Assert `--amber-text` meets AA on every surface, both themes |
| `src/app/app/legacies/[slug]/_components/tree-atlas/tree-atlas.module.css` | 1 | Consume `--amber-text` |
| `src/app/app/legacies/[slug]/_components/tree-atlas/sim-inspector.tsx` | 1 | Consume `--amber-text` |
| `src/app/app/legacies/[slug]/_components/succession/succession.tsx` | 1 | Consume `--amber-text` |
| `src/app/app/legacies/[slug]/_components/hero/hero.module.css` | 1 | Consume `--amber-text` |
| `src/app/app/legacies/[slug]/_components/hero/hero.tsx` | 1 | Consume `--amber-text` |
| `src/components/lineage-tree/lineage-tree.tsx` | 1, 2 | (1) gen-label fill → token; (2) bonds from `layout.couples` |
| `src/components/lineage-tree/crest-node.tsx` | 1 | Heir monogram fill → token |
| `src/components/ui/portrait-avatar/portrait-avatar.module.css` | 1 | Consume `--amber-text`, drop hand-rolled dark override |
| `src/components/ui/generation-badge/generation-badge.module.css` | 1 | Consume `--amber-text`, drop hand-rolled dark override |
| `src/components/lineage-tree/layout.ts` | 2 | Expose `couples` (adjacently-placed partner pairs) |
| `src/components/lineage-tree/__tests__/layout.test.ts` | 2 | Cover non-adjacent partner → single bond |
| `src/app/app/legacies/[slug]/lib/derive.ts` | 3 | `selectDesignateHeir` helper; consistent designate label |
| `src/app/app/legacies/[slug]/lib/__tests__/derive.test.ts` | 3 | Cover null-gen heir designate consistency |
| `src/app/app/legacies/[slug]/page.tsx` | 3 | Derive `currentHeir` via `selectDesignateHeir` |
| `src/components/ui/portrait-avatar/portrait-avatar.tsx` | 4 | `onError` → monogram fallback; props spread; monogram `title` |
| `src/components/ui/portrait-avatar/__tests__/portrait-avatar.test.tsx` | 4 | Cover image-error fallback |
| `src/components/ui/eyebrow/eyebrow.tsx` | 5 | Extend `HTMLAttributes`, spread props |
| `src/components/ui/generation-badge/generation-badge.tsx` | 5 | Extend `HTMLAttributes`, spread props |
| `src/components/ui/section-heading/section-heading.tsx` | 5 | `ReactNode` props; extend `HTMLAttributes`, spread |
| `src/components/ui/stat-block/stat-block.tsx` | 5 | Extend `HTMLAttributes`, spread props |
| `src/components/ui/icons/tree-icon.tsx` | 5 | Extend `SVGProps`, spread props |
| `src/app/app/legacies/[slug]/page.module.css` | 6 | Responsive: collapse rail at narrow widths |
| `src/app/app/legacies/[slug]/_components/section-nav/section-nav.tsx` | 6 | `aria-current="location"` |
| `src/app/app/legacies/[slug]/_components/section-nav/section-nav.module.css` | 6 | `:focus-visible` ring; narrow-width handling |
| `src/app/app/legacies/[slug]/_components/chronicle-sections/chronicle-sections.tsx` | 6 | `aria-label` on each `<section>` (landmark regions) |

---

## Task 1: `--amber-text` semantic token + migrate all heir-text amber usages

**Problem:** Nine sites colour heir/legacy **text** with the Layer-1 primitive `var(--color-amber-700)`, which has no dark-mode override. In Forest Night the heir callouts render dim brown `#b45309` (measured **3.27:1 on `--bg-card`** — fails WCAG AA 4.5:1). The semantic `--amber` (`#d4a017`/`#fbbf24`) is a fill/border accent, not a legible text colour in light mode. The fix is one new semantic token, `--amber-text`, that resolves to a dark amber in light mode and a bright amber in dark mode — exactly the swap that `generation-badge` and `portrait-avatar` already hand-roll.

**Files:**
- Modify: `src/app/globals.css` (light semantic block ~line 45; dark block ~line 157)
- Modify: `src/app/__tests__/contrast.test.ts`
- Modify: `src/app/app/legacies/[slug]/_components/tree-atlas/tree-atlas.module.css:147`
- Modify: `src/app/app/legacies/[slug]/_components/tree-atlas/sim-inspector.tsx:74`
- Modify: `src/app/app/legacies/[slug]/_components/succession/succession.tsx:44`
- Modify: `src/app/app/legacies/[slug]/_components/hero/hero.module.css:29`
- Modify: `src/app/app/legacies/[slug]/_components/hero/hero.tsx:21,97`
- Modify: `src/components/lineage-tree/lineage-tree.tsx:116`
- Modify: `src/components/lineage-tree/crest-node.tsx:184`
- Modify: `src/components/ui/portrait-avatar/portrait-avatar.module.css:40-47`
- Modify: `src/components/ui/generation-badge/generation-badge.module.css:1-17`

- [ ] **Step 1: Write the failing contrast test**

In `src/app/__tests__/contrast.test.ts`, after the line `const texts = ['--text-muted', '--text-subtle']` (line 57) add:

```ts
const accents = ['--amber-text']
```

Then, inside the `describe.each([...])('WCAG AA — %s theme', ...)` body, update the existence check loop and add an accent assertion. Replace this existing block:

```ts
  it('resolved the token set from globals.css', () => {
    expect(Object.keys(tok).length).toBeGreaterThan(0)
    for (const t of [...texts, ...surfaces]) {
      expect(tok[t], `${t} missing`).toBeTruthy()
    }
  })
```

with:

```ts
  it('resolved the token set from globals.css', () => {
    expect(Object.keys(tok).length).toBeGreaterThan(0)
    for (const t of [...texts, ...accents, ...surfaces]) {
      expect(tok[t], `${t} missing`).toBeTruthy()
    }
  })

  it.each(accents)('%s meets 4.5:1 on every surface', (accent) => {
    for (const surf of surfaces) {
      const r = ratio(tok[accent], tok[surf])
      expect(r, `${accent} on ${surf} = ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA)
    }
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/app/__tests__/contrast.test.ts`
Expected: FAIL — `--amber-text missing` (token not defined yet).

- [ ] **Step 3: Add the `--amber-text` token to `globals.css`**

In the **light** semantic block, replace:

```css
  /* Amber accent (legacy/heir callouts only) */
  --amber:        var(--color-amber-600);
```

with:

```css
  /* Amber accent (legacy/heir callouts only) */
  --amber:        var(--color-amber-600);
  /* Amber TEXT — AA-legible heir/legacy text colour. Darker than --amber in
     light mode; brightens in dark mode (see [data-theme="dark"] below).
     Components must use this for amber text, never the raw --color-amber-* scale. */
  --amber-text:   #b45309;
```

In the `[data-theme="dark"]` block, replace:

```css
  --amber:        #fbbf24;
```

with:

```css
  --amber:        #fbbf24;
  --amber-text:   #fbbf24;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/app/__tests__/contrast.test.ts`
Expected: PASS — `--amber-text` resolves and clears 4.5:1 on `--bg`, `--bg-surface`, `--bg-card` in both themes.

- [ ] **Step 5: Migrate the CSS-module usages**

`src/app/app/legacies/[slug]/_components/tree-atlas/tree-atlas.module.css:147` — change `color: var(--color-amber-700);` to `color: var(--amber-text);`

`src/app/app/legacies/[slug]/_components/hero/hero.module.css:29` — change `color: var(--color-amber-700);` to `color: var(--amber-text);`

`src/components/ui/portrait-avatar/portrait-avatar.module.css` — replace this block:

```css
.accentMonogram {
  border-color: var(--amber);
  color: var(--color-amber-700);
}

[data-theme="dark"] .accentMonogram {
  color: var(--color-amber-400);
}
```

with:

```css
.accentMonogram {
  border-color: var(--amber);
  color: var(--amber-text);
}
```

`src/components/ui/generation-badge/generation-badge.module.css` — replace the trailing `color` declaration and dark override. Change line 12 `color: var(--color-amber-700);` to `color: var(--amber-text);`, then delete the now-redundant block:

```css

[data-theme="dark"] .badge {
  color: var(--color-amber-400);
}
```

- [ ] **Step 6: Migrate the inline-style / SVG-fill usages**

`src/components/lineage-tree/lineage-tree.tsx:116` — change `fill="var(--color-amber-700)"` to `fill="var(--amber-text)"`

`src/components/lineage-tree/crest-node.tsx:184` — change `fill={isHeir ? 'var(--color-amber-700)' : 'var(--text)'}` to `fill={isHeir ? 'var(--amber-text)' : 'var(--text)'}`

`src/app/app/legacies/[slug]/_components/hero/hero.tsx:21` — change `<Eyebrow color={ring === 'heir' ? 'var(--color-amber-700)' : undefined}>` to `<Eyebrow color={ring === 'heir' ? 'var(--amber-text)' : undefined}>`

`src/app/app/legacies/[slug]/_components/hero/hero.tsx:97` — change `accent="var(--color-amber-700)"` to `accent="var(--amber-text)"`

`src/app/app/legacies/[slug]/_components/tree-atlas/sim-inspector.tsx:74` — change `<Eyebrow color={isHeir ? 'var(--color-amber-700)' : undefined}>{role}</Eyebrow>` to `<Eyebrow color={isHeir ? 'var(--amber-text)' : undefined}>{role}</Eyebrow>`

`src/app/app/legacies/[slug]/_components/succession/succession.tsx:44` — change `? { color: 'var(--color-amber-700)' }` to `? { color: 'var(--amber-text)' }`

- [ ] **Step 7: Verify no `--color-amber-700` text usages remain (only `--warning` should reference it)**

Run: `grep -rn "color-amber-700\|color-amber-400" src/`
Expected: only `src/app/globals.css` lines defining `--color-amber-700`/`--color-amber-400` and `--warning: var(--color-amber-700);`. No component or module references.

- [ ] **Step 8: Validate**

Run: `npx tsc --noEmit`
Expected: no errors.
Run: `npm run lint`
Expected: no errors or warnings.
Run: `npx vitest run src/app/__tests__/contrast.test.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/app/globals.css src/app/__tests__/contrast.test.ts \
  src/app/app/legacies/'[slug]'/_components/tree-atlas/tree-atlas.module.css \
  src/app/app/legacies/'[slug]'/_components/tree-atlas/sim-inspector.tsx \
  src/app/app/legacies/'[slug]'/_components/succession/succession.tsx \
  src/app/app/legacies/'[slug]'/_components/hero/hero.module.css \
  src/app/app/legacies/'[slug]'/_components/hero/hero.tsx \
  src/components/lineage-tree/lineage-tree.tsx \
  src/components/lineage-tree/crest-node.tsx \
  src/components/ui/portrait-avatar/portrait-avatar.module.css \
  src/components/ui/generation-badge/generation-badge.module.css
git commit -m "fix(theme): add --amber-text token so heir callouts meet AA in dark mode"
```

---

## Task 2: Marriage bond renders only for adjacently-placed couples

**Problem:** `lineage-tree.tsx` derives marriage bonds from every `partnerEdge` whose endpoints merely share a row (`a.y !== b.y` is the only guard). But the layout pairs only the **first** partner adjacently (`layout.ts:142-147` — first partner wins). A sim with two same-generation partners therefore gets a bond drawn to the second partner too, producing a horizontal amber line that cuts straight across unrelated medallions. Fix: have the layout expose the couples it actually placed adjacently, and render bonds only from that list.

**Files:**
- Modify: `src/components/lineage-tree/layout.ts`
- Modify: `src/components/lineage-tree/__tests__/layout.test.ts`
- Modify: `src/components/lineage-tree/lineage-tree.tsx:61-68`

- [ ] **Step 1: Write the failing layout test**

In `src/components/lineage-tree/__tests__/layout.test.ts`, add this test inside the top-level `describe` block (mirror the existing import of `computeLineageLayout`):

```ts
  it('emits one couple per adjacent pair, not one per partner edge', () => {
    const sims = [
      { id: 'a', generationNumber: 1 },
      { id: 'b', generationNumber: 1 },
      { id: 'c', generationNumber: 1 },
    ]
    // 'a' has two partner edges in the same generation. Only one partner can be
    // placed adjacent, so the layout must expose exactly one couple — never two.
    const partnerEdges = [
      { simAId: 'a', simBId: 'b' },
      { simAId: 'a', simBId: 'c' },
    ]
    const layout = computeLineageLayout(sims, [], partnerEdges)
    expect(layout.couples).toHaveLength(1)
    const [couple] = layout.couples
    expect(layout.byId[couple.a].y).toBe(layout.byId[couple.b].y)
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/lineage-tree/__tests__/layout.test.ts -t "emits one couple"`
Expected: FAIL — `layout.couples` is `undefined`.

- [ ] **Step 3: Add `couples` to the layout type and computation**

In `src/components/lineage-tree/layout.ts`, add the field to the `LineageLayout` type. Replace:

```ts
export type LineageLayout = {
  nodes: PositionedNode[]
  /** id → positioned node, for convenient lookup by consumers. */
  byId: Record<string, PositionedNode>
  /** Top-left y of each rendered generation row, keyed by row index (0-based). */
  rowYs: number[]
  /** Generation number for each rendered row (null-gen sims live in a trailing row). */
  rowGenerations: (number | null)[]
  viewBox: { width: number; height: number }
}
```

with:

```ts
export type LineageLayout = {
  nodes: PositionedNode[]
  /** id → positioned node, for convenient lookup by consumers. */
  byId: Record<string, PositionedNode>
  /** Top-left y of each rendered generation row, keyed by row index (0-based). */
  rowYs: number[]
  /** Generation number for each rendered row (null-gen sims live in a trailing row). */
  rowGenerations: (number | null)[]
  /**
   * Partner pairs that were actually placed adjacently (one node-width + bond
   * gap apart, same row). Consumers render marriage bonds ONLY from this list —
   * a sim with multiple partner edges yields at most one couple here, so bonds
   * never span non-adjacent medallions.
   */
  couples: { a: string; b: string }[]
  viewBox: { width: number; height: number }
}
```

Declare the accumulator before the first-pass `rowGenerations.forEach(...)` loop. Find:

```ts
  const byId: Record<string, PositionedNode> = {}
  const nodes: PositionedNode[] = []
  const rowYs: number[] = []
  let maxRowWidth = 0
```

and replace with:

```ts
  const byId: Record<string, PositionedNode> = {}
  const nodes: PositionedNode[] = []
  const rowYs: number[] = []
  const couples: { a: string; b: string }[] = []
  let maxRowWidth = 0
```

Record a couple when the cluster builder forms a 2-member cluster. Replace:

```ts
      if (partner && !placedInRow.has(partner) && rowSims.some((r) => r.id === partner)) {
        // Couple: order the two members by id for determinism.
        const members = [sim.id, partner].sort()
        clusters.push({ members, key: members.join('|') })
        placedInRow.add(sim.id)
        placedInRow.add(partner)
      } else {
```

with:

```ts
      if (partner && !placedInRow.has(partner) && rowSims.some((r) => r.id === partner)) {
        // Couple: order the two members by id for determinism.
        const members = [sim.id, partner].sort()
        clusters.push({ members, key: members.join('|') })
        couples.push({ a: members[0], b: members[1] })
        placedInRow.add(sim.id)
        placedInRow.add(partner)
      } else {
```

Add `couples` to the returned object. Replace:

```ts
  return {
    nodes,
    byId,
    rowYs,
    rowGenerations,
    viewBox: { width: viewBoxWidth, height: viewBoxHeight },
  }
```

with:

```ts
  return {
    nodes,
    byId,
    rowYs,
    rowGenerations,
    couples,
    viewBox: { width: viewBoxWidth, height: viewBoxHeight },
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/lineage-tree/__tests__/layout.test.ts -t "emits one couple"`
Expected: PASS.

- [ ] **Step 5: Render bonds from `layout.couples`**

In `src/components/lineage-tree/lineage-tree.tsx`, replace:

```ts
  // Marriage bonds: only render when both partners are positioned in the same
  // row of the layout.
  const bonds = partnerEdges.flatMap(({ simAId, simBId }) => {
    const a = layout.byId[simAId]
    const b = layout.byId[simBId]
    if (!a || !b || a.y !== b.y) return []
    return [{ key: `${simAId}-${simBId}`, a, b }]
  })
```

with:

```ts
  // Marriage bonds: render only for couples the layout actually placed adjacently
  // (layout.couples). Deriving from partnerEdges directly would draw a bond across
  // the row for a sim's second same-generation partner, who is not placed adjacent.
  const bonds = layout.couples.flatMap(({ a: aId, b: bId }) => {
    const a = layout.byId[aId]
    const b = layout.byId[bId]
    if (!a || !b) return []
    return [{ key: `${aId}-${bId}`, a, b }]
  })
```

- [ ] **Step 6: Validate (full lineage-tree suite must still pass)**

Run: `npx tsc --noEmit`
Expected: no errors.
Run: `npm run lint`
Expected: no errors or warnings.
Run: `npx vitest run src/components/lineage-tree`
Expected: PASS (layout, lineage-tree, crest-node, a11y, use-pan-zoom suites all green).

- [ ] **Step 7: Commit**

```bash
git add src/components/lineage-tree/layout.ts \
  src/components/lineage-tree/__tests__/layout.test.ts \
  src/components/lineage-tree/lineage-tree.tsx
git commit -m "fix(legacy-tree): draw marriage bonds only for adjacently-placed couples"
```

---

## Task 3: Heir-designate label agrees with the Hero's current heir

**Problem:** `deriveSuccession` labels the **last** heir in a null-last sort as "Heir designate" — so a heir with `generationNumber === null` (which always sorts last) wins the designate label. But `page.tsx` computes `currentHeir` as the heir with the highest **non-null** generation. When a null-gen heir exists, the Succession section and the Hero name **different** heirs. Fix: a single shared selector, `selectDesignateHeir`, used by both — null-gen heirs are never the designate unless every heir is null-gen.

**Files:**
- Modify: `src/app/app/legacies/[slug]/lib/derive.ts`
- Modify: `src/app/app/legacies/[slug]/lib/__tests__/derive.test.ts`
- Modify: `src/app/app/legacies/[slug]/page.tsx:105-116`

- [ ] **Step 1: Write the failing test**

In `src/app/app/legacies/[slug]/lib/__tests__/derive.test.ts`, locate the `describe('deriveSuccession', ...)` block and add this test inside it. It builds three heirs — gen 2, gen 3, and a null-gen heir — and asserts the **gen-3** heir is the designate (not the null-gen one), and that the null-gen heir gets the plain "Heir" label:

```ts
  it('never designates a null-generation heir when a numbered heir exists', () => {
    const sims: ChronicleSim[] = [
      makeChronicleSim({ id: 'h2', isHeir: true, generationNumber: 2 }),
      makeChronicleSim({ id: 'h3', isHeir: true, generationNumber: 3 }),
      makeChronicleSim({ id: 'hx', isHeir: true, generationNumber: null }),
    ]
    const steps = deriveSuccession(sims, null)
    const designate = steps.find((s) => s.role === 'Heir designate')
    expect(designate?.sim.id).toBe('h3')
    const nullHeir = steps.find((s) => s.sim.id === 'hx')
    expect(nullHeir?.role).toBe('Heir')
    // Exactly one designate.
    expect(steps.filter((s) => s.role === 'Heir designate')).toHaveLength(1)
  })
```

> **Note on the fixture helper:** This test uses a `makeChronicleSim(overrides)` factory. If the test file already defines one (most `derive.test.ts` suites do — search for `makeChronicleSim` or a `chronicleSim(` helper), reuse it and delete the duplicate. If none exists, add this minimal factory near the top of the file, after the imports:
>
> ```ts
> function makeChronicleSim(overrides: Partial<ChronicleSim> & { id: string }): ChronicleSim {
>   return {
>     firstName: 'Test',
>     lastName: 'Sim',
>     imageUrl: null,
>     generationNumber: null,
>     lifeStage: 'ADULT',
>     isHeir: false,
>     isFounder: false,
>     aspirationName: null,
>     ...overrides,
>   }
> }
> ```
>
> Ensure `ChronicleSim` is imported at the top of the test file: `import type { ChronicleSim } from '../types'` (add it to the existing type import if one is present).

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/app/app/legacies/'[slug]'/lib/__tests__/derive.test.ts -t "never designates a null-generation heir"`
Expected: FAIL — the null-gen heir `hx` is currently the designate, so `designate?.sim.id` is `'hx'`, not `'h3'`.

- [ ] **Step 3: Add the `selectDesignateHeir` helper and use it in `deriveSuccession`**

In `src/app/app/legacies/[slug]/lib/derive.ts`, add this exported helper immediately **above** the `deriveSuccession` function (above its doc-comment):

```ts
/**
 * The reigning heir — shown as "Heir designate" in the succession line and as
 * the Hero's current heir. Chosen from heirs EXCLUDING the founder (the founder
 * is shown separately as "Founder").
 *
 * Rule: the highest non-null `generationNumber` wins. A null-generation heir is
 * never the designate unless EVERY heir is null-generation, in which case the
 * last by id is chosen (deterministic). Returns null when there are no
 * non-founder heirs.
 *
 * Both deriveSuccession and the page's currentHeir use this single selector so
 * the two never disagree about who the heir is.
 */
export function selectDesignateHeir(
  sims: ChronicleSim[],
  founderSimId: string | null,
): ChronicleSim | null {
  const heirs = sims.filter((s) => s.isHeir && s.id !== founderSimId)
  if (heirs.length === 0) return null
  return heirs.reduce((best, sim) => {
    const bestGen = best.generationNumber
    const simGen = sim.generationNumber
    if (simGen === null) {
      // No generation: only wins if best is also null-gen and sim sorts later.
      return bestGen === null && sim.id > best.id ? sim : best
    }
    if (bestGen === null) return sim // any numbered heir beats a null-gen one
    if (simGen !== bestGen) return simGen > bestGen ? sim : best
    return sim.id > best.id ? sim : best // tie → last by id
  })
}
```

Then change the labelling inside `deriveSuccession`. Replace:

```ts
  heirs.forEach((sim, index) => {
    const isLast = index === heirs.length - 1
    let role: string

    if (isLast) {
      role = 'Heir designate'
    } else if (sim.generationNumber !== null) {
      role = `Heir · Gen ${roman(sim.generationNumber)}`
    } else {
      role = 'Heir'
    }

    steps.push({ sim, role, isHeir: true, isFounder: false })
  })
```

with:

```ts
  const designate = selectDesignateHeir(sims, founderSimId)

  heirs.forEach((sim) => {
    let role: string

    if (designate && sim.id === designate.id) {
      role = 'Heir designate'
    } else if (sim.generationNumber !== null) {
      role = `Heir · Gen ${roman(sim.generationNumber)}`
    } else {
      role = 'Heir'
    }

    steps.push({ sim, role, isHeir: true, isFounder: false })
  })
```

- [ ] **Step 4: Run the new test to verify it passes**

Run: `npx vitest run src/app/app/legacies/'[slug]'/lib/__tests__/derive.test.ts -t "never designates a null-generation heir"`
Expected: PASS.

- [ ] **Step 5: Run the full derive suite and reconcile**

Run: `npx vitest run src/app/app/legacies/'[slug]'/lib/__tests__/derive.test.ts`
Expected: PASS. If a pre-existing test fails because it asserted a *null-generation* heir as the designate, that test encoded the bug — update its expectation to the corrected rule (numbered heir wins). Numbered-only scenarios (e.g. heirs gen 1/2/3 → designate gen 3) are unchanged and must still pass without edits.

- [ ] **Step 6: Use the shared selector for `currentHeir` in `page.tsx`**

In `src/app/app/legacies/[slug]/page.tsx`, add `selectDesignateHeir` to the existing import from `./lib/derive` (the line that already imports `deriveSuccession`). Then replace:

```ts
  const founder = chronicleSims.find((s) => s.isFounder) ?? null

  // Current heir = the heir with the highest generationNumber (nulls last).
  const currentHeir =
    chronicleSims
      .filter((s) => s.isHeir)
      .reduce<ChronicleSim | null>((best, sim) => {
        if (best === null) return sim
        const bestGen = best.generationNumber
        const simGen = sim.generationNumber
        if (simGen === null) return best
        if (bestGen === null) return sim
        return simGen > bestGen ? sim : best
      }, null) ?? null
```

with:

```ts
  const founder = chronicleSims.find((s) => s.isFounder) ?? null

  // Current heir = the same sim the succession line marks "Heir designate"
  // (highest numbered heir). Fall back to the founder when they are the only heir.
  const currentHeir =
    selectDesignateHeir(chronicleSims, fetched.founderSimId) ??
    (founder?.isHeir ? founder : null)
```

> If `ChronicleSim` is now unused in `page.tsx` after removing the `reduce<ChronicleSim | null>` generic, remove it from the import to satisfy lint (no unused imports). Run lint in Step 7 to confirm.

- [ ] **Step 7: Validate**

Run: `npx tsc --noEmit`
Expected: no errors.
Run: `npm run lint`
Expected: no errors or warnings.
Run: `npx vitest run src/app/app/legacies/'[slug]'/lib`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/app/app/legacies/'[slug]'/lib/derive.ts \
  src/app/app/legacies/'[slug]'/lib/__tests__/derive.test.ts \
  src/app/app/legacies/'[slug]'/page.tsx
git commit -m "fix(legacy): designate heir consistently between succession and hero"
```

---

## Task 4: PortraitAvatar falls back to the monogram on image error

**Problem:** When `imageUrl` 404s or fails to load, `next/image` leaves a broken-image box with no fallback. The component is also a closed-prop primitive that can't receive `data-testid`/`aria-*`. Fix: make it a client component that swaps to the monogram on `onError`, give the monogram a `title` (so screen readers announce the name, not bare initials), and adopt the `Card`/`Badge` props-spread convention.

> The un-allowlisted-host case (R2/S3) is **not** fixed here — `next/image` throws at render for hosts missing from `remotePatterns`, which `onError` cannot catch. That host lives on the `feat/s3-image-storage` branch; add it to `next.config.ts` `remotePatterns` when these branches merge. This task handles broken/404 images on already-allowlisted hosts.

**Files:**
- Modify: `src/components/ui/portrait-avatar/portrait-avatar.tsx`
- Modify: `src/components/ui/portrait-avatar/__tests__/portrait-avatar.test.tsx`

- [ ] **Step 1: Write the failing fallback test**

In `src/components/ui/portrait-avatar/__tests__/portrait-avatar.test.tsx`, update the `next/image` mock so it forwards `onError`, and import `fireEvent`. Replace the import line:

```ts
import { render, screen } from '@testing-library/react'
```

with:

```ts
import { render, screen, fireEvent } from '@testing-library/react'
```

Replace the `next/image` mock:

```ts
vi.mock('next/image', () => ({
  default: ({ alt }: { src: string; alt: string }) => (
    <span data-testid="portrait-image" aria-label={alt} />
  ),
}))
```

with:

```ts
vi.mock('next/image', () => ({
  default: ({ alt, onError }: { src: string; alt: string; onError?: () => void }) => (
    <span data-testid="portrait-image" aria-label={alt} onError={onError} />
  ),
}))
```

Add this test inside the `describe('PortraitAvatar', ...)` block:

```ts
  it('falls back to the monogram when the image fails to load', () => {
    render(
      <PortraitAvatar
        imageUrl="https://example.com/broken.jpg"
        firstName="Dina"
        lastName="Caliente"
      />
    )
    // Initially the image renders.
    fireEvent.error(screen.getByTestId('portrait-image'))
    // After the error, the monogram replaces it.
    expect(screen.queryByTestId('portrait-image')).not.toBeInTheDocument()
    expect(screen.getByText('DC')).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/ui/portrait-avatar/__tests__/portrait-avatar.test.tsx -t "falls back to the monogram"`
Expected: FAIL — there is no `onError` handler, so the image stays and `DC` never appears.

- [ ] **Step 3: Rewrite `portrait-avatar.tsx` with client state, fallback, and props spread**

Replace the entire contents of `src/components/ui/portrait-avatar/portrait-avatar.tsx` with:

```tsx
'use client'
import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import styles from './portrait-avatar.module.css'

export interface PortraitAvatarProps
  extends Omit<React.HTMLAttributes<HTMLElement>, 'children'> {
  imageUrl?: string | null
  firstName: string
  lastName: string
  size?: number
  ring?: 'founder' | 'heir' | 'green'
  /** When set, the avatar becomes a link (e.g. to the sim's detail page). */
  href?: string
  /** Accessible name for the link; defaults to "View {firstName} {lastName}". */
  ariaLabel?: string
}

export function PortraitAvatar({
  imageUrl,
  firstName,
  lastName,
  size = 56,
  ring = 'green',
  href,
  ariaLabel,
  className,
  ...rest
}: PortraitAvatarProps) {
  const [imgError, setImgError] = useState(false)
  const isAccent = ring === 'founder' || ring === 'heir'
  const initials = `${firstName[0] ?? ''}${lastName[0] ?? ''}`
  const fullName = `${firstName} ${lastName}`

  const accentRingStyle = isAccent
    ? { boxShadow: '0 0 0 2px var(--bg-card), 0 0 0 3px var(--amber)' }
    : {}

  // When linked, the className + spread props land on the <Link>; otherwise on
  // the avatar root.
  const rootClass = href ? undefined : className
  const rootRest = href ? {} : rest
  const showImage = imageUrl && !imgError

  const avatar = showImage ? (
    <div
      className={cn(styles.photoContainer, rootClass)}
      style={{ width: size, height: size, ...accentRingStyle }}
      {...rootRest}
    >
      <Image
        src={imageUrl}
        alt={href ? '' : fullName}
        width={size}
        height={size}
        style={{ objectFit: 'cover' }}
        onError={() => setImgError(true)}
      />
    </div>
  ) : (
    <div
      className={cn(styles.monogram, isAccent && styles.accentMonogram, rootClass)}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.36),
        ...accentRingStyle,
      }}
      // Give the monogram an accessible name so screen readers announce the sim,
      // not the bare initials. (When linked, the <Link> aria-label covers this.)
      title={href ? undefined : fullName}
      {...rootRest}
    >
      <span
        className={cn(styles.innerRing, isAccent && styles.accentInnerRing)}
        style={{ inset: Math.max(3, Math.round(size * 0.08)) }}
        aria-hidden="true"
      />
      {initials}
    </div>
  )

  if (href) {
    return (
      <Link
        href={href}
        className={cn(styles.link, className)}
        aria-label={ariaLabel ?? `View ${fullName}`}
        {...rest}
      >
        {avatar}
      </Link>
    )
  }

  return avatar
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/ui/portrait-avatar/__tests__/portrait-avatar.test.tsx`
Expected: PASS — all existing tests plus the new fallback test.

- [ ] **Step 5: Validate**

Run: `npx tsc --noEmit`
Expected: no errors.
Run: `npm run lint`
Expected: no errors or warnings.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/portrait-avatar/portrait-avatar.tsx \
  src/components/ui/portrait-avatar/__tests__/portrait-avatar.test.tsx
git commit -m "fix(ui): PortraitAvatar falls back to monogram on image error"
```

---

## Task 5: New UI primitives adopt the `Card`/`Badge` props convention

**Problem:** `Card` and `Badge` `extends React.HTMLAttributes<…>` and spread `{...props}`, so they accept `id`, `aria-*`, event handlers, etc. The five newer primitives (`Eyebrow`, `GenerationBadge`, `SectionHeading`, `StatBlock`, `TreeIcon`) declare closed interfaces and forward only `className`. Align them to the convention. Additionally widen `SectionHeading`'s `eyebrow`/`title`/`blurb` to `ReactNode` so callers can pass rich content (e.g. an inline `<em>` accent) instead of hand-rolling the heading cluster.

**Files:**
- Modify: `src/components/ui/eyebrow/eyebrow.tsx`
- Modify: `src/components/ui/generation-badge/generation-badge.tsx`
- Modify: `src/components/ui/section-heading/section-heading.tsx`
- Modify: `src/components/ui/stat-block/stat-block.tsx`
- Modify: `src/components/ui/icons/tree-icon.tsx`

> **No behaviour change** — these are additive type/spread changes. The existing component tests (`portrait-avatar`, etc.) and the page render must stay green. There is no new test to write; the guard is `tsc` + `lint` + the full suite. (Per the project's Testing Trophy, do not add unit tests for trivial pass-through wrappers.)

- [ ] **Step 1: `Eyebrow` — extend `HTMLAttributes`, spread props**

Replace the entire contents of `src/components/ui/eyebrow/eyebrow.tsx` with:

```tsx
import { cn } from '@/lib/utils'
import styles from './eyebrow.module.css'

export interface EyebrowProps
  extends React.HTMLAttributes<HTMLParagraphElement> {
  /** Overrides the label color. Pass a `var(--token)` (e.g. `var(--amber-text)`), never a raw hex. */
  color?: string
}

export function Eyebrow({ children, color, className, style, ...props }: EyebrowProps) {
  return (
    <p
      className={cn(styles.eyebrow, className)}
      style={color ? { color, ...style } : style}
      {...props}
    >
      {children}
    </p>
  )
}
```

- [ ] **Step 2: `GenerationBadge` — extend `HTMLAttributes`, spread props**

Replace the entire contents of `src/components/ui/generation-badge/generation-badge.tsx` with:

```tsx
import { cn } from '@/lib/utils'
import styles from './generation-badge.module.css'

export type GenerationBadgeProps = React.HTMLAttributes<HTMLSpanElement>

export function GenerationBadge({ children, className, ...props }: GenerationBadgeProps) {
  return (
    <span className={cn(styles.badge, className)} {...props}>
      {children}
    </span>
  )
}
```

- [ ] **Step 3: `SectionHeading` — `ReactNode` props, extend `HTMLAttributes`, spread**

Replace the entire contents of `src/components/ui/section-heading/section-heading.tsx` with:

```tsx
import { cn } from '@/lib/utils'
import { Eyebrow } from '@/components/ui/eyebrow/eyebrow'
import styles from './section-heading.module.css'

export interface SectionHeadingProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  eyebrow: React.ReactNode
  title: React.ReactNode
  blurb?: React.ReactNode
}

export function SectionHeading({
  eyebrow,
  title,
  blurb,
  className,
  ...props
}: SectionHeadingProps) {
  return (
    <div className={cn(styles.container, className)} {...props}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className={styles.title}>{title}</h2>
      {blurb && <p className={styles.blurb}>{blurb}</p>}
    </div>
  )
}
```

> `HTMLAttributes` already declares `title?: string`; we `Omit` it so our `ReactNode` `title` prop does not clash.

- [ ] **Step 4: `StatBlock` — extend `HTMLAttributes`, spread props**

Replace the entire contents of `src/components/ui/stat-block/stat-block.tsx` with:

```tsx
import { cn } from '@/lib/utils'
import styles from './stat-block.module.css'

export interface StatBlockProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string | number
  label: React.ReactNode
  /** Overrides the numeral color. Pass a `var(--token)` (e.g. `var(--amber-text)`), never a raw hex. */
  accent?: string
}

export function StatBlock({ value, label, accent, className, ...props }: StatBlockProps) {
  return (
    <div className={cn(styles.container, className)} {...props}>
      <span className={styles.value} style={accent ? { color: accent } : undefined}>
        {value}
      </span>
      <span className={styles.label}>{label}</span>
    </div>
  )
}
```

- [ ] **Step 5: `TreeIcon` — extend `SVGProps`, spread props**

Replace the entire contents of `src/components/ui/icons/tree-icon.tsx` with:

```tsx
export type TreeIconProps = React.SVGProps<SVGSVGElement>

export function TreeIcon({ className, ...props }: TreeIconProps) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <circle cx="7" cy="2.5" r="1.5" />
      <circle cx="3" cy="11" r="1.5" />
      <circle cx="11" cy="11" r="1.5" />
      <path d="M7 4 V 7 M3 9.5 V 7 H 11 V 9.5" />
    </svg>
  )
}
```

> `width`/`height`/`aria-hidden` come before `{...props}`, so callers can override any of them (e.g. a different size, or `aria-hidden={false}` + `role`/`aria-label` for a meaningful icon).

- [ ] **Step 6: Validate (full suite — these primitives are widely consumed)**

Run: `npx tsc --noEmit`
Expected: no errors.
Run: `npm run lint`
Expected: no errors or warnings.
Run: `npm test`
Expected: PASS (whole component + integration suite).

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/eyebrow/eyebrow.tsx \
  src/components/ui/generation-badge/generation-badge.tsx \
  src/components/ui/section-heading/section-heading.tsx \
  src/components/ui/stat-block/stat-block.tsx \
  src/components/ui/icons/tree-icon.tsx
git commit -m "refactor(ui): align new primitives to Card/Badge props-spread convention"
```

---

## Task 6: Legacy page responsive collapse + section landmarks + nav a11y

**Problem:** The legacy page grid is a fixed `200px 1fr` with **no media queries anywhere** — the 200px rail never reflows (fails WCAG 1.4.10). The scroll-target `<section>`s have no accessible names, so they aren't landmark regions for the nav they back. The nav buttons lack a `:focus-visible` ring, and use `aria-current="true"` where `aria-current="location"` is semantically correct.

**Files:**
- Modify: `src/app/app/legacies/[slug]/page.module.css`
- Modify: `src/app/app/legacies/[slug]/_components/section-nav/section-nav.module.css`
- Modify: `src/app/app/legacies/[slug]/_components/section-nav/section-nav.tsx:123`
- Modify: `src/app/app/legacies/[slug]/_components/chronicle-sections/chronicle-sections.tsx`

- [ ] **Step 1: Make the page grid responsive**

Replace the entire contents of `src/app/app/legacies/[slug]/page.module.css` with:

```css
.grid {
  display: grid;
  grid-template-columns: 200px 1fr;
  align-items: start;
}

/* Below the rail breakpoint, collapse to a single column. The sticky rail
   becomes a normal-flow horizontal nav at the top (see section-nav.module.css). */
@media (max-width: 768px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 2: Add `:focus-visible` ring and narrow-width handling to the nav**

In `src/app/app/legacies/[slug]/_components/section-nav/section-nav.module.css`, add a `:focus-visible` rule immediately after the `.item:hover` block:

```css
.item:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
```

Then append a breakpoint at the end of the file that turns the vertical sticky rail into a horizontal, scrollable, non-sticky strip on narrow screens:

```css
@media (max-width: 768px) {
  .rail {
    position: static;
    width: auto;
    flex-direction: row;
    gap: 4px;
    padding: 12px 16px;
    overflow-x: auto;
  }

  .item {
    border-left: none;
    border-bottom: 2px solid transparent;
    border-radius: 6px 6px 0 0;
    white-space: nowrap;
  }

  .itemActive,
  .itemActive:hover {
    border-left: none;
    border-bottom: 2px solid var(--green);
  }
}
```

- [ ] **Step 3: Use `aria-current="location"` in the nav**

In `src/app/app/legacies/[slug]/_components/section-nav/section-nav.tsx`, replace:

```tsx
            aria-current={isActive ? 'true' : undefined}
```

with:

```tsx
            aria-current={isActive ? 'location' : undefined}
```

- [ ] **Step 4: Give each `<section>` an accessible name (landmark region)**

In `src/app/app/legacies/[slug]/_components/chronicle-sections/chronicle-sections.tsx`, add an `aria-label` to each `<section>` so it is exposed as a `region` landmark the nav can target. Apply these four edits:

Replace `<section id="hero" data-section="hero" className={styles.heroSection}>` with `<section id="hero" data-section="hero" aria-label="Overview" className={styles.heroSection}>`

Replace:
```tsx
      <section
        id="succession"
        data-section="succession"
        className={styles.cardSection}
      >
```
with:
```tsx
      <section
        id="succession"
        data-section="succession"
        aria-label="Succession"
        className={styles.cardSection}
      >
```

Replace:
```tsx
      <section
        id="milestones"
        data-section="milestones"
        className={styles.cardSection}
      >
```
with:
```tsx
      <section
        id="milestones"
        data-section="milestones"
        aria-label="Milestones"
        className={styles.cardSection}
      >
```

Replace:
```tsx
      <section
        id="sims"
        data-section="sims"
        data-testid="roster"
        className={styles.rosterSection}
      >
```
with:
```tsx
      <section
        id="sims"
        data-section="sims"
        data-testid="roster"
        aria-label="Sims"
        className={styles.rosterSection}
      >
```

- [ ] **Step 5: Validate**

Run: `npx tsc --noEmit`
Expected: no errors.
Run: `npm run lint`
Expected: no errors or warnings.
Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/app/legacies/'[slug]'/page.module.css \
  src/app/app/legacies/'[slug]'/_components/section-nav/section-nav.module.css \
  src/app/app/legacies/'[slug]'/_components/section-nav/section-nav.tsx \
  src/app/app/legacies/'[slug]'/_components/chronicle-sections/chronicle-sections.tsx
git commit -m "fix(legacy): responsive page grid, section landmarks, nav focus + aria-current"
```

---

## Final Verification (after all tasks)

- [ ] **Full static + test sweep**

Run: `npx tsc --noEmit`
Expected: no errors.
Run: `npm run lint`
Expected: no errors or warnings.
Run: `npm test`
Expected: all suites PASS.

- [ ] **E2E**

Run: `npm run test:e2e`
Expected: PASS. (Requires PostgreSQL + seeded data + env vars per `.claude/rules/testing.md`. If the environment is unavailable, state that explicitly rather than skipping silently.)

- [ ] **Confirm no suppressions or stray primitives were introduced**

Run: `grep -rn "eslint-disable\|@ts-ignore\|@ts-expect-error\|@ts-nocheck" src/`
Expected: no matches.
Run: `grep -rn "color-amber-700\|color-amber-400" src/`
Expected: only the `globals.css` token definitions + `--warning`.
