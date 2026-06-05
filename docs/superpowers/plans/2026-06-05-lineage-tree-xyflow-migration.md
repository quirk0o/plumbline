# Lineage Tree → xyflow Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-platform the legacy tree Atlas onto `@xyflow/react`, keeping `computeLineageLayout` as the layout engine, rebuilding the Crest medallion as an HTML node (optimized `next/image` portraits, native focus, broken-image fallback), and converging the sim-detail mini tree onto the same renderer so the dagre-based `family-tree/` stack and `@dagrejs/dagre` can be deleted.

**Architecture:** `computeLineageLayout` (`src/components/lineage-tree/layout.ts`) stays untouched as the single source of positions. A new pure adapter `toFlowGraph` converts its `LineageLayout` output into xyflow nodes/edges: `crest` nodes (HTML medallions), `genLabel` pill nodes, invisible `union` nodes at marriage-bond midpoints (so descent connectors can anchor to a non-node point), `marriage` edges (amber line + diamond), and `descent` edges (right-angle path). A `LineageFlow` component renders these in a `<ReactFlow>` canvas, replacing the hand-rolled SVG shell (`lineage-tree.tsx`, `connectors.tsx`, `crest-node.tsx`, `tree-defs.tsx`) and the entire `usePanZoom` hook — pan, wheel-zoom-to-cursor, pinch-zoom, and fit-capped-at-100% come from xyflow.

**Tech Stack:** Next.js 16, React 19, TypeScript, `@xyflow/react` v12 (already installed at `^12.10.2` — do **not** reinstall), CSS Modules, Vitest + RTL (jsdom), Playwright. `@dagrejs/dagre` is **removed** at the end.

**Out of scope:** Any change to `layout.ts` or its tests; the `sims.getTreeData` procedure (already returns `lifeStage` + `isHeir`); the inspector, toolbar, and capsule internals (only their wiring changes).

---

## Version control (GitButler — read first)

This repo uses GitButler with potentially multiple agents in flight. Never use raw `git` for writes.

1. Before starting:
   - `but status -fv` to see the workspace state and other agents' in-flight branches
   - `but branch new feat/lineage-tree-xyflow` to create this session's branch
2. For every commit step below:
   - `but status -fv` — find the CLI IDs of exactly the files listed in that task
   - `but commit feat/lineage-tree-xyflow -m "<message>" --changes <id1>,<id2>` — only those IDs
3. Never commit hunks belonging to another agent's branch. Do not push or open PRs.

**Validation after every task:** `npx tsc --noEmit` and `npm run lint` must both be clean before committing. No eslint-disable / @ts-ignore — ever; fix the root cause.

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `src/test/setup.ts` | jsdom polyfills. | Add xyflow mocks (DOMMatrixReadOnly, offsetWidth/Height, getBBox). |
| `src/components/lineage-tree/layout.ts` | Pure layout math. | **Untouched.** |
| `src/components/lineage-tree/to-flow-graph.ts` | **New.** Pure adapter: `LineageLayout` → xyflow nodes/edges. Owns the shared `LineageFlowSim` type. | Create. |
| `src/components/lineage-tree/crest-flow-node.tsx` | **New.** HTML Crest medallion node (button + `PortraitAvatar` + `Plumbob` crown). | Create. |
| `src/components/lineage-tree/crest-flow-node.module.css` | **New.** Crest node styling. | Create. |
| `src/components/lineage-tree/flow-parts.tsx` | **New.** `GenLabelNode`, `UnionNode`, `MarriageEdge`, `DescentEdge`. | Create. |
| `src/components/lineage-tree/lineage-flow.tsx` | **New.** `<ReactFlow>` wrapper: nodeTypes/edgeTypes, fit options, refit, focus-pan. Replaces `lineage-tree.tsx` + `use-pan-zoom.ts`. | Create. |
| `src/components/lineage-tree/lineage-flow.module.css` | **New.** Flow wrapper + gen pill styling. | Create. |
| `src/components/lineage-tree/__tests__/to-flow-graph.test.ts` | **New.** Adapter unit tests. | Create. |
| `src/components/lineage-tree/__tests__/crest-flow-node.test.tsx` | **New.** Ports `crest-node.test.tsx` cases. | Create. |
| `src/components/lineage-tree/__tests__/lineage-flow.test.tsx` | **New.** Ports `lineage-tree.test.tsx` + `lineage-tree.a11y.test.tsx` cases. | Create. |
| `…/_components/tree-atlas/tree-atlas.tsx` | Atlas page component. | Swap `LineageTree`+`usePanZoom` → `ReactFlowProvider`+`LineageFlow`; bottom bar uses xyflow hooks. |
| `…/_components/tree-atlas/tree-atlas.module.css` | Atlas styling. | Remove `.surface`/`.viewport`; add `.flowSurface`. |
| `src/server/routers/sims.ts:10-12` | Mini-tree select. | Add `lifeStage` + `isHeir` to `miniTreeSimSelect`. |
| `…/sims/[id]/family-tree-mini.tsx` | Sim-detail mini tree. | Render `LineageFlow` (focus ring + click-to-navigate). |
| `src/components/lineage-tree/{lineage-tree.tsx, crest-node.tsx, connectors.tsx, tree-defs.tsx, use-pan-zoom.ts, lineage-tree.module.css}` + their tests | Old SVG stack. | **Delete** (Task 8). |
| `src/components/family-tree/` (whole dir), `@dagrejs/dagre` | Old dagre stack. | **Delete / uninstall** (Task 9). |

(`…` = `src/app/app/legacies/[slug]`.)

---

### Task 1: jsdom mocks for xyflow

xyflow measures DOM in ways jsdom doesn't implement. `ResizeObserver` and pointer-capture are already mocked in `src/test/setup.ts`; add the rest (per xyflow's official testing guidance).

**Files:**
- Modify: `src/test/setup.ts`

- [ ] **Step 1: Append the mocks**

Add at the end of `src/test/setup.ts`, following the existing guard style:

```ts
// @xyflow/react measures the viewport via DOMMatrixReadOnly and element
// offsets; jsdom implements neither. Minimal mocks per the React Flow
// testing guide (reactflow.dev/learn/advanced-use/testing).
if (typeof global.DOMMatrixReadOnly === 'undefined') {
  class DOMMatrixReadOnlyMock {
    m22: number
    constructor(transform?: string) {
      const scale = transform?.match(/scale\(([\d.]+)\)/)?.[1]
      this.m22 = scale === undefined ? 1 : +scale
    }
  }
  global.DOMMatrixReadOnly = DOMMatrixReadOnlyMock as unknown as typeof DOMMatrixReadOnly
}

if (typeof HTMLElement !== 'undefined') {
  Object.defineProperties(HTMLElement.prototype, {
    offsetHeight: { configurable: true, get(this: HTMLElement) { return parseFloat(this.style.height) || 600 } },
    offsetWidth: { configurable: true, get(this: HTMLElement) { return parseFloat(this.style.width) || 800 } },
  })
}

if (typeof SVGElement !== 'undefined' && !('getBBox' in SVGElement.prototype)) {
  ;(SVGElement.prototype as SVGElement['prototype'] & { getBBox: () => DOMRect }).getBBox = () =>
    ({ x: 0, y: 0, width: 0, height: 0 }) as DOMRect
}
```

If TypeScript complains about the `SVGElement['prototype']` intersection, use a module-scoped declaration instead — do not `@ts-ignore`:

```ts
declare global {
  interface SVGElement {
    getBBox?: () => DOMRect
  }
}
```

- [ ] **Step 2: Verify the suite is still green**

Run: `npm test`
Expected: same pass count as before this task (the mocks must not break cmdk/Radix tests).

- [ ] **Step 3: Validate and commit**

```bash
npx tsc --noEmit && npm run lint
but status -fv   # CLI ID for: src/test/setup.ts
but commit feat/lineage-tree-xyflow -m "test: add xyflow jsdom mocks (DOMMatrix, offsets, getBBox)" --changes <id>
```

---

### Task 2: `toFlowGraph` pure adapter

Converts `LineageLayout` + sims + family edges into xyflow nodes/edges. Pure and deterministic, like `layout.ts`.

**Files:**
- Create: `src/components/lineage-tree/to-flow-graph.ts`
- Test: `src/components/lineage-tree/__tests__/to-flow-graph.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { computeLineageLayout, CREST_ANCHORS } from '../layout'
import { toFlowGraph, type LineageFlowSim } from '../to-flow-graph'

const sim = (id: string, gen: number | null, extra: Partial<LineageFlowSim> = {}): LineageFlowSim => ({
  id,
  firstName: id,
  lastName: 'Test',
  imageUrl: null,
  generationNumber: gen,
  lifeStage: 'ADULT',
  isHeir: false,
  ...extra,
})

// Founder couple (gen 1) with one child (gen 2).
const sims = [sim('f1', 1), sim('f2', 1), sim('c1', 2, { isHeir: true })]
const familyEdges = [
  { parentId: 'f1', childId: 'c1' },
  { parentId: 'f2', childId: 'c1' },
]
const partnerEdges = [{ simAId: 'f1', simBId: 'f2' }]
const layout = computeLineageLayout(sims, familyEdges, partnerEdges)

describe('toFlowGraph', () => {
  const graph = toFlowGraph(layout, sims, familyEdges, {})

  it('emits one crest node per sim at the layout position', () => {
    const crests = graph.nodes.filter((n) => n.type === 'crest')
    expect(crests).toHaveLength(3)
    for (const node of crests) {
      expect(node.position).toEqual({ x: layout.byId[node.id].x, y: layout.byId[node.id].y })
    }
  })

  it('emits a non-interactive genLabel node per rendered row', () => {
    const labels = graph.nodes.filter((n) => n.type === 'genLabel')
    expect(labels.map((n) => n.data.label)).toEqual(['GEN I', 'GEN II'])
    expect(labels.every((n) => n.focusable === false && n.selectable === false)).toBe(true)
  })

  it('emits one marriage edge per placed couple, left node as source', () => {
    const marriages = graph.edges.filter((e) => e.type === 'marriage')
    expect(marriages).toHaveLength(1)
    const [edge] = marriages
    const left = layout.byId[edge.source]
    const right = layout.byId[edge.target]
    expect(left.x).toBeLessThan(right.x)
    expect(edge.sourceHandle).toBe('right')
    expect(edge.targetHandle).toBe('left')
  })

  it('emits one union node per distinct parent set, at the bond midpoint', () => {
    const unions = graph.nodes.filter((n) => n.type === 'union')
    expect(unions).toHaveLength(1)
    const [union] = unions
    const f1 = layout.byId['f1']
    const f2 = layout.byId['f2']
    const midX = (f1.x + CREST_ANCHORS.cx + f2.x + CREST_ANCHORS.cx) / 2
    expect(union.position).toEqual({ x: midX, y: Math.min(f1.y, f2.y) + CREST_ANCHORS.cy })
  })

  it('emits one descent edge per child, from its union to its top handle', () => {
    const descents = graph.edges.filter((e) => e.type === 'descent')
    expect(descents).toHaveLength(1)
    expect(descents[0].target).toBe('c1')
    expect(descents[0].targetHandle).toBe('top')
    expect(graph.nodes.some((n) => n.id === descents[0].source && n.type === 'union')).toBe(true)
  })

  it('orders descent edges before marriage edges so bonds render on top', () => {
    const firstMarriage = graph.edges.findIndex((e) => e.type === 'marriage')
    const lastDescent = graph.edges.map((e) => e.type).lastIndexOf('descent')
    expect(lastDescent).toBeLessThan(firstMarriage)
  })

  it('flags dimmed / selected / founder / focused sims in crest data', () => {
    const flagged = toFlowGraph(layout, sims, familyEdges, {
      dimmedIds: new Set(['f2']),
      selectedId: 'c1',
      founderSimId: 'f1',
      focusSimId: 'f1',
    })
    const byId = new Map(flagged.nodes.map((n) => [n.id, n]))
    expect(byId.get('f2')!.data.isDimmed).toBe(true)
    expect(byId.get('c1')!.data.isSelected).toBe(true)
    expect(byId.get('f1')!.data.isFounder).toBe(true)
    expect(byId.get('f1')!.data.isFocused).toBe(true)
  })

  it('skips edges referencing sims missing from the layout', () => {
    const graph2 = toFlowGraph(layout, sims, [...familyEdges, { parentId: 'ghost', childId: 'c1' }], {})
    expect(graph2.edges.filter((e) => e.type === 'descent')).toHaveLength(1)
  })

  it('produces a "GEN —" label row for null-generation sims', () => {
    const sims2 = [...sims, sim('x1', null)]
    const layout2 = computeLineageLayout(sims2, familyEdges, partnerEdges)
    const labels = toFlowGraph(layout2, sims2, familyEdges, {}).nodes.filter((n) => n.type === 'genLabel')
    expect(labels.map((n) => n.data.label)).toEqual(['GEN I', 'GEN II', 'GEN —'])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/lineage-tree/__tests__/to-flow-graph.test.ts`
Expected: FAIL — `Cannot find module '../to-flow-graph'`

- [ ] **Step 3: Implement the adapter**

```ts
/**
 * Pure adapter: LineageLayout → @xyflow/react nodes/edges.
 *
 * Layout math stays in layout.ts; this file only translates positions into
 * the node/edge shapes xyflow renders. Deterministic, no React, no DOM.
 *
 * Node types: 'crest' (sim medallion), 'genLabel' (row pill), 'union'
 * (invisible 0×0 anchor at a couple's bond midpoint — descent connectors
 * start at a point that is not a sim node, so we materialise that point).
 * Edge types: 'descent' (right-angle parent→child), 'marriage' (amber bond).
 * Descent edges are emitted before marriage edges so bonds paint on top
 * (matching the old SVG render order).
 */
import type { Edge, Node } from '@xyflow/react'
import type { LifeStage } from '@prisma/client'
import {
  CREST_ANCHORS,
  type LineageFamilyEdge,
  type LineageLayout,
} from './layout'
import { roman } from '@/lib/legacy-format'

/**
 * Structural sim shape the renderer needs. Both `sims.getTreeData` and
 * (after Task 10's select change) `sims.getMiniTreeData` satisfy it.
 * NOTE: must stay a `type` (not `interface`) — xyflow's `Node<T>` constraint
 * requires an implicit index signature, which interfaces don't get.
 */
export type LineageFlowSim = {
  id: string
  firstName: string
  lastName: string
  imageUrl: string | null
  generationNumber: number | null
  lifeStage: LifeStage
  isHeir: boolean
}

export type CrestNodeData = {
  sim: LineageFlowSim
  isFounder: boolean
  isSelected: boolean
  isDimmed: boolean
  isFocused: boolean
  onSelect?: (id: string) => void
  /** Fired on keyboard focus so the canvas can pan an off-screen node into view. */
  onNodeFocus?: (id: string) => void
}

export type GenLabelNodeData = { label: string }

export type CrestFlowNodeType = Node<CrestNodeData, 'crest'>
export type GenLabelNodeType = Node<GenLabelNodeData, 'genLabel'>

export type FlowGraphOptions = {
  founderSimId?: string
  focusSimId?: string
  selectedId?: string
  dimmedIds?: Set<string>
  onSelect?: (id: string) => void
  onNodeFocus?: (id: string) => void
}

const STATIC_NODE = { draggable: false, selectable: false, focusable: false, connectable: false } as const

export function toFlowGraph(
  layout: LineageLayout,
  sims: LineageFlowSim[],
  familyEdges: LineageFamilyEdge[],
  opts: FlowGraphOptions,
): { nodes: Node[]; edges: Edge[] } {
  const simById = new Map(sims.map((s) => [s.id, s]))

  // Generation row pills. Position mirrors the old SVG gutter placement:
  // pill top-left at (6, rowY + NODE_HEIGHT/2 - 42) for a 54×24 pill.
  const genLabelNodes: GenLabelNodeType[] = layout.rowYs.map((rowY, i) => {
    const gen = layout.rowGenerations[i]
    return {
      id: `gen-${gen ?? 'null'}`,
      type: 'genLabel',
      position: { x: 6, y: rowY + 45 - 42 },
      data: { label: gen === null ? 'GEN —' : `GEN ${roman(gen)}` },
      ...STATIC_NODE,
    }
  })

  // Group family edges by child (only edges whose ends are placed).
  const parentsByChild = new Map<string, string[]>()
  for (const { parentId, childId } of familyEdges) {
    if (!layout.byId[parentId] || !layout.byId[childId]) continue
    const list = parentsByChild.get(childId) ?? []
    if (!list.includes(parentId)) list.push(parentId)
    parentsByChild.set(childId, list)
  }

  // One invisible union node per distinct parent set, at the bond midpoint
  // (avg of parents' medallion centers; y = top parent's medallion center —
  // mirrors the old ParentChildLine source point).
  const unionNodes: Node[] = []
  const unionIdByKey = new Map<string, string>()
  const descentEdges: Edge[] = []
  for (const [childId, parentIds] of parentsByChild) {
    const key = [...parentIds].sort().join('+')
    let unionId = unionIdByKey.get(key)
    if (!unionId) {
      unionId = `union-${key}`
      unionIdByKey.set(key, unionId)
      const placed = parentIds.map((id) => layout.byId[id])
      const midX = placed.reduce((sum, p) => sum + p.x + CREST_ANCHORS.cx, 0) / placed.length
      const topY = Math.min(...placed.map((p) => p.y))
      unionNodes.push({
        id: unionId,
        type: 'union',
        position: { x: midX, y: topY + CREST_ANCHORS.cy },
        data: {},
        ...STATIC_NODE,
      })
    }
    descentEdges.push({
      id: `descent-${childId}`,
      type: 'descent',
      source: unionId,
      sourceHandle: 'out',
      target: childId,
      targetHandle: 'top',
      focusable: false,
    })
  }

  // Marriage bonds: only couples the layout placed adjacently; left node is
  // the edge source (its 'right' handle) so the bond always draws left→right.
  const marriageEdges: Edge[] = layout.couples.flatMap(({ a, b }) => {
    const pa = layout.byId[a]
    const pb = layout.byId[b]
    if (!pa || !pb) return []
    const [left, right] = pa.x <= pb.x ? [a, b] : [b, a]
    return [{
      id: `marriage-${a}-${b}`,
      type: 'marriage',
      source: left,
      sourceHandle: 'right',
      target: right,
      targetHandle: 'left',
      focusable: false,
    }]
  })

  const crestNodes: CrestFlowNodeType[] = layout.nodes.flatMap((n) => {
    const sim = simById.get(n.id)
    if (!sim) return []
    return [{
      id: n.id,
      type: 'crest' as const,
      position: { x: n.x, y: n.y },
      data: {
        sim,
        isFounder: opts.founderSimId === n.id,
        isSelected: opts.selectedId === n.id,
        isDimmed: opts.dimmedIds?.has(n.id) ?? false,
        isFocused: opts.focusSimId === n.id,
        onSelect: opts.onSelect,
        onNodeFocus: opts.onNodeFocus,
      },
      ...STATIC_NODE,
    }]
  })

  return {
    nodes: [...genLabelNodes, ...unionNodes, ...crestNodes],
    edges: [...descentEdges, ...marriageEdges],
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/lineage-tree/__tests__/to-flow-graph.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Validate and commit**

```bash
npx tsc --noEmit && npm run lint
but status -fv   # CLI IDs for: to-flow-graph.ts + its test
but commit feat/lineage-tree-xyflow -m "feat(lineage-tree): pure LineageLayout → xyflow graph adapter" --changes <ids>
```

---

### Task 3: HTML Crest node

Rebuilds the Crest medallion as an HTML xyflow node: a real `<button>` (native focus, Enter/Space for free), `PortraitAvatar` for the portrait (optimized `next/image` + built-in broken-image → monogram fallback — closes a tracked follow-up in `docs/legacy-chronicle-redesign-status.md`), and the brand `Plumbob` component as the heir crown (replaces the SVG gradient defs).

**Files:**
- Create: `src/components/lineage-tree/crest-flow-node.tsx`
- Create: `src/components/lineage-tree/crest-flow-node.module.css`
- Test: `src/components/lineage-tree/__tests__/crest-flow-node.test.tsx`

- [ ] **Step 1: Write the failing tests** (ports the old `crest-node.test.tsx` cases to the new component)

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReactFlowProvider } from '@xyflow/react'
import { CrestFlowNode } from '../crest-flow-node'
import type { CrestNodeData, LineageFlowSim } from '../to-flow-graph'

const sim: LineageFlowSim = {
  id: 's1',
  firstName: 'Reed',
  lastName: 'Caliente',
  imageUrl: null,
  generationNumber: 2,
  lifeStage: 'TEEN',
  isHeir: false,
}

const data = (overrides: Partial<CrestNodeData> = {}): CrestNodeData => ({
  sim,
  isFounder: false,
  isSelected: false,
  isDimmed: false,
  isFocused: false,
  ...overrides,
})

// Handles need a ReactFlow store; the node itself renders fine inside a bare provider.
function renderNode(d: CrestNodeData) {
  return render(
    <ReactFlowProvider>
      <CrestFlowNode data={d} />
    </ReactFlowProvider>,
  )
}

describe('CrestFlowNode', () => {
  it('renders as a button whose accessible name includes the life stage', () => {
    renderNode(data({ onSelect: vi.fn() }))
    expect(screen.getByRole('button', { name: 'Reed Caliente, Teen' })).toBeInTheDocument()
  })

  it('activates on click, Enter, and Space', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    renderNode(data({ onSelect }))
    const button = screen.getByRole('button', { name: /Reed Caliente/ })
    await user.click(button)
    button.focus()
    await user.keyboard('{Enter}')
    await user.keyboard(' ')
    expect(onSelect).toHaveBeenCalledTimes(3)
    expect(onSelect).toHaveBeenCalledWith('s1')
  })

  it('renders the monogram fallback when the sim has no portrait', () => {
    renderNode(data({ onSelect: vi.fn() }))
    expect(screen.getByText('RC')).toBeInTheDocument()
  })

  it('is not interactive (no button role) when onSelect is omitted', () => {
    renderNode(data())
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    // Still exposes the sim's name to assistive tech.
    expect(screen.getByText('Reed Caliente')).toBeInTheDocument()
  })

  it('marks the focused sim with aria-current="location" (mini-tree focus ring)', () => {
    renderNode(data({ onSelect: vi.fn(), isFocused: true }))
    expect(screen.getByRole('button', { name: /Reed Caliente/ })).toHaveAttribute('aria-current', 'location')
  })

  it('exposes the dimmed state as a data attribute', () => {
    const { container } = renderNode(data({ isDimmed: true }))
    expect(container.querySelector('[data-tree-node]')).toHaveAttribute('data-dimmed')
  })

  it('shows the heir plumbob crown only for heirs', () => {
    const { rerender } = renderNode(data({ sim: { ...sim, isHeir: true } }))
    expect(screen.getByTestId('heir-crown')).toBeInTheDocument()
    rerender(
      <ReactFlowProvider>
        <CrestFlowNode data={data()} />
      </ReactFlowProvider>,
    )
    expect(screen.queryByTestId('heir-crown')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/lineage-tree/__tests__/crest-flow-node.test.tsx`
Expected: FAIL — `Cannot find module '../crest-flow-node'`

- [ ] **Step 3: Implement the node**

`src/components/lineage-tree/crest-flow-node.tsx`:

```tsx
'use client'
import { Handle, Position } from '@xyflow/react'
import { PortraitAvatar } from '@/components/ui'
import { Plumbob } from '@/components/plumbob'
import { formatLifeStage } from '@/lib/legacy-format'
import { cn } from '@/lib/utils'
import type { CrestNodeData } from './to-flow-graph'
import styles from './crest-flow-node.module.css'

/**
 * The Crest medallion as an HTML xyflow node (140×90 bbox). Hidden handles sit
 * at the CREST_ANCHORS offsets so edges join the medallion edge, never the
 * bbox corners: top target (descent), left target / right source (marriage).
 *
 * The xyflow `NodeProps` generic needs the full node type; we only consume
 * `data`, so the component takes just that — keeps it directly testable.
 */
export function CrestFlowNode({ data }: { data: CrestNodeData }) {
  const { sim, isFounder, isSelected, isDimmed, isFocused, onSelect, onNodeFocus } = data
  const fullName = `${sim.firstName} ${sim.lastName}`.trim()
  const lifeStageLabel = formatLifeStage(sim.lifeStage)
  const accessibleName = `${fullName}, ${lifeStageLabel}`
  const isAccent = isFounder || sim.isHeir

  const medallion = (
    <>
      {sim.isHeir && (
        <span className={styles.crown} data-testid="heir-crown" aria-hidden="true">
          <Plumbob size={12} />
        </span>
      )}
      <span className={cn(styles.medallion, isAccent && styles.medallionAccent, isSelected && styles.medallionSelected)}>
        <PortraitAvatar
          imageUrl={sim.imageUrl}
          firstName={sim.firstName}
          lastName={sim.lastName}
          size={38}
          ring={isFounder ? 'founder' : sim.isHeir ? 'heir' : 'green'}
        />
      </span>
      <span className={styles.divider} aria-hidden="true" />
      <span className={styles.name}>{fullName}</span>
      <span className={styles.stage} aria-hidden="true">
        {lifeStageLabel.toUpperCase()}
      </span>
    </>
  )

  return (
    <div className={styles.crest} data-tree-node data-dimmed={isDimmed ? '' : undefined}>
      <Handle type="target" id="top" position={Position.Top} className={styles.handle} style={{ left: 70, top: 2 }} isConnectable={false} />
      <Handle type="target" id="left" position={Position.Left} className={styles.handle} style={{ left: 48, top: 24 }} isConnectable={false} />
      <Handle type="source" id="right" position={Position.Right} className={styles.handle} style={{ left: 92, top: 24 }} isConnectable={false} />
      {onSelect ? (
        <button
          type="button"
          className={styles.hit}
          aria-label={accessibleName}
          aria-current={isFocused ? 'location' : undefined}
          onClick={() => onSelect(sim.id)}
          onFocus={() => onNodeFocus?.(sim.id)}
        >
          {medallion}
        </button>
      ) : (
        <span className={styles.hit}>{medallion}</span>
      )}
    </div>
  )
}
```

`src/components/lineage-tree/crest-flow-node.module.css`:

```css
/* 140×90 node bbox; medallion circle centered at (70, 24) like CREST_ANCHORS. */
.crest {
  width: 140px;
  height: 90px;
  position: relative;
  transition: opacity var(--transition-base);
}

.crest[data-dimmed] {
  opacity: 0.25;
}

/* xyflow requires handles in the DOM for edge anchoring; visually they vanish. */
.handle {
  opacity: 0;
  pointer-events: none;
  width: 1px;
  height: 1px;
  min-width: 0;
  min-height: 0;
  border: none;
  background: transparent;
}

.hit {
  display: block;
  width: 100%;
  height: 100%;
  padding: 0;
  margin: 0;
  background: none;
  border: none;
  cursor: default;
  font: inherit;
  color: inherit;
  text-align: center;
}

button.hit {
  cursor: pointer;
  outline: none;
}

/* Keyboard focus halo around the medallion (parity with the old SVG ring). */
button.hit:focus-visible .medallion {
  box-shadow: 0 0 0 3px var(--green);
}

.medallion {
  position: absolute;
  left: 48px;
  top: 2px;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 1.5px solid var(--text);
  background: var(--bg);
  display: grid;
  place-items: center;
  box-shadow: 0 2px 3px rgba(20, 15, 5, 0.1); /* lift, was an SVG feDropShadow */
}

/* Amber medallion ring marks heir / founder (legacy callouts). */
.medallionAccent {
  border-color: var(--amber);
}

/* Selection halo: soft glow + crisp green ring (parity with the SVG halo). */
.medallionSelected {
  box-shadow:
    0 0 0 4px var(--green-glow),
    0 0 0 2px var(--green),
    0 2px 3px rgba(20, 15, 5, 0.1);
}

.crown {
  position: absolute;
  left: 64px;
  top: -12px;
}

.divider {
  position: absolute;
  left: 52px;
  top: 54px;
  width: 36px;
  border-top: 0.75px solid var(--amber);
}

.name {
  position: absolute;
  left: 0;
  top: 58px;
  width: 140px;
  font-family: var(--font-display);
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stage {
  position: absolute;
  left: 0;
  top: 75px;
  width: 140px;
  font-family: var(--font-body);
  font-size: 8.5px;
  letter-spacing: 0.22em;
  color: var(--text-subtle);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/lineage-tree/__tests__/crest-flow-node.test.tsx`
Expected: PASS (7 tests)

- [ ] **Step 5: Validate and commit**

```bash
npx tsc --noEmit && npm run lint
but status -fv
but commit feat/lineage-tree-xyflow -m "feat(lineage-tree): HTML Crest node — PortraitAvatar portraits, native focus, Plumbob crown" --changes <ids>
```

---

### Task 4: Gen-label / union nodes and marriage / descent edges

Small presentational pieces. Tested through `lineage-flow.test.tsx` in Task 5 (per the Testing Trophy, no isolated render tests for trivially presentational SVG), except the descent path geometry which is behavior worth pinning here.

**Files:**
- Create: `src/components/lineage-tree/flow-parts.tsx`
- Create: `src/components/lineage-tree/lineage-flow.module.css` (gen pill styles live here, shared with Task 5)
- Test: `src/components/lineage-tree/__tests__/to-flow-graph.test.ts` (append the path test below)

- [ ] **Step 1: Write the failing test for the descent path shape** (append to `to-flow-graph.test.ts`)

```ts
import { descentPath } from '../flow-parts'

describe('descentPath', () => {
  it('draws vertical → horizontal → vertical through the midpoint (old ParentChildLine shape)', () => {
    expect(descentPath(100, 50, 240, 170)).toBe('M 100 50 V 110 H 240 V 170')
  })
})
```

Run: `npx vitest run src/components/lineage-tree/__tests__/to-flow-graph.test.ts`
Expected: FAIL — `Cannot find module '../flow-parts'`

- [ ] **Step 2: Implement `flow-parts.tsx`**

```tsx
'use client'
import { Handle, Position, type EdgeProps } from '@xyflow/react'
import type { GenLabelNodeData } from './to-flow-graph'
import styles from './lineage-flow.module.css'

/** Amber generation pill in the left gutter (old SVG gutter labels). */
export function GenLabelNode({ data }: { data: GenLabelNodeData }) {
  return (
    <div className={styles.genPill} aria-hidden="true">
      {data.label}
    </div>
  )
}

/**
 * Invisible 0×0 anchor at a couple's marriage-bond midpoint. Descent edges
 * start here — the bond is where children descend from. For a lone parent it
 * sits at the medallion center, occluded until the line exits below (edges
 * render beneath nodes), matching the old connector behavior.
 */
export function UnionNode() {
  return (
    <div style={{ width: 0, height: 0 }}>
      <Handle type="source" id="out" position={Position.Bottom} className={styles.handle} isConnectable={false} />
    </div>
  )
}

/** Right-angle path: down from the bond, across, down to the child's top. */
export function descentPath(sourceX: number, sourceY: number, targetX: number, targetY: number): string {
  const midY = (sourceY + targetY) / 2
  return `M ${sourceX} ${sourceY} V ${midY} H ${targetX} V ${targetY}`
}

export function DescentEdge({ sourceX, sourceY, targetX, targetY }: EdgeProps) {
  return (
    <path
      d={descentPath(sourceX, sourceY, targetX, targetY)}
      stroke="var(--border-bright)"
      strokeWidth="1.5"
      fill="none"
      strokeLinejoin="round"
      aria-hidden="true"
    />
  )
}

/** Amber bond between adjacent partners with a rotated diamond at the midpoint. */
export function MarriageEdge({ sourceX, sourceY, targetX, targetY }: EdgeProps) {
  const mx = (sourceX + targetX) / 2
  const my = (sourceY + targetY) / 2
  return (
    <g aria-hidden="true">
      <line x1={sourceX} y1={sourceY} x2={targetX} y2={targetY} stroke="var(--amber)" strokeWidth="1.5" />
      <rect x={mx - 4} y={my - 4} width="8" height="8" transform={`rotate(45 ${mx} ${my})`} fill="var(--amber)" />
    </g>
  )
}
```

`src/components/lineage-tree/lineage-flow.module.css`:

```css
.flow {
  width: 100%;
  height: 100%;
  user-select: none; /* drag-to-pan must not select text (old surface parity) */
}

.handle {
  opacity: 0;
  pointer-events: none;
  width: 1px;
  height: 1px;
  min-width: 0;
  min-height: 0;
  border: none;
  background: transparent;
}

.genPill {
  min-width: 54px;
  height: 24px;
  padding: 0 8px;
  display: grid;
  place-items: center;
  border: 1px solid var(--amber);
  border-radius: 12px;
  color: var(--amber-text);
  font-family: var(--font-body);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.14em;
}
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `npx vitest run src/components/lineage-tree/__tests__/to-flow-graph.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 4: Validate and commit**

```bash
npx tsc --noEmit && npm run lint
but status -fv
but commit feat/lineage-tree-xyflow -m "feat(lineage-tree): gen-pill/union nodes and marriage/descent edges for xyflow" --changes <ids>
```

---

### Task 5: `LineageFlow` wrapper component

The `<ReactFlow>` canvas replacing `lineage-tree.tsx` + `usePanZoom`. Read `node_modules/next/dist/docs/` guidance does not apply here (pure client component), but **do** check `node_modules/@xyflow/react/dist/esm/index.d.ts` if any import below doesn't resolve — this is Next 16 / React 19, APIs may differ from training data.

**Files:**
- Create: `src/components/lineage-tree/lineage-flow.tsx`
- Modify: `src/components/lineage-tree/lineage-flow.module.css` (append)
- Test: `src/components/lineage-tree/__tests__/lineage-flow.test.tsx`

- [ ] **Step 1: Write the failing tests** (ports `lineage-tree.test.tsx` + `lineage-tree.a11y.test.tsx` behavior cases; the SVG-intrinsic-size test is obsolete — xyflow owns the transform — and is replaced by the adapter position tests from Task 2)

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReactFlowProvider } from '@xyflow/react'
import { LineageFlow } from '../lineage-flow'
import type { LineageFlowSim } from '../to-flow-graph'

const sims: LineageFlowSim[] = [
  { id: 'founder', firstName: 'Bella', lastName: 'Goth', imageUrl: null, generationNumber: 1, lifeStage: 'ADULT', isHeir: false },
  { id: 'spouse', firstName: 'Mortimer', lastName: 'Goth', imageUrl: null, generationNumber: 1, lifeStage: 'ADULT', isHeir: false },
  { id: 'heir', firstName: 'Cassandra', lastName: 'Goth', imageUrl: null, generationNumber: 2, lifeStage: 'TEEN', isHeir: true },
]
const familyEdges = [
  { parentId: 'founder', childId: 'heir' },
  { parentId: 'spouse', childId: 'heir' },
]
const partnerEdges = [{ simAId: 'founder', simBId: 'spouse' }]

function renderTree(props: Partial<React.ComponentProps<typeof LineageFlow>> = {}) {
  return render(
    <ReactFlowProvider>
      <div style={{ width: 800, height: 600 }}>
        <LineageFlow
          sims={sims}
          familyEdges={familyEdges}
          partnerEdges={partnerEdges}
          legacyName="Goth"
          {...props}
        />
      </div>
    </ReactFlowProvider>,
  )
}

describe('LineageFlow', () => {
  it('labels the tree as a group using the legacy name', () => {
    renderTree()
    expect(screen.getByRole('group', { name: 'Goth tree — 3 sims' })).toBeInTheDocument()
  })

  it('falls back to "Family" in the group label', () => {
    renderTree({ legacyName: undefined })
    expect(screen.getByRole('group', { name: 'Family tree — 3 sims' })).toBeInTheDocument()
  })

  it('exposes each sim as a button named with name + life stage when selectable', () => {
    renderTree({ onSelectSim: vi.fn() })
    expect(screen.getByRole('button', { name: 'Bella Goth, Adult' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mortimer Goth, Adult' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cassandra Goth, Teen' })).toBeInTheDocument()
  })

  it('calls onSelectSim with the sim id when a node is clicked', async () => {
    const onSelectSim = vi.fn()
    const user = userEvent.setup()
    renderTree({ onSelectSim })
    await user.click(screen.getByRole('button', { name: /Cassandra Goth/ }))
    expect(onSelectSim).toHaveBeenCalledWith('heir')
  })

  it('renders the heir crown for the heir only', () => {
    renderTree()
    expect(screen.getAllByTestId('heir-crown')).toHaveLength(1)
  })

  it('fades nodes whose id is in dimmedIds (search highlight)', () => {
    const { container } = renderTree({ dimmedIds: new Set(['spouse']) })
    expect(container.querySelectorAll('[data-tree-node][data-dimmed]')).toHaveLength(1)
  })

  it('renders nothing when there are no sims', () => {
    const { container } = render(
      <ReactFlowProvider>
        <LineageFlow sims={[]} familyEdges={[]} partnerEdges={[]} />
      </ReactFlowProvider>,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/lineage-tree/__tests__/lineage-flow.test.tsx`
Expected: FAIL — `Cannot find module '../lineage-flow'`

- [ ] **Step 3: Implement `lineage-flow.tsx`**

```tsx
'use client'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  ReactFlow,
  useReactFlow,
  type EdgeTypes,
  type FitViewOptions,
  type NodeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/base.css'
import { cn } from '@/lib/utils'
import { computeLineageLayout, NODE_HEIGHT, NODE_WIDTH, type LineageFamilyEdge, type LineagePartnerEdge } from './layout'
import { toFlowGraph, type LineageFlowSim } from './to-flow-graph'
import { CrestFlowNode } from './crest-flow-node'
import { DescentEdge, GenLabelNode, MarriageEdge, UnionNode } from './flow-parts'
import styles from './lineage-flow.module.css'

// CrestFlowNode/GenLabelNode accept only `{ data }` (keeps them directly
// testable without fabricating full NodeProps). Under strictFunctionTypes
// that narrower props type is not assignable to ComponentType<NodeProps>,
// so register with an explicit assertion — an assertion, NOT a suppression.
// If `satisfies NodeTypes` accepts them without the casts on this xyflow
// version, drop the casts.
const nodeTypes = {
  crest: CrestFlowNode as NodeTypes[string],
  genLabel: GenLabelNode as NodeTypes[string],
  union: UnionNode,
} satisfies NodeTypes
const edgeTypes = { marriage: MarriageEdge, descent: DescentEdge } satisfies EdgeTypes

/** Fit-to-viewport capped at 100% — small legacies sit ~1:1, large scale down. */
export const FIT_VIEW_OPTIONS: FitViewOptions = { maxZoom: 1, padding: 0.08 }
export const MIN_ZOOM = 0.2
export const MAX_ZOOM = 2

export type LineageFlowProps = {
  sims: LineageFlowSim[]
  familyEdges: LineageFamilyEdge[]
  partnerEdges: LineagePartnerEdge[]
  founderSimId?: string
  /** Mini-tree: marks the page's sim with aria-current + ring. */
  focusSimId?: string
  selectedId?: string
  dimmedIds?: Set<string>
  onSelectSim?: (id: string) => void
  legacyName?: string
  /** Change to re-fit the viewport (e.g. the Atlas generation filter). */
  refitKey?: string | number
  className?: string
}

/**
 * The lineage tree on an xyflow canvas. Layout still comes from
 * computeLineageLayout; xyflow contributes pan, wheel-zoom-toward-cursor,
 * pinch-zoom, and fit. Must be rendered inside a <ReactFlowProvider> so
 * siblings (zoom toolbar) can share the instance.
 */
export function LineageFlow({
  sims,
  familyEdges,
  partnerEdges,
  founderSimId,
  focusSimId,
  selectedId,
  dimmedIds,
  onSelectSim,
  legacyName,
  refitKey,
  className,
}: LineageFlowProps) {
  const { fitView, getViewport, setCenter } = useReactFlow()

  const layout = useMemo(
    () => computeLineageLayout(sims, familyEdges, partnerEdges),
    [sims, familyEdges, partnerEdges],
  )

  // Keyboard focus on an off-screen node pans it into view (tracked follow-up).
  // Click-focus on a visible node is a no-op: the medallion is already on screen.
  const surfaceRef = useRef<HTMLDivElement>(null)
  const handleNodeFocus = useCallback(
    (id: string) => {
      const node = layout.byId[id]
      const surface = surfaceRef.current
      if (!node || !surface) return
      const { x, y, zoom } = getViewport()
      const view = {
        left: -x / zoom,
        top: -y / zoom,
        right: (-x + surface.clientWidth) / zoom,
        bottom: (-y + surface.clientHeight) / zoom,
      }
      const visible =
        node.x >= view.left && node.x + NODE_WIDTH <= view.right &&
        node.y >= view.top && node.y + NODE_HEIGHT <= view.bottom
      if (visible) return
      void setCenter(node.x + NODE_WIDTH / 2, node.y + NODE_HEIGHT / 2, { zoom, duration: 200 })
    },
    [layout, getViewport, setCenter],
  )

  const { nodes, edges } = useMemo(
    () =>
      toFlowGraph(layout, sims, familyEdges, {
        founderSimId,
        focusSimId,
        selectedId,
        dimmedIds,
        onSelect: onSelectSim,
        onNodeFocus: handleNodeFocus,
      }),
    [layout, sims, familyEdges, founderSimId, focusSimId, selectedId, dimmedIds, onSelectSim, handleNodeFocus],
  )

  // Re-fit when the caller's filter changes (initial fit comes from fitView prop).
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    void fitView(FIT_VIEW_OPTIONS)
  }, [refitKey, fitView])

  if (sims.length === 0) return null

  return (
    <div
      ref={surfaceRef}
      role="group"
      aria-label={`${legacyName ?? 'Family'} tree — ${sims.length} sims`}
      className={cn(styles.flow, className)}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={FIT_VIEW_OPTIONS}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        nodesDraggable={false}
        nodesConnectable={false}
        nodesFocusable={false}
        edgesFocusable={false}
        elementsSelectable={false}
      />
    </div>
  )
}
```

Append to `lineage-flow.module.css`:

```css
/* The canvas inherits the page's dot-grid parchment; keep xyflow's pane clear. */
.flow :global(.react-flow__pane),
.flow :global(.react-flow) {
  background: transparent;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/lineage-tree/__tests__/lineage-flow.test.tsx`
Expected: PASS (7 tests). If xyflow logs jsdom warnings about zero-size containers, that's fine; if tests fail on missing browser APIs, extend the Task 1 mocks rather than the tests.

- [ ] **Step 5: Validate and commit**

```bash
npx tsc --noEmit && npm run lint
but status -fv
but commit feat/lineage-tree-xyflow -m "feat(lineage-tree): LineageFlow xyflow canvas with fit-capped-at-100% and focus-pan" --changes <ids>
```

---

### Task 6: Wire the Atlas onto `LineageFlow`

Replace the `usePanZoom` surface in `TreeAtlas` with `ReactFlowProvider` + `LineageFlow`, and drive the bottom zoom bar from xyflow hooks.

**Files:**
- Modify: `src/app/app/legacies/[slug]/_components/tree-atlas/tree-atlas.tsx`
- Modify: `src/app/app/legacies/[slug]/_components/tree-atlas/tree-atlas.module.css`
- Test: `src/app/app/legacies/[slug]/_components/tree-atlas/__tests__/tree-atlas.test.tsx`

- [ ] **Step 1: Rewrite `tree-atlas.tsx` imports and the canvas section**

Replace these imports:

```tsx
import { LineageTree } from '@/components/lineage-tree/lineage-tree'
import { computeLineageLayout } from '@/components/lineage-tree/layout'
import { usePanZoom } from '@/components/lineage-tree/use-pan-zoom'
```

with:

```tsx
import { ReactFlowProvider, useReactFlow, useViewport } from '@xyflow/react'
import { FIT_VIEW_OPTIONS, LineageFlow } from '@/components/lineage-tree/lineage-flow'
```

Rewrite `AtlasBottomBar` to take no zoom props — it reads the shared xyflow instance:

```tsx
/** Bottom glass bar: colour key + zoom controls (driven by the shared xyflow instance). */
function AtlasBottomBar() {
  const { zoomIn, zoomOut, fitView } = useReactFlow()
  const { zoom } = useViewport()
  return (
    <div className={styles.bottomBar}>
      {/* …legend markup unchanged… */}
      <span className={styles.divider} aria-hidden="true" />
      <div className={styles.zoomControls}>
        <Button size="icon" variant="ghost" onClick={() => void zoomOut({ duration: 150 })} aria-label="Zoom out">
          −
        </Button>
        <span className={styles.zoomReadout} aria-live="polite">
          {Math.round(zoom * 100)}%
        </span>
        <Button size="icon" variant="ghost" onClick={() => void zoomIn({ duration: 150 })} aria-label="Zoom in">
          +
        </Button>
        <Button size="sm" variant="ghost" onClick={() => void fitView({ ...FIT_VIEW_OPTIONS, duration: 200 })} aria-label="Fit tree to view">
          Fit
        </Button>
      </div>
    </div>
  )
}
```

In `TreeAtlas`: delete the `computeLineageLayout` + `usePanZoom` calls (`tree-atlas.tsx:183-190`) and the `transform`/`surfaceProps` destructuring; wrap the loaded-state JSX in `<ReactFlowProvider>`; replace the `.surface`/`.viewport` block (`tree-atlas.tsx:234-254`) with:

```tsx
<ReactFlowProvider>
  <div className={styles.flowSurface}>
    {visibleSims.length > 0 ? (
      <LineageFlow
        sims={visibleSims}
        familyEdges={familyEdges}
        partnerEdges={partnerEdges}
        founderSimId={founderSimId}
        legacyName={legacyName}
        dimmedIds={dimmedIds}
        selectedId={activeId ?? undefined}
        onSelectSim={handleSelectSim}
        refitKey={genFilter}
      />
    ) : null}
  </div>
  {/* …emptyFilter / searchEmpty / SimInspector unchanged… */}
  <AtlasBottomBar />
</ReactFlowProvider>
```

(`AtlasToolbar` stays outside or inside the provider — it doesn't use xyflow hooks; keep the existing position. `SimInspector` and the empty/search messages are unchanged.)

- [ ] **Step 2: Update `tree-atlas.module.css`**

Delete the `.surface` and `.viewport` rules. Add:

```css
.flowSurface {
  position: absolute;
  inset: 0;
}
```

(Match the positioning the old `.surface` had — check the deleted rule and keep identical inset/z-index so the capsule/toolbar/bottom-bar float above it.)

- [ ] **Step 3: Run the Atlas tests and fix locators**

Run: `npx vitest run "src/app/app/legacies/[slug]/_components/tree-atlas/__tests__/tree-atlas.test.tsx"`

Expected breakages and fixes:
- `'shows the tree when data resolves'` — if it queried the SVG group, the query still works: the wrapper keeps `role="group"` with the same `… tree — N sims` label format.
- `'opens the sim inspector when a node is selected'` — node buttons' accessible names now include the life stage (`"Bella Goth, Adult"`); loosen to `getByRole('button', { name: /Bella Goth/ })`.
- The zoom readout test (if any) — `AtlasBottomBar` now requires the provider, which `TreeAtlas` itself renders; no test harness change needed.

Do not delete assertions — adapt queries only. All other cases (capsule, pills, loading/error/empty) must pass unchanged.

- [ ] **Step 4: Validate and commit**

```bash
npx tsc --noEmit && npm run lint
npx vitest run "src/app/app/legacies/[slug]/_components/tree-atlas"
but status -fv
but commit feat/lineage-tree-xyflow -m "feat(legacy-tree): Atlas renders on xyflow — provider, LineageFlow surface, hook-driven zoom bar" --changes <ids>
```

---

### Task 7: Delete the hand-rolled SVG stack

Nothing imports it after Task 6 — verify, then delete.

**Files:**
- Delete: `src/components/lineage-tree/lineage-tree.tsx`
- Delete: `src/components/lineage-tree/crest-node.tsx`
- Delete: `src/components/lineage-tree/connectors.tsx`
- Delete: `src/components/lineage-tree/tree-defs.tsx`
- Delete: `src/components/lineage-tree/use-pan-zoom.ts`
- Delete: `src/components/lineage-tree/lineage-tree.module.css`
- Delete: `src/components/lineage-tree/__tests__/lineage-tree.test.tsx`
- Delete: `src/components/lineage-tree/__tests__/lineage-tree.a11y.test.tsx`
- Delete: `src/components/lineage-tree/__tests__/crest-node.test.tsx`
- Delete: `src/components/lineage-tree/__tests__/use-pan-zoom.test.ts`

- [ ] **Step 1: Verify nothing imports the doomed files**

Run: `grep -rn "lineage-tree/lineage-tree\|lineage-tree/use-pan-zoom\|lineage-tree/crest-node\|lineage-tree/connectors\|lineage-tree/tree-defs" src/`
Expected: no matches outside the files being deleted. If anything matches, fix that import first (it should be using `lineage-flow`).

- [ ] **Step 2: Delete the files**

```bash
rm src/components/lineage-tree/lineage-tree.tsx \
   src/components/lineage-tree/crest-node.tsx \
   src/components/lineage-tree/connectors.tsx \
   src/components/lineage-tree/tree-defs.tsx \
   src/components/lineage-tree/use-pan-zoom.ts \
   src/components/lineage-tree/lineage-tree.module.css \
   src/components/lineage-tree/__tests__/lineage-tree.test.tsx \
   src/components/lineage-tree/__tests__/lineage-tree.a11y.test.tsx \
   src/components/lineage-tree/__tests__/crest-node.test.tsx \
   src/components/lineage-tree/__tests__/use-pan-zoom.test.ts
```

- [ ] **Step 3: Full unit suite must be green**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: all pass. The `layout.test.ts` suite is untouched and must still pass.

- [ ] **Step 4: Commit**

```bash
but status -fv
but commit feat/lineage-tree-xyflow -m "refactor(lineage-tree): delete hand-rolled SVG shell, connectors, and usePanZoom" --changes <ids>
```

---

### Task 8: Mini-tree server data — add `lifeStage` + `isHeir`

The Crest node needs both fields; `getMiniTreeData` (via `miniTreeSimSelect`) doesn't select them yet.

**Files:**
- Modify: `src/server/routers/sims.ts:10-12`
- Test: find the existing `getMiniTreeData` server test with `grep -rn "getMiniTreeData" src/server --include="*.test.ts"` and extend it

- [ ] **Step 1: Write the failing assertion**

In the existing `getMiniTreeData` test file, extend the happy-path test:

```ts
const tree = await caller.sims.getMiniTreeData({ simId: focusedSim.id })
const returned = tree.sims.find((s) => s.id === focusedSim.id)
expect(returned).toMatchObject({ lifeStage: expect.any(String), isHeir: expect.any(Boolean) })
```

Run it; expected: FAIL — `lifeStage` is `undefined` on the returned sim. (If no server test for `getMiniTreeData` exists, add this as a new test in the sims router test file, using the existing `createTestSim` helpers and the loud-failing seed getters from `src/test/` — follow the pattern of the neighbouring `getTreeData` tests.)

- [ ] **Step 2: Implement**

```ts
const miniTreeSimSelect = {
  id: true, firstName: true, lastName: true, imageUrl: true, generationNumber: true,
  lifeStage: true, isHeir: true,
} as const
```

- [ ] **Step 3: Run the server tests**

Run: `npx vitest run src/server`
Expected: PASS.

- [ ] **Step 4: Validate and commit**

```bash
npx tsc --noEmit && npm run lint
but status -fv
but commit feat/lineage-tree-xyflow -m "feat(api): include lifeStage and isHeir in mini-tree sim select" --changes <ids>
```

---

### Task 9: Converge the mini tree, delete `family-tree/`, uninstall dagre

**Files:**
- Modify: `src/app/app/legacies/[slug]/sims/[id]/family-tree-mini.tsx`
- Delete: `src/components/family-tree/` (entire directory: `FamilyTree.tsx`, `SimNode.tsx`, `SimNode.module.css`, `SimNode.test.tsx`, `useTreeLayout.ts`, `tree-utils.ts`, `tree-utils.test.ts`)
- Modify: `package.json` (remove `@dagrejs/dagre`)

- [ ] **Step 1: Rewrite `family-tree-mini.tsx`**

```tsx
'use client'
import { useRouter } from 'next/navigation'
import { ReactFlowProvider } from '@xyflow/react'
import { trpc } from '@/trpc/client'
import { LineageFlow } from '@/components/lineage-tree/lineage-flow'

type Props = { simId: string }

export function FamilyTreeMini({ simId }: Props) {
  const router = useRouter()
  const { data, isLoading, isError } = trpc.sims.getMiniTreeData.useQuery({ simId })

  if (isLoading) {
    return (
      <div role="status" aria-live="polite">
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9em' }}>Loading tree…</p>
      </div>
    )
  }
  if (isError) {
    return (
      <div role="alert" aria-live="assertive">
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9em' }}>Could not load family tree.</p>
      </div>
    )
  }
  if (!data) return null

  const hasFamily = data.familyEdges.length > 0 || data.partnerEdges.length > 0
  if (!hasFamily) {
    return <p style={{ color: 'var(--text-muted)' }}>No recorded family yet.</p>
  }

  const hrefById = new Map(data.sims.map((s) => [s.id, s.href]))

  return (
    <ReactFlowProvider>
      <div style={{ height: 280 }}>
        <LineageFlow
          sims={data.sims}
          familyEdges={data.familyEdges}
          partnerEdges={data.partnerEdges}
          focusSimId={simId}
          onSelectSim={(id) => {
            const href = hrefById.get(id)
            if (href) router.push(href)
          }}
        />
      </div>
    </ReactFlowProvider>
  )
}
```

Note: the mini tree keeps the old click-to-navigate behavior (it has no inspector); the Atlas keeps click-to-select. Both flow through the same `onSelectSim` prop — the consumer decides.

- [ ] **Step 2: Verify nothing else imports `family-tree/`, then delete it**

Run: `grep -rn "components/family-tree" src/ e2e/`
Expected: no matches outside the directory itself (check test mocks too — if a sim-detail test mocks `@/components/family-tree/FamilyTree`, update the mock to `@/components/lineage-tree/lineage-flow`).

```bash
rm -r src/components/family-tree
npm uninstall @dagrejs/dagre
```

(`@xyflow/react` stays — it is now the renderer for both trees.)

- [ ] **Step 3: Run the affected suites**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: all green. The deleted `SimNode.test.tsx` / `tree-utils.test.ts` counts disappear; sim-detail tests pass with updated mocks.

- [ ] **Step 4: Commit**

```bash
but status -fv
but commit feat/lineage-tree-xyflow -m "refactor(sim-detail): mini tree renders on LineageFlow; drop dagre family-tree stack" --changes <ids>
```

---

### Task 10: Full validation, browser QA, docs

- [ ] **Step 1: Full test suites**

```bash
npm test
npm run test:e2e
```

Expected: all pass. Likely e2e touch-points: `e2e/sim-detail.spec.ts` (mini tree — the old ReactFlow `Controls` zoom buttons are gone; if a locator targeted them, re-scope using `getByTestId`/role locators against the new Crest buttons, per the project's Playwright locator rule). If the dev/test servers are needed: this worktree-less session uses the root `.env`; MinIO via `docker compose up -d` if portrait specs run.

- [ ] **Step 2: Live browser QA (light + dark, keyboard)**

Sign in via the magic-link flow (see AGENTS.md), open a legacy with multiple generations, navigate to `…/tree`:

1. Tree fits on open, capped at 100% (small legacy ≈ 1:1; check the % readout).
2. Drag-pan, wheel-zoom toward cursor, −/+/Fit, live % readout.
3. Search dims non-matches; clearing restores; zero matches shows the pill.
4. Gen pills filter and re-fit.
5. Click a medallion → selection halo + inspector; Esc/✕ closes; "Open profile →" navigates.
6. Keyboard: Tab reaches every medallion in order, focus ring visible, Enter/Space selects, **focusing an off-screen node pans it into view** (zoom out, tab through).
7. Marriage bond diamond, descent lines, GEN pills, heir crown, founder amber ring — visual parity with the old tree in light **and** dark mode.
8. Sim detail page: mini tree shows Crest medallions, focused sim ringed (aria-current), node click navigates.
9. A sim with a portrait renders an optimized image; break an `imageUrl` in dev tools → monogram fallback appears (the old SVG `<image>` gap).
10. Run axe on the tree route — 0 violations.

- [ ] **Step 3: Update the status doc**

In `docs/legacy-chronicle-redesign-status.md`, under Follow-ups, mark resolved with a one-line note each: broken-portrait fallback (now `PortraitAvatar` `onError`), keyboard focus pans off-screen nodes into view (xyflow `setCenter`), and add a line recording the re-platform: "Tree renders on `@xyflow/react` (layout still `computeLineageLayout`); dagre and the hand-rolled SVG/pan-zoom stack removed."

- [ ] **Step 4: Commit docs**

```bash
but status -fv
but commit feat/lineage-tree-xyflow -m "docs: record xyflow re-platform and resolved tree follow-ups" --changes <ids>
```

- [ ] **Step 5: Hand back to the user**

Do not push or open a PR. Report: suites green, QA checklist results, and any visual deltas found in step 2.7 that need a polish pass.
