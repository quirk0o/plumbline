# Sim Detail Quick Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align detail page section headers to the form's small-uppercase-label style, right-align skill pip bars, and tighten vertical spacing in the identity section.

**Architecture:** All changes are CSS and minor HTML restructuring — no logic changes. The detail page section headers gain the same flex-label-plus-rule pattern already used in the creation form.

**Tech Stack:** CSS Modules, React/TSX

---

### Task 1: Replace `.sectionHeading` with form-style header classes

**Files:**
- Modify: `src/app/app/legacies/[slug]/sims/[id]/page.module.css:32-39`
- Modify: `src/app/app/legacies/[slug]/sims/[id]/sim-detail-client.tsx:62-90`

No logic test possible for pure CSS. Verify with TypeScript and lint after the change.

- [ ] **Step 1: Replace the `.sectionHeading` block in `page.module.css`**

Remove lines 32–39:
```css
.sectionHeading {
  font-family: var(--font-display);
  font-size: 1.375rem;
  font-weight: 600;
  color: var(--text);
  margin-bottom: var(--space-3);
  line-height: 1.2;
}
```

Replace with these three classes (insert at the same location):
```css
.sectionHeader {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.sectionLabel {
  font-size: var(--text-xs);
  font-weight: var(--weight-bold);
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: var(--text-muted);
  white-space: nowrap;
}

.sectionLine {
  flex: 1;
  height: 1px;
  background: var(--border);
}
```

- [ ] **Step 2: Update every section heading in `sim-detail-client.tsx`**

The file has five `<h2 className={styles.sectionHeading}>` elements (lines 63, 68, 73, 78, 83, 88). Replace each one with the wrapper pattern. For example:

Before:
```tsx
<section className={styles.section}>
  <h2 className={styles.sectionHeading}>Personality Traits</h2>
  <TraitEditor sim={sim} traits={traits} />
</section>
```

After:
```tsx
<section className={styles.section}>
  <div className={styles.sectionHeader}>
    <h2 className={styles.sectionLabel}>Personality Traits</h2>
    <div className={styles.sectionLine} />
  </div>
  <TraitEditor sim={sim} traits={traits} />
</section>
```

Apply the same pattern to all five sections: Personality Traits, Goals & Career, Skills, Family, Social Relationships.

Also update the `DeathSection` function (lines 114–132 in the same file) — it has its own `<h2 className={styles.sectionHeading}>Death</h2>`:
```tsx
<div className={styles.sectionHeader}>
  <h2 className={styles.sectionLabel}>Death</h2>
  <div className={styles.sectionLine} />
</div>
```

- [ ] **Step 3: Type-check and lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: no errors or warnings.

- [ ] **Step 4: Commit**

```bash
git add src/app/app/legacies/[slug]/sims/[id]/page.module.css \
        src/app/app/legacies/[slug]/sims/[id]/sim-detail-client.tsx
git commit -m "feat(sim-detail): align section headers to form-style uppercase label + rule"
```

---

### Task 2: Right-align skill pip bars

**Files:**
- Modify: `src/app/app/legacies/[slug]/sims/[id]/page.module.css:242-245`

- [ ] **Step 1: Add `justify-content: flex-end` to `.pipBar`**

Current (lines 242–245):
```css
.pipBar {
  display: flex;
  gap: 3px;
}
```

Replace with:
```css
.pipBar {
  display: flex;
  gap: 3px;
  justify-content: flex-end;
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
git commit -m "feat(sim-detail): right-align skill pip bars"
```

---

### Task 3: Reduce identity section row spacing

**Files:**
- Modify: `src/app/app/legacies/[slug]/sims/[id]/page.module.css:42-72, 493-496`

- [ ] **Step 1: Reduce `.hero` gap and row margins**

Make three edits in `page.module.css`:

**Edit 1** — `.hero` gap (line 46): change `gap: var(--space-4)` to `gap: var(--space-3)`:
```css
.hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding-bottom: var(--space-7);
  border-bottom: 1px solid var(--border);
  margin-bottom: var(--space-7);
}
```

**Edit 2** — `.nameRow` margin (line 61): change `margin-bottom: var(--space-3)` to `margin-bottom: var(--space-2)`:
```css
.nameRow {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex-wrap: wrap;
  margin-bottom: var(--space-2);
  justify-content: center;
}
```

**Edit 3** — `.pronounLine` margin (line 495): change `margin: 0 auto var(--space-3)` to `margin: 0 auto var(--space-2)`:
```css
.pronounLine {
  display: block;
  margin: 0 auto var(--space-2);
  font-size: 0.875rem;
  color: var(--text-muted);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  font-family: inherit;
  line-height: 1.4;
  border-bottom: 1px dashed transparent;
  transition: border-color 0.15s, color 0.15s;
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
git commit -m "feat(sim-detail): tighten identity section row spacing"
```
