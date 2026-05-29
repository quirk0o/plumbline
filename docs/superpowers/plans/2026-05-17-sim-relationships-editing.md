# Sim Relationships & Inline Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the Family and Social Relationships sections into one "Relationships" section (no friends, partner badge on social cards); replace the chip-styled Goals & Career selects with honest form fields; replace the bare Death select with a confirmation dialog + death card.

**Architecture:** Four targeted changes: (1) merge sections in `sim-detail-client.tsx`, (2) remove friends and add partner badge in `social-editor.tsx`, (3) restyle selects in `goals-section.tsx`, (4) extract and rewrite death logic in new `death-section.tsx`. New CSS classes added to `page.module.css`.

**Prerequisite:** The `sim-detail-quick-polish` plan must be applied first (or at minimum its Task 1 — adding `.sectionHeader`, `.sectionLabel`, `.sectionLine` to `page.module.css`). This plan uses those classes in Task 3.

**Tech Stack:** React/TSX, tRPC, CSS Modules

---

### Task 1: Add CSS for partner badge and goal selects

**Files:**
- Modify: `src/app/app/legacies/[slug]/sims/[id]/page.module.css`

Add all new classes at the end of the file before any `@media` queries (or at the very end). This task adds CSS only — no component changes yet.

- [ ] **Step 1: Append new CSS classes to `page.module.css`**

```css
/* Partner badge on social relationship cards */
.simPortraitPartner {
  border-color: var(--border-bright) !important;
}

.partnerBadge {
  position: absolute;
  bottom: -8px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--bg-card);
  border: 1px solid var(--border);
  color: var(--text-subtle);
  font-size: 0.5rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 1px 5px;
  border-radius: var(--radius-xs);
  white-space: nowrap;
  pointer-events: none;
  z-index: 1;
}

/* Honest form select for Goals & Career */
.goalSelect {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-sm);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-card);
  color: var(--text);
  cursor: pointer;
  box-sizing: border-box;
}

.goalSelect:hover {
  border-color: var(--border-bright);
}

.goalSelect:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

/* Death section */
.deathConfirm {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-base);
  max-width: 280px;
}

.deathConfirmTitle {
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  margin: 0;
}

.deathConfirmActions {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.deathCard {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-base);
}

.deathCardIcon {
  font-size: 1rem;
  color: var(--text-subtle);
  margin-top: 2px;
  flex-shrink: 0;
}

.deathCardMeta {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.deathCardCause {
  font-size: var(--text-base);
  font-weight: var(--weight-medium);
  color: var(--text);
  margin: 0;
}

.deathCardActions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-1);
}

.deathCardLink {
  font-size: var(--text-xs);
  color: var(--text-muted);
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
  text-decoration-style: dotted;
  font-family: inherit;
}

.deathCardLink:hover {
  color: var(--text);
}

.deathCardLink:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.deathCardSep {
  font-size: var(--text-xs);
  color: var(--text-subtle);
}
```

- [ ] **Step 2: Type-check and lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: no errors or warnings.

- [ ] **Step 3: Commit**

```bash
git add src/app/app/legacies/[slug]/sims/[id]/page.module.css
git commit -m "feat(sim-detail): add CSS for partner badge, goal selects, death card"
```

---

### Task 2: Update `social-editor.tsx` — remove friends, add partner badge

**Files:**
- Modify: `src/app/app/legacies/[slug]/sims/[id]/social-editor.tsx`

- [ ] **Step 1: Remove `RomanticStatus.NONE` from options and filter existing NONE relationships**

In `social-editor.tsx`, make three changes:

**Change 1** — Remove `RomanticStatus.NONE` from `ROMANTIC_STATUS_OPTIONS` (line 14). Change from:
```tsx
const ROMANTIC_STATUS_OPTIONS: RomanticStatus[] = [
  RomanticStatus.NONE,
  RomanticStatus.DATING,
  RomanticStatus.ENGAGED,
  RomanticStatus.MARRIED,
  RomanticStatus.EX_PARTNER,
  RomanticStatus.WIDOWED,
]
```
To:
```tsx
const ROMANTIC_STATUS_OPTIONS: RomanticStatus[] = [
  RomanticStatus.DATING,
  RomanticStatus.ENGAGED,
  RomanticStatus.MARRIED,
  RomanticStatus.EX_PARTNER,
  RomanticStatus.WIDOWED,
]
```

**Change 2** — Filter out NONE relationships in the initial `useState` (lines 44–53). Add a `.filter` call:
```tsx
const [rels, setRels] = useState<SocialRel[]>([
  ...sim.socialRelationshipsA
    .filter((r) => r.romanticStatus !== RomanticStatus.NONE)
    .map((r) => {
      const [a, b] = [sim.id, r.simB.id].sort()
      return { sim: r.simB, romanticStatus: r.romanticStatus as RomanticStatus, simAId: a, simBId: b }
    }),
  ...sim.socialRelationshipsB
    .filter((r) => r.romanticStatus !== RomanticStatus.NONE)
    .map((r) => {
      const [a, b] = [sim.id, r.simA.id].sort()
      return { sim: r.simA, romanticStatus: r.romanticStatus as RomanticStatus, simAId: a, simBId: b }
    }),
])
```

**Change 3** — Change the default `newStatus` (line 57) from `RomanticStatus.NONE` to `RomanticStatus.DATING`:
```tsx
const [newStatus, setNewStatus] = useState<RomanticStatus>(RomanticStatus.DATING)
```

- [ ] **Step 2: Add partner badge to each card**

In the `rels.map(...)` render block (lines 98–123), update the `simPortraitWrap` div to add the partner ring and badge:

Before:
```tsx
<div className={styles.simPortraitWrap}>
  {rel.sim.imageUrl ? (
    <Image src={rel.sim.imageUrl} alt={rel.sim.firstName} fill sizes="72px" style={{ objectFit: 'cover' }} />
  ) : (
    <span className={styles.simInitials} aria-hidden="true">
      {rel.sim.firstName[0]}{rel.sim.lastName[0]}
    </span>
  )}
</div>
```

After:
```tsx
<div className={`${styles.simPortraitWrap} ${styles.simPortraitPartner}`}>
  {rel.sim.imageUrl ? (
    <Image src={rel.sim.imageUrl} alt={rel.sim.firstName} fill sizes="72px" style={{ objectFit: 'cover' }} />
  ) : (
    <span className={styles.simInitials} aria-hidden="true">
      {rel.sim.firstName[0]}{rel.sim.lastName[0]}
    </span>
  )}
  <span className={styles.partnerBadge} aria-hidden="true">Partner</span>
</div>
```

- [ ] **Step 3: Update the "Add connection" button label**

Change the add card label from "Add connection" to "Add partner" (line 139):
```tsx
<span className={styles.simCardName}>Add partner</span>
```

Also update the `SimPickerModal` title (line 151) from "Add social connection" to "Add partner".

- [ ] **Step 4: Type-check and lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: no errors or warnings.

- [ ] **Step 5: Commit**

```bash
git add src/app/app/legacies/[slug]/sims/[id]/social-editor.tsx
git commit -m "feat(sim-detail): remove friends from relationships, add partner badge"
```

---

### Task 3: Merge Family and Social Relationships into one section

**Files:**
- Modify: `src/app/app/legacies/[slug]/sims/[id]/sim-detail-client.tsx:77-90`

- [ ] **Step 1: Replace the two separate sections with one "Relationships" section**

Current (lines 77–90):
```tsx
<section className={styles.section}>
  <h2 className={styles.sectionHeading}>Family</h2>
  <FamilyEditor sim={sim} slug={slug} legacySims={legacySims} />
</section>

<section className={styles.section}>
  <h2 className={styles.sectionHeading}>Social Relationships</h2>
  <SocialEditor sim={sim} slug={slug} legacySims={legacySims} />
</section>
```

Replace with:
```tsx
<section className={styles.section}>
  <div className={styles.sectionHeader}>
    <h2 className={styles.sectionLabel}>Relationships</h2>
    <div className={styles.sectionLine} />
  </div>
  <FamilyEditor sim={sim} slug={slug} legacySims={legacySims} />
  <SocialEditor sim={sim} slug={slug} legacySims={legacySims} />
</section>
```

- [ ] **Step 2: Type-check and lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: no errors or warnings.

- [ ] **Step 3: Commit**

```bash
git add src/app/app/legacies/[slug]/sims/[id]/sim-detail-client.tsx
git commit -m "feat(sim-detail): merge Family and Social into single Relationships section"
```

---

### Task 4: Replace Goals & Career chip selects with honest form fields

**Files:**
- Modify: `src/app/app/legacies/[slug]/sims/[id]/goals-section.tsx`

- [ ] **Step 1: Replace `editableChip` class with `goalSelect` on both selects**

In `goals-section.tsx`, there are two `<select className={styles.editableChip}>` elements (lines 39 and 60).

Replace both occurrences of `className={styles.editableChip}` with `className={styles.goalSelect}`. No other changes needed — the `onChange → update.mutate` auto-save logic stays identical.

After the change, the aspiration select should look like:
```tsx
<select
  className={styles.goalSelect}
  defaultValue={currentAspiration?.id ?? ''}
  aria-label="Aspiration"
  onChange={(e) =>
    update.mutate({ id: sim.id, aspirationId: e.target.value || null })
  }
>
```

And the career select:
```tsx
<select
  className={styles.goalSelect}
  defaultValue={currentCareer?.id ?? ''}
  aria-label="Career"
  onChange={(e) =>
    update.mutate({ id: sim.id, careerId: e.target.value || null })
  }
>
```

- [ ] **Step 2: Type-check and lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: no errors or warnings.

- [ ] **Step 3: Commit**

```bash
git add src/app/app/legacies/[slug]/sims/[id]/goals-section.tsx
git commit -m "feat(sim-detail): replace chip-styled selects with honest form fields in Goals & Career"
```

---

### Task 5: Extract and rewrite the Death section

**Files:**
- Create: `src/app/app/legacies/[slug]/sims/[id]/death-section.tsx`
- Modify: `src/app/app/legacies/[slug]/sims/[id]/sim-detail-client.tsx`

The `DeathSection` and `MarkDeceasedButton` functions are currently defined inline in `sim-detail-client.tsx`. This task extracts them into their own file and rewrites the UX.

- [ ] **Step 1: Create `death-section.tsx`**

Create `src/app/app/legacies/[slug]/sims/[id]/death-section.tsx` with the following content:

```tsx
'use client'

import { useState } from 'react'
import { CauseOfDeath } from '@prisma/client'
import { trpc } from '@/trpc/client'
import { Button } from '@/components/ui'
import styles from './page.module.css'

const CAUSE_OF_DEATH_OPTIONS: CauseOfDeath[] = [
  CauseOfDeath.OLD_AGE,
  CauseOfDeath.DROWNING,
  CauseOfDeath.FIRE,
  CauseOfDeath.ELECTROCUTION,
  CauseOfDeath.HUNGER,
  CauseOfDeath.OVEREXERTION,
  CauseOfDeath.EMBARRASSMENT,
  CauseOfDeath.ANGER,
  CauseOfDeath.LAUGHTER,
  CauseOfDeath.COWPLANT,
  CauseOfDeath.PUFFERFISH,
  CauseOfDeath.MURPHY_BED,
  CauseOfDeath.STEAM,
  CauseOfDeath.POISON,
  CauseOfDeath.METEOR,
]

function formatCause(cause: string): string {
  return cause.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
}

interface Props {
  simId: string
  initialCauseOfDeath: string | null
}

export function DeathSection({ simId, initialCauseOfDeath }: Props) {
  const update = trpc.sims.update.useMutation()
  const [causeOfDeath, setCauseOfDeath] = useState<string | null>(initialCauseOfDeath)
  const [confirming, setConfirming] = useState(false)
  const [pendingCause, setPendingCause] = useState<CauseOfDeath>(CauseOfDeath.OLD_AGE)
  const [editingCause, setEditingCause] = useState(false)

  function handleConfirmDeath() {
    update.mutate(
      { id: simId, causeOfDeath: pendingCause },
      { onSuccess: () => setCauseOfDeath(pendingCause) },
    )
    setConfirming(false)
  }

  function handleChangeCause(newCause: CauseOfDeath) {
    update.mutate(
      { id: simId, causeOfDeath: newCause },
      { onSuccess: () => setCauseOfDeath(newCause) },
    )
    setEditingCause(false)
  }

  function handleMarkAlive() {
    update.mutate(
      { id: simId, causeOfDeath: null },
      { onSuccess: () => setCauseOfDeath(null) },
    )
  }

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionLabel}>Death</h2>
        <div className={styles.sectionLine} />
      </div>

      {!causeOfDeath && !confirming && (
        <button className={styles.addChip} onClick={() => setConfirming(true)}>
          + Mark as deceased
        </button>
      )}

      {!causeOfDeath && confirming && (
        <div className={styles.deathConfirm}>
          <p className={styles.deathConfirmTitle}>Mark as deceased</p>
          <span className={styles.fieldLabel}>Cause of death</span>
          <select
            className={styles.goalSelect}
            value={pendingCause}
            onChange={(e) => setPendingCause(e.target.value as CauseOfDeath)}
          >
            {CAUSE_OF_DEATH_OPTIONS.map((c) => (
              <option key={c} value={c}>{formatCause(c)}</option>
            ))}
          </select>
          <div className={styles.deathConfirmActions}>
            <Button
              type="button"
              onClick={handleConfirmDeath}
              disabled={update.isPending}
            >
              Confirm
            </Button>
            <button
              className={styles.modalCancelBtn}
              type="button"
              onClick={() => setConfirming(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {causeOfDeath && (
        <div className={styles.deathCard}>
          <span className={styles.deathCardIcon} aria-hidden="true">✦</span>
          <div className={styles.deathCardMeta}>
            <span className={styles.fieldLabel}>Cause of death</span>
            {editingCause ? (
              <select
                className={styles.goalSelect}
                defaultValue={causeOfDeath}
                autoFocus
                onChange={(e) => handleChangeCause(e.target.value as CauseOfDeath)}
                onBlur={() => setEditingCause(false)}
              >
                {CAUSE_OF_DEATH_OPTIONS.map((c) => (
                  <option key={c} value={c}>{formatCause(c)}</option>
                ))}
              </select>
            ) : (
              <p className={styles.deathCardCause}>{formatCause(causeOfDeath)}</p>
            )}
            <div className={styles.deathCardActions}>
              <button
                className={styles.deathCardLink}
                type="button"
                onClick={() => setEditingCause(true)}
              >
                Change cause
              </button>
              <span className={styles.deathCardSep} aria-hidden="true">·</span>
              <button
                className={styles.deathCardLink}
                type="button"
                onClick={handleMarkAlive}
                disabled={update.isPending}
              >
                Mark as alive
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 2: Update `sim-detail-client.tsx` to use `DeathSection`**

**Remove** the inline `DeathSection` and `MarkDeceasedButton` function definitions at the bottom of `sim-detail-client.tsx` (lines 93–146 approximately).

**Remove** the `CauseOfDeath` import from `sim-detail-client.tsx` (it is now only needed in `death-section.tsx`).

**Add** the import for the new component at the top of `sim-detail-client.tsx`:
```tsx
import { DeathSection } from './death-section'
```

**Replace** the conditional death rendering (currently two lines):
```tsx
{sim.causeOfDeath && <DeathSection sim={sim} />}
{!sim.causeOfDeath && <MarkDeceasedButton simId={sim.id} />}
```

With a single line:
```tsx
<DeathSection simId={sim.id} initialCauseOfDeath={sim.causeOfDeath} />
```

- [ ] **Step 3: Type-check and lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: no errors or warnings.

- [ ] **Step 4: Commit**

```bash
git add src/app/app/legacies/[slug]/sims/[id]/death-section.tsx \
        src/app/app/legacies/[slug]/sims/[id]/sim-detail-client.tsx
git commit -m "feat(sim-detail): replace death inline select with confirmation dialog and death card"
```

---

### Final: Run full test suite

- [ ] **Run all tests**

```bash
npm test
npm run test:e2e
```

Expected: all tests pass. If the E2E tests include flows that use the relationship sections or the death feature, verify them manually in the browser as well.
