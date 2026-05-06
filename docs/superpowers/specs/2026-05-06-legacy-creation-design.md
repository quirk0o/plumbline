# Legacy Creation with Founder Sim — Design Spec

**Date:** 2026-05-06

## Context

SimTrack's database schema already models Legacies, Households, Sims, Traits, Aspirations, Skills, and Careers — but no UI exists to create any of them. This spec covers the first user-facing feature: creating a Legacy and optionally specifying its founder Sim.

## Goal

Let a user create a named Legacy (with optional description and cover image), then optionally define the founder Sim in the same flow. The Sim form is designed to be reused when adding sims to a legacy later.

---

## Routes

| URL | File | Purpose |
|-----|------|---------|
| `/app/legacies/new` | `src/app/app/legacies/new/page.tsx` | Two-step creation wizard |
| `/app/legacies/[slug]` | `src/app/app/legacies/[slug]/page.tsx` | Legacy detail page (stub) |

The dashboard (`/app`) will list legacies and link to `/app/legacies/new`.

---

## Schema Changes

All changes require a single new migration.

**`Legacy` model — new fields:**
```prisma
slug        String   // unique per user, derived from name
description String?
imageUrl    String?
@@unique([userId, slug])
```

**`Sim` model — new field, nullable pronouns, nullable household:**
```prisma
imageUrl          String?
householdId       String?   // was required — made nullable
pronounSubject    String?   // was required — made nullable
pronounObject     String?   // was required — made nullable
pronounPossessive String?   // was required — made nullable
```

`householdId` is made nullable so a Sim can exist independently of a Household. Pronouns are made nullable so they can be left unset in the UI.

**New `PersonalityTraitConflict` model:**
```prisma
model PersonalityTraitConflict {
  traitAId String
  traitBId String

  traitA PersonalityTrait @relation("ConflictA", fields: [traitAId], references: [id])
  traitB PersonalityTrait @relation("ConflictB", fields: [traitBId], references: [id])

  @@id([traitAId, traitBId])
  @@map("personality_trait_conflicts")
}
```

Conflicts are stored once per pair (traitAId < traitBId enforced in the application layer, same pattern as `SocialRelationship`). The seed file is updated with known Sims 4 trait conflicts (e.g. Neat ↔ Slob, Good ↔ Mean, Hot-Headed ↔ Good, etc.).

Slug is auto-derived from the legacy name (e.g. "The Caliente Legacy" → `caliente-legacy`). Collisions within a user's legacies append a numeric suffix (`caliente-legacy-2`).

---

## Wizard Flow

**Step 1 — Your Legacy**
- Cover image upload (optional) — drag-and-drop / click, uploads to Vercel Blob
- Legacy name (required)
- Description (optional, textarea)
- Actions: Cancel · Continue →

**Step 2 — Founder Sim**
- Skip button in header — bypasses this step entirely
- Uses the shared `SimForm` component (see below)
- Actions: ← Back · Skip this step · Create legacy →

State is held in React (`useState`) within `LegacyWizard`. On final submit, `legacies.create` is called with legacy + sim data in a single transaction. On success, redirect to `/app/legacies/[slug]`.

---

## SimForm Component

A reusable client component (`src/app/components/sim-form.tsx`) used in:
1. Step 2 of the legacy wizard (with `onSkip` prop → shows Skip buttons)
2. "Add sim" flow within an existing legacy (without `onSkip`)

Props: `defaultValues`, `onSubmit(data: SimFormData)`, `onSkip?()`, `isSubmitting`

### Fields

**Identity section**
| Field | Required | Default | Input type |
|-------|----------|---------|------------|
| Photo | No | — | `ImageUpload` (circle crop) |
| First name | Yes | — | text |
| Last name | Yes | — | text |
| Gender | Yes | — | select: Male / Female / Non-Binary |
| Life stage | No | Young Adult | select (8 stages) |
| Pronouns | No | — | select: She/Her/Hers · He/Him/His · They/Them/Theirs · Ze/Zir/Zirs · Custom |

When **Custom** is selected for pronouns, three inline text inputs appear (subject / object / possessive).

**Personality section** — up to 6 personality traits via `TraitPicker`

**Goals & Career section**
- Aspiration — select (24 options, grouped by category)
- Career — select: Unemployed (default) + ~21 careers grouped by type

**Special section**
- Occult type — select: None + 9 occult types

---

## TraitPicker Component

`src/app/components/trait-picker.tsx` — searchable multi-select chip picker.

- Shows all ~40 personality traits from the DB
- Filterable by category tab: All / Emotional / Hobby / Lifestyle / Social
- Max 6 selected; additional selections disabled when cap is reached
- Selected traits render as dismissible chips above the picker
- Backed by a `trpc.traits.getAll` query (cached, no user-specific data)

**Conflict checking:** when a trait is selected, all traits that conflict with it are disabled in the picker and shown with a muted style + tooltip ("Conflicts with Neat"). Conflicts are symmetric — disabling cascades across all currently selected traits. The `traits.getAll` response includes each trait's conflict list so the check runs client-side with no extra round-trips.

---

## ImageUpload Component

`src/app/components/image-upload.tsx` — reusable for both legacy cover and sim portrait.

- Click or drag to select a file
- On select: POST to `/api/upload` → Vercel Blob → returns URL
- Shows upload progress, then preview
- Accepts `shape` prop: `'square'` (legacy cover) or `'circle'` (sim portrait)
- On error: shows inline error message, retains previous value

Upload route: `src/app/api/upload/route.ts` using `@vercel/blob`.

---

## tRPC API

### `legacies.create`

```ts
input: {
  name: string           // required
  description?: string
  imageUrl?: string      // Vercel Blob URL
  founder?: {
    firstName: string    // required
    lastName: string     // required
    gender: Gender       // required
    lifeStage?: LifeStage  // default: YOUNG_ADULT
    pronounSubject?: string
    pronounObject?: string
    pronounPossessive?: string
    imageUrl?: string
    personalityTraitIds?: string[]  // max 6, validated conflict-free server-side
    aspirationId?: string
    careerId?: string
    occultType?: OccultType
  }
}
```

Creates Legacy + optional Sim in a single Prisma transaction:
1. Slugify name, check for conflicts, append suffix if needed
2. Create `Legacy` (with slug, description, imageUrl)
3. If founder provided: create `Sim` (householdId null) → set `Legacy.founderSimId`

No Household is created during legacy creation. `Sim.householdId` is nullable so the founder can exist without one.

Career: if a career is selected, create a `SimCareer` with `employmentType: EMPLOYED` and `startedAt: now()`. If "Unemployed" is selected (default), no `SimCareer` record is created.

Returns: `{ legacy: { id, slug, name } }`

### `legacies.getAll`

Returns all legacies for the current user, ordered by `createdAt` desc. Used on the dashboard.

### `sims.create`

Same shape as `founder` above, plus `legacyId: string`. Used when adding sims to an existing legacy later. Career and household follow the same rules as above.

### `traits.getAll`

Returns all personality traits grouped by category, each with a `conflictsWith: string[]` (IDs of conflicting traits). Cached — reference data, never user-specific. The client uses this list to compute which traits to disable as selections change.

---

## Legacy Detail Page (Stub)

`/app/legacies/[slug]` — minimal page for the initial release:
- Legacy name + description
- Founder sim card (name, photo, key traits) or "No founder set" empty state
- "Add sim" button (placeholder for future)

---

## Verification

1. Sign in via magic link, complete pack onboarding
2. Dashboard shows "Start a legacy" CTA → navigates to `/app/legacies/new`
3. Step 1: enter name, optionally upload cover image, click Continue
4. Step 2: fill in founder sim fields (check trait picker, pronouns custom flow), click Create legacy
5. Redirected to `/app/legacies/[slug]` — legacy name, founder sim card visible
6. Return to dashboard — legacy appears in list
7. Repeat step 2–5 with "Skip this step" — legacy created with no founder
8. Create two legacies with the same name — second gets `-2` suffix in URL
9. Run `npx prisma studio` to verify `Legacy.slug` is populated and `@@unique([userId, slug])` holds
