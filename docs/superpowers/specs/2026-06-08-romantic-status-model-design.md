# Romantic Status Model Redesign — Design Spec

**Date:** 2026-06-08

## Context

`SocialRelationship.romanticStatus` is a single enum
(`NONE | DATING | ENGAGED | MARRIED | EX_PARTNER | WIDOWED`) that conflates two
independent facts:

- **the bond** — what the relationship is/was (dating, engaged, married);
- **how it ended** — still together, the couple split, or a partner died.

Because `EX_PARTNER` and `WIDOWED` are *derived* facts stored as if they were
the bond, the model loses information:

- "Ex-partner" can't tell a **divorce** (was married) from a **break-up**
  (was only dating) — the prior bond is gone.
- **Widowhood** has to be hand-set by the user, can contradict the actual
  death data, and overwrites the bond (a widow of a marriage is
  indistinguishable from a widow of an engagement).

This spec separates the two axes so richer relationship labels (consumed by
[the kinship-labels feature](2026-06-07-kinship-labels-design.md) and the
existing relationships editor / sim inspector / chronicle) can be **derived**
rather than stored.

## Scope

- Schema: `RomanticStatus` becomes bond-only; add `endedAt` to
  `SocialRelationship`. Prisma migration with data remap.
- A shared pure derivation helper turning (bond, endedAt, partner-deceased)
  into a relationship state.
- Server: relationship mutations and tree-data queries.
- UI: relationships editor and add-relationship modal.
- Chronicle: derive **Divorce** (ended marriage) and **Break-up** (ended
  dating/engagement) milestones from `endedAt`, alongside the existing
  marriage and death milestones.

Out of scope: a dedicated widowhood timeline event (widowhood is already
implied by the partner's existing Death milestone); back-dating the end via a
date picker (the end is stamped `now()`; a picker can come later).

## Data model

### `RomanticStatus` — bond only

```
enum RomanticStatus {
  NONE      // non-romantic social relationship (friendship row)
  DATING
  PARTNER   // committed, unmarried partnership (more than dating, no engagement/marriage)
  ENGAGED
  MARRIED
}
```

`EX_PARTNER` and `WIDOWED` are **removed** (they were derived facts stored as
bonds). `PARTNER` is a real bond and stays. `NONE` stays — a
`SocialRelationship` row also models pure friendships, and the tree filters
`romanticStatus != NONE` to find partners. There are now **four bonds**:
DATING, PARTNER, ENGAGED, MARRIED.

### `SocialRelationship.endedAt`

```
endedAt DateTime?   // non-null = the couple deliberately ended the bond
                    //            (break-up / divorce) while both were alive
```

Null means the bond is current *unless* a partner has died (widowhood is
derived — see below). Death is never written to the relationship.

## Derived relationship state

A pure helper is the single source of truth, shared by every surface:

```ts
// src/lib/romantic-status.ts
type RomanticBond = 'DATING' | 'PARTNER' | 'ENGAGED' | 'MARRIED'
type RomanticState =
  | { kind: 'active';  bond: RomanticBond }
  | { kind: 'ended';   bond: RomanticBond } // break-up / divorce
  | { kind: 'widowed'; bond: RomanticBond } // partner deceased

deriveRomanticState(
  bond: RomanticStatus,
  endedAt: Date | null,
  partnerDeceased: boolean,
): RomanticState | null      // null for NONE
```

Precedence (deliberate end beats death):

1. `bond === NONE` → `null`.
2. `endedAt != null` → `ended` — divorce if `MARRIED`, otherwise a break-up
   (PARTNER/ENGAGED/DATING). (A couple who divorced and then one ex died
   stays **divorced**, not widowed.)
3. else `partnerDeceased` → `widowed`.
4. else → `active`.

`partnerDeceased` is `causeOfDeath != null` on the partner sim (the existing
deceased signal — there is no separate death flag/date).

This helper returns the **state**, not display text. Each consumer maps the
state to its own vocabulary — the kinship-labels spec owns the gendered crest
captions (Wife / Husband, Divorced, Ex-fiancée, Late husband, Widow, …).

## Migration & backfill

Backfilling every existing `SocialRelationship` is part of this migration —
not a separate script. The enum-narrowing **requires** the doomed values to
be remapped first: Postgres can't drop a value while rows still hold it, and
nothing can run in the window between "values exist" and "values dropped", so
a standalone `backfill:*` script (the `backfill:uploads` pattern) cannot do
it. The remap is a **plain best-effort** transform — no inference, no report
(decided 2026-06-08).

Removing enum values in Postgres requires recreating the type. The migration:

1. Add `endedAt` column (nullable).
2. Backfill / remap every row off the doomed values **before** narrowing the
   enum:
   - `EX_PARTNER` → `romanticStatus = DATING`, `endedAt = updatedAt`. The
     prior bond is unrecoverable; `DATING` is the least-committal choice, so
     these read as a generic break-up ("Ex"), never an asserted "Divorced".
     (`updatedAt` is the best end-timestamp available; no row history exists.)
   - `WIDOWED` → `romanticStatus = MARRIED`, `endedAt = NULL`. The widow
     label then derives only when the partner is actually marked deceased; if
     not, the row reads as an active marriage. **Accepted caveat:** legacy
     `WIDOWED` rows whose partner isn't recorded deceased lose the widow
     signal until the user marks the death. We do not auto-mark any sim
     deceased and do not emit a report.
   - All other rows (`NONE` / `DATING` / `PARTNER` / `ENGAGED` / `MARRIED`)
     keep their value and get `endedAt = NULL` (the column default). No action
     needed.
3. Create `RomanticStatus_new` with the five surviving values
   (`NONE`, `DATING`, `PARTNER`, `ENGAGED`, `MARRIED`), alter the column with a
   `USING` cast, drop the old type, rename.

Hand-written migration SQL (partial enums / multi-step type swap aren't
expressible in PSL). Follow the project's Prisma migration workflow and AI
consent guard (test DB only); verify `prisma migrate diff` reports no drift.
The migration test seeds an `EX_PARTNER` and a `WIDOWED` row and asserts the
post-migration shape, pinning the backfill.

## Server changes

- `addSocialRelationship` / `updateSocialRelationship`: `romanticStatus` input
  is the surviving enum (NONE + the four bonds); add an
  `endedAt: z.date().nullable()` input (the editor sends `now()` to end,
  `null` to reopen). No `WIDOWED` path.
- `sims.getTreeData` / `sims.getMiniTreeData`: partner edges gain
  `romanticStatus` (already added for kinship) **and** `endedAt`; the sim
  select gains `causeOfDeath` (or a derived `isDeceased`) so the client can
  determine `partnerDeceased`. Single query, no N+1.

## UI changes

### Relationships editor (`relationships-editor.tsx`) + add modal (`add-relationship-modal.tsx`)

- `ROMANTIC_STATUS_OPTIONS` drops `EX_PARTNER` and `WIDOWED` → Dating,
  Partner, Engaged, Married (plus None where applicable).
- Each partner row gains an **end / reopen** control. When the bond is active,
  a button labelled by bond — "Divorce" for married, "End relationship"
  otherwise — sets `endedAt = now()`. When ended, a "Reopen" action clears it.
  Widowhood has no control: it is derived and shown as a read-only badge.
- The row shows the derived state via the shared helper: a small badge for
  Divorced / Ended / Widowed; active bonds show the bond as today.

## Chronicle milestones

`deriveMilestones` gains two derived milestone kinds from rows with a
non-null `endedAt`, de-duplicated by canonical pair like the existing
marriage milestone and ordered by `endedAt`:

- **Divorce** — an ended `MARRIED` bond ("Ada and Ben divorce").
- **Break-up** — an ended `DATING`, `PARTNER`, or `ENGAGED` bond
  ("Ada and Cy break up").

The marriage milestone is unchanged: a couple that later divorced keeps its
wedding milestone *and* gains a divorce milestone — both events happened. No
dedicated widowhood milestone; the partner's existing Death milestone already
marks it. The milestone `kind` is rendered as plain text, so the new kinds
need no rendering changes.

## Testing

Trophy style.

- **`romantic-status.test.ts`** (pure helper): every
  (bond × endedAt × partnerDeceased) combination → expected state, including
  precedence (ended beats deceased) and `NONE → null`.
- **Server**: mutations accept/round-trip `endedAt` and reject the removed
  enum values; tree-data queries include `endedAt` and the deceased signal.
- **Migration**: a seeded `EX_PARTNER` row becomes `DATING` + non-null
  `endedAt`; a `WIDOWED` row becomes `MARRIED` + null `endedAt`.
- **Milestones**: an ended marriage yields a Divorce milestone (sorted by
  `endedAt`) while keeping its Marriage milestone; an ended dating/engaged
  bond yields a Break-up; a current (`endedAt: null`) bond yields neither.
- **Editor render**: ending a married relationship calls the mutation with a
  non-null `endedAt`; a relationship whose partner is deceased shows the
  derived widowed badge with no user action.

## Relationship to other branches

This is a **prerequisite** for kinship-labels: that spec's partner vocabulary
now derives from (bond, endedAt, partner-deceased) via `deriveRomanticState`
instead of a stored `EX_PARTNER` / `WIDOWED`. Branch order (stacked):

```
feat/lineage-layout-d3dag  →  feat/romantic-status-model  →  feat/kinship-labels
```

romantic-status touches `sims.ts` and the tree sim select, which the layout
branch also edits, so it stacks on top to avoid dependency locks; kinship
stacks on top of it.

### Breaking impact on the d3-dag layout branch

`feat/lineage-layout-d3dag` already reads the *stored* `WIDOWED` and
`EX_PARTNER` values this spec removes:

- `layout-clusters.ts` (`matchCouples`) ranks partner adjacency
  `MARRIED > ENGAGED > DATING > WIDOWED` and keeps ex-partners non-adjacent.
- the flow adapter / `flow-parts.tsx` dash **widowed bonds** (a
  `MarriageEdgeData` flag) and rank by the same enum.

Under the new model those are *derived* states, not bond values, so this
work must move that logic onto the bond + derived state:

- ranking now covers the four bonds, `MARRIED > ENGAGED > PARTNER > DATING`
  (a committed partnership ranks above casual dating, below an engagement);
  an `ended` edge (the new "ex", `endedAt != null`) stays non-adjacent
  regardless of bond. A widowed couple is still adjacent because its bond is
  unchanged (e.g. `MARRIED`) — widowhood no longer needs its own rank.
- the dashed-bond rule keys off a deceased partner on an (always-current)
  adjacent couple, computed from the partner's deceased signal, instead of a
  stored `WIDOWED`.

The layout's partner edges therefore need `endedAt` + the partners' deceased
signal as well — the same tree-data additions this spec already makes. Since
romantic-status stacks **above** the layout branch, the layout code is
updated here (or the two are sequenced so the enum removal and the layout's
derived-ranking land together); the implementation plan must call this out so
the enum migration never lands while the layout still references the dropped
values.
