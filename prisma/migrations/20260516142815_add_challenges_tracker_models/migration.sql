-- CreateEnum
CREATE TYPE "ValueKind" AS ENUM ('BOOLEAN', 'NUMERICAL', 'THRESHOLD');

-- CreateTable
CREATE TABLE "tracker_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isBuiltIn" BOOLEAN NOT NULL DEFAULT false,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "ownerId" TEXT,
    "computationSpec" JSONB,
    "configSchema" JSONB NOT NULL DEFAULT '{}',
    "goalSchema" JSONB,
    "valueKind" "ValueKind" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tracker_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "challenges" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "challenge_phases" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "generationNumber" INTEGER,
    "title" TEXT,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "challenge_phases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracker_definitions" (
    "id" TEXT NOT NULL,
    "challengePhaseId" TEXT NOT NULL,
    "trackerTypeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "config" JSONB NOT NULL DEFAULT '{}',
    "goalConfig" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tracker_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "challenge_runs" (
    "id" TEXT NOT NULL,
    "legacyId" TEXT NOT NULL,
    "sourceChallengeId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "challenge_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "challenge_run_phases" (
    "id" TEXT NOT NULL,
    "challengeRunId" TEXT NOT NULL,
    "generationNumber" INTEGER,
    "title" TEXT,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "challenge_run_phases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "challenge_run_trackers" (
    "id" TEXT NOT NULL,
    "challengeRunPhaseId" TEXT NOT NULL,
    "trackerTypeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "config" JSONB NOT NULL DEFAULT '{}',
    "goalConfig" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "challenge_run_trackers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracker_progress" (
    "id" TEXT NOT NULL,
    "challengeRunTrackerId" TEXT NOT NULL,
    "value" JSONB,
    "completedAt" TIMESTAMP(3),
    "isManual" BOOLEAN NOT NULL DEFAULT true,
    "evaluatedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tracker_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tracker_types_name_key" ON "tracker_types"("name");

-- CreateIndex
CREATE UNIQUE INDEX "tracker_progress_challengeRunTrackerId_key" ON "tracker_progress"("challengeRunTrackerId");

-- AddForeignKey
ALTER TABLE "tracker_types" ADD CONSTRAINT "tracker_types_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_phases" ADD CONSTRAINT "challenge_phases_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracker_definitions" ADD CONSTRAINT "tracker_definitions_challengePhaseId_fkey" FOREIGN KEY ("challengePhaseId") REFERENCES "challenge_phases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracker_definitions" ADD CONSTRAINT "tracker_definitions_trackerTypeId_fkey" FOREIGN KEY ("trackerTypeId") REFERENCES "tracker_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_runs" ADD CONSTRAINT "challenge_runs_legacyId_fkey" FOREIGN KEY ("legacyId") REFERENCES "legacies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_runs" ADD CONSTRAINT "challenge_runs_sourceChallengeId_fkey" FOREIGN KEY ("sourceChallengeId") REFERENCES "challenges"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_run_phases" ADD CONSTRAINT "challenge_run_phases_challengeRunId_fkey" FOREIGN KEY ("challengeRunId") REFERENCES "challenge_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_run_trackers" ADD CONSTRAINT "challenge_run_trackers_challengeRunPhaseId_fkey" FOREIGN KEY ("challengeRunPhaseId") REFERENCES "challenge_run_phases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_run_trackers" ADD CONSTRAINT "challenge_run_trackers_trackerTypeId_fkey" FOREIGN KEY ("trackerTypeId") REFERENCES "tracker_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracker_progress" ADD CONSTRAINT "tracker_progress_challengeRunTrackerId_fkey" FOREIGN KEY ("challengeRunTrackerId") REFERENCES "challenge_run_trackers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
