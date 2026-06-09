-- Backfill generationNumber so the column can become NOT NULL.
-- Mirrors recomputeGenerations (src/server/lib/generation.ts):
--   roots keep their value (null roots take the legacy's current max, else 1),
--   derived sims relax to max(parent generation) + 1 to a fixpoint.

-- 1. Null roots (sims with no parent edge) -> legacy's current max gen, else 1.
UPDATE "sims" s
SET "generationNumber" = COALESCE(
  (SELECT MAX(s2."generationNumber") FROM "sims" s2 WHERE s2."legacyId" = s."legacyId"),
  1
)
WHERE s."generationNumber" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "family_relationships" f WHERE f."childId" = s."id"
  );

-- 2. Relax derived sims to max(parent generation) + 1, looping to a fixpoint.
--    Also normalizes any historically min-based values to the new max rule.
DO $$
DECLARE
  changed integer;
  max_passes integer := (SELECT COUNT(*) FROM "sims");
  pass integer := 0;
BEGIN
  LOOP
    UPDATE "sims" c
    SET "generationNumber" = sub.maxgen + 1
    FROM (
      SELECT f."childId" AS child_id, MAX(p."generationNumber") AS maxgen
      FROM "family_relationships" f
      JOIN "sims" p ON p."id" = f."parentId"
      WHERE p."generationNumber" IS NOT NULL
      GROUP BY f."childId"
    ) sub
    WHERE c."id" = sub.child_id
      AND (c."generationNumber" IS NULL OR c."generationNumber" <> sub.maxgen + 1);
    GET DIAGNOSTICS changed = ROW_COUNT;
    EXIT WHEN changed = 0;
    -- A productive pass happened. An acyclic graph converges within one pass
    -- per sim, so exceeding that bound means an unresolvable cycle.
    pass := pass + 1;
    IF pass > max_passes THEN
      RAISE EXCEPTION 'generationNumber backfill did not converge after % passes — possible cycle in family_relationships', max_passes;
    END IF;
  END LOOP;
END $$;

-- 3. Safety net: any sim still null (orphan chain with no resolvable parent) -> 1.
UPDATE "sims" SET "generationNumber" = 1 WHERE "generationNumber" IS NULL;

-- 4. Enforce the invariant.
ALTER TABLE "sims" ALTER COLUMN "generationNumber" SET NOT NULL;
