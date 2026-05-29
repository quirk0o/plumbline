# Unified Relationships Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace two separate relationship editors (FamilyEditor + SocialEditor) with one unified `RelationshipsEditor` that shows a single portrait-card grid — add-card first, then partners, then family members — and a single tabbed modal for adding either type.

**Architecture:** `relationships-editor.tsx` holds all state (partners + family members) and renders one `.simCards` grid. `add-relationship-modal.tsx` provides a Partner/Family tab toggle above the sim picker. `sim-detail-client.tsx` is updated to use `RelationshipsEditor`; the two old files are deleted.

**Tech Stack:** Next.js 16 App Router, React, tRPC, Prisma, CSS Modules (`page.module.css`)

---

### Task 1: Add tab-row styles to page.module.css

**Files:**
- Modify: `src/app/app/legacies/[slug]/sims/[id]/page.module.css` (append after `.modalTitle` block, around line 416)

- [ ] **Step 1: Add CSS for the tab toggle row**

Open `page.module.css` and insert the following block immediately after the `.modalTitle` block (after line 416):

```css
/* Relationship type tab toggle (inside add-relationship modal) */
.relTabRow {
  display: flex;
  gap: var(--space-1);
}

.relTab {
  flex: 1;
  padding: 5px 0;
  border-radius: var(--radius-full);
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-muted);
  font-size: var(--text-sm);
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
  font-family: inherit;
}

.relTab:hover {
  border-color: var(--border-bright);
  color: var(--text);
}

.relTab:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.relTabActive {
  background: var(--green);
  color: #fff;
  border-color: var(--green);
}

.relTabActive:hover {
  border-color: var(--green);
  color: #fff;
}
```

- [ ] **Step 2: Run lint to verify no issues**

```bash
npm run lint
```

Expected: no errors or warnings.

- [ ] **Step 3: Commit**

```bash
git add "src/app/app/legacies/[slug]/sims/[id]/page.module.css"
git commit -m "style(relationships): add tab toggle styles for unified add modal"
```

---

### Task 2: Create add-relationship-modal.tsx

**Files:**
- Create: `src/app/app/legacies/[slug]/sims/[id]/add-relationship-modal.tsx`

- [ ] **Step 1: Create the file with the full implementation**

```tsx
'use client'

import { useState } from 'react'
import Image from 'next/image'
import { FamilyRelationshipType, RomanticStatus } from '@prisma/client'
import styles from './page.module.css'

type SimMini = { id: string; firstName: string; lastName: string; imageUrl: string | null }

const ROMANTIC_STATUS_OPTIONS: RomanticStatus[] = [
  RomanticStatus.DATING,
  RomanticStatus.ENGAGED,
  RomanticStatus.MARRIED,
  RomanticStatus.EX_PARTNER,
  RomanticStatus.WIDOWED,
]

function formatStatus(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

interface Props {
  familyAvailable: SimMini[]
  partnerAvailable: SimMini[]
  onAddFamily: (pickedId: string, role: 'parent' | 'child', relType: FamilyRelationshipType) => void
  onAddPartner: (pickedId: string, status: RomanticStatus) => void
  onClose: () => void
}

export function AddRelationshipModal({
  familyAvailable,
  partnerAvailable,
  onAddFamily,
  onAddPartner,
  onClose,
}: Props) {
  const [tab, setTab] = useState<'partner' | 'family'>('partner')
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [role, setRole] = useState<'parent' | 'child'>('child')
  const [relType, setRelType] = useState<FamilyRelationshipType>(FamilyRelationshipType.BIOLOGICAL)
  const [romanticStatus, setRomanticStatus] = useState<RomanticStatus>(RomanticStatus.DATING)

  function handleTabChange(next: 'partner' | 'family') {
    setTab(next)
    setPickedId(null)
  }

  function handleConfirm() {
    if (!pickedId) return
    if (tab === 'partner') {
      onAddPartner(pickedId, romanticStatus)
    } else {
      onAddFamily(pickedId, role, relType)
    }
  }

  const sims = tab === 'partner' ? partnerAvailable : familyAvailable

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <p className={styles.modalTitle}>Add relationship</p>

        <div className={styles.relTabRow}>
          <button
            className={`${styles.relTab} ${tab === 'partner' ? styles.relTabActive : ''}`}
            onClick={() => handleTabChange('partner')}
          >
            Partner
          </button>
          <button
            className={`${styles.relTab} ${tab === 'family' ? styles.relTabActive : ''}`}
            onClick={() => handleTabChange('family')}
          >
            Family
          </button>
        </div>

        <div className={styles.simCards} style={{ maxHeight: '240px', overflowY: 'auto' }}>
          {sims.map((sim) => (
            <button
              key={sim.id}
              className={styles.simCard}
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              onClick={() => setPickedId(sim.id)}
              aria-pressed={pickedId === sim.id}
            >
              <div
                className={styles.simPortraitWrap}
                style={pickedId === sim.id ? { borderColor: 'var(--green)' } : undefined}
              >
                {sim.imageUrl ? (
                  <Image
                    src={sim.imageUrl}
                    alt={sim.firstName}
                    fill
                    sizes="72px"
                    style={{ objectFit: 'cover' }}
                  />
                ) : (
                  <span className={styles.simInitials} aria-hidden="true">
                    {sim.firstName[0]}{sim.lastName[0]}
                  </span>
                )}
              </div>
              <span className={styles.simCardName}>{sim.firstName} {sim.lastName}</span>
            </button>
          ))}
        </div>

        {tab === 'partner' ? (
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.75rem' }}>
            Romantic status
            <select
              className={styles.editableChip}
              value={romanticStatus}
              onChange={(e) => setRomanticStatus(e.target.value as RomanticStatus)}
            >
              {ROMANTIC_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{formatStatus(s)}</option>
              ))}
            </select>
          </label>
        ) : (
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.75rem' }}>
              Role
              <select
                className={styles.editableChip}
                value={role}
                onChange={(e) => setRole(e.target.value as 'parent' | 'child')}
              >
                <option value="parent">This sim is the parent</option>
                <option value="child">This sim is the child</option>
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.75rem' }}>
              Relationship type
              <select
                className={styles.editableChip}
                value={relType}
                onChange={(e) => setRelType(e.target.value as FamilyRelationshipType)}
              >
                <option value={FamilyRelationshipType.BIOLOGICAL}>Biological</option>
                <option value={FamilyRelationshipType.ADOPTIVE}>Adoptive</option>
                <option value={FamilyRelationshipType.STEP}>Step</option>
              </select>
            </label>
          </div>
        )}

        <div className={styles.modalActions}>
          <button className={styles.modalCancelBtn} onClick={onClose}>Cancel</button>
          <button
            className={styles.editableChip}
            style={{ background: 'var(--green)', color: 'white', borderColor: 'var(--green)' }}
            onClick={handleConfirm}
            disabled={!pickedId}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/app/legacies/[slug]/sims/[id]/add-relationship-modal.tsx"
git commit -m "feat(relationships): add unified AddRelationshipModal with Partner/Family tabs"
```

---

### Task 3: Create relationships-editor.tsx

**Files:**
- Create: `src/app/app/legacies/[slug]/sims/[id]/relationships-editor.tsx`

This component merges all state and display logic from `family-editor.tsx` and `social-editor.tsx` into one component. The add-card appears first, then partners, then family members — all in one `.simCards` grid.

- [ ] **Step 1: Create the file with the full implementation**

```tsx
'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { FamilyRelationshipType, RomanticStatus } from '@prisma/client'
import { trpc } from '@/trpc/client'
import { AddRelationshipModal } from './add-relationship-modal'
import styles from './page.module.css'

type SimMini = { id: string; firstName: string; lastName: string; imageUrl: string | null }

interface FamilyMember {
  sim: SimMini
  relType: FamilyRelationshipType
  role: 'parent' | 'child'
  parentId: string
  childId: string
}

interface SocialRel {
  sim: SimMini
  romanticStatus: RomanticStatus
  simAId: string
  simBId: string
}

interface SimProp {
  id: string
  legacyId: string
  parentsOf: { child: SimMini; type: string }[]
  childOf: { parent: SimMini; type: string }[]
  socialRelationshipsA: { simB: SimMini; romanticStatus: string }[]
  socialRelationshipsB: { simA: SimMini; romanticStatus: string }[]
}

const ROMANTIC_STATUS_OPTIONS: RomanticStatus[] = [
  RomanticStatus.DATING,
  RomanticStatus.ENGAGED,
  RomanticStatus.MARRIED,
  RomanticStatus.EX_PARTNER,
  RomanticStatus.WIDOWED,
]

function formatStatus(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function familyLabel(m: FamilyMember) {
  const roleLabel = m.role === 'parent' ? 'Parent' : 'Child'
  return `${roleLabel} · ${m.relType.charAt(0) + m.relType.slice(1).toLowerCase()}`
}

export function RelationshipsEditor({
  sim,
  slug,
  legacySims,
}: {
  sim: SimProp
  slug: string
  legacySims: SimMini[]
}) {
  const addFamily = trpc.sims.addFamilyRelationship.useMutation()
  const removeFamily = trpc.sims.removeFamilyRelationship.useMutation()
  const addSocial = trpc.sims.addSocialRelationship.useMutation()
  const updateSocial = trpc.sims.updateSocialRelationship.useMutation()
  const removeSocial = trpc.sims.removeSocialRelationship.useMutation()

  const [members, setMembers] = useState<FamilyMember[]>([
    ...sim.parentsOf.map((r) => ({
      sim: r.child,
      relType: r.type as FamilyRelationshipType,
      role: 'child' as const,
      parentId: sim.id,
      childId: r.child.id,
    })),
    ...sim.childOf.map((r) => ({
      sim: r.parent,
      relType: r.type as FamilyRelationshipType,
      role: 'parent' as const,
      parentId: r.parent.id,
      childId: sim.id,
    })),
  ])

  const [partners, setPartners] = useState<SocialRel[]>([
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

  const [adding, setAdding] = useState(false)

  const partnerLinkedIds = new Set([...partners.map((r) => r.sim.id), sim.id])
  const familyLinkedIds = new Set([...members.map((m) => m.sim.id), sim.id])
  const partnerAvailable = legacySims.filter((s) => !partnerLinkedIds.has(s.id))
  const familyAvailable = legacySims.filter((s) => !familyLinkedIds.has(s.id))

  function handleAddPartner(pickedId: string, romanticStatus: RomanticStatus) {
    const picked = legacySims.find((s) => s.id === pickedId)
    if (!picked) return
    const [a, b] = [sim.id, pickedId].sort()
    const rel: SocialRel = { sim: picked, romanticStatus, simAId: a, simBId: b }
    setPartners((prev) => [...prev, rel])
    addSocial.mutate(
      { simAId: a, simBId: b, romanticStatus },
      { onError: () => setPartners((prev) => prev.filter((r) => r.sim.id !== pickedId)) },
    )
    setAdding(false)
  }

  function handleAddFamily(pickedId: string, role: 'parent' | 'child', relType: FamilyRelationshipType) {
    const picked = legacySims.find((s) => s.id === pickedId)
    if (!picked) return
    const parentId = role === 'parent' ? pickedId : sim.id
    const childId = role === 'parent' ? sim.id : pickedId
    setMembers((prev) => [...prev, { sim: picked, relType, role, parentId, childId }])
    addFamily.mutate(
      { parentId, childId, type: relType },
      { onError: () => setMembers((prev) => prev.filter((m) => m.sim.id !== pickedId)) },
    )
    setAdding(false)
  }

  function handleStatusChange(rel: SocialRel, romanticStatus: RomanticStatus) {
    const previousStatus = rel.romanticStatus
    setPartners((prev) =>
      prev.map((r) => (r.sim.id === rel.sim.id ? { ...r, romanticStatus } : r)),
    )
    updateSocial.mutate(
      { simAId: rel.simAId, simBId: rel.simBId, romanticStatus },
      {
        onError: () =>
          setPartners((prev) =>
            prev.map((r) => (r.sim.id === rel.sim.id ? { ...r, romanticStatus: previousStatus } : r)),
          ),
      },
    )
  }

  function handleRemovePartner(rel: SocialRel) {
    setPartners((prev) => prev.filter((r) => r.sim.id !== rel.sim.id))
    removeSocial.mutate(
      { simAId: rel.simAId, simBId: rel.simBId },
      { onError: () => setPartners((prev) => [...prev, rel]) },
    )
  }

  function handleRemoveFamily(m: FamilyMember) {
    setMembers((prev) => prev.filter((x) => x.sim.id !== m.sim.id || x.role !== m.role))
    removeFamily.mutate(
      { parentId: m.parentId, childId: m.childId },
      { onError: () => setMembers((prev) => [...prev, m]) },
    )
  }

  return (
    <>
      <div className={styles.simCards}>
        <button
          className={`${styles.simCard} ${styles.addCard}`}
          onClick={() => setAdding(true)}
        >
          <div className={styles.simPortraitWrap}>
            <span className={styles.addCardIcon}>+</span>
          </div>
          <span className={styles.simCardName}>Add</span>
        </button>

        {partners.map((rel) => (
          <div key={rel.sim.id} className={styles.simCard}>
            <Link href={`/app/legacies/${slug}/sims/${rel.sim.id}`} style={{ display: 'contents' }}>
              <div className={styles.simPortraitOuter}>
                <div className={`${styles.simPortraitWrap} ${styles.simPortraitPartner}`}>
                  {rel.sim.imageUrl ? (
                    <Image
                      src={rel.sim.imageUrl}
                      alt={rel.sim.firstName}
                      fill
                      sizes="72px"
                      style={{ objectFit: 'cover' }}
                    />
                  ) : (
                    <span className={styles.simInitials} aria-hidden="true">
                      {rel.sim.firstName[0]}{rel.sim.lastName[0]}
                    </span>
                  )}
                </div>
                <span className={styles.partnerBadge} aria-hidden="true">Partner</span>
              </div>
              <span className={styles.simCardName}>{rel.sim.firstName} {rel.sim.lastName}</span>
            </Link>
            <select
              className={styles.simCardSub}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                textAlign: 'center',
                fontSize: '0.6875rem',
                color: 'var(--text-muted)',
              }}
              value={rel.romanticStatus}
              aria-label={`Romantic status with ${rel.sim.firstName}`}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => handleStatusChange(rel, e.target.value as RomanticStatus)}
            >
              {ROMANTIC_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{formatStatus(s)}</option>
              ))}
            </select>
            <button
              className={styles.simCardRemove}
              aria-label={`Remove ${rel.sim.firstName}`}
              onClick={(e) => {
                e.stopPropagation()
                e.preventDefault()
                handleRemovePartner(rel)
              }}
            >
              ×
            </button>
          </div>
        ))}

        {members.map((m) => (
          <div key={`${m.sim.id}-${m.role}`} className={styles.simCard}>
            <Link href={`/app/legacies/${slug}/sims/${m.sim.id}`} style={{ display: 'contents' }}>
              <div className={styles.simPortraitWrap}>
                {m.sim.imageUrl ? (
                  <Image
                    src={m.sim.imageUrl}
                    alt={m.sim.firstName}
                    fill
                    sizes="72px"
                    style={{ objectFit: 'cover' }}
                  />
                ) : (
                  <span className={styles.simInitials} aria-hidden="true">
                    {m.sim.firstName[0]}{m.sim.lastName[0]}
                  </span>
                )}
              </div>
              <span className={styles.simCardName}>{m.sim.firstName} {m.sim.lastName}</span>
              <span className={styles.simCardSub}>{familyLabel(m)}</span>
            </Link>
            <button
              className={styles.simCardRemove}
              aria-label={`Remove ${m.sim.firstName}`}
              onClick={(e) => {
                e.stopPropagation()
                e.preventDefault()
                handleRemoveFamily(m)
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {adding && (
        <AddRelationshipModal
          familyAvailable={familyAvailable}
          partnerAvailable={partnerAvailable}
          onAddFamily={handleAddFamily}
          onAddPartner={handleAddPartner}
          onClose={() => setAdding(false)}
        />
      )}
    </>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/app/legacies/[slug]/sims/[id]/relationships-editor.tsx"
git commit -m "feat(relationships): add RelationshipsEditor — unified grid with partners first"
```

---

### Task 4: Update sim-detail-client.tsx

**Files:**
- Modify: `src/app/app/legacies/[slug]/sims/[id]/sim-detail-client.tsx`

- [ ] **Step 1: Replace imports**

In `sim-detail-client.tsx`, replace:
```tsx
import { FamilyEditor } from './family-editor'
import { SocialEditor } from './social-editor'
```
with:
```tsx
import { RelationshipsEditor } from './relationships-editor'
```

- [ ] **Step 2: Replace usage in JSX**

Find the Relationships section (around line 86–93):
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

Replace with:
```tsx
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionLabel}>Relationships</h2>
          <div className={styles.sectionLine} />
        </div>
        <RelationshipsEditor sim={sim} slug={slug} legacySims={legacySims} />
      </section>
```

- [ ] **Step 3: Type-check and lint**

```bash
npx tsc --noEmit && npm run lint
```

Expected: no errors or warnings.

- [ ] **Step 4: Commit**

```bash
git add "src/app/app/legacies/[slug]/sims/[id]/sim-detail-client.tsx"
git commit -m "refactor(sim-detail): use RelationshipsEditor in place of FamilyEditor + SocialEditor"
```

---

### Task 5: Delete the old editor files

**Files:**
- Delete: `src/app/app/legacies/[slug]/sims/[id]/family-editor.tsx`
- Delete: `src/app/app/legacies/[slug]/sims/[id]/social-editor.tsx`

- [ ] **Step 1: Delete the files**

```bash
rm "src/app/app/legacies/[slug]/sims/[id]/family-editor.tsx"
rm "src/app/app/legacies/[slug]/sims/[id]/social-editor.tsx"
```

- [ ] **Step 2: Confirm nothing imports them**

```bash
grep -r "family-editor\|social-editor" src/
```

Expected: no output.

- [ ] **Step 3: Type-check and lint**

```bash
npx tsc --noEmit && npm run lint
```

Expected: no errors or warnings.

- [ ] **Step 4: Commit**

```bash
git add -u
git commit -m "refactor(relationships): delete family-editor and social-editor (replaced by relationships-editor)"
```

---

### Task 6: Final verification

- [ ] **Step 1: Run full type-check and lint**

```bash
npx tsc --noEmit && npm run lint
```

Expected: clean output.

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Manual browser check**

Start the dev server (`npm run dev`) and sign in via the magic link flow (see AGENTS.md). Navigate to a sim detail page that has at least one partner and one family member.

Verify:
1. Single `.simCards` grid — no gap between two separate rows
2. Add-card appears first (dashed circle, "Add" label)
3. Partners appear before family members; partner badge visible
4. Click add-card → modal opens with "Partner" tab active by default
5. Switch to "Family" tab → sim list refreshes, role + relationship type selects appear
6. Add a partner → appears immediately in grid after add-card
7. Add a family member → appears after existing partners
8. Romantic status select on partner cards still works
9. Remove buttons on both partner and family cards still work
10. Test with a sim that has no existing relationships — add-card is visible, modal opens

- [ ] **Step 4: Run E2E tests**

```bash
npm run test:e2e
```

Expected: all tests pass.
