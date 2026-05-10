/*
  Warnings:

  - Added the required column `legacyId` to the `sims` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "sims" ADD COLUMN     "legacyId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "sims" ADD CONSTRAINT "sims_legacyId_fkey" FOREIGN KEY ("legacyId") REFERENCES "legacies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
