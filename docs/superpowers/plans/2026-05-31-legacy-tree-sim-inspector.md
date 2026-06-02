# Legacy Tree Atlas — Selected-Sim Inspector (popup preview)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** Add the design's **selected-sim popup preview** to the Tree Atlas. Clicking a tree node *selects* it (instead of immediately navigating) and floats in a `SimInspector` card — portrait, name, life-stage · aspiration, traits, parents, partner, and an "Open profile →" link. Matches `FloatingSimInspector` in the design bundle (`combined.jsx` L264–357).

**Architecture:** `TreeAtlas` gains a `selectedId` state. A node click sets it (no more `router.push`); the selected node shows the green selection halo (`CrestNode` already supports `isSelected` via `LineageTree`'s `selectedId` prop). A new client `SimInspector` lazy-fetches the sim via the existing `trpc.sims.getById` query and renders a floating glass card pinned top-right under the toolbar. "Open profile →" is the navigation affordance. Esc / ✕ deselect.

**Tech Stack:** Next.js 16, React, TypeScript, tRPC (`sims.getById` — already exists), CSS Modules, Vitest + RTL. No new deps.

**Worktree:** `.claude/worktrees/legacy-chronicle-redesign` (branch `worktree-legacy-chronicle-redesign`); run commands from its root. Hard rules: no lint/TS suppressions; no `setState` inside a `useEffect` body; conventional commits; stage only changed files; `tsc`+`lint` clean and tests green.

**Reuse (do not reinvent):**
- `trpc.sims.getById.useQuery({ id })` → returns the sim with `personalityTraits[].personalityTrait.name`, `aspirations[].aspiration.name`, `childOf[].parent {firstName,lastName,...}`, `socialRelationshipsA[].simB` / `socialRelationshipsB[].simA` with `romanticStatus`, plus `firstName,lastName,imageUrl,lifeStage,isHeir,generationNumber`.
- `PortraitAvatar` (`@/components/ui`): props `{ imageUrl, firstName, lastName, size, ring: 'founder'|'heir'|'green', href, ariaLabel }`.
- `Eyebrow`, `Badge`, `ButtonLink` (`@/components/ui`); `roman`, `formatLifeStage` (`@/lib/legacy-format`).
- `LineageTree` already accepts `selectedId`; `CrestNode` draws the green selection halo for `isSelected`.

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `…/tree-atlas/sim-inspector.tsx` | **New.** Floating selected-sim card. | Create. |
| `…/tree-atlas/sim-inspector.module.css` | **New.** Card styling. | Create. |
| `…/tree-atlas/__tests__/sim-inspector.test.tsx` | **New.** Inspector tests. | Create. |
| `…/tree-atlas/tree-atlas.tsx` | Host. | Add `selectedId` state; node click selects; pass `selectedId` to `LineageTree`; render `SimInspector`. |
| `…/tree-atlas/__tests__/tree-atlas.test.tsx` | Atlas tests. | Node-select now opens the inspector (not navigation). |

(`…` = `src/app/app/legacies/[slug]/_components`.)

---

## Task 1: `SimInspector` component

**Files:** create `…/tree-atlas/sim-inspector.tsx`, `…/tree-atlas/sim-inspector.module.css`, `…/tree-atlas/__tests__/sim-inspector.test.tsx`.

- [ ] **Step 1: Failing test** — create `…/tree-atlas/__tests__/sim-inspector.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.ComponentProps<'a'> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))
vi.mock('next/image', () => ({
  default: ({ alt }: { src: string; alt: string }) => <span>{alt}</span>,
}))

const { mockUseQuery } = vi.hoisted(() => ({ mockUseQuery: vi.fn() }))
vi.mock('@/trpc/client', () => ({
  trpc: { sims: { getById: { useQuery: mockUseQuery } } },
}))

import { SimInspector } from '../sim-inspector'

const SIM = {
  id: 'reed',
  firstName: 'Reed',
  lastName: 'Caliente',
  imageUrl: null,
  lifeStage: 'TEEN',
  isHeir: true,
  generationNumber: 3,
  personalityTraits: [
    { personalityTrait: { name: 'Genius' } },
    { personalityTrait: { name: 'Foodie' } },
  ],
  aspirations: [{ aspiration: { name: 'Successful Lineage' } }],
  childOf: [
    { parent: { id: 'a', firstName: 'Alexander', lastName: 'Goth' } },
    { parent: { id: 'e', firstName: 'Eliza', lastName: 'Pancakes' } },
  ],
  socialRelationshipsA: [],
  socialRelationshipsB: [],
}

const baseProps = { simId: 'reed', legacySlug: 'caliente', founderSimId: 'dina', onClose: () => {} }

describe('SimInspector', () => {
  beforeEach(() => {
    mockUseQuery.mockReturnValue({ data: SIM, isLoading: false, isError: false })
  })

  it('shows the sim name, life stage, aspiration, traits and parents', () => {
    render(<SimInspector {...baseProps} />)
    expect(screen.getByText('Reed Caliente')).toBeInTheDocument()
    expect(screen.getByText(/Teen/)).toBeInTheDocument()
    expect(screen.getByText('Successful Lineage')).toBeInTheDocument()
    expect(screen.getByText('Genius')).toBeInTheDocument()
    expect(screen.getByText(/Alexander Goth · Eliza Pancakes/)).toBeInTheDocument()
  })

  it('labels the current heir', () => {
    render(<SimInspector {...baseProps} />)
    expect(screen.getByText(/current heir/i)).toBeInTheDocument()
  })

  it('links "Open profile" to the sim detail route', () => {
    render(<SimInspector {...baseProps} />)
    expect(screen.getByRole('link', { name: /open profile/i })).toHaveAttribute(
      'href',
      '/app/legacies/caliente/sims/reed',
    )
  })

  it('calls onClose from the ✕ button', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<SimInspector {...baseProps} onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: /close sim details/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('shows a loading state while fetching', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true, isError: false })
    render(<SimInspector {...baseProps} />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run → fails** (`../sim-inspector` missing): `npm test -- "src/app/app/legacies/[slug]/_components/tree-atlas/__tests__/sim-inspector.test.tsx"`.

- [ ] **Step 3: Implement** `…/tree-atlas/sim-inspector.tsx`:

```tsx
'use client'
import { useEffect } from 'react'
import { trpc } from '@/trpc/client'
import { ButtonLink, Eyebrow, PortraitAvatar, Badge } from '@/components/ui'
import { formatLifeStage, roman } from '@/lib/legacy-format'
import styles from './sim-inspector.module.css'

/** Romantic statuses worth surfacing a "Partner" for, strongest first. */
const PARTNER_STATUSES = ['MARRIED', 'ENGAGED', 'DATING', 'WIDOWED']

export interface SimInspectorProps {
  simId: string
  legacySlug: string
  founderSimId?: string
  onClose: () => void
}

export function SimInspector({ simId, legacySlug, founderSimId, onClose }: SimInspectorProps) {
  const { data: sim, isLoading, isError } = trpc.sims.getById.useQuery({ id: simId })

  // Esc closes the inspector. (Adds a listener only — no setState in the effect body.)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const isHeir = sim?.isHeir ?? false
  const isFounder = !!sim && sim.id === founderSimId
  const ring = isFounder ? 'founder' : isHeir ? 'heir' : 'green'
  const role = isHeir
    ? 'Current heir'
    : isFounder
      ? 'Founder'
      : sim?.generationNumber != null
        ? `Selected · Gen ${roman(sim.generationNumber)}`
        : 'Selected'

  const aspiration = sim?.aspirations?.[0]?.aspiration?.name ?? null
  const traits = sim?.personalityTraits?.map((pt) => pt.personalityTrait.name) ?? []
  const parents = sim?.childOf?.map((r) => r.parent) ?? []
  const partner =
    [
      ...(sim?.socialRelationshipsA ?? []).map((r) => ({ status: r.romanticStatus, p: r.simB })),
      ...(sim?.socialRelationshipsB ?? []).map((r) => ({ status: r.romanticStatus, p: r.simA })),
    ]
      .filter((r) => PARTNER_STATUSES.includes(r.status))
      .sort((a, b) => PARTNER_STATUSES.indexOf(a.status) - PARTNER_STATUSES.indexOf(b.status))[0]?.p ?? null

  return (
    <aside
      className={styles.inspector}
      aria-label={sim ? `${sim.firstName} ${sim.lastName} details` : 'Sim details'}
    >
      <div className={styles.header}>
        <Eyebrow color={isHeir ? 'var(--color-amber-700)' : undefined}>{role}</Eyebrow>
        <button
          type="button"
          className={styles.close}
          onClick={onClose}
          aria-label="Close sim details"
        >
          ✕
        </button>
      </div>

      {isLoading && (
        <p className={styles.message} role="status" aria-live="polite">
          Loading…
        </p>
      )}
      {isError && (
        <p className={styles.message} role="alert">
          Could not load this sim.
        </p>
      )}

      {sim && (
        <div className={styles.body}>
          <div className={styles.identity}>
            <PortraitAvatar
              imageUrl={sim.imageUrl}
              firstName={sim.firstName}
              lastName={sim.lastName}
              size={60}
              ring={ring}
            />
            <div className={styles.nameBlock}>
              <span className={styles.name}>
                {sim.firstName} {sim.lastName}
              </span>
              <span className={styles.sub}>
                {formatLifeStage(sim.lifeStage)}
                {aspiration ? (
                  <>
                    {' · '}
                    <span className={styles.aspiration}>{aspiration}</span>
                  </>
                ) : null}
              </span>
            </div>
          </div>

          {traits.length > 0 && (
            <div>
              <Eyebrow>Traits</Eyebrow>
              <div className={styles.traits}>
                {traits.map((t) => (
                  <Badge key={t} variant="neutral">
                    {t}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {parents.length > 0 && (
            <div>
              <Eyebrow>Parents</Eyebrow>
              <p className={styles.relation}>
                {parents.map((p) => `${p.firstName} ${p.lastName}`).join(' · ')}
              </p>
            </div>
          )}

          {partner && (
            <div>
              <Eyebrow>Partner</Eyebrow>
              <p className={styles.relation}>
                {partner.firstName} {partner.lastName}
              </p>
            </div>
          )}

          <ButtonLink
            href={`/app/legacies/${legacySlug}/sims/${sim.id}`}
            variant="outline"
            size="sm"
            fullWidth
          >
            Open profile →
          </ButtonLink>
        </div>
      )}
    </aside>
  )
}
```

Verify the real shapes while implementing: confirm `sims.getById` returns `personalityTraits`, `aspirations`, `childOf`, `socialRelationshipsA/B`, `romanticStatus`, `generationNumber`, `isHeir` (read `src/server/routers/sims.ts` getById). Confirm `Badge` accepts `variant="neutral"` and children (read `badge.tsx`); if the neutral variant is named differently, use the real one. If `aspirations` entries carry an "active"/"completedAt" flag, prefer the active aspiration; otherwise the first is fine.

- [ ] **Step 4: CSS** — create `…/tree-atlas/sim-inspector.module.css`:

```css
@keyframes sim-inspector-in {
  from { opacity: 0; transform: translateX(-8px); }
  to   { opacity: 1; transform: translateX(0); }
}

.inspector {
  position: absolute;
  top: 76px;
  right: 16px;
  z-index: 3;
  width: 300px;
  max-height: calc(100% - 140px);
  overflow-y: auto;
  background: color-mix(in srgb, var(--bg-card) 96%, transparent);
  backdrop-filter: blur(14px);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  animation: sim-inspector-in 240ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

@media (prefers-reduced-motion: reduce) {
  .inspector {
    animation: none;
  }
}

.header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border);
}

.close {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
}

.close:hover {
  background: var(--bg-card-hover);
  color: var(--text);
}

.close:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px 20px;
}

.identity {
  display: flex;
  align-items: center;
  gap: 14px;
}

.nameBlock {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.name {
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 600;
  line-height: 1.15;
  color: var(--text);
}

.sub {
  font-family: var(--font-body);
  font-size: 12px;
  color: var(--text-muted);
}

.aspiration {
  color: var(--text-subtle);
}

.traits {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.relation {
  margin: 6px 0 0;
  font-family: var(--font-display);
  font-size: 13px;
  color: var(--text-muted);
}

.message {
  margin: 0;
  padding: 18px 20px;
  font-family: var(--font-body);
  font-size: 13px;
  color: var(--text-muted);
}
```

- [ ] **Step 5: Run the inspector test, tsc, lint, commit**

```bash
npm test -- "src/app/app/legacies/[slug]/_components/tree-atlas/__tests__/sim-inspector.test.tsx"
npx tsc --noEmit && npm run lint
git add "src/app/app/legacies/[slug]/_components/tree-atlas/sim-inspector.tsx" \
        "src/app/app/legacies/[slug]/_components/tree-atlas/sim-inspector.module.css" \
        "src/app/app/legacies/[slug]/_components/tree-atlas/__tests__/sim-inspector.test.tsx"
git commit -m "feat(legacy-tree): selected-sim inspector card"
```

---

## Task 2: Wire selection into `TreeAtlas`

Clicking a node selects it (shows the inspector + halo) instead of navigating; the inspector's "Open profile →" is now the navigation.

**Files:** `…/tree-atlas/tree-atlas.tsx`, `…/tree-atlas/__tests__/tree-atlas.test.tsx`.

- [ ] **Step 1: Edit `tree-atlas.tsx`**
  - Add `import { SimInspector } from './sim-inspector'`.
  - Remove the `useRouter` import + `const router = useRouter()` (navigation now lives in the inspector). 
  - Add state: `const [selectedId, setSelectedId] = useState<string | null>(null)`.
  - Replace `handleSelectSim` so it selects: `function handleSelectSim(simId: string) { setSelectedId(simId) }` (keep passing it as `onSelectSim`).
  - When the gen filter hides the selected sim, clear it: after `visibleIds` is computed, derive `const activeId = selectedId && visibleIds.has(selectedId) ? selectedId : null` and pass `selectedId={activeId ?? undefined}` to `<LineageTree>` and render the inspector for `activeId`. (Keeps the halo + inspector consistent with what's visible.)
  - Pass `selectedId={activeId ?? undefined}` to `<LineageTree>`.
  - Render the inspector inside the data block (sibling of the surface/bottom bar):
    ```tsx
    {activeId && (
      <SimInspector
        simId={activeId}
        legacySlug={legacySlug}
        founderSimId={founderSimId}
        onClose={() => setSelectedId(null)}
      />
    )}
    ```

- [ ] **Step 2: Update `tree-atlas.test.tsx`** — the node-select test must now assert the inspector opens (not navigation). Mock the inspector so the atlas test stays focused:
  - Add near the other mocks: 
    ```tsx
    vi.mock('../sim-inspector', () => ({
      SimInspector: ({ simId }: { simId: string }) => (
        <div data-testid="sim-inspector">{simId}</div>
      ),
    }))
    ```
  - Replace the "navigates to the sim detail route when a node is selected" test with:
    ```tsx
    it('opens the sim inspector when a node is selected', async () => {
      const user = userEvent.setup()
      render(<TreeAtlas {...defaultProps} />)
      expect(screen.queryByTestId('sim-inspector')).not.toBeInTheDocument()
      await user.click(screen.getByTestId('lineage-tree'))
      expect(screen.getByTestId('sim-inspector')).toHaveTextContent('s2')
    })
    ```
  - The `mockPush` mock can stay (harmless) or be removed; if removed, drop its references.

- [ ] **Step 3: Verify & commit**

```bash
npm test -- "src/app/app/legacies/[slug]/_components/tree-atlas/__tests__/tree-atlas.test.tsx"
npx tsc --noEmit && npm run lint
npm test   # full suite green
git add "src/app/app/legacies/[slug]/_components/tree-atlas/tree-atlas.tsx" \
        "src/app/app/legacies/[slug]/_components/tree-atlas/__tests__/tree-atlas.test.tsx"
git commit -m "feat(legacy-tree): select a tree node to preview the sim (halo + inspector)"
```

---

## Verification (controller, after both tasks)

1. `npx tsc --noEmit`, `npm run lint`, `npm test` — all clean/green.
2. Live: open a legacy → **View family tree** → click a sim node. Confirm: the node gets a green selection halo; a card floats in top-right with portrait, name, life·aspiration, traits, parents, partner; "Open profile →" navigates to the sim; ✕ and Esc deselect (halo + card disappear); selecting another node swaps the card; verify in light + dark.

## Self-Review
- **Coverage:** inspector card (Task 1) + node-select wiring with halo (Task 2). Node click no longer navigates; "Open profile →" does.
- **Data:** reuses `sims.getById` (no schema/API change) and existing UI primitives.
- **Type consistency:** `SimInspectorProps { simId, legacySlug, founderSimId?, onClose }` consumed by `TreeAtlas`; `selectedId` state + `activeId` (filter-aware) feed both `LineageTree.selectedId` and the inspector.
- **No placeholders / no suppressions / no setState-in-effect** (the Esc effect only attaches a listener).
