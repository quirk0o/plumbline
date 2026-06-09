-- Backfill existing rows off the values being removed (plain best-effort remap).
-- EX_PARTNER: prior bond is unrecoverable -> generic break-up (DATING + ended).
UPDATE "social_relationships"
  SET "romanticStatus" = 'DATING', "endedAt" = "updatedAt"
  WHERE "romanticStatus" = 'EX_PARTNER';
-- WIDOWED: becomes a marriage; widowhood now derives from the partner's death.
UPDATE "social_relationships"
  SET "romanticStatus" = 'MARRIED'
  WHERE "romanticStatus" = 'WIDOWED';

-- Narrow the enum: Postgres cannot drop a value in place, so swap the type.
-- Only EX_PARTNER and WIDOWED are dropped; PARTNER survives.
ALTER TYPE "RomanticStatus" RENAME TO "RomanticStatus_old";
CREATE TYPE "RomanticStatus" AS ENUM ('NONE', 'DATING', 'PARTNER', 'ENGAGED', 'MARRIED');
ALTER TABLE "social_relationships"
  ALTER COLUMN "romanticStatus" TYPE "RomanticStatus"
  USING ("romanticStatus"::text::"RomanticStatus");
DROP TYPE "RomanticStatus_old";
