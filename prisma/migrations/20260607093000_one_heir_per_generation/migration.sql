-- One heir per generation per legacy, enforced at the database level as a
-- backstop against concurrent heir swaps (the application clears the cohort
-- before setting the flag inside a transaction, but two racing transactions
-- can both pass that check).
--
-- NULL generationNumber rows are exempt (Postgres treats NULLs as distinct):
-- sims without a generation are not a cohort and may all carry the flag.
--
-- NOTE: partial unique indexes cannot be expressed in schema.prisma, so this
-- index exists only in migration SQL. If a future `prisma migrate dev`
-- generates a `DROP INDEX "sims_one_heir_per_generation_key"`, delete that
-- statement from the generated migration — it is drift detection misfiring,
-- not an intentional change.
CREATE UNIQUE INDEX "sims_one_heir_per_generation_key"
  ON "sims" ("legacyId", "generationNumber")
  WHERE "isHeir";
