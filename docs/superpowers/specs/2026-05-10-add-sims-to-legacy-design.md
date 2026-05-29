# Design: Adding Sims to an Existing Legacy

**Date:** 2026-05-10

## Context

The add-sim page (`/app/legacies/[slug]/sims/new`) is fully built — form, API, validation — but is unreachable from the UI. The legacy detail page shows a "Sims" section with a placeholder "Sim tracking coming soon." Users have no way to navigate to the add-sim flow or see their existing sims on a legacy.

Additionally, the data model has a structural gap: sims are only associated to a legacy indirectly through their household, and the founder sim has no household at all. This makes querying "all sims for a legacy" unreliable and indirect.

This design closes both gaps: it adds a direct `legacyId` field to `Sim` and wires up the Sims section on the legacy detail page.

---

## Schema Change

Add `legacyId` directly to the `Sim` model:

```prisma
model Sim {
  // existing fields ...
  legacyId  String
  legacy    Legacy @relation(fields: [legacyId], references: [id], onDelete: Cascade)
}

model Legacy {
  // existing fields ...
  sims  Sim[]
}
```

- Non-nullable — every sim must belong to a legacy by design.
- `onDelete: Cascade` — when a legacy is deleted, its sims are deleted too.
- **Migration strategy (dev):** `prisma migrate reset` + reseed. No backfill needed.

**File:** `prisma/schema.prisma`

---

## API Changes

### `sims.create` (`src/server/routers/sims.ts`)

`legacyId` is already in the input; it just isn't stored on the sim. Add it to `sim.create`:

```ts
return ctx.db.sim.create({
  data: {
    legacyId: input.legacyId,   // ← add this
    // ...rest of fields
  },
})
```

### `legacies.create` — founder path (`src/server/routers/legacies.ts`)

The founder sim is created within the legacy transaction. Use `legacy.id`:

```ts
const sim = await tx.sim.create({
  data: {
    legacyId: legacy.id,   // ← add this
    // ...rest of fields
  },
})
```

---

## Legacy Detail Page

**File:** `src/app/app/legacies/[slug]/page.tsx`

Extend the `db.legacy.findFirst` include to load sims:

```ts
include: {
  founderSim: { ... },          // existing
  sims: {
    select: { id: true, firstName: true, lastName: true },
    orderBy: { createdAt: 'asc' },
  },
}
```

Replace the placeholder Sims section with:

1. **Section header row** — "Sims" title on the left, an "Add sim" link-button on the right (`/app/legacies/${slug}/sims/new`).
2. **Flat list of sim name cards** — one card per sim, showing `firstName lastName`. Styled using existing card tokens (`--bg-card`, `--border`, `--radius-lg`, `--shadow-sm`). Founder is included in the list.
3. **Empty state** — when no sims: existing dashed empty box with "No sims yet." and a "Add your first sim →" link to the add-sim page.

**CSS file:** `src/app/app/legacies/[slug]/page.module.css`

New classes needed:
- `.simList` — `display: flex; flex-direction: column; gap: var(--space-2)`
- `.simCard` — card surface: `padding`, `background: var(--bg-card)`, `border`, `border-radius: var(--radius-lg)`, `box-shadow: var(--shadow-sm)`
- `.simName` — display name typography (body font, `--text` color)
- `.addSimLink` — link-button in the section header (right-aligned, styled like a secondary action)
- `.emptyAction` — inline link in the empty state CTA

---

## Verification

1. `prisma migrate reset` (dev) — confirms migration applies cleanly and seed runs without errors.
2. TypeScript check: `npx tsc --noEmit` — no errors after schema regen and code updates.
3. Lint: `npm run lint` — no warnings.
4. Manual flow — create a new legacy with a founder, navigate to the legacy detail, confirm:
   - Founder appears in the Sims list.
   - "Add sim" button is visible and navigates to the add-sim form.
   - Submit the form — confirm the new sim appears in the Sims list on the detail page.
   - Create a legacy without a founder — confirm the empty state and CTA are shown.
