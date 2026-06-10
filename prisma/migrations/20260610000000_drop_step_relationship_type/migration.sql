-- Drop the stored STEP family-relationship type. Step relations are now derived
-- from marriage + parentage in the kinship module, not stored as edges.
-- Plain best-effort backfill (no inference, no report), mirroring the
-- romantic-status narrow migration (20260609120000_narrow_romantic_status).

-- 1. Delete STEP edges. A deleted step re-derives as a label only where the
--    connecting marriage is recorded -- the honest model (step IS the marriage).
DELETE FROM "family_relationships" WHERE "type" = 'STEP';

-- 2. Narrow the enum. Postgres cannot drop an in-use value in place, so swap the
--    type. The column's DEFAULT is of the old type, so drop it before the cast
--    and restore it after.
ALTER TYPE "FamilyRelationshipType" RENAME TO "FamilyRelationshipType_old";
CREATE TYPE "FamilyRelationshipType" AS ENUM ('BIOLOGICAL', 'ADOPTIVE');
ALTER TABLE "family_relationships" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "family_relationships"
  ALTER COLUMN "type" TYPE "FamilyRelationshipType"
  USING ("type"::text::"FamilyRelationshipType");
ALTER TABLE "family_relationships" ALTER COLUMN "type" SET DEFAULT 'BIOLOGICAL';
DROP TYPE "FamilyRelationshipType_old";
