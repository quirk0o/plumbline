-- CreateIndex
CREATE INDEX "challenge_run_phases_challengeRunId_idx" ON "challenge_run_phases"("challengeRunId");

-- CreateIndex
CREATE INDEX "challenge_run_trackers_challengeRunPhaseId_idx" ON "challenge_run_trackers"("challengeRunPhaseId");

-- CreateIndex
CREATE INDEX "challenge_run_trackers_trackerTypeId_idx" ON "challenge_run_trackers"("trackerTypeId");

-- CreateIndex
CREATE INDEX "challenge_runs_legacyId_completedAt_idx" ON "challenge_runs"("legacyId", "completedAt");

-- CreateIndex
CREATE INDEX "challenges_ownerId_idx" ON "challenges"("ownerId");

-- CreateIndex
CREATE INDEX "sims_legacyId_generationNumber_idx" ON "sims"("legacyId", "generationNumber");

-- CreateIndex
CREATE INDEX "tracker_definitions_challengePhaseId_idx" ON "tracker_definitions"("challengePhaseId");

-- CreateIndex
CREATE INDEX "tracker_definitions_trackerTypeId_idx" ON "tracker_definitions"("trackerTypeId");

-- CreateIndex
CREATE INDEX "tracker_types_ownerId_idx" ON "tracker_types"("ownerId");
