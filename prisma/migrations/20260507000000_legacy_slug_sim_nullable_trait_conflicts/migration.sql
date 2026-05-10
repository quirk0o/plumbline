-- AlterTable: Legacy — add slug, description, imageUrl
ALTER TABLE "legacies" ADD COLUMN "slug" TEXT NOT NULL DEFAULT '';
ALTER TABLE "legacies" ADD COLUMN "description" TEXT;
ALTER TABLE "legacies" ADD COLUMN "imageUrl" TEXT;

-- Backfill slug with id (cuid, globally unique) so existing rows don't collide on the unique index
UPDATE "legacies" SET "slug" = "id" WHERE "slug" = '';

-- Remove temporary default from slug (it's a required field going forward)
ALTER TABLE "legacies" ALTER COLUMN "slug" DROP DEFAULT;

-- UniqueConstraint: userId + slug
CREATE UNIQUE INDEX "legacies_userId_slug_key" ON "legacies"("userId", "slug");

-- AlterTable: Sim — make householdId, pronouns nullable; add imageUrl
ALTER TABLE "sims" ALTER COLUMN "householdId" DROP NOT NULL;
ALTER TABLE "sims" ALTER COLUMN "pronounSubject" DROP NOT NULL;
ALTER TABLE "sims" ALTER COLUMN "pronounObject" DROP NOT NULL;
ALTER TABLE "sims" ALTER COLUMN "pronounPossessive" DROP NOT NULL;
ALTER TABLE "sims" ADD COLUMN "imageUrl" TEXT;

-- Update Sim household FK to SetNull on delete (drop old, add new)
ALTER TABLE "sims" DROP CONSTRAINT "sims_householdId_fkey";
ALTER TABLE "sims" ADD CONSTRAINT "sims_householdId_fkey"
  FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: PersonalityTraitConflict
CREATE TABLE "personality_trait_conflicts" (
    "traitAId" TEXT NOT NULL,
    "traitBId" TEXT NOT NULL,

    CONSTRAINT "personality_trait_conflicts_pkey" PRIMARY KEY ("traitAId","traitBId")
);

-- AddForeignKey
ALTER TABLE "personality_trait_conflicts" ADD CONSTRAINT "personality_trait_conflicts_traitAId_fkey"
  FOREIGN KEY ("traitAId") REFERENCES "personality_traits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personality_trait_conflicts" ADD CONSTRAINT "personality_trait_conflicts_traitBId_fkey"
  FOREIGN KEY ("traitBId") REFERENCES "personality_traits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
