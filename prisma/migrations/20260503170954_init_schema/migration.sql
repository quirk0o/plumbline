-- CreateEnum
CREATE TYPE "PackType" AS ENUM ('BASE_GAME', 'EXPANSION', 'GAME_PACK', 'STUFF_PACK', 'KIT');

-- CreateEnum
CREATE TYPE "TraitType" AS ENUM ('BONUS', 'REWARD', 'DEATH');

-- CreateEnum
CREATE TYPE "TraitCategory" AS ENUM ('EMOTIONAL', 'HOBBY', 'LIFESTYLE', 'SOCIAL');

-- CreateEnum
CREATE TYPE "AspirationCategory" AS ENUM ('ATHLETIC', 'CREATIVITY', 'DEVIANCE', 'FAMILY', 'FOOD', 'FORTUNE', 'KNOWLEDGE', 'LOVE', 'NATURE', 'POPULARITY');

-- CreateEnum
CREATE TYPE "CareerType" AS ENUM ('STANDARD', 'ACTIVE', 'PART_TIME');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('EMPLOYED', 'SELF_EMPLOYED');

-- CreateEnum
CREATE TYPE "LifeStage" AS ENUM ('NEWBORN', 'INFANT', 'TODDLER', 'CHILD', 'TEEN', 'YOUNG_ADULT', 'ADULT', 'ELDER');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'NON_BINARY');

-- CreateEnum
CREATE TYPE "OccultType" AS ENUM ('VAMPIRE', 'SPELLCASTER', 'MERMAID', 'WEREWOLF', 'FAIRY', 'ALIEN', 'GHOST', 'PLANT_SIM', 'SERVO');

-- CreateEnum
CREATE TYPE "CauseOfDeath" AS ENUM ('OLD_AGE', 'DROWNING', 'FIRE', 'ELECTROCUTION', 'HUNGER', 'OVEREXERTION', 'EMBARRASSMENT', 'ANGER', 'LAUGHTER', 'COWPLANT', 'PUFFERFISH', 'MURPHY_BED', 'STEAM', 'POISON', 'METEOR');

-- CreateEnum
CREATE TYPE "FamilyRelationshipType" AS ENUM ('BIOLOGICAL', 'ADOPTIVE', 'STEP');

-- CreateEnum
CREATE TYPE "RomanticStatus" AS ENUM ('NONE', 'DATING', 'ENGAGED', 'MARRIED', 'EX_PARTNER', 'WIDOWED');

-- CreateTable
CREATE TABLE "packs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PackType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "packs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personality_traits" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "TraitCategory",
    "minLifeStage" "LifeStage",
    "maxLifeStage" "LifeStage",
    "packId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personality_traits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "traits" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "TraitType" NOT NULL,
    "packId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "traits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aspirations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "AspirationCategory" NOT NULL,
    "bonusTraitId" TEXT,
    "minLifeStage" "LifeStage",
    "maxLifeStage" "LifeStage",
    "packId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aspirations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skills" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minLifeStage" "LifeStage",
    "maxLifeStage" "LifeStage",
    "maxLevel" INTEGER NOT NULL,
    "packId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "careers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CareerType" NOT NULL,
    "branchAName" TEXT,
    "branchBName" TEXT,
    "packId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "careers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "user_packs" (
    "userId" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_packs_pkey" PRIMARY KEY ("userId","packId")
);

-- CreateTable
CREATE TABLE "legacies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "founderSimId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legacies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "households" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legacyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "households_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sims" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "lifeStage" "LifeStage" NOT NULL,
    "gender" "Gender" NOT NULL,
    "pronounSubject" TEXT NOT NULL,
    "pronounObject" TEXT NOT NULL,
    "pronounPossessive" TEXT NOT NULL,
    "occultType" "OccultType",
    "causeOfDeath" "CauseOfDeath",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sim_personality_traits" (
    "simId" TEXT NOT NULL,
    "personalityTraitId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sim_personality_traits_pkey" PRIMARY KEY ("simId","personalityTraitId")
);

-- CreateTable
CREATE TABLE "sim_traits" (
    "simId" TEXT NOT NULL,
    "traitId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sim_traits_pkey" PRIMARY KEY ("simId","traitId")
);

-- CreateTable
CREATE TABLE "sim_skills" (
    "simId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sim_skills_pkey" PRIMARY KEY ("simId","skillId")
);

-- CreateTable
CREATE TABLE "sim_aspirations" (
    "id" TEXT NOT NULL,
    "simId" TEXT NOT NULL,
    "aspirationId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sim_aspirations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sim_careers" (
    "id" TEXT NOT NULL,
    "simId" TEXT NOT NULL,
    "careerId" TEXT,
    "employmentType" "EmploymentType" NOT NULL,
    "level" INTEGER,
    "branch" TEXT,
    "customName" TEXT,
    "customGoal" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sim_careers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_relationships" (
    "id" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "type" "FamilyRelationshipType" NOT NULL DEFAULT 'BIOLOGICAL'::"FamilyRelationshipType",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "family_relationships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_relationships" (
    "id" TEXT NOT NULL,
    "simAId" TEXT NOT NULL,
    "simBId" TEXT NOT NULL,
    "friendshipScore" INTEGER NOT NULL,
    "romanceScore" INTEGER NOT NULL,
    "romanticStatus" "RomanticStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_relationships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "packs_name_key" ON "packs"("name");

-- CreateIndex
CREATE UNIQUE INDEX "personality_traits_name_key" ON "personality_traits"("name");

-- CreateIndex
CREATE UNIQUE INDEX "traits_name_key" ON "traits"("name");

-- CreateIndex
CREATE UNIQUE INDEX "aspirations_name_key" ON "aspirations"("name");

-- CreateIndex
CREATE UNIQUE INDEX "skills_name_key" ON "skills"("name");

-- CreateIndex
CREATE UNIQUE INDEX "careers_name_key" ON "careers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "legacies_founderSimId_key" ON "legacies"("founderSimId");

-- CreateIndex
CREATE UNIQUE INDEX "sim_aspirations_simId_aspirationId_key" ON "sim_aspirations"("simId", "aspirationId");

-- CreateIndex
CREATE INDEX "family_relationships_childId_idx" ON "family_relationships"("childId");

-- CreateIndex
CREATE UNIQUE INDEX "family_relationships_parentId_childId_key" ON "family_relationships"("parentId", "childId");

-- CreateIndex
CREATE INDEX "social_relationships_simBId_idx" ON "social_relationships"("simBId");

-- CreateIndex
CREATE UNIQUE INDEX "social_relationships_simAId_simBId_key" ON "social_relationships"("simAId", "simBId");

-- AddForeignKey
ALTER TABLE "personality_traits" ADD CONSTRAINT "personality_traits_packId_fkey" FOREIGN KEY ("packId") REFERENCES "packs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traits" ADD CONSTRAINT "traits_packId_fkey" FOREIGN KEY ("packId") REFERENCES "packs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aspirations" ADD CONSTRAINT "aspirations_bonusTraitId_fkey" FOREIGN KEY ("bonusTraitId") REFERENCES "traits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aspirations" ADD CONSTRAINT "aspirations_packId_fkey" FOREIGN KEY ("packId") REFERENCES "packs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skills" ADD CONSTRAINT "skills_packId_fkey" FOREIGN KEY ("packId") REFERENCES "packs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "careers" ADD CONSTRAINT "careers_packId_fkey" FOREIGN KEY ("packId") REFERENCES "packs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_packs" ADD CONSTRAINT "user_packs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_packs" ADD CONSTRAINT "user_packs_packId_fkey" FOREIGN KEY ("packId") REFERENCES "packs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legacies" ADD CONSTRAINT "legacies_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legacies" ADD CONSTRAINT "legacies_founderSimId_fkey" FOREIGN KEY ("founderSimId") REFERENCES "sims"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "households" ADD CONSTRAINT "households_legacyId_fkey" FOREIGN KEY ("legacyId") REFERENCES "legacies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sims" ADD CONSTRAINT "sims_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sim_personality_traits" ADD CONSTRAINT "sim_personality_traits_simId_fkey" FOREIGN KEY ("simId") REFERENCES "sims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sim_personality_traits" ADD CONSTRAINT "sim_personality_traits_personalityTraitId_fkey" FOREIGN KEY ("personalityTraitId") REFERENCES "personality_traits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sim_traits" ADD CONSTRAINT "sim_traits_simId_fkey" FOREIGN KEY ("simId") REFERENCES "sims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sim_traits" ADD CONSTRAINT "sim_traits_traitId_fkey" FOREIGN KEY ("traitId") REFERENCES "traits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sim_skills" ADD CONSTRAINT "sim_skills_simId_fkey" FOREIGN KEY ("simId") REFERENCES "sims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sim_skills" ADD CONSTRAINT "sim_skills_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "skills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sim_aspirations" ADD CONSTRAINT "sim_aspirations_simId_fkey" FOREIGN KEY ("simId") REFERENCES "sims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sim_aspirations" ADD CONSTRAINT "sim_aspirations_aspirationId_fkey" FOREIGN KEY ("aspirationId") REFERENCES "aspirations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sim_careers" ADD CONSTRAINT "sim_careers_simId_fkey" FOREIGN KEY ("simId") REFERENCES "sims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sim_careers" ADD CONSTRAINT "sim_careers_careerId_fkey" FOREIGN KEY ("careerId") REFERENCES "careers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_relationships" ADD CONSTRAINT "family_relationships_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "sims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_relationships" ADD CONSTRAINT "family_relationships_childId_fkey" FOREIGN KEY ("childId") REFERENCES "sims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_relationships" ADD CONSTRAINT "social_relationships_simAId_fkey" FOREIGN KEY ("simAId") REFERENCES "sims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_relationships" ADD CONSTRAINT "social_relationships_simBId_fkey" FOREIGN KEY ("simBId") REFERENCES "sims"("id") ON DELETE CASCADE ON UPDATE CASCADE;
