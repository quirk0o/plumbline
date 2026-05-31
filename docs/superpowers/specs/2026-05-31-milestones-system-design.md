# Legacy Milestones System — Design

**Date:** 2026-05-31
**Status:** Approved (design); pending implementation plan
**Worktree:** `legacy-chronicle-redesign`

## Problem

The Legacy Chronicle redesign introduces a **Milestones** section on the legacy
detail page. Two things are needed:

1. **A milestone system for both auto-calculated and user-authored entries.**
   Today milestones are 100% derived at read time by `deriveMilestones()` in
   `src/app/app/legacies/[slug]/lib/derive.ts` — nothing is stored, and there is
   no path to create the user-authored "Note" entries the mock shows (the
   `userAuthored` field exists in the view type but is always `false`).

2. **Fix the birth bug.** `deriveMilestones` currently emits a `Birth`
   ("X is born") for *every* non-founder sim, keyed off `sim.createdAt`. So a sim
   who married in or moved in as an adult gets a fabricated "is born" row. In the
   design mock, married-in adults (Mortimer, Eliza, Johnny) correctly get **no**
   birth row — only sims actually born into the line (Alexander, Reed, Marcus) do.

## Decisions (from brainstorming)

- **Birth detection: parent-based derivation.** A sim gets an auto `Birth` only
  if they have ≥1 parent who is also a member of this legacy. No schema change to
  `Sim`; matches the mock exactly.
- **Auto-calculated kinds: Birth, Marriage, Founding, Death.** Death is derivable
  now from `Sim.causeOfDeath` (point-in-time fact). Age-up is **not** auto — it is
  a transition with no recorded timestamp; users write it as a manual note.
- **User milestones default to insertion time, but are draggable anywhere in the
  unified timeline.** Auto events stay pinned to their real timestamps and are not
  draggable; only user milestones move. Implemented via an adjustable `sortOrder`
  float on the same time axis as the derived timestamps.
- **Drag-and-drop via `@dnd-kit`** (accessible: keyboard + screen reader + touch;
  supports disabled items so auto rows stay pinned).

## Architecture: Hybrid (derive auto, store only user milestones)

Auto milestones (Birth/Marriage/Founding/Death) remain **derived at read time**
from current `Sim` & relationship state — a pure function of the data, so they
never drift. User milestones are **persisted** in a new table with an adjustable
`sortOrder`. The read path merges derived + stored and sorts by `sortOrder`
descending.

Rejected alternatives:
- *Full event log* (materialize every milestone): must stay in sync with every
  sim edit, needs a backfill, risks drift — high complexity for no benefit here.
- *User-only ordering* (notes ordered only among themselves): ruled out by the
  "drag anywhere in the timeline" decision.

## Section 1 — Data model

New Prisma models:

```prisma
model Milestone {
  id        String   @id @default(cuid())
  legacyId  String
  title     String
  blurb     String?
  sortOrder Float            // position on the shared time axis; default = createdAt epoch ms
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  legacy Legacy         @relation(fields: [legacyId], references: [id], onDelete: Cascade)
  sims   MilestoneSim[]

  @@index([legacyId, sortOrder])
  @@map("milestones")
}

model MilestoneSim {
  milestoneId String
  simId       String

  milestone Milestone @relation(fields: [milestoneId], references: [id], onDelete: Cascade)
  sim       Sim       @relation(fields: [simId], references: [id], onDelete: Cascade)

  @@id([milestoneId, simId])
  @@map("milestone_sims")
}
```

`Legacy` gains `milestones Milestone[]`; `Sim` gains `milestones MilestoneSim[]`.

Notes:
- **No `kind` column** — every stored milestone is the mock's `Note` kind
  (`userAuthored: true`, `✎` prefix). The composer collects no kind, so YAGNI.
- **Generation not stored** — inferred at read from tagged sims (min non-null
  `generationNumber`, same rule marriages use; null if untagged).
- **`sortOrder` is `Float`** so a dragged note can take the midpoint between two
  neighbors. Defaulted on create to `Date.now()` (server) so new notes land at the
  top. No renormalization / LexoRank needed: a double has ~4000 representable
  values even between two timestamps 1 ms apart, and auto events are normally
  seconds apart (millions of slots). The only genuine failure is two neighbors
  sharing an *identical* key (e.g. a batch import in the same millisecond), which
  the merge handles by tie-breaking on `id`.

## Section 2 — Derivation + birth bug fix

**View type change** (`lib/types.ts`):

```ts
export interface Milestone {
  id: string
  kind: 'Founding' | 'Birth' | 'Marriage' | 'Death' | 'Note'
  gen: number | null
  simIds: string[]
  title: string
  blurb: string | null
  userAuthored: boolean   // was the literal `false`; doubles as "draggable/editable"
  sortOrder: number       // shared time axis; drives merge order + client drag
}
```

**Fetch-shape additions** (`FetchedSim` / `FetchedLegacy` and the `page.tsx`
query):
- `FetchedSim` gains `causeOfDeath: CauseOfDeath | null` and `updatedAt: Date`
  (death sort proxy).
- `FetchedLegacy` gains `familyRelationships: { parentId: string; childId: string }[]`
  (for sims in the legacy) and `userMilestones: FetchedMilestone[]` (the new table,
  with tagged sim ids).

**`deriveMilestones` (birth fix):**
1. Build `childrenWithInLegacyParent = Set<childId>` from family relationships
   where `parentId` is a member of this legacy.
2. Per sim:
   - **Founder** → `Founding` row (`sortOrder = createdAt` ms). Never also a Birth.
   - **Non-founder** → emit a `Birth` row **only if** the sim is in
     `childrenWithInLegacyParent`. A married-in / moved-in adult (no in-legacy
     parent) gets **no origin row**. *This is the bug fix.*
   - **Death** (independent): if `causeOfDeath !== null`, emit a `Death` row
     (`sortOrder = updatedAt` ms — accepted proxy; no stored date of death). A sim
     can have both a Birth and a Death row.
3. Marriages: unchanged.

**New pure helpers:**
- `toUserMilestone(fetched)` → view `Milestone` with `kind:'Note'`,
  `userAuthored:true`, `simIds` from the join, `gen` = min non-null generation of
  tagged sims (null if untagged), `sortOrder` from the stored float.
- `mergeMilestones(auto, user)` → concat, sort by `sortOrder` **descending**,
  tie-break by `id`. Replaces the internal sort in `deriveMilestones`;
  `computeStats` counts the merged length.

**Caveat (recorded):** because Death sorts by `updatedAt`, editing a dead sim
later nudges its death row's position; a user note positioned right beside it may
end up on the other side. Acceptable given there is no real death date.

## Section 3 — API layer

New `milestonesRouter` (`src/server/routers/milestones.ts`), registered as
`milestones` in `src/server/routers/index.ts`. Every mutation re-verifies legacy
ownership the way `sims.create` does (`legacy.findFirst({ where: { id, userId } })`)
and that all `simIds` belong to that legacy.

- **`create({ legacyId, title, blurb?, simIds })`** — `title` 1–120, `blurb` ≤ 1000,
  `simIds` array (may be empty). Sets `sortOrder = Date.now()`; creates the row +
  `MilestoneSim` joins in one transaction. Returns the created milestone.
- **`update({ id, title, blurb?, simIds })`** — edits text, replaces the tag set
  (delete + recreate joins). Leaves `sortOrder` untouched.
- **`delete({ id })`** — removes the row; `MilestoneSim` cascades.
- **`reorder({ id, prevSortOrder?, nextSortOrder? })`** — client passes the
  `sortOrder` of the rows now directly above (`prev`, higher) and below (`next`,
  lower) the drop point. Server computes:
  - between two rows → `(prev + next) / 2`
  - top (no `prev`) → `next + 1000`
  - bottom (no `next`) → `prev - 1000`
  then validates `id` is a user milestone in an owned legacy and writes it.

## Section 4 — UI & client interactivity

The `Milestones` section splits:
- **`page.tsx`** keeps the server fetch + merge, passing merged `milestones` +
  `simsById` as initial props.
- **`milestones-client.tsx`** (new client component) owns the interactive list:
  local state for optimistic updates, tRPC mutations, then `router.refresh()` so
  server-derived auto rows re-merge cleanly. Auto rows never change on user
  actions, so optimistic insert/move/edit of user rows is safe.
- **`MilestoneComposer`** (from the mock): collapsed "Record a moment" card →
  expands to title input, story textarea, and an inline **sim-tag multi-select**
  scoped to the legacy's sims → Save calls `milestones.create`.
- **`MilestoneRow`**: auto rows render static. User rows gain a drag handle, edit
  (reopens the composer pre-filled → `update`), and delete (confirm → `delete`).
  The `✎ Note` amber eyebrow distinguishes them (already in the mock).

**Reordering** (`@dnd-kit`): applies only to user rows; auto rows are `disabled`
(pinned reference points). On drop, the client reads the `sortOrder` of the rows
immediately above/below the drop target and calls
`milestones.reorder({ id, prevSortOrder, nextSortOrder })`, with an optimistic
local reorder.

## Section 5 — Testing & migration

Per the Testing Trophy (mostly integration; no unit tests for trivial functions;
no CSS-source assertions; `getByTestId` for e2e):

- **`lib/__tests__/derive.test.ts`** (update): sim with in-legacy parent → `Birth`;
  founder → `Founding` (never `Birth`); **married-in adult with no in-legacy parent
  → no origin row** (regression guard); `causeOfDeath` set → `Death` row; both →
  two rows; `mergeMilestones` order (desc, tie-break `id`); user `gen` inference;
  `toUserMilestone` mapping.
- **`server/routers/milestones.test.ts`** (new, integration against test DB like
  `sims.test.ts`): create / update / delete / reorder; ownership enforcement
  (cannot mutate another user's legacy milestone); `reorder` midpoint math
  (between / top / bottom); rejects `simIds` not in the legacy.
- **Component tests** (`milestones-client`, composer) with RTL: open composer →
  fill → Save fires the mutation; edit pre-fills; delete confirms; auto vs user
  rows render their distinguishing text/affordances (assert rendered output, not
  `.module.css` source).
- **E2E** (`e2e/`, Playwright, `getByTestId`): magic-link sign-in → create a legacy
  with a born child *and* an adult married-in sim → assert the adult shows **no
  "is born" row**; add a milestone via the composer → appears at the top; drag to
  reorder → order persists after reload; edit and delete.

**Migration:** a Prisma migration adds `milestones` + `milestone_sims` and the
`Legacy` / `Sim` back-relations (`prisma migrate dev`; test DB via the existing
`db:test:setup` consent path).

**Build gates** (AGENTS.md): `npx tsc --noEmit` + `npm run lint` after each chunk;
`npm test` + `npm run test:e2e` at the end. No lint/TS suppressions.

## Out of scope (YAGNI)

- Auto age-up milestones (no transition timestamps stored).
- A stored date / explicit "occurred at" field on milestones (generations + drag
  order are the temporal model).
- User-selectable milestone *kinds* (all stored milestones are `Note`).
- Materializing auto events into a table / change-history log.
