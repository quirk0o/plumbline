# Legacy Tree — Rendering Engine (Plan 1 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the pure-SVG lineage tree the rendering primitives the Atlas overlay needs — intrinsic (natural-scale) sizing, a per-node "dimmed" state for search highlighting, and a hand-rolled `usePanZoom` hook (drag-pan, wheel-zoom, fit/clamp). This plan produces reusable, independently unit-tested pieces; Plan 2 wires them into the overlay.

**Architecture:** The tree SVG renders at its computed-viewBox pixel size (so a transform layer, not CSS stretching, controls visible scale). Search highlights by fading non-matching nodes (`dimmedIds`). `usePanZoom` keeps a `{x, y, scale}` transform with pure helpers (`computeFit`, `clampZoom`, `zoomAtPoint`) that are unit-tested; initial state fits the content to the viewport capped at 100% (never upscales).

**Tech Stack:** React, TypeScript, CSS Modules, Vitest + React Testing Library (jsdom). No new dependencies.

**Worktree:** Work in `.claude/worktrees/legacy-chronicle-redesign` (branch `worktree-legacy-chronicle-redesign`); run commands from its root.

**Out of scope:** `src/components/family-tree/FamilyTree.tsx` (the sim-detail ReactFlow mini-tree) — do not touch.

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `src/components/lineage-tree/lineage-tree.tsx` | Pure-SVG tree. | Intrinsic `width`/`height` attrs; new `dimmedIds` prop. |
| `src/components/lineage-tree/crest-node.tsx` | One sim medallion. | `isDimmed` opacity + `data-tree-node` marker. |
| `src/components/lineage-tree/lineage-tree.module.css` | Tree SVG styling. | `.tree` → plain block (intrinsic size). |
| `src/components/lineage-tree/use-pan-zoom.ts` | **New.** Pan/zoom state + pure math. | Create. |
| `src/components/lineage-tree/__tests__/lineage-tree.test.tsx` | Tree tests. | Add intrinsic-size + dim assertions. |
| `src/components/lineage-tree/__tests__/use-pan-zoom.test.ts` | **New.** Pure-helper unit tests. | Create. |

---

## Task 1: Tree renders at intrinsic size + supports search-dimming

The pan/zoom layer (Task 2) scales the tree via CSS transform, so the SVG must render at its **natural** pixel size. We also add a per-node dim state (search highlight) and a `data-tree-node` marker so the pan handler can distinguish a node press from a background press.

**Files:**
- Modify: `src/components/lineage-tree/lineage-tree.tsx`
- Modify: `src/components/lineage-tree/crest-node.tsx`
- Modify: `src/components/lineage-tree/lineage-tree.module.css`
- Test: `src/components/lineage-tree/__tests__/lineage-tree.test.tsx`

- [ ] **Step 1: Add failing tests for intrinsic sizing + dimming**

In `src/components/lineage-tree/__tests__/lineage-tree.test.tsx`, add inside `describe('LineageTree', …)`:

```tsx
  it('sizes the <svg> to its intrinsic viewBox (pan/zoom scales it, CSS does not stretch it)', () => {
    render(<LineageTree sims={sims} familyEdges={familyEdges} partnerEdges={partnerEdges} />)
    const svg = screen.getByRole('group', { name: /Family tree —/ })
    const viewBox = svg.getAttribute('viewBox')!.split(' ')
    expect(svg.getAttribute('width')).toBe(viewBox[2])
    expect(svg.getAttribute('height')).toBe(viewBox[3])
  })

  it('fades nodes whose id is in dimmedIds (search highlight)', () => {
    render(
      <LineageTree
        sims={sims}
        familyEdges={familyEdges}
        partnerEdges={partnerEdges}
        dimmedIds={new Set(['founder'])}
      />,
    )
    const dina = screen.getByText('Dina').closest('[data-tree-node]') as HTMLElement
    const reed = screen.getByText('Reed').closest('[data-tree-node]') as HTMLElement
    expect(dina.style.opacity).toBe('0.25')
    expect(reed.style.opacity).toBe('1')
  })
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/components/lineage-tree/__tests__/lineage-tree.test.tsx`
Expected: FAIL — `width` attr is `null`; `dimmedIds`/`data-tree-node` not implemented.

- [ ] **Step 3: Implement intrinsic size + `dimmedIds` in `lineage-tree.tsx`**

a) Add `dimmedIds` to `LineageTreeProps`:

```tsx
export type LineageTreeProps = {
  sims: LineageTreeSim[]
  familyEdges: LineageFamilyEdge[]
  partnerEdges: LineagePartnerEdge[]
  founderSimId?: string
  selectedId?: string
  onSelectSim?: (id: string) => void
  /** Ids to fade (search highlight). Undefined = nothing dimmed. */
  dimmedIds?: Set<string>
  /** Legacy name for the tree's accessible group label (defaults to "Family"). */
  legacyName?: string
  className?: string
}
```

b) Destructure `dimmedIds` in the function signature (next to `onSelectSim`).

c) Add intrinsic size attributes to the `<svg>` (`{ width, height }` is already destructured from `layout.viewBox`):

```tsx
    <svg
      className={cn(styles.tree, className)}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      preserveAspectRatio="xMidYMid meet"
      role="group"
      aria-label={`${legacyName ?? 'Family'} tree — ${sims.length} sims`}
    >
```

d) Pass `isDimmed` to each node in the `layout.nodes.map(...)` render:

```tsx
        return (
          <CrestNode
            key={node.id}
            sim={sim}
            x={node.x}
            y={node.y}
            isHeir={sim.isHeir}
            isFounder={founderSimId === sim.id}
            isSelected={selectedId === sim.id}
            isDimmed={dimmedIds?.has(sim.id) ?? false}
            plumbobGradientId={defIds.plumbobGradient}
            liftFilterId={defIds.liftShadow}
            onSelect={onSelectSim}
          />
        )
```

- [ ] **Step 4: Implement `isDimmed` + `data-tree-node` in `crest-node.tsx`**

a) Add `isDimmed?: boolean` to `CrestNodeProps` and to the destructured params (default `false`).

b) Replace the opening `<g …>` of the node with:

```tsx
    <g
      data-tree-node
      transform={`translate(${x}, ${y})`}
      className={onSelect ? styles.node : undefined}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      aria-label={accessibleName}
      style={{
        ...(onSelect ? { cursor: 'pointer' } : {}),
        opacity: isDimmed ? 0.25 : 1,
        transition: 'opacity var(--transition-base)',
      }}
      onClick={onSelect ? handleActivate : undefined}
      onKeyDown={
        onSelect
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleActivate()
              }
            }
          : undefined
      }
    >
```

- [ ] **Step 5: Simplify `.tree` CSS (intrinsic size; no stretch)**

In `src/components/lineage-tree/lineage-tree.module.css`, replace the `.tree` rule with:

```css
.tree {
  display: block;
}
```

(Keep `.node` and `.focusRing` rules unchanged.)

- [ ] **Step 6: Run tests, type-check, lint, commit**

```bash
npm test -- src/components/lineage-tree/__tests__/lineage-tree.test.tsx
npx tsc --noEmit
npm run lint
git add src/components/lineage-tree/lineage-tree.tsx src/components/lineage-tree/crest-node.tsx src/components/lineage-tree/lineage-tree.module.css src/components/lineage-tree/__tests__/lineage-tree.test.tsx
git commit -m "feat(legacy-tree): intrinsic SVG sizing + search-dim node state"
```

---

## Task 2: `usePanZoom` hook (drag-pan, wheel-zoom, fit, clamp)

Pure math (`computeFit`, `clampZoom`, `zoomAtPoint`) is unit-tested; the DOM wiring is verified live in Plan 2. Initial transform = fit-to-viewport capped at 100%.

**Files:**
- Create: `src/components/lineage-tree/use-pan-zoom.ts`
- Test: `src/components/lineage-tree/__tests__/use-pan-zoom.test.ts`

- [ ] **Step 1: Write the failing unit tests**

Create `src/components/lineage-tree/__tests__/use-pan-zoom.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { clampZoom, computeFit, zoomAtPoint, MIN_ZOOM, MAX_ZOOM } from '../use-pan-zoom'

describe('clampZoom', () => {
  it('clamps to [MIN_ZOOM, MAX_ZOOM]', () => {
    expect(clampZoom(0.01)).toBe(MIN_ZOOM)
    expect(clampZoom(99)).toBe(MAX_ZOOM)
    expect(clampZoom(1)).toBe(1)
  })
})

describe('computeFit', () => {
  it('never upscales past 100% and centers a small content', () => {
    const t = computeFit({ width: 1000, height: 1000 }, { width: 200, height: 100 }, 32)
    expect(t.scale).toBe(1)
    expect(t.x).toBe((1000 - 200) / 2)
    expect(t.y).toBe((1000 - 100) / 2)
  })

  it('scales down to fit a large content', () => {
    const t = computeFit({ width: 1000, height: 1000 }, { width: 2000, height: 500 }, 32)
    expect(t.scale).toBeCloseTo((1000 - 64) / 2000, 5)
  })

  it('returns identity for empty content', () => {
    expect(computeFit({ width: 1000, height: 1000 }, { width: 0, height: 0 })).toEqual({
      x: 0,
      y: 0,
      scale: 1,
    })
  })
})

describe('zoomAtPoint', () => {
  it('keeps the focal point stationary while zooming', () => {
    const next = zoomAtPoint({ x: 0, y: 0, scale: 1 }, 2, 100, 100)
    expect(next.scale).toBe(2)
    const contentXAfter = (100 - next.x) / next.scale
    expect(contentXAfter).toBeCloseTo(100, 5)
  })

  it('clamps the zoom', () => {
    expect(zoomAtPoint({ x: 0, y: 0, scale: 1 }, 999, 0, 0).scale).toBe(MAX_ZOOM)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/components/lineage-tree/__tests__/use-pan-zoom.test.ts`
Expected: FAIL — module `../use-pan-zoom` does not exist.

- [ ] **Step 3: Implement the hook + helpers**

Create `src/components/lineage-tree/use-pan-zoom.ts`:

```ts
'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

export const MIN_ZOOM = 0.2
export const MAX_ZOOM = 2

export type Transform = { x: number; y: number; scale: number }

export function clampZoom(z: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))
}

/** Fit `content` (content px) into `viewport` (px), capped at 100%, centered. */
export function computeFit(
  viewport: { width: number; height: number },
  content: { width: number; height: number },
  padding = 32,
): Transform {
  if (content.width <= 0 || content.height <= 0) return { x: 0, y: 0, scale: 1 }
  const availW = Math.max(0, viewport.width - padding * 2)
  const availH = Math.max(0, viewport.height - padding * 2)
  const scale = Math.min(availW / content.width, availH / content.height, 1)
  return {
    scale,
    x: (viewport.width - content.width * scale) / 2,
    y: (viewport.height - content.height * scale) / 2,
  }
}

/** New transform after zooming toward a viewport-space point (px). */
export function zoomAtPoint(t: Transform, nextScaleRaw: number, px: number, py: number): Transform {
  const scale = clampZoom(nextScaleRaw)
  const ratio = scale / t.scale
  return { scale, x: px - (px - t.x) * ratio, y: py - (py - t.y) * ratio }
}

/**
 * Drag-to-pan + wheel-zoom + fit/step controls for an absolutely-sized content
 * box inside `surfaceRef`. Re-fits on mount, on content-size change, and on
 * window resize. Panning is suppressed when the press starts on a tree node
 * (`[data-tree-node]`) so node clicks still navigate.
 */
export function usePanZoom(
  surfaceRef: React.RefObject<HTMLElement | null>,
  contentWidth: number,
  contentHeight: number,
) {
  const [t, setT] = useState<Transform>({ x: 0, y: 0, scale: 1 })
  const drag = useRef<{ x: number; y: number } | null>(null)

  const surfaceSize = useCallback(() => {
    const el = surfaceRef.current
    return el ? { width: el.clientWidth, height: el.clientHeight } : { width: 0, height: 0 }
  }, [surfaceRef])

  const fit = useCallback(() => {
    setT(computeFit(surfaceSize(), { width: contentWidth, height: contentHeight }))
  }, [surfaceSize, contentWidth, contentHeight])

  // Fit on mount + whenever the content size changes.
  useEffect(() => {
    fit()
  }, [fit])

  // Re-fit on window resize (overlay is full-viewport).
  useEffect(() => {
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [fit])

  // Native non-passive wheel listener so preventDefault works.
  useEffect(() => {
    const el = surfaceRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
      setT((cur) => zoomAtPoint(cur, cur.scale * factor, e.clientX - rect.left, e.clientY - rect.top))
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [surfaceRef])

  const zoomBy = useCallback(
    (factor: number) => {
      const { width, height } = surfaceSize()
      setT((cur) => zoomAtPoint(cur, cur.scale * factor, width / 2, height / 2))
    },
    [surfaceSize],
  )

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-tree-node]')) return
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY }
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!drag.current) return
    const dx = e.clientX - drag.current.x
    const dy = e.clientY - drag.current.y
    drag.current = { x: e.clientX, y: e.clientY }
    setT((cur) => ({ ...cur, x: cur.x + dx, y: cur.y + dy }))
  }, [])

  const endDrag = useCallback((e: React.PointerEvent) => {
    if (!drag.current) return
    drag.current = null
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      // pointer capture may already be released; ignore.
    }
  }, [])

  return {
    transform: t,
    zoomPercent: Math.round(t.scale * 100),
    fit,
    zoomIn: () => zoomBy(1.2),
    zoomOut: () => zoomBy(1 / 1.2),
    isPanning: drag.current !== null,
    surfaceProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
    },
  }
}
```

- [ ] **Step 4: Run tests, type-check, lint, commit**

```bash
npm test -- src/components/lineage-tree/__tests__/use-pan-zoom.test.ts
npx tsc --noEmit
npm run lint
git add src/components/lineage-tree/use-pan-zoom.ts src/components/lineage-tree/__tests__/use-pan-zoom.test.ts
git commit -m "feat(legacy-tree): usePanZoom hook (drag-pan, wheel-zoom, fit, clamp)"
```

---

## Self-Review

- **Coverage:** intrinsic sizing (Task 1 Step 3c + 5), search-dim (Task 1 Steps 3d/4), pan/zoom hook with fit-capped-at-100% (Task 2).
- **Type consistency:** `dimmedIds?: Set<string>` defined in `lineage-tree.tsx`, consumed by `crest-node.tsx` via `isDimmed`. `usePanZoom(surfaceRef, contentWidth, contentHeight)` returns `{ transform, zoomPercent, fit, zoomIn, zoomOut, isPanning, surfaceProps }` — the exact shape Plan 2 consumes. `computeFit`/`clampZoom`/`zoomAtPoint`/`MIN_ZOOM`/`MAX_ZOOM` are all exported and tested.
- **No placeholders:** every code step is complete; run steps have exact commands + expected results.

---

## Handoff to Plan 2

After both tasks are committed and green, proceed to **`2026-05-30-legacy-tree-atlas-overlay.md`**, which consumes `usePanZoom`, `dimmedIds`, and the intrinsic-size SVG.
