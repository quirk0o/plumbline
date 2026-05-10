-- AlterTable
ALTER TABLE "packs" ALTER COLUMN "code" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "packs_code_key" ON "packs"("code");
