# GEDCOM Family Tree Import — Design

**Date:** 2026-06-01
**Status:** Approved (design); pending implementation plan

## Summary

Let a user import a family tree from a GEDCOM file (the standard genealogy
export format) and turn it into a new Legacy of Sims. The primary source is the
MC Command Center (MCCC) "MC Gedcom" module, which exports a Sim's family tree
as a standard **GEDCOM 5.5** `.ged` file; genealogy apps (Ancestry, MyHeritage,
Gramps) emit the same format. The individuals in these files represent Sims, so
names, sex, and the parent/child + marriage structure map directly onto the
existing `Sim`, `FamilyRelationship`, and `SocialRelationship` models.

The flow is **upload → parse → edit in a mapping table → commit**. Each import
creates a brand-new Legacy, so there is no merge or de-duplication against
existing data.

## Context: what the source format actually contains

Research into the MCCC "MC Gedcom" module and the GEDCOM 5.5 spec established:

- MCCC exports **standard GEDCOM 5.5** `.ged` files (in-game cheat
  `gedcom <first> <last>`). The exact tag set is "what EA exposes from script"
  and is **not guaranteed** — birth/death events and dates are inconsistently
  present and sparse.
- The reliable content is **basic familial data**: individual `NAME` (surname
  in `/slashes/`), `SEX` (M/F), and family structure
  (`INDI`/`FAM`/`HUSB`/`WIFE`/`CHIL`/`FAMS`/`FAMC`).
- **No Sims-specific data exists in GEDCOM** — no life stage, traits,
  aspirations, careers, occult type, or pronouns. These cannot come from the
  file and must be defaulted (then edited by the user).

**Consequence:** the importer is a defensive, standards-based GEDCOM 5.5 reader,
not an MCCC-specific one. It tolerates missing tags and applies sensible
defaults for everything the format omits.

## Decisions

| Decision | Choice |
|---|---|
| Import target | Always create a **new Legacy** per import (no merge/dedup). |
| Flow | Upload → **editable mapping table** → confirm/commit. |
| Edit scope | **Per-Sim core fields** in a table; relationships read-only. |
| Field mapping | Sensible defaults + deceased flag (see mapping table). |
| Parser | `read-gedcom` (npm, MIT, TypeScript types), behind an adapter. |

## Architecture

New feature module under `src/server/lib/gedcom/` plus a tRPC router, following
the existing `src/server/routers/*` + `src/server/lib/*` split.

- **`src/server/lib/gedcom/parse.ts`** — thin adapter over `read-gedcom`; the
  **only** file that imports the library. Input: raw file text. Output: a
  normalized, library-agnostic `ParsedGedcom`:
  - individuals `{ ref, given, surname, sex, deceased }`
  - families `{ husbandRef, wifeRef, childRefs, adoptedChildRefs }`
  - `ref` is the GEDCOM xref pointer (e.g. `@I1@`), stable across edits.
- **`src/server/lib/gedcom/map.ts`** — pure function `ParsedGedcom → ImportPlan`.
  Applies field mapping + defaults, computes generation numbers and founder,
  collects warnings. No DB, no I/O — fully unit-testable.
- **`src/server/lib/gedcom/commit.ts`** — `EditedPlan + userId → Legacy`, all
  writes inside one `prisma.$transaction`.
- **`src/server/routers/gedcom.ts`** — two procedures (below). Registered in
  `src/server/routers/index.ts`.

### Procedures

Both are `protectedProcedure` (import belongs to the signed-in user).

1. **`gedcom.preview(text: string)`** — runs `parse → map`, returns the full
   `ImportPlan` (every Sim as an editable row + read-only relationship
   summary + warnings). **Writes nothing.**
2. **`gedcom.commit(editedPlan)`** — accepts the user-edited plan, validates it
   with Zod, then `commit()`. Returns `{ legacySlug }`.

### Trust model

Because the user edits the rows, `commit` treats the **edited plan as the
source of truth** (it does not re-parse). It is validated server-side with Zod
exactly as rigorously as manual Sim creation:

- enum membership: `Gender`, `LifeStage`, `OccultType`
- name lengths: `firstName`/`lastName` 1–50 (matching `sims.create`)
- every `relationships`/`marriages` ref resolves to a Sim row
- no self-parent and no parent/child cycle

This is the same authoring-trust model as the existing manual create flow — the
user is deliberately authoring their own data into their own Legacy.

### Types

```ts
ImportPlan {
  suggestedLegacyName: string          // from the root individual's surname
  sims: ImportSim[]                    // editable rows
  relationships: { parentRef, childRef, type: FamilyRelationshipType }[]  // read-only
  marriages: { aRef, bRef }[]                                              // read-only
  founderRef: string | null
  warnings: Warning[]
}

ImportSim {
  ref: string            // stable GEDCOM xref; relationships point at this, survives edits
  firstName: string      // editable
  lastName: string       // editable
  gender: Gender         // editable
  lifeStage: LifeStage   // editable
  occultType: OccultType | null   // editable
  deceased: boolean      // editable toggle → causeOfDeath on commit
  generationNumber: number | null // computed, shown read-only
}

Warning {
  code: 'BLANK_GIVEN_NAME' | 'BLANK_SURNAME' | 'AMBIGUOUS_SEX'
      | 'DROPPED_RELATIONSHIP' | 'DUPLICATE_XREF'
  ref?: string           // the individual it concerns, when applicable
  message: string
}
```

### Data flow

```
.ged file ──File.text()──▶ gedcom.preview(text)
                              parse() ▶ ParsedGedcom ▶ map() ▶ ImportPlan
                          ◀── { suggestedLegacyName, sims[], relationships[], marriages[], warnings[] }
   user edits rows + names the Legacy
                          ──▶ gedcom.commit(editedPlan)
                              Zod validate ▶ commit() in one prisma.$transaction
                          ◀── { legacySlug }  ▶ redirect to the new legacy's tree
```

The raw file is **never persisted** (no S3/blob) — it lives only in the browser
between preview and commit.

## UI

New route **`src/app/app/legacies/import/page.tsx`**:

1. File picker → `File.text()` → `gedcom.preview(text)`.
2. **Warnings panel** above the table (one line per warning, with the affected
   Sim's name).
3. **Editable Sims table** — one row per Sim:
   - `firstName`, `lastName` text inputs
   - `gender`, `lifeStage`, `occultType` selects
   - `deceased` toggle
   - `generationNumber` shown read-only
4. **Read-only relationship summary** — e.g. "12 marriages, 30 parent-child
   links".
5. **Legacy-name input**, pre-filled from `suggestedLegacyName`.
6. **Create Legacy** button → `gedcom.commit(...)` → redirect to the new
   legacy's tree.

An entry point to this route is added from the legacies list/new-legacy area
(exact placement decided during implementation, following existing nav
patterns).

## Field mapping (`map.ts`)

Everything Sims-specific that GEDCOM cannot supply gets a default the user can
edit in the table.

| GEDCOM source | Sim field | Rule |
|---|---|---|
| `NAME` text before `/…/` | `firstName` | Trimmed, truncated to 50. Blank → `"Unnamed"` + `BLANK_GIVEN_NAME` warning. |
| `NAME` text inside `/…/` | `lastName` | Trimmed, truncated to 50. Blank → inherit family/root surname if derivable, else `"(Unknown)"` + `BLANK_SURNAME` warning. |
| `SEX M` / `SEX F` | `gender` | `MALE` / `FEMALE`. |
| `SEX U` / `X` / missing | `gender` | `NON_BINARY` + `AMBIGUOUS_SEX` warning. |
| `DEAT` event present | `deceased = true` | → `lifeStage ELDER`, `causeOfDeath OLD_AGE` (both editable). |
| no `DEAT` | `deceased = false` | → `lifeStage YOUNG_ADULT`, `causeOfDeath null`. |
| `BIRT` / `DEAT` dates | — | No schema field for dates; used **only** to order generations / tie-break founder. Otherwise discarded (noted once in the summary, not per-Sim). |
| `FAM` `HUSB` + `WIFE` | `SocialRelationship` | `romanticStatus MARRIED`, `friendshipScore 50`, `romanceScore 50`. Enforce `simAId < simBId` ordering (the schema's app-layer rule). |
| `FAM` `HUSB`/`WIFE` → `CHIL` | `FamilyRelationship` parent→child | `BIOLOGICAL`; child with `PEDI adopted` → `ADOPTIVE`. |
| tree depth | `generationNumber` | Roots = 1; child = `min(parentGen) + 1` (mirrors existing `sims.create` logic). |
| root individual | `Legacy.founderSimId` | The gen-1 Sim the export was rooted on; if ambiguous, the one with the most descendants. |

**Always-defaulted (absent from GEDCOM):** pronouns `null`; no
traits/aspirations/careers/skills; `imageUrl null`; `occultType null`
(editable); a single auto-created `"Household 1"` (matching `sims.create`).

**Notes**
- `gender` only ever resolves to the three enum values; `NON_BINARY` is the
  catch-all for non-M/F, flagged so the user can correct it.
- A `FAM` with `HUSB`+`WIFE` but no `MARR` tag is still treated as `MARRIED`
  (a GEDCOM `FAM` implies a union). Rationale: over-linking a couple is more
  recoverable than silently dropping it, and the user sees the marriage count.
  There is no clean `RomanticStatus` for "partnered, unmarried" in this context.

## Error & warning handling

**Errors — nothing written, friendly tRPC `BAD_REQUEST`:**

- **Not GEDCOM / malformed** — `read-gedcom` throws or yields zero records →
  "This doesn't look like a valid GEDCOM file."
- **Empty / no individuals** → "No people found in this file."
- **Too large** — cap at **5 MB and 2,000 individuals** (MCCC/household trees
  are far smaller); over the cap → clear message. Guards the synchronous parse
  against pathological uploads.
- **Invalid edited plan on commit** — Zod rejection (bad enum, name length,
  unresolved ref, cycle) → `BAD_REQUEST` naming the offending row(s); the
  transaction never starts.

**Warnings — non-fatal, surfaced in the preview panel; import proceeds:**

- `BLANK_GIVEN_NAME`, `BLANK_SURNAME` — defaults applied.
- `AMBIGUOUS_SEX` — defaulted to `NON_BINARY`.
- `DROPPED_RELATIONSHIP` — a `FAM` pointer references a missing/unparseable
  individual, or a self/cyclic parent link → that single link is dropped, the
  Sims still import.
- `DUPLICATE_XREF` — same individual id twice → first wins.

**Best-effort vs all-or-nothing:** invalid *relationships* are dropped with a
warning (the tree still imports usefully); the *Sims themselves* commit
all-or-nothing inside one `prisma.$transaction` — partial Sim creation would
leave a broken Legacy.

## Testing

Following the project's Testing Trophy philosophy (mostly integration, no
trivial unit tests):

- **Mapper integration tests** — fixture `.ged` files under
  `src/test/fixtures/gedcom/`: a small MCCC-style tree, missing-surname,
  `SEX U`, deceased, adoption (`PEDI adopted`), and a malformed file. Assert the
  resulting `ImportPlan` (counts, defaults applied, warnings emitted).
- **Router tests** (`src/server/routers/gedcom.test.ts`, against the test DB
  like the existing routers):
  - `preview` returns the plan and writes nothing.
  - `commit` creates the Legacy + Sims + `FamilyRelationship` +
    `SocialRelationship` + `founderSimId`.
  - an invalid plan rolls back with **zero** rows written.
- **E2E** (Playwright): upload a fixture → edit a row (fix a blank surname, flip
  a deceased toggle) → Create Legacy → land on the tree showing the imported
  Sims.

### E2E locator policy

Follow the project's locator priority (`.claude/rules/testing.md`): prefer
`getByRole` / `getByLabel` / `getByText`. The import form's controls
(Legacy-name input, gender/lifeStage/occult selects, deceased toggle) are
reached by `getByLabel` / `getByRole`. Reach for `getByTestId` **only** to
scope/disambiguate a region (e.g. the Sims table) when role/label/text cannot,
adding a `data-testid` at that point. **Never** use CSS `#id` / `.class`
selectors.

## New dependency

- `read-gedcom` (MIT) — GEDCOM 5.5/7 reader with TypeScript types, wrapped
  behind `parse.ts` so it is swappable.

## Out of scope (YAGNI)

- Importing into an existing Legacy / merge / de-duplication.
- Editing relationships in the UI (relationships are read-only; fixed post-import via existing Sim editing).
- Persisting the uploaded file or supporting re-import/round-trip export.
- Mapping real genealogy fields with no Sims equivalent (places, sources, notes, occupations).
- Storing birth/death dates (no schema field; dates inform generation order only).
