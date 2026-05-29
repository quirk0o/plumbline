# Sim Detail Page Design

## Context

The legacy detail page shows sims as a portrait grid with no way to navigate to an individual sim. There is no detail or edit page for sims — creation is the only mutation. This spec adds a dedicated sim detail page with per-field inline editing covering all sim data.

---

## Route

`/app/legacies/[slug]/sims/[id]`

Breadcrumb: Legacy name → Sim name

Navigation entry: sim portrait cards on the legacy detail page become `<Link>` elements.

---

## UX Pattern

Per-field inline editing throughout. No save/cancel buttons. Saves fire:
- **On blur** — text fields (first name, last name, pronoun fields)
- **On change** — dropdowns (gender, life stage, occult type, cause of death, aspiration, career, romantic status)
- **Immediately on action** — trait add/remove, skill pip click, skill add/remove, relationship add/remove

On save failure: revert the field to its previous value, show inline error text.

---

## Page Sections

### 1. Identity Hero

- Circular portrait — clicking opens image upload; saves immediately on upload complete
- First name and last name — inline text inputs, save on blur
- Life stage badge (display only, also editable as a chip dropdown)
- Occult type chip dropdown (save on change; "None" clears the field)
- Gender chip dropdown (save on change)
- Pronouns chip — clicking expands to three inline text inputs (subject/object/possessive), each saves on blur independently

### 2. Personality Traits

- Current traits shown as chips with × — clicking × calls `removeTrait`, saves immediately
- "+ Add trait" opens the existing `TraitPicker` component as an overlay; selecting/deselecting a trait calls `addTrait`/`removeTrait` immediately

### 3. Goals & Career

Two-column layout:
- Aspiration — dropdown (save on change). Clearing sets no active aspiration.
- Career — dropdown (save on change). Clearing ends the current career.

### 4. Skills

- Each tracked skill: skill name + pip bar (pip count = `skill.maxLevel`). Clicking pip N sets level to N, saves immediately. × removes the skill.
- "+ Add skill" shows a select of skills not yet tracked for this sim; selecting one calls `addSkill({ level: 1 })`.

### 5. Family

Portrait card grid (same visual pattern as legacy page sims grid). Each card shows:
- Portrait or initials
- Name
- Relationship type below name (e.g. "Parent · Bio")
- Card is a link to that sim's detail page
- × on hover removes the relationship immediately

"+ Add family" opens `SimPickerModal`: shows sims in the same legacy (excluding current sim and already-linked sims), plus a relationship type dropdown (Biological / Adoptive / Step) and Parent/Child role selector. Confirming calls `addFamilyRelationship`.

### 6. Social Relationships

Portrait card grid. Each card shows:
- Portrait or initials
- Name
- Romantic status as an editable dropdown below name (save on change)
- × on hover removes the relationship immediately

"+ Add connection" opens `SimPickerModal` with a romantic status selector. Confirming calls `addSocialRelationship`.

### 7. Death (conditional)

Hidden when `causeOfDeath` is null. When set, shows cause of death as an editable dropdown.

"Mark as deceased" button appears at the bottom of the page when `causeOfDeath` is null.

---

## Navigation Change

In `src/app/app/legacies/[slug]/page.tsx`: wrap the `<li>` sim card contents in a `<Link href={/app/legacies/${slug}/sims/${sim.id}}>`.

---

## New tRPC Procedures

All require ownership via `legacy.userId === ctx.session.user.id`.

| Procedure | Type | Key behaviour |
|-----------|------|---------------|
| `sims.getById` | query | Full include: traits, aspirations, careers, skills, family rels, social rels |
| `sims.listByLegacy` | query | Minimal `{ id, firstName, lastName, imageUrl }` list for sim picker |
| `sims.update` | mutation | Partial scalar fields + aspiration/career junction swap |
| `sims.addTrait` | mutation | Max 6 + conflict check via `assertNoTraitConflicts` |
| `sims.removeTrait` | mutation | Delete `SimPersonalityTrait` record |
| `sims.addSkill` | mutation | Upsert `SimSkill`; validates level ≤ `skill.maxLevel` |
| `sims.setSkillLevel` | mutation | Update `SimSkill.level`; validates level ≤ `skill.maxLevel` |
| `sims.removeSkill` | mutation | Delete `SimSkill` record |
| `sims.addFamilyRelationship` | mutation | Both sims must belong to user's legacy |
| `sims.removeFamilyRelationship` | mutation | Delete `FamilyRelationship` record |
| `sims.addSocialRelationship` | mutation | Normalise `simAId < simBId`; default scores 0 |
| `sims.updateSocialRelationship` | mutation | Update `romanticStatus` only |
| `sims.removeSocialRelationship` | mutation | Delete `SocialRelationship` record |

---

## New Files

| File | Purpose |
|------|---------|
| `src/app/app/legacies/[slug]/sims/[id]/page.tsx` | Server component — auth, data fetch, passes props |
| `src/app/app/legacies/[slug]/sims/[id]/page.module.css` | Page layout styles |
| `src/app/app/legacies/[slug]/sims/[id]/sim-detail-client.tsx` | Top-level client wrapper, assembles sections |
| `src/app/app/legacies/[slug]/sims/[id]/identity-section.tsx` | Hero, name, gender, life stage, occult, pronouns, photo |
| `src/app/app/legacies/[slug]/sims/[id]/trait-editor.tsx` | Trait chips + picker overlay |
| `src/app/app/legacies/[slug]/sims/[id]/goals-section.tsx` | Aspiration + career dropdowns |
| `src/app/app/legacies/[slug]/sims/[id]/skill-editor.tsx` | Pip bars per skill |
| `src/app/app/legacies/[slug]/sims/[id]/family-editor.tsx` | Family portrait card grid |
| `src/app/app/legacies/[slug]/sims/[id]/social-editor.tsx` | Social portrait card grid |
| `src/app/app/legacies/[slug]/sims/[id]/sim-picker-modal.tsx` | Shared sim picker for family + social add flows |

## Modified Files

| File | Change |
|------|--------|
| `src/server/routers/sims.ts` | Add 13 new procedures |
| `src/lib/reference-data.ts` | Add `fetchSkills()` |
| `src/app/app/legacies/[slug]/page.tsx` | Wrap sim portrait cards in Link |
| `src/server/routers/sims.test.ts` | Add tests for all new procedures |
| `src/test/helpers.ts` | Add `createTestSim()` helper |
| `e2e/sim-detail.spec.ts` | New E2E test file |
