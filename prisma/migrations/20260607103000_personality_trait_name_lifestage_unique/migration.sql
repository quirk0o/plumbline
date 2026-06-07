-- Replace the name-only unique constraint with a compound (name, minLifeStage) unique
-- so that traits with the same name can exist in different life-stage pools
-- (e.g. "Clingy" can appear in both the Infant and Toddler pools).
DROP INDEX IF EXISTS "personality_traits_name_key";
CREATE UNIQUE INDEX "personality_traits_name_minLifeStage_key"
  ON "personality_traits" ("name", "minLifeStage");
