-- CreateTable
CREATE TABLE "milestones" (
    "id" TEXT NOT NULL,
    "legacyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "blurb" TEXT,
    "sortOrder" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "milestone_sims" (
    "milestoneId" TEXT NOT NULL,
    "simId" TEXT NOT NULL,

    CONSTRAINT "milestone_sims_pkey" PRIMARY KEY ("milestoneId","simId")
);

-- CreateIndex
CREATE INDEX "milestones_legacyId_sortOrder_idx" ON "milestones"("legacyId", "sortOrder");

-- AddForeignKey
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_legacyId_fkey" FOREIGN KEY ("legacyId") REFERENCES "legacies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestone_sims" ADD CONSTRAINT "milestone_sims_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "milestones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestone_sims" ADD CONSTRAINT "milestone_sims_simId_fkey" FOREIGN KEY ("simId") REFERENCES "sims"("id") ON DELETE CASCADE ON UPDATE CASCADE;
