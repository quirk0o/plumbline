# Derived Step-Relationships Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drop the stored `STEP` family-relationship type and instead derive stepparent / stepchild / step-sibling labels from blood/adoptive parentage + marriage, exactly as in-laws are derived.

**Architecture:** Step is a derived **label** computed in the kinship partner layer alongside in-laws, gated by the same `isMarriageBond` rule (active or widowed `MARRIED`) and applied via `setIfAbsent` so blood/adoptive relations always win. The schema migration deletes existing `STEP` edges and narrows `FamilyRelationshipType` to two values; the add-relationship modal drops the Step option. No new queries — `getTreeData`/`getMiniTreeData` already supply parents, partners, and `romanticStatus`/`endedAt`.

**Tech Stack:** Next.js 16, Prisma 7 / PostgreSQL, tRPC, Vitest (jsdom + node/DB), Playwright.

**Spec:** `docs/superpowers/specs/2026-06-10-derived-step-relationships-design.md`

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `prisma/schema.prisma` | Modify (`enum FamilyRelationshipType`, lines 101–104) | Drop `STEP`; enum becomes `BIOLOGICAL`/`ADOPTIVE` |
| `prisma/migrations/20260610000000_drop_step_relationship_type/migration.sql` | Create | Delete `STEP` rows, narrow the enum, preserve the column default |
| `src/components/lineage-tree/kinship.ts` | Modify | New `applyStepLabels` helper; call it last in `applyPartnerLabels` |
| `src/components/lineage-tree/__tests__/kinship.test.ts` | Modify | Add the step-relations describe block |
| `src/app/app/legacies/[slug]/sims/[id]/add-relationship-modal.tsx` | Modify (line 160) | Remove the `STEP` `Combobox.Item` |
| `src/app/app/legacies/[slug]/sims/[id]/__tests__/add-relationship-modal.test.tsx` | Modify | Assert Step is no longer offered |
| `src/server/routers/sims.test.ts` | Modify (lines 1549–1568, 1757–1766) | Remove `STEP` seeding; add a server→kinship step-derivation integration test |

> The `enum FamilyRelationshipType` lives at `prisma/schema.prisma:101`; the column default `@default(BIOLOGICAL)` at `prisma/schema.prisma:500`. `relationships-editor.tsx:56` only title-cases the stored type — no `STEP`-specific branch exists, so it needs **no change** (confirm in Task 5).

---

## Task 1: Derive step labels in the kinship module

The core pure-logic change. TDD here — the labeller is pure and deterministic, no DB.

**Files:**
- Test: `src/components/lineage-tree/__tests__/kinship.test.ts`
- Modify: `src/components/lineage-tree/kinship.ts`

- [ ] **Step 1: Write the failing tests**

Append this describe block to the end of `src/components/lineage-tree/__tests__/kinship.test.ts` (the `partner(a, b, status, endedAt?)` helper is already defined in this file at line 204 and is reused here):

```ts
describe('step relations (marriage-derived, focus F female)', () => {
  it('labels a stepfather (mother\'s husband, not a bio parent) and a stepmother', () => {
    const sims: KinshipSim[] = [
      { id: 'F', gender: 'FEMALE', isDeceased: false },
      { id: 'DAD', gender: 'MALE', isDeceased: false },
      { id: 'MUM', gender: 'FEMALE', isDeceased: false },
      { id: 'STEPDAD', gender: 'MALE', isDeceased: false },
      { id: 'STEPMUM', gender: 'FEMALE', isDeceased: false },
    ]
    const edges: LineageFamilyEdge[] = [
      { parentId: 'DAD', childId: 'F' }, { parentId: 'MUM', childId: 'F' },
    ]
    const l = computeKinshipLabels('F', sims, edges, [
      partner('MUM', 'STEPDAD', 'MARRIED'),
      partner('DAD', 'STEPMUM', 'MARRIED'),
    ])
    expect(l.get('STEPDAD')).toBe('Stepfather')
    expect(l.get('STEPMUM')).toBe('Stepmother')
  })

  it('labels a stepchild (spouse\'s child that is not F\'s child)', () => {
    const sims: KinshipSim[] = [
      { id: 'F', gender: 'FEMALE', isDeceased: false },
      { id: 'HUS', gender: 'MALE', isDeceased: false },
      { id: 'SCHILD', gender: 'FEMALE', isDeceased: false },
    ]
    const edges: LineageFamilyEdge[] = [{ parentId: 'HUS', childId: 'SCHILD' }]
    const l = computeKinshipLabels('F', sims, edges, [partner('F', 'HUS', 'MARRIED')])
    expect(l.get('SCHILD')).toBe('Stepdaughter')
  })

  it('labels a step-sibling (stepparent\'s child by another, sharing no parent with F)', () => {
    const sims: KinshipSim[] = [
      { id: 'F', gender: 'FEMALE', isDeceased: false },
      { id: 'MUM', gender: 'FEMALE', isDeceased: false },
      { id: 'STEPDAD', gender: 'MALE', isDeceased: false },
      { id: 'OTHERWOMAN', gender: 'FEMALE', isDeceased: false },
      { id: 'STEPBRO', gender: 'MALE', isDeceased: false },
    ]
    const edges: LineageFamilyEdge[] = [
      { parentId: 'MUM', childId: 'F' },
      { parentId: 'STEPDAD', childId: 'STEPBRO' },
      { parentId: 'OTHERWOMAN', childId: 'STEPBRO' },
    ]
    const l = computeKinshipLabels('F', sims, edges, [partner('MUM', 'STEPDAD', 'MARRIED')])
    expect(l.get('STEPBRO')).toBe('Step-brother')
  })

  it('drops the step label once the connecting marriage is divorced (endedAt set)', () => {
    const sims: KinshipSim[] = [
      { id: 'F', gender: 'FEMALE', isDeceased: false },
      { id: 'MUM', gender: 'FEMALE', isDeceased: false },
      { id: 'EXSTEP', gender: 'MALE', isDeceased: false },
    ]
    const edges: LineageFamilyEdge[] = [{ parentId: 'MUM', childId: 'F' }]
    const l = computeKinshipLabels('F', sims, edges, [
      partner('MUM', 'EXSTEP', 'MARRIED', new Date('2026-01-01')),
    ])
    expect(l.has('EXSTEP')).toBe(false)
  })

  it('keeps the step label through widowhood (deceased stepparent, no divorce)', () => {
    const sims: KinshipSim[] = [
      { id: 'F', gender: 'FEMALE', isDeceased: false },
      { id: 'MUM', gender: 'FEMALE', isDeceased: false },
      { id: 'STEPDAD', gender: 'MALE', isDeceased: true }, // widowed marriage, no endedAt
    ]
    const edges: LineageFamilyEdge[] = [{ parentId: 'MUM', childId: 'F' }]
    const l = computeKinshipLabels('F', sims, edges, [partner('MUM', 'STEPDAD', 'MARRIED')])
    expect(l.get('STEPDAD')).toBe('Stepfather')
  })

  it('does NOT derive a step relation through a non-marriage bond (DATING)', () => {
    const sims: KinshipSim[] = [
      { id: 'F', gender: 'FEMALE', isDeceased: false },
      { id: 'MUM', gender: 'FEMALE', isDeceased: false },
      { id: 'BOYF', gender: 'MALE', isDeceased: false },
    ]
    const edges: LineageFamilyEdge[] = [{ parentId: 'MUM', childId: 'F' }]
    const l = computeKinshipLabels('F', sims, edges, [partner('MUM', 'BOYF', 'DATING')])
    expect(l.has('BOYF')).toBe(false)
  })

  it('lets a blood relation win over a step relation (mother\'s husband who is also F\'s uncle)', () => {
    // UNCLE is DAD's brother (F's blood uncle) AND married to MUM (F's mother).
    const sims: KinshipSim[] = [
      { id: 'F', gender: 'FEMALE', isDeceased: false },
      { id: 'DAD', gender: 'MALE', isDeceased: false },
      { id: 'MUM', gender: 'FEMALE', isDeceased: false },
      { id: 'GF', gender: 'MALE', isDeceased: false },
      { id: 'GM', gender: 'FEMALE', isDeceased: false },
      { id: 'UNCLE', gender: 'MALE', isDeceased: false },
    ]
    const edges: LineageFamilyEdge[] = [
      { parentId: 'GF', childId: 'DAD' }, { parentId: 'GM', childId: 'DAD' },
      { parentId: 'GF', childId: 'UNCLE' }, { parentId: 'GM', childId: 'UNCLE' },
      { parentId: 'DAD', childId: 'F' }, { parentId: 'MUM', childId: 'F' },
    ]
    const l = computeKinshipLabels('F', sims, edges, [partner('MUM', 'UNCLE', 'MARRIED')])
    expect(l.get('UNCLE')).toBe('Uncle')
  })

  it('uses neutral terms for a NON_BINARY stepparent', () => {
    const sims: KinshipSim[] = [
      { id: 'F', gender: 'FEMALE', isDeceased: false },
      { id: 'MUM', gender: 'FEMALE', isDeceased: false },
      { id: 'NBSTEP', gender: 'NON_BINARY', isDeceased: false },
    ]
    const edges: LineageFamilyEdge[] = [{ parentId: 'MUM', childId: 'F' }]
    const l = computeKinshipLabels('F', sims, edges, [partner('MUM', 'NBSTEP', 'MARRIED')])
    expect(l.get('NBSTEP')).toBe('Stepparent')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/lineage-tree/__tests__/kinship.test.ts`
Expected: FAIL — the new `step relations` cases return `undefined`/`false` for the step labels (e.g. `expected undefined to be 'Stepfather'`). The pre-existing blood/partner/in-law cases must still PASS.

- [ ] **Step 3: Add the `applyStepLabels` helper**

In `src/components/lineage-tree/kinship.ts`, add this function immediately **after** `applyPartnerLabels` (after line 263, before `partnerTerm`). It reuses the existing `isMarriageBond`, `setIfAbsent`, `pick`, and `PartnerLink` definitions:

```ts
/**
 * Step relations derive from a parent's (or the focus's own) active/widowed
 * MARRIED bond — never a mere partnership. Applied after blood + in-laws via
 * setIfAbsent, so a sim who is both a step- and a blood relative keeps the
 * blood term. One hop only, matching in-laws.
 */
function applyStepLabels(
  focusId: string,
  parents: Map<string, Set<string>>,
  children: Map<string, Set<string>>,
  partnersOf: Map<string, PartnerLink[]>,
  genderOf: (id: string) => Gender,
  labels: Map<string, string>,
): void {
  const focusParents = parents.get(focusId) ?? new Set<string>()
  const focusChildren = children.get(focusId) ?? new Set<string>()

  // Stepparents: a married spouse of one of F's parents who is not also F's parent.
  const stepparents = new Set<string>()
  for (const parentId of focusParents) {
    for (const { otherId: spouseId, state } of partnersOf.get(parentId) ?? []) {
      if (!isMarriageBond(state)) continue
      if (focusParents.has(spouseId)) continue // an actual parent of F, not a step
      stepparents.add(spouseId)
      setIfAbsent(labels, spouseId, focusId, pick(genderOf(spouseId), 'Stepmother', 'Stepfather', 'Stepparent'))
    }
  }

  // Stepchildren: a married spouse's child that is not also F's own child.
  for (const { otherId: spouseId, state } of partnersOf.get(focusId) ?? []) {
    if (!isMarriageBond(state)) continue
    for (const childId of children.get(spouseId) ?? []) {
      if (focusChildren.has(childId)) continue // F's own child
      setIfAbsent(labels, childId, focusId, pick(genderOf(childId), 'Stepdaughter', 'Stepson', 'Stepchild'))
    }
  }

  // Step-siblings: a stepparent's child that shares no parent with F (a shared
  // parent makes them a half/full sibling, already labelled by the blood pass).
  for (const stepparentId of stepparents) {
    for (const childId of children.get(stepparentId) ?? []) {
      if (childId === focusId) continue
      const childParents = parents.get(childId) ?? new Set<string>()
      const sharesParent = [...focusParents].some((p) => childParents.has(p))
      if (sharesParent) continue
      setIfAbsent(labels, childId, focusId, pick(genderOf(childId), 'Step-sister', 'Step-brother', 'Step-sibling'))
    }
  }
}
```

- [ ] **Step 4: Call `applyStepLabels` last in `applyPartnerLabels`**

The `partnersOf` and `genderOf` locals are defined at the top of `applyPartnerLabels` (lines 228–232). Add the call as the final statement of `applyPartnerLabels` (after the sibling-in-law loop that ends at line 262, i.e. right before the closing `}` at line 263):

```ts
  // 3. Step relations (parent's marriage / focus's marriage). Applied last so
  //    blood and in-law labels already in the map win.
  applyStepLabels(focusId, parents, children, partnersOf, genderOf, labels)
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/components/lineage-tree/__tests__/kinship.test.ts`
Expected: PASS — all step cases plus every pre-existing case. Output pristine (no warnings).

- [ ] **Step 6: Validate types and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors, no warnings.

- [ ] **Step 7: Commit**

Use the `/but` skill (GitButler) to commit on this session's branch:
```
feat(kinship): derive step relations from marriage + parentage

Stepparent/stepchild/step-sibling are now derived labels in the partner
layer, gated by isMarriageBond (active or widowed MARRIED) and applied via
setIfAbsent so blood/adoptive relations win. One hop only, matching in-laws.
```

---

## Task 2: Drop `STEP` from the schema enum

**Files:**
- Modify: `prisma/schema.prisma` (lines 101–104)

- [ ] **Step 1: Remove `STEP` from the enum**

Change `prisma/schema.prisma`:

```prisma
enum FamilyRelationshipType {
  BIOLOGICAL
  ADOPTIVE
}
```

(Delete the `STEP` line. Leave the `type FamilyRelationshipType @default(BIOLOGICAL)` field at line 500 unchanged.)

- [ ] **Step 2: Regenerate the Prisma client**

Run: `npx prisma generate`
Expected: succeeds; `FamilyRelationshipType` in the generated client now has only `BIOLOGICAL` and `ADOPTIVE`.

- [ ] **Step 3: Verify the type tightening surfaces the stale `STEP` references**

Run: `npx tsc --noEmit`
Expected: FAIL with errors at `add-relationship-modal.tsx:160` and `sims.test.ts:1562`/`:1762` — `Property 'STEP' does not exist on type 'typeof FamilyRelationshipType'`. These are fixed in Tasks 4–6. (Do not commit yet; commit the schema with the migration in Task 3.)

---

## Task 3: Migration — delete `STEP` rows and narrow the enum

**Files:**
- Create: `prisma/migrations/20260610000000_drop_step_relationship_type/migration.sql`

- [ ] **Step 1: Write the migration SQL**

Create `prisma/migrations/20260610000000_drop_step_relationship_type/migration.sql`:

```sql
-- Drop the stored STEP family-relationship type. Step relations are now derived
-- from marriage + parentage in the kinship module, not stored as edges.
-- Plain best-effort backfill (no inference, no report), mirroring the
-- romantic-status narrow migration (20260609120000_narrow_romantic_status).

-- 1. Delete STEP edges. A deleted step re-derives as a label only where the
--    connecting marriage is recorded — the honest model (step IS the marriage).
DELETE FROM "family_relationships" WHERE "type" = 'STEP';

-- 2. Narrow the enum. Postgres cannot drop an in-use value in place, so swap the
--    type. The column's DEFAULT is of the old type, so drop it before the cast
--    and restore it after.
ALTER TYPE "FamilyRelationshipType" RENAME TO "FamilyRelationshipType_old";
CREATE TYPE "FamilyRelationshipType" AS ENUM ('BIOLOGICAL', 'ADOPTIVE');
ALTER TABLE "family_relationships" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "family_relationships"
  ALTER COLUMN "type" TYPE "FamilyRelationshipType"
  USING ("type"::text::"FamilyRelationshipType");
ALTER TABLE "family_relationships" ALTER COLUMN "type" SET DEFAULT 'BIOLOGICAL';
DROP TYPE "FamilyRelationshipType_old";
```

- [ ] **Step 2: Apply the migration to the dev/test database**

Run: `npx prisma migrate dev` (or the project's MCP `migrate-dev`). If the AI-consent guard blocks it, the test DB is set up via the existing `db:test:setup` pretest hook — see memory `[Prisma 7 AI consent guard]`.
Expected: the migration applies cleanly; `prisma migrate status` shows it as the latest applied migration. Confirm the schema matches with `npx prisma migrate status`.

- [ ] **Step 3: Sanity-check the narrowed enum in the DB**

Run: `npx prisma db execute --stdin <<< "SELECT unnest(enum_range(NULL::\"FamilyRelationshipType\"))::text;"`
Expected: two rows — `BIOLOGICAL` and `ADOPTIVE` only.

- [ ] **Step 4: Commit the schema + migration together**

Use the `/but` skill. Stage only `prisma/schema.prisma` and the new migration directory:
```
feat(schema): drop STEP from FamilyRelationshipType; derive step from marriage

Delete existing STEP family-relationship rows and narrow the enum to
BIOLOGICAL/ADOPTIVE. Step relations are now derived labels (see kinship).
```

---

## Task 4: Remove the Step option from the add-relationship modal

**Files:**
- Modify: `src/app/app/legacies/[slug]/sims/[id]/add-relationship-modal.tsx` (line 160)
- Test: `src/app/app/legacies/[slug]/sims/[id]/__tests__/add-relationship-modal.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `src/app/app/legacies/[slug]/sims/[id]/__tests__/add-relationship-modal.test.tsx`, inside the existing top-level `describe`. It mirrors the existing "offers a Partner option" test (which opens a combobox and asserts an option). The Family tab's relationship-type combobox has `aria-label="Relationship type"`:

```ts
it('does not offer a "Step" relationship type (step is derived from marriage)', async () => {
  const user = userEvent.setup()
  renderModal()
  await user.click(screen.getByRole('button', { name: /family/i }))
  await user.click(screen.getByRole('button', { name: /relationship type/i }))
  expect(screen.getByRole('option', { name: 'Biological', hidden: true })).toBeInTheDocument()
  expect(screen.getByRole('option', { name: 'Adoptive', hidden: true })).toBeInTheDocument()
  expect(screen.queryByRole('option', { name: 'Step', hidden: true })).not.toBeInTheDocument()
})
```

> If `renderModal`/`openCombobox` helpers in this file open comboboxes differently than `user.click(getByRole('button', { name: ... }))`, match the existing pattern used by the "offers a Partner option" test (line ~127) rather than the snippet above.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run "src/app/app/legacies/[slug]/sims/[id]/__tests__/add-relationship-modal.test.tsx"`
Expected: FAIL — `Step` option is still present, so `not.toBeInTheDocument()` fails.

- [ ] **Step 3: Remove the Step `Combobox.Item`**

In `src/app/app/legacies/[slug]/sims/[id]/add-relationship-modal.tsx`, delete line 160:

```tsx
                      <Combobox.Item value={FamilyRelationshipType.STEP}>Step</Combobox.Item>
```

Leaving only the Biological and Adoptive items.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run "src/app/app/legacies/[slug]/sims/[id]/__tests__/add-relationship-modal.test.tsx"`
Expected: PASS — including the existing `onAddFamily ... BIOLOGICAL` test.

- [ ] **Step 5: Commit**

Use the `/but` skill:
```
feat(ui): drop the Step option from the add-relationship modal

New step relations are expressed by recording a marriage to a parent, not by
adding a family edge.
```

---

## Task 5: Update server tests that reference `STEP`

The two `getTreeData`/`getMiniTreeData` tests seed `STEP` rows to prove they are excluded from rendering. With `STEP` gone there is nothing to exclude, so rework them: keep the bio/adoptive coverage and replace the step-exclusion assertions with a real **step-derivation** integration test that feeds `getTreeData` output into the kinship module.

**Files:**
- Modify: `src/server/routers/sims.test.ts` (lines 1549–1568 and 1757–1766)

- [ ] **Step 1: Add the kinship import**

At the top of `src/server/routers/sims.test.ts`, add (next to the existing imports):

```ts
import { computeKinshipLabels } from '@/components/lineage-tree/kinship'
```

- [ ] **Step 2: Rework the `getTreeData` STEP test (lines 1549–1568)**

Replace the `it('returns biological and adoptive family edges but not step edges', ...)` test with two tests — one keeping the bio/adoptive edge coverage, one proving step derivation end-to-end:

```ts
it('returns biological and adoptive family edges', async () => {
  const caller = authedCaller(userId)
  const parent = await createTestSim(legacyId, { firstName: 'Parent' })
  const bioChild = await createTestSim(legacyId, { firstName: 'BioChild' })
  const adoptedChild = await createTestSim(legacyId, { firstName: 'AdoptedChild' })
  await db.familyRelationship.create({
    data: { parentId: parent.id, childId: bioChild.id, type: FamilyRelationshipType.BIOLOGICAL },
  })
  await db.familyRelationship.create({
    data: { parentId: parent.id, childId: adoptedChild.id, type: FamilyRelationshipType.ADOPTIVE },
  })
  const result = await caller.sims.getTreeData({ legacySlug })
  expect(result.familyEdges).toContainEqual({ parentId: parent.id, childId: bioChild.id })
  expect(result.familyEdges).toContainEqual({ parentId: parent.id, childId: adoptedChild.id })
})

it('exposes the data to derive a step label from a recorded parent marriage', async () => {
  const caller = authedCaller(userId)
  const mum = await createTestSim(legacyId, { firstName: 'Mum', gender: Gender.FEMALE })
  const focus = await createTestSim(legacyId, { firstName: 'Focus', gender: Gender.FEMALE })
  const stepdad = await createTestSim(legacyId, { firstName: 'Stepdad', gender: Gender.MALE })
  await db.familyRelationship.create({
    data: { parentId: mum.id, childId: focus.id, type: FamilyRelationshipType.BIOLOGICAL },
  })
  const [aId, bId] = [mum.id, stepdad.id].sort()
  await db.socialRelationship.create({
    data: { simAId: aId, simBId: bId, romanticStatus: RomanticStatus.MARRIED, friendshipScore: 0, romanceScore: 0 },
  })
  const tree = await caller.sims.getTreeData({ legacySlug })
  const labels = computeKinshipLabels(focus.id, tree.sims, tree.familyEdges, tree.partnerEdges)
  expect(labels.get(stepdad.id)).toBe('Stepfather')
})
```

> `createTestSim`'s signature accepts a partial sim (the file already passes `{ firstName }`). Confirm it forwards `gender`; if not, set the gender via the option it does accept, or default sims are `FEMALE`/`MALE` per the helper — verify in `src/server/routers/sims.test.ts` / `src/test/fixtures.ts` and adjust so `mum`/`stepdad`/`focus` have the genders the assertion needs (`Stepfather` requires `stepdad.gender === MALE`).

- [ ] **Step 3: Remove the obsolete `getMiniTreeData` step-exclusion test (lines 1757–1766)**

Delete the `it('excludes step-parent edges', ...)` test entirely — a `STEP` row can no longer be stored, so the exclusion is unobservable. The adjacent `it('includes an ADOPTIVE parent ...')` test (line 1831) already proves the type filter keeps adoptive edges.

- [ ] **Step 4: Run the server tests to verify they pass**

Run: `npx vitest run src/server/routers/sims.test.ts`
Expected: PASS — all sims-router tests, including the two reworked ones. (Requires the migrated DB from Task 3.)

- [ ] **Step 5: Confirm no `STEP` references remain anywhere**

Run: `grep -rn "FamilyRelationshipType.STEP\|'STEP'\|\"STEP\"" src/ prisma/schema.prisma`
Expected: no matches. (The migration SQL string `'STEP'` is allowed — it is in `prisma/migrations/`, which is not searched here.)

Also confirm `relationships-editor.tsx` needs no change — its label rendering at line 56 (`m.relType.charAt(0) + m.relType.slice(1).toLowerCase()`) title-cases whatever type is stored and has no `STEP`-specific branch. No edit required.

- [ ] **Step 6: Commit**

Use the `/but` skill:
```
test(sims): replace STEP-edge exclusion tests with step-derivation coverage

STEP can no longer be stored; assert bio/adoptive edges and that getTreeData
output derives a Stepfather label via the kinship module.
```

---

## Task 6: Full validation and review

- [ ] **Step 1: Type-check and lint the whole project**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors, no warnings. (No `eslint-disable`/`@ts-ignore` anywhere — fix root causes.)

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: all component + integration tests pass against the migrated DB.

- [ ] **Step 3: Run E2E tests**

Run: `npm run test:e2e`
Expected: all journeys pass. If a failure traces to another agent's in-flight branch in the combined workspace (see memory `[E2E combined workspace]`), confirm it is unrelated to step relations before treating it as a regression.

- [ ] **Step 4: Code review**

Run the `/code-review` skill on the branch. Because this touches UI (the modal), also run the `design-system-reviewer` and `web-qa-tester` agents. Address any non-false-positive findings; document reasoning for any false positives.

- [ ] **Step 5: Final commit / branch finish**

Use the `superpowers:finishing-a-development-branch` skill to decide how to integrate (this branch stacks per the spec: `… → feat/romantic-status-model → feat/kinship-labels → feat/step-relationships`). Do not push or open a PR unless the user asks.

---

## Self-Review (completed during planning)

**Spec coverage:**
- Schema: drop `STEP` from enum → Task 2. ✓
- Migration & backfill (delete rows, narrow enum, preserve default) → Task 3. ✓
- Kinship derivation (stepparent/stepchild/step-sibling, `isMarriageBond` gate, `setIfAbsent` blood-wins, gendered + neutral vocabulary, ordering after in-laws) → Task 1. ✓
- `generation.ts` change → none required (spec §"Generations are unaffected"); confirmed no task needed. ✓
- Surfaces/data flow: no new queries — verified `getTreeData`/`getMiniTreeData` already return parents, partners, `romanticStatus`/`endedAt`; the filter `type: { in: [BIOLOGICAL, ADOPTIVE] }` stays (harmless, defensive). ✓
- UI: modal drops Step (Task 4); editor confirmed needs no change (Task 5 Step 5). ✓
- Testing: kinship cases incl. divorced/widowed/non-marriage/blood-wins/non-binary (Task 1); migration→re-derivation integration test (Task 5 Step 2); update existing `STEP` tests (Task 5); modal no longer offers Step (Task 4). ✓

**Placeholder scan:** No TBD/"handle edge cases"/"similar to" — every code step shows full code. ✓

**Type consistency:** `applyStepLabels(focusId, parents, children, partnersOf, genderOf, labels)` — signature in Step 3 matches the call site in Step 4. Vocabulary strings match the spec's table exactly (`Stepmother`/`Stepfather`/`Stepparent`, `Stepdaughter`/`Stepson`/`Stepchild`, `Step-sister`/`Step-brother`/`Step-sibling`). ✓
```
