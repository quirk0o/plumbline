# Trait & Aspiration Life Stage Filtering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Filter traits and aspirations displayed during Sim creation/editing to only those valid for the Sim's current life stage, enforced both in the UI and server-side.

**Architecture:** `PersonalityTrait` and `Aspiration` already have `minLifeStage`/`maxLifeStage` fields in the schema; they are just not used. We add a shared `isLifeStageInRange` utility, expose those fields through `fetchTraitsWithConflicts` and `fetchAspirations`, add them to the `Trait` interface, then filter in `TraitPicker` and `SimForm` reactively as the life stage changes. `TraitEditor` (the per-sim trait picker on the detail page) also receives the sim's life stage and passes it down. A matching server-side guard in `addTrait` enforces the constraint even if the UI is bypassed.

**Tech Stack:** Next.js 16, Prisma 7, tRPC, React Hook Form (`watch`), Vitest (integration tests)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/lib/life-stage.ts` | Create | Life stage ordering constant and `isLifeStageInRange` helper |
| `src/lib/reference-data.ts` | Modify | Expose `minLifeStage`/`maxLifeStage` from both fetch functions |
| `src/app/components/trait-picker.tsx` | Modify | Add fields to `Trait` interface; accept `lifeStage` prop; filter |
| `src/app/components/sim-form.tsx` | Modify | Watch life stage; filter visible traits + aspirations; clear stale selections |
| `src/app/app/legacies/[slug]/sims/[id]/trait-editor.tsx` | Modify | Accept and forward sim's life stage to `TraitPicker` |
| `src/server/routers/sims.ts` | Modify | Validate life stage in `addTrait` before writing |
| `src/test/helpers.ts` | Modify | Add `createTestPersonalityTrait` helper |
| `src/lib/reference-data.test.ts` | Modify | Assert life stage fields returned from both fetch functions |
| `src/server/routers/sims.test.ts` | Modify | Integration test: `addTrait` rejects trait outside life stage range |

---

### Task 1: Life stage ordering utility

**Files:**
- Create: `src/lib/life-stage.ts`

- [ ] **Step 1: Write the file**

```ts
import { LifeStage } from '@prisma/client'

const LIFE_STAGE_ORDER: Record<LifeStage, number> = {
  NEWBORN: 0,
  INFANT: 1,
  TODDLER: 2,
  CHILD: 3,
  TEEN: 4,
  YOUNG_ADULT: 5,
  ADULT: 6,
  ELDER: 7,
}

export function isLifeStageInRange(
  lifeStage: LifeStage,
  min: LifeStage | null,
  max: LifeStage | null,
): boolean {
  const order = LIFE_STAGE_ORDER[lifeStage]
  if (min !== null && order < LIFE_STAGE_ORDER[min]) return false
  if (max !== null && order > LIFE_STAGE_ORDER[max]) return false
  return true
}
```

- [ ] **Step 2: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
but commit -m "feat(life-stage): add isLifeStageInRange utility"
```

---

### Task 2: Expose life stage fields from reference-data fetch functions

**Files:**
- Modify: `src/lib/reference-data.ts`

- [ ] **Step 1: Update `fetchTraitsWithConflicts` to include life stage in returned objects**

In `src/lib/reference-data.ts`, change the `traits.map(...)` return to include the two new fields:

```ts
export async function fetchTraitsWithConflicts(userId: string): Promise<Trait[]> {
  const packFilter = await getOwnedPackFilter(userId)
  const traits = await db.personalityTrait.findMany({
    where: packFilter,
    include: {
      conflictsA: { select: { traitBId: true } },
      conflictsB: { select: { traitAId: true } },
    },
    orderBy: { name: 'asc' },
  })
  return traits.map((t) => ({
    id: t.id,
    name: t.name,
    category: t.category,
    minLifeStage: t.minLifeStage,
    maxLifeStage: t.maxLifeStage,
    conflictsWith: [
      ...t.conflictsA.map((c) => c.traitBId),
      ...t.conflictsB.map((c) => c.traitAId),
    ],
  }))
}
```

- [ ] **Step 2: Update `fetchAspirations` to include life stage in the select**

```ts
export async function fetchAspirations(userId: string) {
  const packFilter = await getOwnedPackFilter(userId)
  return db.aspiration.findMany({
    where: packFilter,
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, category: true, minLifeStage: true, maxLifeStage: true },
  })
}
```

- [ ] **Step 3: Update `Trait` interface in `trait-picker.tsx` to add the new fields**

In `src/app/components/trait-picker.tsx`, add the import and fields:

```ts
import type { LifeStage } from '@prisma/client'

export interface Trait {
  id: string
  name: string
  category: string | null
  minLifeStage: LifeStage | null
  maxLifeStage: LifeStage | null
  conflictsWith: string[]
}
```

- [ ] **Step 4: Update `Aspiration` interface in `sim-form.tsx`**

In `src/app/components/sim-form.tsx`, update the local `Aspiration` interface (it already imports `LifeStage` from `@prisma/client`):

```ts
interface Aspiration {
  id: string
  name: string
  category: string
  minLifeStage: LifeStage | null
  maxLifeStage: LifeStage | null
}
```

- [ ] **Step 5: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: no errors (the new fields are optional in the Prisma result, so they are already `LifeStage | null`)

- [ ] **Step 6: Write integration tests for the reference-data functions**

In `src/lib/reference-data.test.ts`, add two test cases at the end of the `fetchTraitsWithConflicts` describe block and two at the end of the `fetchAspirations` describe block:

```ts
describe('fetchTraitsWithConflicts', () => {
  // ... existing tests ...

  it('returns minLifeStage and maxLifeStage for each trait', async () => {
    const result = await fetchTraitsWithConflicts(userId)
    expect(result.length).toBeGreaterThan(0)
    for (const t of result) {
      expect(t).toHaveProperty('minLifeStage')
      expect(t).toHaveProperty('maxLifeStage')
    }
  })
})

describe('fetchAspirations', () => {
  // ... existing tests ...

  it('returns minLifeStage and maxLifeStage for each aspiration', async () => {
    const result = await fetchAspirations(userId)
    expect(result.length).toBeGreaterThan(0)
    for (const a of result) {
      expect(a).toHaveProperty('minLifeStage')
      expect(a).toHaveProperty('maxLifeStage')
    }
  })
})
```

- [ ] **Step 7: Run the tests**

Run: `npm test -- reference-data`
Expected: all tests pass

- [ ] **Step 8: Commit**

```bash
but commit -m "feat(reference-data): expose minLifeStage/maxLifeStage from trait and aspiration fetch functions"
```

---

### Task 3: Filter traits by life stage in TraitPicker

**Files:**
- Modify: `src/app/components/trait-picker.tsx`

- [ ] **Step 1: Add `lifeStage` prop and filtering logic**

Replace the `TraitPickerProps` interface and the `visible` filter in `src/app/components/trait-picker.tsx`. The full updated top of the component:

```ts
'use client'

import { useState } from 'react'
import type { LifeStage } from '@prisma/client'
import { isLifeStageInRange } from '@/lib/life-stage'
import styles from './trait-picker.module.css'

export interface Trait {
  id: string
  name: string
  category: string | null
  minLifeStage: LifeStage | null
  maxLifeStage: LifeStage | null
  conflictsWith: string[]
}

interface TraitPickerProps {
  traits: Trait[]
  selected: string[]
  onChange: (ids: string[]) => void
  max?: number
  scrollableGrid?: boolean
  lifeStage?: LifeStage
}

const CATEGORIES = ['All', 'Emotional', 'Hobby', 'Lifestyle', 'Social'] as const

export function TraitPicker({ traits, selected, onChange, max = 6, scrollableGrid = false, lifeStage }: TraitPickerProps) {
  const [activeCategory, setActiveCategory] = useState<string>('All')
  const [search, setSearch] = useState('')

  const eligible = lifeStage
    ? traits.filter((t) => isLifeStageInRange(lifeStage, t.minLifeStage, t.maxLifeStage))
    : traits

  const conflictedIds = new Set(
    selected.flatMap((id) => eligible.find((t) => t.id === id)?.conflictsWith ?? [])
  )

  const visible = eligible.filter((t) => {
    if (activeCategory !== 'All' && t.category !== activeCategory.toUpperCase()) return false
    if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })
```

Also update the two places inside the component body that reference `traits` directly (the chip labels and `conflictingWithLabel`) to use `eligible` instead:

- The chips `selected.map((id) => { const trait = traits.find(...)` → `eligible.find(...)`
- `conflictingWithLabel`: `const conflictingSelected = selected.find((selId) => { const t = traits.find(...)` → `eligible.find(...)` and `return traits.find(...)` → `eligible.find(...)`

Full updated `conflictingWithLabel` and chips section:

```ts
  function conflictingWithLabel(id: string): string | undefined {
    if (!conflictedIds.has(id)) return undefined
    const conflictingSelected = selected.find((selId) => {
      const t = eligible.find((x) => x.id === selId)
      return t?.conflictsWith.includes(id)
    })
    return eligible.find((t) => t.id === conflictingSelected)?.name
  }
```

And in the chips JSX:
```tsx
{selected.map((id) => {
  const trait = eligible.find((t) => t.id === id)
  if (!trait) return null
  return (
    <button
      key={id}
      type="button"
      className={styles.chip}
      onClick={() => toggle(id)}
      aria-label={`Remove ${trait.name}`}
    >
      {trait.name} <span aria-hidden="true">✕</span>
    </button>
  )
})}
```

- [ ] **Step 2: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
but commit -m "feat(trait-picker): filter traits by life stage"
```

---

### Task 4: Filter in SimForm reactively when life stage changes

**Files:**
- Modify: `src/app/components/sim-form.tsx`

The `SimForm` uses `react-hook-form`. We need to:
1. Add `watch` to the `useForm` destructuring to reactively read the current `lifeStage`
2. Filter traits and aspirations based on the current life stage before rendering
3. Clear any selected traits or aspiration that become invalid when the life stage changes

- [ ] **Step 1: Add `isLifeStageInRange` import**

At the top of `src/app/components/sim-form.tsx`, add:

```ts
import { isLifeStageInRange } from '@/lib/life-stage'
```

- [ ] **Step 2: Add `watch` and `getValues` to the form destructuring**

Find the `useForm` destructuring (around line 135). Add `watch` and `getValues`:

```ts
  const {
    register,
    handleSubmit,
    control,
    setValue,
    getValues,
    watch,
    setError,
    formState: { errors: formErrors },
  } = useForm({ ... })
```

- [ ] **Step 3: Add reactive life stage and filtered lists**

After the `useForm` block and before the existing `groupedAspirations` line, add:

```ts
  const currentLifeStage = watch('lifeStage')

  const visibleTraits = traits.filter((t) =>
    isLifeStageInRange(currentLifeStage, t.minLifeStage, t.maxLifeStage)
  )

  const visibleAspirations = aspirations.filter((a) =>
    isLifeStageInRange(currentLifeStage, a.minLifeStage, a.maxLifeStage)
  )
```

- [ ] **Step 4: Replace the `groupedAspirations` line**

Change:
```ts
  const groupedAspirations = groupBy(aspirations, (a) => a.category)
```
to:
```ts
  const groupedAspirations = groupBy(visibleAspirations, (a) => a.category)
```

- [ ] **Step 5: Add a `useEffect` to clear invalid selections when life stage changes**

After the existing `useEffect` for external `errors` (around line 160), add:

```ts
  useEffect(() => {
    const traitIds = getValues('personalityTraitIds')
    const validTraitIds = traitIds.filter((id) => {
      const t = traits.find((t) => t.id === id)
      return !t || isLifeStageInRange(currentLifeStage, t.minLifeStage, t.maxLifeStage)
    })
    if (validTraitIds.length !== traitIds.length) setValue('personalityTraitIds', validTraitIds)

    const aspirationId = getValues('aspirationId')
    if (aspirationId) {
      const a = aspirations.find((a) => a.id === aspirationId)
      if (a && !isLifeStageInRange(currentLifeStage, a.minLifeStage, a.maxLifeStage)) {
        setValue('aspirationId', '')
      }
    }
  }, [currentLifeStage, traits, aspirations, getValues, setValue])
```

- [ ] **Step 6: Pass `visibleTraits` and `lifeStage` to `TraitPicker`**

Find the `<TraitPicker ... />` render (around line 374). Update it:

```tsx
<TraitPicker
  traits={visibleTraits}
  selected={field.value}
  onChange={field.onChange}
  max={6}
  lifeStage={currentLifeStage}
/>
```

- [ ] **Step 7: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 8: Run lint**

Run: `npm run lint`
Expected: no errors

- [ ] **Step 9: Commit**

```bash
but commit -m "feat(sim-form): filter traits and aspirations by selected life stage"
```

---

### Task 5: Pass life stage to TraitEditor

**Files:**
- Modify: `src/app/app/legacies/[slug]/sims/[id]/trait-editor.tsx`

The `TraitEditor` receives `sim` (which already has `lifeStage: string`) and `traits`. It needs to forward the life stage to `TraitPicker`.

- [ ] **Step 1: Import LifeStage and isLifeStageInRange, update SimProp, pass lifeStage to TraitPicker**

Full updated `src/app/app/legacies/[slug]/sims/[id]/trait-editor.tsx`:

```ts
'use client'

import { useState } from 'react'
import type { LifeStage } from '@prisma/client'
import { trpc } from '@/trpc/client'
import { TraitPicker, type Trait } from '@/app/components/trait-picker'
import styles from './page.module.css'

interface SimProp {
  id: string
  lifeStage: string
  personalityTraits: { personalityTrait: { id: string; name: string } }[]
}

export function TraitEditor({ sim, traits }: { sim: SimProp; traits: Trait[] }) {
  const [localTraitIds, setLocalTraitIds] = useState<string[]>(
    sim.personalityTraits.map((t) => t.personalityTrait.id),
  )
  const [picking, setPicking] = useState(false)
  const addTrait = trpc.sims.addTrait.useMutation()
  const removeTrait = trpc.sims.removeTrait.useMutation()

  function handleAdd(traitId: string) {
    setLocalTraitIds((prev) => [...prev, traitId])
    addTrait.mutate(
      { simId: sim.id, traitId },
      { onError: () => setLocalTraitIds((prev) => prev.filter((id) => id !== traitId)) },
    )
  }

  function handleRemove(traitId: string) {
    setLocalTraitIds((prev) => prev.filter((id) => id !== traitId))
    removeTrait.mutate(
      { simId: sim.id, traitId },
      { onError: () => setLocalTraitIds((prev) => [...prev, traitId]) },
    )
  }

  function handlePickerChange(ids: string[]) {
    const added = ids.find((id) => !localTraitIds.includes(id))
    const removed = localTraitIds.find((id) => !ids.includes(id))
    if (added) handleAdd(added)
    if (removed) handleRemove(removed)
  }

  const localTraits = localTraitIds.map((id) => {
    const found = traits.find((t) => t.id === id)
    return found ?? { id, name: id, category: null, minLifeStage: null, maxLifeStage: null, conflictsWith: [] }
  })

  return (
    <>
      <div className={styles.traitList}>
        {localTraits.map((trait) => (
          <span key={trait.id} className={styles.traitChip}>
            {trait.name}
            <button
              className={styles.traitRemove}
              aria-label={`Remove ${trait.name}`}
              onClick={() => handleRemove(trait.id)}
            >
              ×
            </button>
          </span>
        ))}
        {localTraitIds.length < 6 && (
          <button className={styles.addChip} onClick={() => setPicking(true)}>
            + Add trait
          </button>
        )}
      </div>

      {picking && (
        <div className={styles.pickerOverlay} onClick={() => setPicking(false)}>
          <div className={styles.pickerBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.pickerClose}>
              <button className={styles.removeBtn} onClick={() => setPicking(false)}>
                Close
              </button>
            </div>
            <TraitPicker
              traits={traits}
              selected={localTraitIds}
              onChange={handlePickerChange}
              max={6}
              scrollableGrid
              lifeStage={sim.lifeStage as LifeStage}
            />
          </div>
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
but commit -m "feat(trait-editor): filter trait picker by sim life stage"
```

---

### Task 6: Server-side validation in addTrait

**Files:**
- Modify: `src/server/routers/sims.ts`

- [ ] **Step 1: Add the import for `isLifeStageInRange`**

At the top of `src/server/routers/sims.ts`, add:

```ts
import { isLifeStageInRange } from '@/lib/life-stage'
```

- [ ] **Step 2: Replace the `addTrait` mutation body**

Find the `addTrait` mutation (around line 405). Replace its body to add life stage validation. Fetch the trait in parallel with the sim, then validate before the existing conflict check:

```ts
  addTrait: protectedProcedure
    .input(z.object({ simId: z.string(), traitId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const [sim, trait] = await Promise.all([
        ctx.db.sim.findFirst({
          where: { id: input.simId, legacy: { userId } },
          include: { personalityTraits: { select: { personalityTraitId: true } } },
        }),
        ctx.db.personalityTrait.findUnique({
          where: { id: input.traitId },
          select: { minLifeStage: true, maxLifeStage: true },
        }),
      ])
      if (!sim) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sim not found' })
      if (!trait) throw new TRPCError({ code: 'NOT_FOUND', message: 'Trait not found' })
      if (!isLifeStageInRange(sim.lifeStage, trait.minLifeStage, trait.maxLifeStage))
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Trait not available for this life stage' })
      if (sim.personalityTraits.length >= 6)
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Maximum 6 traits allowed' })
      const currentIds = sim.personalityTraits.map((t) => t.personalityTraitId)
      await assertNoTraitConflicts(ctx.db, [...currentIds, input.traitId])
      return ctx.db.simPersonalityTrait.create({
        data: { simId: input.simId, personalityTraitId: input.traitId },
      })
    }),
```

- [ ] **Step 3: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Run lint**

Run: `npm run lint`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
but commit -m "feat(sims): validate trait life stage compatibility in addTrait"
```

---

### Task 7: Integration test for addTrait life stage rejection

**Files:**
- Modify: `src/test/helpers.ts`
- Modify: `src/server/routers/sims.test.ts`

- [ ] **Step 1: Add `createTestPersonalityTrait` helper to `src/test/helpers.ts`**

Add this function after the existing `getPersonalityTraits` function:

```ts
export async function createTestPersonalityTrait(
  overrides: { minLifeStage?: LifeStage; maxLifeStage?: LifeStage } = {},
) {
  return db.personalityTrait.create({
    data: {
      name: `test-trait-${randomUUID()}`,
      minLifeStage: overrides.minLifeStage ?? null,
      maxLifeStage: overrides.maxLifeStage ?? null,
    },
  })
}
```

The `LifeStage` import is already in the file. No additional imports needed.

- [ ] **Step 2: Export `createTestPersonalityTrait` from helpers (verify it's exported)**

The function declaration above uses `export`, so it's already exported.

- [ ] **Step 3: Add the life stage rejection test to `sims.test.ts`**

Import `createTestPersonalityTrait` at the top of `src/server/routers/sims.test.ts`:

```ts
import {
  createTestUser,
  cleanupUser,
  createTestLegacy,
  createTestSim,
  getAnyTrait,
  getConflictingTraits,
  getAnySkill,
  getAnyAspiration,
  getAnyCareer,
  getTrackerTypeByName,
  getPersonalityTraits,
  createTestPersonalityTrait,
  createTestChallenge,
  createTestChallengePhase,
  createTestChallengeRun,
} from '@/test/helpers'
```

Also import `LifeStage` from `@prisma/client`:
```ts
import { Gender, LifeStage, FamilyRelationshipType, RomanticStatus } from '@prisma/client'
```

Then add a new test case to the `sims.addTrait / sims.removeTrait` describe block, after the existing four tests:

```ts
  it('throws BAD_REQUEST when adding a trait not valid for the sim life stage', async () => {
    const youngAdultTrait = await createTestPersonalityTrait({ minLifeStage: LifeStage.YOUNG_ADULT })
    await db.sim.update({ where: { id: simId }, data: { lifeStage: LifeStage.CHILD } })
    try {
      await expect(
        authedCaller(userId).sims.addTrait({ simId, traitId: youngAdultTrait.id })
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    } finally {
      await db.personalityTrait.delete({ where: { id: youngAdultTrait.id } })
    }
  })
```

- [ ] **Step 4: Run the test**

Run: `npm test -- sims`
Expected: all tests pass, including the new one

- [ ] **Step 5: Commit**

```bash
but commit -m "test(sims): assert addTrait rejects traits outside sim life stage"
```

---

### Task 8: Final validation

- [ ] **Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: no errors or warnings

- [ ] **Step 3: Run full test suite**

Run: `npm test`
Expected: all tests pass

- [ ] **Step 4: Commit if any lint/type fixes were needed**

```bash
but commit -m "chore: fix any remaining type or lint issues from life stage filtering"
```
