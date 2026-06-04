# Household Section & Household Management — Design

**Date:** 2026-06-04
**Source design:** Claude Design export `simtrack-legacy-redesign` — final state in
`Legacy Page.html` / `households.jsx` (drawer: G° ceremonial no-crest; founding form:
option B no-crest, V1 field layout). Recreate the prototype's visuals; match output,
not its internal structure.

## Summary

Add a **Households** section to the legacy chronicle page (between Succession and
Milestones, registered in the section nav) showing one featured "Now playing"
household plus a grid of compact cards, with a **founding form** (centered ceremonial
dialog) and a **management drawer** (right slide-over) where the player renames a
household, edits its world/lot/description/funds/lot value, sets it active, and moves
sims between households (or out to unhoused).

## Decisions made during brainstorming

| Question | Decision |
|---|---|
| Generation filter | **Out of scope.** The prototype reacts to a page-wide gen filter; the real page has none. Section always shows all households. |
| Resident role badges | **Derived only**: "Heir" from `Sim.isHeir`, "Founder" from `Legacy.founderSimId`. No other badges; no role field. |
| Worlds & lots | **Seeded reference data** (`World`, `Lot` models in `prisma/seed.ts`). `Household.worldId` FK + free-form `lot` string (custom addresses preserved). |
| World select scope | **Filtered by owned packs** (`UserPack`): base-game worlds (no `packId`) always offered, pack worlds only when the user owns the pack. A household's current world is always offered even if its pack is unowned, so existing data never disappears from the select. The server validates only that `worldId` exists — the filter is a UX concern, not an authorization rule. |
| New sims' household | **Default unhoused** (`householdId: null`). Sim form gains an optional household picker. Auto-create "Household 1" removed. |
| Founder housing | Wizard founder step gets a **checkbox** (default checked): found "The ⟨LastName⟩ Household" with the founder as first resident; it becomes the active household. |
| Data flow | **Approach A**: server-fed section; drawer/forms are client components; every mutation = tRPC call + `router.refresh()` (the `NameHeirDialog` pattern). |
| Drawer primitive | **Reuse** existing `src/components/ui/drawer/` (already matches the prototype's chrome); style via `className` on `Drawer.Content`. |

Explicitly rejected by the designer during prototyping (do not reintroduce):
status badges other than "Now playing", an inline founding composer in the grid,
white-card styling for the drawer (parchment header + card body instead).

## Data model (Prisma)

New reference models, seeded with the existing upsert-by-name pattern:

```prisma
model World {
  id     String  @id @default(cuid())
  name   String  @unique
  packId String?              // base-game worlds have no pack
  pack   Pack?   @relation(fields: [packId], references: [id])
  lots   Lot[]
  households Household[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@map("worlds")
}

model Lot {
  id      String @id @default(cuid())
  name    String                // canonical address, e.g. "1 Goth Hill"
  worldId String
  world   World  @relation(fields: [worldId], references: [id], onDelete: Cascade)
  @@unique([worldId, name])
  @@map("lots")
}
```

Seed: all Sims 4 worlds linked to packs by pack code (base-game worlds unlinked),
plus canonical residential lot addresses for worlds we can enumerate. Worlds without
seeded lots offer an empty lot list; the free-form `lot` string still works.

`Household` additions (all backward-compatible for existing rows):

```prisma
worldId           String?   // FK → World, onDelete: SetNull
lot               String?   // free-form address; select offers canonical lots, preserves custom values
description       String?
funds             Int @default(0)
lotValue          Int @default(0)
foundedGeneration Int?      // snapshot at founding; null on pre-existing rows (stat hidden)
```

Active household: `Legacy.activeHouseholdId String?` — named-relation FK →
Household, `onDelete: SetNull`. A nullable FK structurally guarantees at most one
active household per legacy. "Set as active" updates this pointer.

Data migration: each existing legacy with households gets its first household set
active. `foundedGeneration` for new households = the legacy's highest sim
`generationNumber` (or 1 if no sims).

## API (tRPC router `households`)

All `protectedProcedure`; ownership verified by walking `household → legacy →
userId`, throwing `NOT_FOUND` otherwise (existing don't-leak-existence pattern).

- **`create`** — `{ legacyId, name (min 1), worldId?, lot?, funds (int ≥ 0),
  description?, simIds? }`. Snapshots `foundedGeneration`; moves chosen sims in
  (from other households or unhoused); if the legacy has no active household, the
  new one becomes active. Validates `worldId` exists, `simIds` belong to the legacy.
  Returns the new household id (client opens its drawer).
- **`update`** — `{ householdId }` + partial of `name, worldId, lot, description,
  funds, lotValue`. Serves every inline edit (each blur-commit sends one field).
- **`setActive`** — `{ householdId }` → sets `legacy.activeHouseholdId`.
- **`moveSim`** — `{ simId, toHouseholdId: string | null }` → reassigns
  `sim.householdId`; `null` = move out to unhoused. Sim and target must share a
  legacy. Move to current household is a no-op.

No `delete`, no `list` query (YAGNI; reads are server-side).

**Page data** (`src/app/app/legacies/[slug]/page.tsx`): extend the existing query to
fetch households with `world` and resident sims (id, names, imageUrl, isHeir,
generationNumber, lifeStage) plus `activeHouseholdId`; also fetch the worlds
reference list (with lots) and pass it down for the selects, filtered to base-game
worlds plus worlds whose pack the user owns (`UserPack`). The drawer and founding
form merge the household's current world into the options when the filter would
exclude it (same preserve-current rule as lots).

**`sims.create` changes:** drop the auto-create-household block; accept optional
`householdId` (validated against the legacy; omitted → unhoused) and optional
`foundHousehold: boolean` (wizard founder path: creates "The ⟨lastName⟩ Household",
assigns the sim, becomes active as the legacy's first household).

**After every mutation:** `router.refresh()`. The page re-renders; hero stats,
roster, and the open drawer (which re-reads its household by id from fresh props)
stay consistent.

## UI

New shared primitives in `src/components/ui/`:

- **`EditableText` / `EditableHeading`** — dashed-green click-to-edit pattern:
  static text → hover shows dashed underline → click swaps to auto-sizing input →
  commit on blur/Enter (Shift+Enter = newline in multiline), Esc cancels, empty or
  unchanged → no commit. Heading variant is serif and supports `autoEdit`; body
  variant supports multiline and an italic muted placeholder when empty.
- **`EditableStat`** — §-prefixed serif numeral with the same affordance; numeric
  input on click; strips non-digits; empty/invalid reverts. Fixed-height number row
  so display↔input swap never reflows.

Households section (`_components/households/`, slotted between Succession and
Milestones; entry added to `SectionNav`):

- Header: `SectionHeading` — eyebrow "Where they live", title "Households", blurb
  "Every roof the legacy keeps — and who lives under it." — plus a primary
  "Found a household" button (Lucide `plus`).
- **Featured card** (active household): "Now playing" pill (glowing plumbob, green),
  house-icon world · lot line, 32px serif name, 2-line-clamped description, resident
  avatar stack (founder/heir rings) + first names; right rail on parchment with
  funds (green) / residents / lot value / founded-gen (amber) stats and an outline
  "Manage household →" button. "Founded" stat hidden when null.
- **Compact grid** (`repeat(auto-fit, minmax(330px, 1fr))`): name, world · lot,
  avatar stack top-right (or italic "Empty lot"), footer with green funds ·
  resident count and "Manage →"; whole card clickable with hover lift.
- **Empty state** (net-new; prototype never showed zero households): existing
  `EmptyState` component — house icon, "No households yet" + a line of copy, CTA
  "Found a household". Header button hidden in this state.
- `activeHouseholdId` null but households exist → no featured card, all in grid.

Founding form — centered Radix `Dialog` styled per the ceremonial mock: close X,
glowing plumbob, amber "Found a household" eyebrow, centered serif name input
(dashed underline, autofocus, required — submit disabled until non-empty), plumbob
gem divider, World + Lot Combobox selects side by side (lots from the selected
world's seeded lots; current/custom value always offered), Starting funds
(§-prefixed, thousands-formatted, prefilled 20,000), Description textarea, and a
"Move sims in" avatar picker listing **all** the legacy's sims with their current
home beneath each ("Unhoused" when none) and the note that housed sims will move.
Submit → `households.create` → close, refresh, open the new household's drawer with
the name primed (`autoEdit`).

Management drawer — composes the existing `Drawer` primitive (chrome already
matches: scrim, `min(440px, 92vw)`, slide-in, `shadow-lg`); household-specific
styling via `className` on `Drawer.Content`:

- **Header (parchment):** "Now playing" pill *or* small outline "Set as active"
  button, ghost close X; inline-editable serif name (`EditableHeading`, `autoEdit`
  after founding); world/lot as inline dashed Combobox selects (changing world
  resets lot to the new world's first canonical lot, keeping the old string if it
  has none); centered italic editable description.
- **Body (card surface):** three centered stats — editable funds (green), editable
  lot value, founded gen (amber, read-only; hidden when null) — gem divider,
  "Residents (n)" label, borderless rows: 40px portrait with ring, serif name,
  derived Heir/Founder badge, life stage · Gen; each row has a "Move to…" chip
  select listing other households (+ resident counts) **plus an "Unhoused" option**.
  Bottom ghost dashed row "+ Move a sim in" opens a grouped select: other households
  as sections plus an "Unhoused" section.
- Empty household: "This lot is empty — bring a sim in to begin."

Sim form: optional `households` prop (`{id, name}[]`) renders an optional
**Household** select ("No household" default + the legacy's households), styled like
the form's existing selects. The wizard passes no `households` (field hidden) and
instead sets a new `offerFoundHousehold` prop, which renders a checkbox inside the
form (it needs the live last-name value from form state): "Settle them into a
household — we'll found 'The ⟨LastName⟩ Household' with them as its first resident.
You can rename it anytime." Checked by default; the household-name preview tracks
the last-name field; the submitted form data includes `foundHousehold`. Add-sim page
and create-sim modal fetch and pass `households`; they never set
`offerFoundHousehold`.

Brand guardrails: no white page surfaces, green = interactive only, amber only for
heir/founder/now-playing accents, plumbob `aria-hidden`, gentle motion with
reduced-motion handling (the Drawer primitive already provides it).

## Error handling

- Client mutations follow the `NameHeirDialog` pattern: `try { await mutateAsync }
  catch { inline error }` — quiet inline line ("Couldn't save that change. Please
  try again.") in the drawer and founding form; no toast library.
- Inline edits revert to the last server value on failure; `router.refresh()`
  restores truth.
- Zod rejects: empty name (create), negative funds/lot value, unknown `worldId`,
  cross-legacy sim/household ids.

## Edge cases

- Zero households → section empty state with CTA; header button hidden.
- No active household but households exist → all in grid; each drawer offers
  "Set as active".
- "Move to…" with no other households → only "Unhoused"; "Move a sim in" with no
  movable sims → "Every sim already lives here."; founding picker with zero sims →
  "No sims yet."
- Drawer open across refresh: household resolved by id from fresh props; if gone,
  drawer closes.
- Wizard founder with checkbox unchecked → founder is unhoused; the founding form's
  picker is the one-step path to house them later.

## Testing (Trophy: mostly integration)

- **tRPC integration tests** (`households.test.ts`, real DB via `authedCaller`):
  all four procedures — ownership denial, validation failures, active-pointer
  behavior (first household becomes active; setActive swaps), move semantics
  (between households, to/from unhoused, no-op self-move), `foundedGeneration`
  snapshot, and the `sims.create` `foundHousehold` / `householdId` paths.
- **Component tests** (Testing Library, mocked tRPC): households section (featured
  vs grid vs empty state), drawer (inline edits commit/cancel, move selects,
  set-active), founding form (required name gating, sim picker, submit payload),
  editable primitives (commit/Esc/empty semantics), and the owned-pack world
  filtering (base-game always offered; unowned-pack worlds excluded unless current). Test rendered behavior, not
  implementation details; no CSS-source assertions.
- **E2E** (Playwright, one journey): sign in → found a household via the form
  (moving the founder in) → rename in the drawer → found a second household → move
  a sim across → set it active → featured card swaps. `getByTestId` scoping where
  roles/labels don't suffice.

## Out of scope

- Page-wide generation filter (and the section's reaction to it)
- Household deletion
- Editable per-sim household roles
- Lot type (the prototype's "40 × 30 · Residential" line is dropped — nothing
  collects it)
