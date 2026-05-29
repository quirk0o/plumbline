# Family Tree Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add interactive family tree visualisation to SimsTrack — a full-legacy tree section on the legacy page and a focused mini tree on the sim detail page.

**Architecture:** React Flow (`@xyflow/react`) renders the canvas with pan/zoom; Dagre (`@dagrejs/dagre`) computes hierarchical positions from parent-child edges only; partner edges are added as plain React Flow edges after layout. No junction nodes. STEP relationships excluded from the tree.

**Tech Stack:** `@xyflow/react` v12, `@dagrejs/dagre` v3, Vitest, tRPC, Prisma, Next.js App Router

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/components/family-tree/tree-utils.ts` | Create | Pure functions: build Dagre graph, build partner edges |
| `src/components/family-tree/tree-utils.test.ts` | Create | Unit tests for pure layout functions |
| `src/components/family-tree/useTreeLayout.ts` | Create | React hook: sims + edges → Dagre → React Flow nodes/edges |
| `src/components/family-tree/SimNode.tsx` | Create | Custom React Flow node: portrait, name, click-to-navigate |
| `src/components/family-tree/SimNode.module.css` | Create | SimNode styles using design tokens |
| `src/components/family-tree/FamilyTree.tsx` | Create | Shared React Flow wrapper used by both surfaces |
| `src/server/routers/sims.ts` | Modify | Add `getTreeData` and `getMiniTreeData` procedures |
| `src/server/routers/sims.test.ts` | Modify | Integration tests for new procedures |
| `src/app/app/legacies/[slug]/legacy-tree.tsx` | Create | Full-legacy tree client component (fetches + renders) |
| `src/app/app/legacies/[slug]/page.tsx` | Modify | Add Family Tree section below Sims |
| `src/app/app/legacies/[slug]/sims/[id]/family-tree-mini.tsx` | Create | Mini tree client component (fetches + renders) |
| `src/app/app/legacies/[slug]/sims/[id]/sim-detail-client.tsx` | Modify | Add Family Tree section |

---

### Task 1: Install dependencies

**Files:** `package.json`

- [ ] Install React Flow and Dagre:

```bash
npm install @xyflow/react @dagrejs/dagre
```

- [ ] Verify no TypeScript errors:

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] Commit:

```bash
git add package.json package-lock.json
git commit -m "chore: install @xyflow/react and @dagrejs/dagre"
```

---

### Task 2: `tree-utils.ts` — pure layout functions (TDD)

**Files:**
- Create: `src/components/family-tree/tree-utils.ts`
- Create: `src/components/family-tree/tree-utils.test.ts`

- [ ] **Write the failing tests** — create `src/components/family-tree/tree-utils.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { buildDagreGraph, buildPartnerEdges } from './tree-utils'
import type { TreeSim, FamilyEdge, PartnerEdge } from './tree-utils'

const makeSim = (id: string, gen: number): TreeSim => ({
  id,
  firstName: id,
  lastName: 'Goth',
  imageUrl: null,
  generationNumber: gen,
})

describe('buildDagreGraph', () => {
  it('returns a node for each sim', () => {
    const sims = [makeSim('a', 1), makeSim('b', 2)]
    const { nodes } = buildDagreGraph(sims, [])
    expect(nodes).toHaveLength(2)
    expect(nodes.map((n) => n.id)).toEqual(expect.arrayContaining(['a', 'b']))
  })

  it('positions children below their parents', () => {
    const sims = [makeSim('parent', 1), makeSim('child', 2)]
    const edges: FamilyEdge[] = [{ parentId: 'parent', childId: 'child' }]
    const { nodes } = buildDagreGraph(sims, edges)
    const parent = nodes.find((n) => n.id === 'parent')!
    const child = nodes.find((n) => n.id === 'child')!
    expect(child.position.y).toBeGreaterThan(parent.position.y)
  })

  it('places both parents of a shared child at the same y-position', () => {
    const sims = [makeSim('p1', 1), makeSim('p2', 1), makeSim('c1', 2)]
    const edges: FamilyEdge[] = [
      { parentId: 'p1', childId: 'c1' },
      { parentId: 'p2', childId: 'c1' },
    ]
    const { nodes } = buildDagreGraph(sims, edges)
    const p1 = nodes.find((n) => n.id === 'p1')!
    const p2 = nodes.find((n) => n.id === 'p2')!
    expect(p1.position.y).toBe(p2.position.y)
  })

  it('positions children from two different partners below their respective parents', () => {
    const sims = [
      makeSim('mortimer', 1), makeSim('bella', 1), makeSim('dina', 1),
      makeSim('cassandra', 2), makeSim('dirk', 2),
    ]
    const edges: FamilyEdge[] = [
      { parentId: 'mortimer', childId: 'cassandra' },
      { parentId: 'bella', childId: 'cassandra' },
      { parentId: 'mortimer', childId: 'dirk' },
      { parentId: 'dina', childId: 'dirk' },
    ]
    const { nodes } = buildDagreGraph(sims, edges)
    const mortimer = nodes.find((n) => n.id === 'mortimer')!
    const cassandra = nodes.find((n) => n.id === 'cassandra')!
    const dirk = nodes.find((n) => n.id === 'dirk')!
    expect(cassandra.position.y).toBeGreaterThan(mortimer.position.y)
    expect(dirk.position.y).toBeGreaterThan(mortimer.position.y)
  })

  it('returns a family edge with correct source, target, and id', () => {
    const sims = [makeSim('p', 1), makeSim('c', 2)]
    const { edges } = buildDagreGraph(sims, [{ parentId: 'p', childId: 'c' }])
    expect(edges).toHaveLength(1)
    expect(edges[0]).toMatchObject({ id: 'family-p-c', source: 'p', target: 'c' })
  })

  it('returns empty edges for a single sim with no relationships', () => {
    const { nodes, edges } = buildDagreGraph([makeSim('lone', 1)], [])
    expect(nodes).toHaveLength(1)
    expect(edges).toHaveLength(0)
  })
})

describe('buildPartnerEdges', () => {
  it('creates a dashed straight edge for each partner pair', () => {
    const pairs: PartnerEdge[] = [{ simAId: 'a', simBId: 'b' }]
    const edges = buildPartnerEdges(pairs)
    expect(edges).toHaveLength(1)
    expect(edges[0]).toMatchObject({ id: 'partner-a-b', source: 'a', target: 'b', type: 'straight' })
    expect(String(edges[0].style?.strokeDasharray)).toMatch(/\d/)
  })

  it('returns empty array when there are no partner pairs', () => {
    expect(buildPartnerEdges([])).toHaveLength(0)
  })
})
```

- [ ] **Run tests — verify they fail:**

```bash
npm test -- src/components/family-tree/tree-utils.test.ts
```

Expected: all tests fail with "Cannot find module './tree-utils'"

- [ ] **Create `src/components/family-tree/tree-utils.ts`:**

```typescript
import dagre from '@dagrejs/dagre'
import type { Node, Edge } from '@xyflow/react'

export const NODE_WIDTH = 100
export const NODE_HEIGHT = 80

export type TreeSim = {
  id: string
  firstName: string
  lastName: string
  imageUrl: string | null
  generationNumber: number | null
  isFocused?: boolean
}

export type FamilyEdge = {
  parentId: string
  childId: string
}

export type PartnerEdge = {
  simAId: string
  simBId: string
}

export function buildDagreGraph(
  sims: TreeSim[],
  familyEdges: FamilyEdge[],
): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'TB', ranksep: 80, nodesep: 40 })
  g.setDefaultEdgeLabel(() => ({}))

  for (const sim of sims) {
    g.setNode(sim.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  }
  for (const { parentId, childId } of familyEdges) {
    g.setEdge(parentId, childId)
  }

  dagre.layout(g)

  const nodes: Node[] = sims.map((sim) => {
    const { x, y } = g.node(sim.id)
    return {
      id: sim.id,
      type: 'simNode',
      position: { x: x - NODE_WIDTH / 2, y: y - NODE_HEIGHT / 2 },
      data: sim,
    }
  })

  const edges: Edge[] = familyEdges.map(({ parentId, childId }) => ({
    id: `family-${parentId}-${childId}`,
    source: parentId,
    target: childId,
    type: 'smoothstep',
    style: { stroke: 'var(--border)' },
  }))

  return { nodes, edges }
}

export function buildPartnerEdges(partnerPairs: PartnerEdge[]): Edge[] {
  return partnerPairs.map(({ simAId, simBId }) => ({
    id: `partner-${simAId}-${simBId}`,
    source: simAId,
    target: simBId,
    type: 'straight',
    style: { stroke: 'var(--border)', strokeDasharray: '4 2' },
  }))
}
```

- [ ] **Run tests — verify they pass:**

```bash
npm test -- src/components/family-tree/tree-utils.test.ts
```

Expected: all 8 tests pass.

- [ ] **Commit:**

```bash
git add src/components/family-tree/tree-utils.ts src/components/family-tree/tree-utils.test.ts
git commit -m "feat(family-tree): add pure layout utilities with dagre"
```

---

### Task 3: `SimNode.tsx` and `useTreeLayout.ts`

**Files:**
- Create: `src/components/family-tree/useTreeLayout.ts`
- Create: `src/components/family-tree/SimNode.tsx`
- Create: `src/components/family-tree/SimNode.module.css`

- [ ] **Create `src/components/family-tree/useTreeLayout.ts`:**

```typescript
import { useMemo } from 'react'
import type { Node, Edge } from '@xyflow/react'
import { buildDagreGraph, buildPartnerEdges } from './tree-utils'
import type { TreeSim, FamilyEdge, PartnerEdge } from './tree-utils'

type UseTreeLayoutInput = {
  sims: TreeSim[]
  familyEdges: FamilyEdge[]
  partnerEdges: PartnerEdge[]
}

export function useTreeLayout({ sims, familyEdges, partnerEdges }: UseTreeLayoutInput): {
  nodes: Node[]
  edges: Edge[]
} {
  return useMemo(() => {
    if (sims.length === 0) return { nodes: [], edges: [] }
    const { nodes, edges: familyFlowEdges } = buildDagreGraph(sims, familyEdges)
    const partnerFlowEdges = buildPartnerEdges(partnerEdges)
    return { nodes, edges: [...familyFlowEdges, ...partnerFlowEdges] }
  }, [sims, familyEdges, partnerEdges])
}
```

- [ ] **Create `src/components/family-tree/SimNode.module.css`:**

```css
.node {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 8px;
  width: 100px;
  background: var(--bg-card);
  border: 1.5px solid var(--border);
  border-radius: 8px;
  cursor: pointer;
  user-select: none;
}

.node:hover {
  border-color: var(--green);
  box-shadow: var(--shadow-sm);
}

.focused {
  border-color: var(--green);
  border-width: 2.5px;
  box-shadow: 0 0 0 3px rgba(26, 92, 53, 0.15);
}

.portrait {
  position: relative;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--green);
  flex-shrink: 0;
}

.image {
  object-fit: cover;
}

.initials {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 14px;
  font-weight: 600;
}

.name {
  font-size: 11px;
  color: var(--text);
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 84px;
}
```

- [ ] **Create `src/components/family-tree/SimNode.tsx`:**

```tsx
'use client'
import Image from 'next/image'
import { useParams, useRouter } from 'next/navigation'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import type { TreeSim } from './tree-utils'
import styles from './SimNode.module.css'

export type SimNodeType = Node<TreeSim, 'simNode'>

export function SimNode({ data }: NodeProps<SimNodeType>) {
  const router = useRouter()
  const params = useParams<{ slug: string }>()
  const initials = `${data.firstName[0]}${data.lastName[0]}`

  function handleClick() {
    router.push(`/app/legacies/${params.slug}/sims/${data.id}`)
  }

  return (
    <>
      <Handle type="target" position={Position.Top} />
      <div
        className={`${styles.node} ${data.isFocused ? styles.focused : ''}`}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && handleClick()}
        aria-label={`${data.firstName} ${data.lastName}`}
      >
        <div className={styles.portrait}>
          {data.imageUrl ? (
            <Image
              src={data.imageUrl}
              alt={`${data.firstName} ${data.lastName}`}
              fill
              sizes="48px"
              className={styles.image}
            />
          ) : (
            <span className={styles.initials} aria-hidden="true">
              {initials}
            </span>
          )}
        </div>
        <span className={styles.name}>
          {data.firstName} {data.lastName}
        </span>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </>
  )
}
```

- [ ] **Type-check:**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Commit:**

```bash
git add src/components/family-tree/
git commit -m "feat(family-tree): add SimNode and useTreeLayout hook"
```

---

### Task 4: `FamilyTree.tsx` — shared React Flow wrapper

**Files:**
- Create: `src/components/family-tree/FamilyTree.tsx`

- [ ] **Create `src/components/family-tree/FamilyTree.tsx`:**

```tsx
'use client'
import type { CSSProperties } from 'react'
import { ReactFlow, Background, Controls, MiniMap, ReactFlowProvider } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { SimNode } from './SimNode'
import type { SimNodeType } from './SimNode'
import { useTreeLayout } from './useTreeLayout'
import type { TreeSim, FamilyEdge, PartnerEdge } from './tree-utils'

const nodeTypes = { simNode: SimNode }

type FamilyTreeProps = {
  sims: TreeSim[]
  familyEdges: FamilyEdge[]
  partnerEdges: PartnerEdge[]
  focusSimId?: string
  showMiniMap?: boolean
  style?: CSSProperties
}

function FamilyTreeInner({
  sims,
  familyEdges,
  partnerEdges,
  focusSimId,
  showMiniMap,
  style,
}: FamilyTreeProps) {
  const simsWithFocus = focusSimId
    ? sims.map((s) => ({ ...s, isFocused: s.id === focusSimId }))
    : sims
  const { nodes, edges } = useTreeLayout({ sims: simsWithFocus, familyEdges, partnerEdges })

  return (
    <div style={{ height: 400, ...style }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes as Record<string, React.ComponentType<NodeProps<SimNodeType>>>}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
      >
        <Background />
        <Controls />
        {showMiniMap && <MiniMap />}
      </ReactFlow>
    </div>
  )
}

export function FamilyTree(props: FamilyTreeProps) {
  return (
    <ReactFlowProvider>
      <FamilyTreeInner {...props} />
    </ReactFlowProvider>
  )
}
```

- [ ] **Type-check:**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Commit:**

```bash
git add src/components/family-tree/FamilyTree.tsx
git commit -m "feat(family-tree): add FamilyTree shared React Flow wrapper"
```

---

### Task 5: `getTreeData` tRPC procedure

**Files:**
- Modify: `src/server/routers/sims.ts`
- Modify: `src/server/routers/sims.test.ts` (create if it doesn't exist)

- [ ] **Write failing tests** — add to `src/server/routers/sims.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { FamilyRelationshipType, RomanticStatus } from '@prisma/client'
import { authedCaller, unauthCaller } from '@/test/caller'
import { createTestUser, cleanupUser, createTestLegacy, createTestSim } from '@/test/helpers'
import { db } from '@/server/db'

describe('sims.getTreeData', () => {
  let userId: string
  let legacyId: string
  let legacySlug: string

  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
    const legacy = await createTestLegacy(userId)
    legacyId = legacy.id
    legacySlug = legacy.slug
  })

  afterEach(async () => {
    await cleanupUser(userId)
  })

  it('returns all sims in the legacy', async () => {
    const caller = authedCaller(userId)
    const s1 = await createTestSim(legacyId, { firstName: 'Mortimer' })
    const s2 = await createTestSim(legacyId, { firstName: 'Bella' })
    const result = await caller.sims.getTreeData({ legacySlug })
    expect(result.sims.map((s) => s.id)).toEqual(expect.arrayContaining([s1.id, s2.id]))
  })

  it('returns biological and adoptive family edges but not step edges', async () => {
    const caller = authedCaller(userId)
    const parent = await createTestSim(legacyId, { firstName: 'Parent' })
    const child = await createTestSim(legacyId, { firstName: 'Child' })
    const stepChild = await createTestSim(legacyId, { firstName: 'StepChild' })
    await db.familyRelationship.create({
      data: { parentId: parent.id, childId: child.id, type: FamilyRelationshipType.BIOLOGICAL },
    })
    await db.familyRelationship.create({
      data: { parentId: parent.id, childId: stepChild.id, type: FamilyRelationshipType.STEP },
    })
    const result = await caller.sims.getTreeData({ legacySlug })
    expect(result.familyEdges).toContainEqual({ parentId: parent.id, childId: child.id })
    expect(result.familyEdges).not.toContainEqual({ parentId: parent.id, childId: stepChild.id })
  })

  it('returns partner edges for non-NONE romantic relationships', async () => {
    const caller = authedCaller(userId)
    const simA = await createTestSim(legacyId, { firstName: 'SimA' })
    const simB = await createTestSim(legacyId, { firstName: 'SimB' })
    await db.socialRelationship.create({
      data: {
        simAId: simA.id,
        simBId: simB.id,
        romanticStatus: RomanticStatus.MARRIED,
        friendshipScore: 0,
        romanceScore: 0,
      },
    })
    const result = await caller.sims.getTreeData({ legacySlug })
    expect(result.partnerEdges).toContainEqual({ simAId: simA.id, simBId: simB.id })
  })

  it('throws NOT_FOUND for a legacy that does not belong to the user', async () => {
    const otherUser = await createTestUser()
    const otherLegacy = await createTestLegacy(otherUser.id)
    const caller = authedCaller(userId)
    await expect(
      caller.sims.getTreeData({ legacySlug: otherLegacy.slug }),
    ).rejects.toThrow('NOT_FOUND')
    await cleanupUser(otherUser.id)
  })
})
```

- [ ] **Run tests — verify they fail:**

```bash
npm test -- src/server/routers/sims.test.ts --reporter=verbose 2>&1 | grep -A2 "getTreeData"
```

Expected: tests fail with procedure not found.

- [ ] **Add `getTreeData` inside the `simsRouter` in `src/server/routers/sims.ts`** (after `listByLegacy`):

```typescript
  getTreeData: protectedProcedure
    .input(z.object({ legacySlug: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const legacy = await ctx.db.legacy.findFirst({
        where: { slug: input.legacySlug, userId },
      })
      if (!legacy) throw new TRPCError({ code: 'NOT_FOUND', message: 'Legacy not found' })

      const sims = await ctx.db.sim.findMany({
        where: { legacyId: legacy.id },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          imageUrl: true,
          generationNumber: true,
        },
      })

      const familyEdges = await ctx.db.familyRelationship.findMany({
        where: {
          parent: { legacyId: legacy.id },
          type: { in: [FamilyRelationshipType.BIOLOGICAL, FamilyRelationshipType.ADOPTIVE] },
        },
        select: { parentId: true, childId: true },
      })

      const partnerEdges = await ctx.db.socialRelationship.findMany({
        where: {
          simA: { legacyId: legacy.id },
          romanticStatus: { not: RomanticStatus.NONE },
        },
        select: { simAId: true, simBId: true },
      })

      return {
        sims,
        familyEdges: familyEdges.map((e) => ({ parentId: e.parentId, childId: e.childId })),
        partnerEdges: partnerEdges.map((e) => ({ simAId: e.simAId, simBId: e.simBId })),
      }
    }),
```

- [ ] **Run tests — verify they pass:**

```bash
npm test -- src/server/routers/sims.test.ts
```

Expected: all `sims.getTreeData` tests pass.

- [ ] **Commit:**

```bash
git add src/server/routers/sims.ts src/server/routers/sims.test.ts
git commit -m "feat(family-tree): add getTreeData tRPC procedure"
```

---

### Task 6: Full-legacy tree on the legacy page

**Files:**
- Create: `src/app/app/legacies/[slug]/legacy-tree.tsx`
- Modify: `src/app/app/legacies/[slug]/page.tsx`

- [ ] **Find the tRPC client import path** used by existing client components:

```bash
grep -r "from '@/trpc/react'" src/app --include="*.tsx" -l | head -1
```

Use the same path in the next step.

- [ ] **Create `src/app/app/legacies/[slug]/legacy-tree.tsx`:**

```tsx
'use client'
import { api } from '@/trpc/react'
import { FamilyTree } from '@/components/family-tree/FamilyTree'

type Props = { legacySlug: string }

export function LegacyTree({ legacySlug }: Props) {
  const { data, isLoading } = api.sims.getTreeData.useQuery({ legacySlug })

  if (isLoading) {
    return <p style={{ color: 'var(--text-muted)', fontSize: '0.9em' }}>Loading tree…</p>
  }
  if (!data || data.sims.length === 0) {
    return <p style={{ color: 'var(--text-muted)', fontSize: '0.9em' }}>No sims yet.</p>
  }

  return (
    <FamilyTree
      sims={data.sims}
      familyEdges={data.familyEdges}
      partnerEdges={data.partnerEdges}
      showMiniMap
      style={{ height: 500 }}
    />
  )
}
```

- [ ] **Add Family Tree section to `src/app/app/legacies/[slug]/page.tsx`** — add the import at the top of the file and a new `<section>` after the closing `</section>` of the Sims section (around line 143):

```tsx
import { LegacyTree } from './legacy-tree'
```

```tsx
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Family Tree</h2>
        </div>
        <LegacyTree legacySlug={slug} />
      </section>
```

- [ ] **Run lint and type-check:**

```bash
npx tsc --noEmit && npm run lint
```

Expected: no errors.

- [ ] **Verify manually** — start dev server, sign in, open a legacy page, scroll to Family Tree section. Tree renders, pan/zoom works, clicking a node navigates to that sim's detail page.

```bash
npm run dev
```

- [ ] **Commit:**

```bash
git add src/app/app/legacies/[slug]/legacy-tree.tsx src/app/app/legacies/[slug]/page.tsx
git commit -m "feat(family-tree): add full-legacy tree section to legacy page"
```

---

### Task 7: `getMiniTreeData` tRPC procedure

**Files:**
- Modify: `src/server/routers/sims.ts`
- Modify: `src/server/routers/sims.test.ts`

- [ ] **Write failing tests** — add to `src/server/routers/sims.test.ts`:

```typescript
describe('sims.getMiniTreeData', () => {
  let userId: string
  let legacyId: string

  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
    const legacy = await createTestLegacy(userId)
    legacyId = legacy.id
  })

  afterEach(async () => {
    await cleanupUser(userId)
  })

  it('includes the focused sim, their parents, and grandparents', async () => {
    const caller = authedCaller(userId)
    const grandparent = await createTestSim(legacyId, { firstName: 'Grandparent' })
    const parent = await createTestSim(legacyId, { firstName: 'Parent' })
    const child = await createTestSim(legacyId, { firstName: 'Child' })
    await db.familyRelationship.createMany({
      data: [
        { parentId: grandparent.id, childId: parent.id, type: FamilyRelationshipType.BIOLOGICAL },
        { parentId: parent.id, childId: child.id, type: FamilyRelationshipType.BIOLOGICAL },
      ],
    })
    const result = await caller.sims.getMiniTreeData({ simId: child.id })
    const ids = result.sims.map((s) => s.id)
    expect(ids).toContain(child.id)
    expect(ids).toContain(parent.id)
    expect(ids).toContain(grandparent.id)
  })

  it("includes the focused sim's children", async () => {
    const caller = authedCaller(userId)
    const parent = await createTestSim(legacyId, { firstName: 'Parent' })
    const child = await createTestSim(legacyId, { firstName: 'Child' })
    await db.familyRelationship.create({
      data: { parentId: parent.id, childId: child.id, type: FamilyRelationshipType.BIOLOGICAL },
    })
    const result = await caller.sims.getMiniTreeData({ simId: parent.id })
    expect(result.sims.map((s) => s.id)).toContain(child.id)
  })

  it('excludes step-parent edges', async () => {
    const caller = authedCaller(userId)
    const parent = await createTestSim(legacyId, { firstName: 'Parent' })
    const child = await createTestSim(legacyId, { firstName: 'Child' })
    await db.familyRelationship.create({
      data: { parentId: parent.id, childId: child.id, type: FamilyRelationshipType.STEP },
    })
    const result = await caller.sims.getMiniTreeData({ simId: child.id })
    expect(result.familyEdges).not.toContainEqual({ parentId: parent.id, childId: child.id })
  })

  it('throws NOT_FOUND for a sim that does not belong to the user', async () => {
    const otherUser = await createTestUser()
    const otherLegacy = await createTestLegacy(otherUser.id)
    const otherSim = await createTestSim(otherLegacy.id)
    const caller = authedCaller(userId)
    await expect(caller.sims.getMiniTreeData({ simId: otherSim.id })).rejects.toThrow('NOT_FOUND')
    await cleanupUser(otherUser.id)
  })
})
```

- [ ] **Run tests — verify they fail:**

```bash
npm test -- src/server/routers/sims.test.ts --reporter=verbose 2>&1 | grep -A2 "getMiniTreeData"
```

Expected: all fail with procedure not found.

- [ ] **Add `getMiniTreeData` inside the `simsRouter` in `src/server/routers/sims.ts`** (after `getTreeData`):

```typescript
  getMiniTreeData: protectedProcedure
    .input(z.object({ simId: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id

      const focusedSim = await ctx.db.sim.findFirst({
        where: { id: input.simId, legacy: { userId } },
        select: {
          id: true, firstName: true, lastName: true, imageUrl: true, generationNumber: true,
          childOf: {
            where: { type: { in: [FamilyRelationshipType.BIOLOGICAL, FamilyRelationshipType.ADOPTIVE] } },
            select: {
              parentId: true,
              parent: {
                select: {
                  id: true, firstName: true, lastName: true, imageUrl: true, generationNumber: true,
                  childOf: {
                    where: { type: { in: [FamilyRelationshipType.BIOLOGICAL, FamilyRelationshipType.ADOPTIVE] } },
                    select: {
                      parentId: true,
                      parent: {
                        select: { id: true, firstName: true, lastName: true, imageUrl: true, generationNumber: true },
                      },
                    },
                  },
                  socialRelationshipsA: {
                    where: { romanticStatus: { not: RomanticStatus.NONE } },
                    select: { simAId: true, simBId: true },
                  },
                  socialRelationshipsB: {
                    where: { romanticStatus: { not: RomanticStatus.NONE } },
                    select: { simAId: true, simBId: true },
                  },
                },
              },
            },
          },
          parentsOf: {
            where: { type: { in: [FamilyRelationshipType.BIOLOGICAL, FamilyRelationshipType.ADOPTIVE] } },
            select: {
              childId: true,
              child: { select: { id: true, firstName: true, lastName: true, imageUrl: true, generationNumber: true } },
            },
          },
          socialRelationshipsA: {
            where: { romanticStatus: { not: RomanticStatus.NONE } },
            select: { simAId: true, simBId: true },
          },
          socialRelationshipsB: {
            where: { romanticStatus: { not: RomanticStatus.NONE } },
            select: { simAId: true, simBId: true },
          },
        },
      })
      if (!focusedSim) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sim not found' })

      type SimData = { id: string; firstName: string; lastName: string; imageUrl: string | null; generationNumber: number | null }
      const simMap = new Map<string, SimData>()
      const familyEdgeSet = new Set<string>()
      const partnerEdgeSet = new Set<string>()
      const familyEdges: { parentId: string; childId: string }[] = []
      const partnerEdges: { simAId: string; simBId: string }[] = []

      function addSim(s: SimData) {
        if (!simMap.has(s.id)) simMap.set(s.id, s)
      }
      function addFamilyEdge(parentId: string, childId: string) {
        const key = `${parentId}-${childId}`
        if (!familyEdgeSet.has(key)) { familyEdgeSet.add(key); familyEdges.push({ parentId, childId }) }
      }
      function addPartnerEdge(simAId: string, simBId: string) {
        const key = [simAId, simBId].sort().join('-')
        if (!partnerEdgeSet.has(key)) { partnerEdgeSet.add(key); partnerEdges.push({ simAId, simBId }) }
      }

      addSim(focusedSim)
      focusedSim.socialRelationshipsA.forEach((r) => addPartnerEdge(r.simAId, r.simBId))
      focusedSim.socialRelationshipsB.forEach((r) => addPartnerEdge(r.simAId, r.simBId))

      for (const parentRel of focusedSim.childOf) {
        const parent = parentRel.parent
        addSim(parent)
        addFamilyEdge(parent.id, focusedSim.id)
        parent.socialRelationshipsA.forEach((r) => addPartnerEdge(r.simAId, r.simBId))
        parent.socialRelationshipsB.forEach((r) => addPartnerEdge(r.simAId, r.simBId))
        for (const gpRel of parent.childOf) {
          addSim(gpRel.parent)
          addFamilyEdge(gpRel.parent.id, parent.id)
        }
      }

      for (const childRel of focusedSim.parentsOf) {
        addSim(childRel.child)
        addFamilyEdge(focusedSim.id, childRel.child.id)
      }

      // Fetch any partner sims not yet in the map
      const missingPartnerIds = partnerEdges
        .flatMap((e) => [e.simAId, e.simBId])
        .filter((id) => !simMap.has(id))
      if (missingPartnerIds.length > 0) {
        const partnerSims = await ctx.db.sim.findMany({
          where: { id: { in: missingPartnerIds } },
          select: { id: true, firstName: true, lastName: true, imageUrl: true, generationNumber: true },
        })
        partnerSims.forEach(addSim)
      }

      return { sims: Array.from(simMap.values()), familyEdges, partnerEdges }
    }),
```

- [ ] **Run tests — verify they pass:**

```bash
npm test -- src/server/routers/sims.test.ts
```

Expected: all tests pass.

- [ ] **Commit:**

```bash
git add src/server/routers/sims.ts src/server/routers/sims.test.ts
git commit -m "feat(family-tree): add getMiniTreeData tRPC procedure"
```

---

### Task 8: Mini tree on the sim detail page

**Files:**
- Create: `src/app/app/legacies/[slug]/sims/[id]/family-tree-mini.tsx`
- Modify: `src/app/app/legacies/[slug]/sims/[id]/sim-detail-client.tsx`

- [ ] **Create `src/app/app/legacies/[slug]/sims/[id]/family-tree-mini.tsx`:**

```tsx
'use client'
import { api } from '@/trpc/react'
import { FamilyTree } from '@/components/family-tree/FamilyTree'

type Props = { simId: string }

export function FamilyTreeMini({ simId }: Props) {
  const { data, isLoading } = api.sims.getMiniTreeData.useQuery({ simId })

  if (isLoading) {
    return <p style={{ color: 'var(--text-muted)', fontSize: '0.9em' }}>Loading tree…</p>
  }
  if (!data || data.sims.length === 0) return null

  return (
    <FamilyTree
      sims={data.sims}
      familyEdges={data.familyEdges}
      partnerEdges={data.partnerEdges}
      focusSimId={simId}
      style={{ height: 280 }}
    />
  )
}
```

- [ ] **Add Family Tree section to `src/app/app/legacies/[slug]/sims/[id]/sim-detail-client.tsx`** — open the file and identify where the Relationships section ends. Import `FamilyTreeMini` at the top and add a section after the relationships section, matching the existing heading style:

```tsx
import { FamilyTreeMini } from './family-tree-mini'
```

```tsx
{/* Add after the relationships section */}
<section>
  <h2>Family Tree</h2>
  <FamilyTreeMini simId={sim.id} />
</section>
```

- [ ] **Run lint and type-check:**

```bash
npx tsc --noEmit && npm run lint
```

Expected: no errors.

- [ ] **Verify manually** — navigate to a sim detail page. The Family Tree section should appear with the focused sim highlighted in green, their parents, grandparents above, and children below. Clicking another sim navigates to their detail page.

- [ ] **Run the full test suite:**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Commit:**

```bash
git add src/app/app/legacies/[slug]/sims/[id]/family-tree-mini.tsx \
        src/app/app/legacies/[slug]/sims/[id]/sim-detail-client.tsx
git commit -m "feat(family-tree): add mini tree section to sim detail page"
```
