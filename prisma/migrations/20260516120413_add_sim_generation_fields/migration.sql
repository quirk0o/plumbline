-- AlterTable
ALTER TABLE "sims" ADD COLUMN     "generationNumber" INTEGER,
ADD COLUMN     "isHeir" BOOLEAN NOT NULL DEFAULT false;
