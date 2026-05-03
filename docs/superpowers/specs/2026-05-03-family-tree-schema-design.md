# Family Tree Schema Design
**Date:** 2026-05-03  
**App:** SimsTrack — Sims 4 legacy playthrough tracker  
**Design doc destination (post-plan):** `docs/superpowers/specs/2026-05-03-family-tree-schema-design.md`

---

## Context

SimsTrack lets players document multi-generational Sims 4 playthroughs ("legacies"). Each legacy contains Sims linked by family relationships across generations. The app needs to model these relationships for two primary access patterns:

1. **Full family tree** — show all ancestors and descendants of a Sim (or the whole legacy lineage)
2. **Immediate family** — show parents, children, siblings, and partner of a specific Sim

Scale is small: hundreds of Sims per legacy, ~10–15 generations max. This rules out heavy optimizations like closure tables.

---

## Decision: Core Edges Only, No Derived Relationships

The original planned schema had a `FamilyRelationship` model with 19 typed edges (including grandparent, in-law, sibling, cousin, aunt/uncle). **The model is kept** but its enum is reduced to 3 direct parent-child edge types only.

**Why:**
- At this scale (~200 Sims), PostgreSQL `WITH RECURSIVE` CTEs are trivially fast — no precomputed closure needed
- Storing derived relationships (grandparent, sibling, cousin, in-law) creates a write-time maintenance burden: adding or changing a parent requires cascading updates to all derived rows — error-prone and fragile
- Spouse/partner relationships are already handled by `SocialRelationship` (MARRIED / DATING / ENGAGED status)
- Derived labels (grandparent, aunt/uncle, cousin, in-law) are computed at the app/service layer and shown in the UI without being persisted

---

## Schema

### `FamilyRelationship` — updated structure

The existing planned `FamilyRelationship` model is kept but its fields and enum are updated to match an explicit parent-child model. The old directional `fromSimId`/`toSimId` with 19 types is replaced with explicit `parentId`/`childId` and 3 types:

```prisma
enum FamilyRelationshipType {
  BIOLOGICAL
  ADOPTIVE
  STEP
}

model FamilyRelationship {
  id        String                 @id @default(cuid())
  parentId  String
  childId   String
  type      FamilyRelationshipType @default(BIOLOGICAL)

  parent    Sim   @relation("ParentOf", fields: [parentId], references: [id], onDelete: Cascade)
  child     Sim   @relation("ChildOf",  fields: [childId],  references: [id], onDelete: Cascade)

  @@unique([parentId, childId])
  @@index([childId])
}
```

And on `Sim`:
```prisma
model Sim {
  // ... existing fields unchanged ...
  parentsOf  FamilyRelationship[]  @relation("ParentOf")
  childOf    FamilyRelationship[]  @relation("ChildOf")
}
```

Spouse/partner relationships remain in `SocialRelationship` (MARRIED / ENGAGED / DATING status) — no change needed there.

### Legacy model — founder field

```prisma
model Legacy {
  // ... existing fields unchanged ...
  founderSimId  String?  @unique
  founderSim    Sim?     @relation("LegacyFounder", fields: [founderSimId], references: [id], onDelete: SetNull)
}
```

And on `Sim`:
```prisma
model Sim {
  // ...
  foundedLegacy  Legacy?  @relation("LegacyFounder")
}
```

`@unique` on `founderSimId` ensures one founder per legacy. `SetNull` on delete means removing the Sim doesn't cascade-delete the legacy.

> **Note on creation order:** The Legacy must be created before the founder Sim (since Sim belongs to a Household in the Legacy). `founderSimId` is set in a second step after the Sim is created.

### What changes from the original plan

- `FamilyRelationshipType` enum reduced from 19 values to 3 (BIOLOGICAL, ADOPTIVE, STEP)
- `FamilyRelationship` fields changed from `fromSimId`/`toSimId` → `parentId`/`childId`
- Derived types (GRANDPARENT, SIBLING, IN_LAW, AUNT_UNCLE, COUSIN, etc.) removed — computed at app layer instead
- `Legacy.founderSimId` added

---

## Query Patterns

### Full family tree (recursive CTE)

Two separate directional CTEs are required — a single bidirectional CTE would loop (traversing up to a parent then back down to the original child):

```sql
WITH RECURSIVE
ancestors AS (
  SELECT id, 0 AS depth FROM sim WHERE id = :simId
  UNION ALL
  SELECT p.parent_id, a.depth - 1
  FROM family_relationship p
  JOIN ancestors a ON p.child_id = a.id
),
descendants AS (
  SELECT id, 0 AS depth FROM sim WHERE id = :simId
  UNION ALL
  SELECT p.child_id, d.depth + 1
  FROM family_relationship p
  JOIN descendants d ON p.parent_id = d.id
)
SELECT DISTINCT s.*
FROM (
  SELECT id FROM ancestors
  UNION
  SELECT id FROM descendants
) tree
JOIN sim s ON s.id = tree.id;
```

To query the whole legacy tree: start from the founding Sim (first Sim in the legacy — the root Sim with no parents recorded in `family_relationship`).

### Immediate family

```sql
-- Parents of :simId
SELECT s.* FROM family_relationship fr JOIN sim s ON s.id = fr.parent_id WHERE fr.child_id = :simId;

-- Children of :simId
SELECT s.* FROM family_relationship fr JOIN sim s ON s.id = fr.child_id WHERE fr.parent_id = :simId;

-- Siblings (share at least one parent)
SELECT DISTINCT s.*
FROM family_relationship p1
JOIN family_relationship p2 ON p1.parent_id = p2.parent_id AND p2.child_id != :simId
JOIN sim s ON s.id = p2.child_id
WHERE p1.child_id = :simId;

-- Spouse / partner (via existing SocialRelationship)
SELECT s.*
FROM social_relationship sr
JOIN sim s ON s.id = CASE
  WHEN sr.sim_a_id = :simId THEN sr.sim_b_id
  ELSE sr.sim_a_id
END
WHERE (sr.sim_a_id = :simId OR sr.sim_b_id = :simId)
  AND sr.romantic_status IN ('DATING', 'ENGAGED', 'MARRIED');
```

### Derived relationships (app layer only, not persisted)

| Label | Derivation |
|-------|-----------|
| Grandparent | Parent's parent (2-hop up) |
| Grandchild | Child's child (2-hop down) |
| Sibling | Shared parent (same query as above) |
| Aunt/Uncle | Parent's sibling |
| Cousin | Parent's sibling's child |
| In-law | Spouse's parent / child's spouse |
| Step-sibling | Shared step-parent |

These are computed in the tRPC service layer when rendering relationship labels in the UI.

---

## Indexes

| Table | Index | Purpose |
|-------|-------|---------|
| `family_relationship` | `UNIQUE (parentId, childId)` | dedup + "find children of X" |
| `family_relationship` | `INDEX (childId)` | "find parents of X" |
| `legacy` | `UNIQUE (founderSimId)` | one founder per legacy |
| `social_relationship` | existing normalization `simAId < simBId` | partner lookup |

---

## Files to Modify

- `prisma/schema.prisma` — update `FamilyRelationshipType` enum to 3 values; update `FamilyRelationship` fields to `parentId`/`childId`; add `ParentOf`/`ChildOf` relations on `Sim`; add `founderSimId` + relation to `Legacy` and back-relation on `Sim`
- `prisma/migrations/` — new migration for the above
- `src/server/routers/family.ts` (new) — tRPC router for family tree queries
- `src/server/services/family.ts` (new) — service layer computing derived relationships

---

## Verification

1. Create a legacy with 3 generations of Sims (grandparent → parent → child)
2. Assign `FamilyRelationship` rows (`parentId` → `childId`) with BIOLOGICAL type
3. Run full family tree query from grandchild — verify all 3 generations returned
4. Run immediate family query on the parent — verify: 2 parents, 1 child, correct sibling(s)
5. Add an ADOPTIVE relationship to a Sim — verify `type` stored correctly, tree query includes them
6. Verify no derived rows needed when a new parent edge is added (vs. 19-type model)
7. Set `founderSimId` on a legacy — verify `@unique` prevents a second founder being assigned
8. Run `npx prisma validate` and `npx prisma migrate dev`
