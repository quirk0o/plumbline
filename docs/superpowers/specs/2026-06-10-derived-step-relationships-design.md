# Derived Step-Relationships — Design Spec

**Date:** 2026-06-10

## Context

`FamilyRelationship` stores a parent→child edge typed `BIOLOGICAL`,
`ADOPTIVE`, or **`STEP`**. But a step-relationship isn't parentage — it
*emerges from a marriage*: a stepfather is your mother's husband. The codebase
already derives every non-parentage relationship (grandparent, sibling,
cousin, aunt/uncle, in-law) by traversing stored edges; `STEP` is the lone
"family" edge that encodes a relationship rather than actual parentage. The
Sims itself auto-derives step- and in-law labels from marriage + parentage
(2024 family-tree update) — it never asks the player to declare a stepparent.

This spec **drops the stored `STEP` type** and instead **derives** step
relationships from blood/adoptive parentage + marriage, exactly as in-laws are
derived. This also lets the [kinship-labels](2026-06-07-kinship-labels-design.md)
feature finally label step-relations, which it scoped out precisely because
step-parents had no clean derivation.

## Rules (decided with the user)

- **Marriage only.** A step-relationship derives strictly from a `MARRIED`
  bond. A partner (`PARTNER`/`DATING`/`ENGAGED`) is never a stepparent. If a
  partner is genuinely treated as the child's parent, that is recorded as an
  **`ADOPTIVE`** parent edge, not a step.
- **Survives widowhood, not divorce.** Step persists through a partner's death
  (widowed) but ends on divorce. This is exactly the existing in-law gate
  `isMarriageBond` (`bond === 'MARRIED' && kind !== 'ended'`) — reused verbatim.
  There is no "former stepfather": once the marriage is divorced (`endedAt`
  set), the sim simply isn't labelled as a step relation anymore.
- **No stored `STEP`.** Remove `STEP` from `FamilyRelationshipType`.

## Scope

- Schema + migration: drop `STEP` from the enum; delete existing `STEP` rows.
- Kinship module: derive stepparent / stepchild / step-sibling labels.
- UI: drop the "Step" option from the add-relationship modal.

Out of scope: cohabiting ("partner") step relations (adoptive covers genuine
parenting); multi-hop step relations (step-grandparent, step-aunt) — one hop
only, matching in-laws; drawing step *edges* on the tree (step is label-only,
and the tree already excludes `STEP` from rendering).

## Data model

### `FamilyRelationshipType` — parentage only

```
enum FamilyRelationshipType {
  BIOLOGICAL
  ADOPTIVE
}
```

`STEP` removed. Every remaining family edge is genuine lineage.

### Migration & backfill

Plain best-effort, no inference, no report (decided 2026-06-10) — mirroring the
romantic-status backfill. Postgres can't drop an in-use enum value, so the
migration first clears the rows, then narrows the type:

1. `DELETE FROM "family_relationships" WHERE "type" = 'STEP';`
2. Recreate the enum with the two survivors and re-cast the column
   (`ALTER TYPE … RENAME`, `CREATE TYPE … AS ENUM ('BIOLOGICAL','ADOPTIVE')`,
   `ALTER COLUMN … USING …::text::…`, drop old type).

**Accepted caveat:** a deleted `STEP` edge re-derives as a step label only
where the connecting marriage is recorded; where it isn't, the relation is lost
until the user records the marriage (the honest model — step *is* the marriage).

**Generations are unaffected.** `recomputeGenerations` currently fetches family
edges with no type filter, so `STEP` edges presently (incorrectly) count toward
generation numbers. Deleting them removes that influence — a correctness
improvement. Stored `generationNumber` values are persisted and are **not**
mutated by the row deletion; subsequent recomputes naturally see only
lineage edges. No `generation.ts` change is required (after the drop, all edges
are already `BIOLOGICAL`/`ADOPTIVE`).

## Derivation (in `src/components/lineage-tree/kinship.ts`)

Step is a derived **label**, computed in the partner layer alongside in-laws,
gated by the same `isMarriageBond` rule (active or widowed `MARRIED`). It is
applied via the existing `setIfAbsent`, so **blood/adoptive relations always
win** — a sim who is both a step-relative and a blood relative keeps the blood
label (e.g. a stepfather who is also a blood uncle reads "Uncle").

Relative to focus **F** (using F's bio/adoptive `parents`/`children` maps and
the `partnersOf` index already built for in-laws):

- **Stepparent** — a sim `S` that is the active/widowed `MARRIED` spouse of one
  of F's parents `P`, and `S` is **not** itself a parent of F. Gendered by `S`:
  `Stepmother` / `Stepfather` / `Stepparent`.
- **Stepchild** — the mirror: a child of F's active/widowed `MARRIED` spouse
  that is **not** F's own child. Gendered by the child:
  `Stepdaughter` / `Stepson` / `Stepchild`.
- **Step-sibling** — a child of one of F's stepparents `S` (i.e. `S`'s child by
  someone other than F's parent) that does **not** share a parent with F (else
  they are a half/full sibling, already labelled by the blood pass). Gendered:
  `Step-sister` / `Step-brother` / `Step-sibling`.

This is the case the in-law layer **deliberately skipped today** (it ignores a
parent's partner to avoid mislabeling step-parents). Step derivation now claims
that case; no conflict, since the in-law layer never labelled it.

**Ordering within the partner layer:** blood (already set) → direct partners →
in-laws → step. Step and in-law derive from different marriages (your parent's
vs. your own), so collisions are rare; `setIfAbsent` makes any overlap
deterministic (first writer wins).

### Vocabulary (new `pick(...)` rows)

| Relation | FEMALE | MALE | NON_BINARY |
|---|---|---|---|
| Stepparent | Stepmother | Stepfather | Stepparent |
| Stepchild | Stepdaughter | Stepson | Stepchild |
| Step-sibling | Step-sister | Step-brother | Step-sibling |

## Surfaces & data flow

No new queries. The Atlas (`getTreeData`) already provides all sims, all
bio/adoptive family edges, and all partner edges (`romanticStatus` + `endedAt`)
— everything step derivation needs. The mini tree (`getMiniTreeData`) already
fetches the focus's parents and their partners, so **stepparents** label
correctly there; step-siblings/stepchildren appear only when those sims are in
the mini tree's ±2-generation window — consistent with the documented
"labels reflect the visible graph" principle.

## UI

- `add-relationship-modal.tsx`: remove the `FamilyRelationshipType.STEP`
  `Combobox.Item` from the Family tab — it offers **Biological / Adoptive**
  only. New step relations are expressed by recording a marriage to a parent,
  not by adding a family edge.
- `relationships-editor.tsx`: the family-label rendering only formats the
  stored type; with `STEP` gone it shows Biological/Adoptive. Confirm no
  `STEP`-specific branch remains.

## Testing

Trophy style.

- **`kinship.test.ts`** — add step cases on a blended-family fixture:
  stepfather (mother's husband, not a bio parent) → "Stepfather"; stepmother;
  stepchild (spouse's child) → "Stepdaughter"; step-sibling (parent's spouse's
  child by another) → "Step-brother"; **divorced** stepparent (`endedAt` set) →
  no label; **widowed** stepparent → still "Stepfather"; a `PARTNER`/`DATING`
  parent's partner → no step label; blood-wins (a step-relative who is also a
  blood relative keeps the blood term); NON_BINARY neutral terms.
- **Migration test** — a seeded `STEP` family-relationship row is deleted and
  the enum is narrowed; a sim whose stepparent marriage is recorded re-derives
  the step label via the kinship module.
- **Update existing tests** that reference `STEP`
  (`sims.test.ts` family-relationship creation, the `kinship.test.ts`
  step-exclusion note) and confirm the add-relationship modal no longer offers
  Step (the `add-relationship-modal` e2e/unit coverage).

## Relationship to other branches

Stacks on `feat/kinship-labels` (extends the kinship partner layer) which is on
`feat/romantic-status-model` (supplies the `MARRIED` + `endedAt` state the step
gate reads). Branch order:

```
… → feat/romantic-status-model → feat/kinship-labels → feat/step-relationships
```
