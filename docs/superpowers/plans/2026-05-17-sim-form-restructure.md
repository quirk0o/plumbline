# Sim Form Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Occult Type into the Identity section of the creation form (removing the "Special" section), and reorder the form so Personality Traits is the last section.

**Architecture:** All changes are in `sim-form.tsx`. The Personality section block moves to after Goals & Career. The Occult Type field moves into the `identityGrid` and the Special section is deleted.

**Tech Stack:** React/TSX, react-hook-form, CSS Modules

---

### Task 1: Move Occult Type into the Identity section

**Files:**
- Modify: `src/app/components/sim-form.tsx:182-327`

- [ ] **Step 1: Add the Occult Type field inside the Identity section**

In `sim-form.tsx`, the Identity section's `identityGrid` currently ends with the pronouns row (around line 265). Add the Occult Type field as a new full-width row after the pronouns block, before the closing `</div>` of `identityGrid`:

```tsx
{/* after the pronounRow and optional customPronouns block, before </div> closing identityGrid */}
<div className={styles.pronounRow}>
  <div className={styles.halfCol}>
    <FormField label="Occult type" htmlFor="occultType">
      <Select id="occultType" {...register('occultType')}>
        <option value="">None</option>
        {OCCULT_TYPES.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </Select>
    </FormField>
  </div>
</div>
```

`styles.pronounRow` is `grid-column: 1 / -1` (full width span), and `styles.halfCol` is `max-width: 50%`. This keeps Occult Type at half-width, matching its current layout in the Special section.

- [ ] **Step 2: Delete the Special section block**

Remove the entire block (currently lines 314–327):
```tsx
<div className={styles.section}>
  <div className={styles.sectionHeader}>
    <span className={styles.sectionLabel}>Special</span>
    <div className={styles.sectionLine} />
  </div>
  <div className={styles.halfCol}>
    <FormField label="Occult type" htmlFor="occultType">
      <Select id="occultType" {...register('occultType')}>
        <option value="">None</option>
        {OCCULT_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </Select>
    </FormField>
  </div>
</div>
```

Delete all of it. Occult Type is now in the Identity section from Step 1.

- [ ] **Step 3: Type-check and lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: no errors or warnings.

- [ ] **Step 4: Commit**

```bash
git add src/app/components/sim-form.tsx
git commit -m "feat(sim-form): move Occult Type into Identity section, remove Special section"
```

---

### Task 2: Move Personality section to last

**Files:**
- Modify: `src/app/components/sim-form.tsx`

The current form order is:
1. Identity (lines ~182–267)
2. Personality (lines ~269–282)
3. Goals & Career (lines ~284–312)
4. Special — deleted in Task 1

Target order:
1. Identity
2. Goals & Career
3. Personality

- [ ] **Step 1: Cut the Personality section and paste it after Goals & Career**

The Personality section is currently:
```tsx
<div className={styles.section}>
  <div className={styles.sectionHeader}>
    <span className={styles.sectionLabel}>Personality</span>
    <div className={styles.sectionLine} />
    <span className={styles.sectionHint}>up to 6 traits</span>
  </div>
  <Controller
    name="personalityTraitIds"
    control={control}
    render={({ field }) => (
      <TraitPicker traits={traits} selected={field.value} onChange={field.onChange} max={6} />
    )}
  />
</div>
```

Move this entire `<div className={styles.section}>` block to after the Goals & Career section block (which ends around line 312 after Task 1 deletions).

After the move, the form structure should be:
1. Identity section (with Occult Type)
2. Goals & Career section
3. Personality section
4. `{formErrors.root?.message && ...}`
5. Actions div

- [ ] **Step 2: Type-check and lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: no errors or warnings.

- [ ] **Step 3: Commit**

```bash
git add src/app/components/sim-form.tsx
git commit -m "feat(sim-form): move Personality Traits section to last position"
```
