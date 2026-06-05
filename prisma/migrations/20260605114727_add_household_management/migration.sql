/*
  Warnings:

  - A unique constraint covering the columns `[activeHouseholdId]` on the table `legacies` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "households" ADD COLUMN     "description" TEXT,
ADD COLUMN     "foundedGeneration" INTEGER,
ADD COLUMN     "funds" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lot" TEXT,
ADD COLUMN     "lotValue" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "worldId" TEXT;

-- AlterTable
ALTER TABLE "legacies" ADD COLUMN     "activeHouseholdId" TEXT;

-- CreateTable
CREATE TABLE "worlds" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "packId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "worlds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lots" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,

    CONSTRAINT "lots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "worlds_name_key" ON "worlds"("name");

-- CreateIndex
CREATE UNIQUE INDEX "lots_worldId_name_key" ON "lots"("worldId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "legacies_activeHouseholdId_key" ON "legacies"("activeHouseholdId");

-- AddForeignKey
ALTER TABLE "worlds" ADD CONSTRAINT "worlds_packId_fkey" FOREIGN KEY ("packId") REFERENCES "packs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "worlds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legacies" ADD CONSTRAINT "legacies_activeHouseholdId_fkey" FOREIGN KEY ("activeHouseholdId") REFERENCES "households"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "households" ADD CONSTRAINT "households_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "worlds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: each existing legacy's first household becomes its active household.
UPDATE "legacies" SET "activeHouseholdId" = sub."id"
FROM (
  SELECT DISTINCT ON ("legacyId") "id", "legacyId"
  FROM "households"
  ORDER BY "legacyId", "createdAt" ASC
) AS sub
WHERE "legacies"."id" = sub."legacyId" AND "legacies"."activeHouseholdId" IS NULL;
