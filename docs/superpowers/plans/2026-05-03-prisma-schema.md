# Prisma Schema Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the full Prisma schema and seed file for SimsTrack-526, covering NextAuth auth, game reference data, playthrough structure, Sim state, and relationships.

**Architecture:** Schema is built incrementally in dependency order — datasource fix + enums first, then reference data (Pack before the models that reference it), then auth, then playthrough, then Sim state junction tables, then relationships. Each group is validated with `prisma validate` before moving on. A single migration creates all tables. The seed file populates all static game reference data using idempotent upserts.

**Tech Stack:** Prisma 7.8.0, PostgreSQL, `@prisma/adapter-pg` (runtime only — CLI tools use `DATABASE_URL` from env directly)

---

### Task 1: Fix datasource + add all enums

**Files:**
- Modify: `prisma/schema.prisma`

The current datasource has no `url`. Prisma CLI tools (`migrate dev`, `validate`, `studio`) need it even when the runtime uses the pg adapter.

- [ ] Add `url = env("DATABASE_URL")` to the datasource block:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

- [ ] Confirm `.env` has `DATABASE_URL` set. If not, add it:

```
DATABASE_URL="postgresql://user:password@localhost:5432/simstrack"
```

- [ ] Add all enums after the datasource block:

```prisma
enum PackType {
  BASE_GAME
  EXPANSION
  GAME_PACK
  STUFF_PACK
  KIT
}

enum TraitType {
  BONUS
  REWARD
  DEATH
}

enum TraitCategory {
  EMOTIONAL
  HOBBY
  LIFESTYLE
  SOCIAL
}

enum AspirationCategory {
  ATHLETIC
  CREATIVITY
  DEVIANCE
  FAMILY
  FOOD
  FORTUNE
  KNOWLEDGE
  LOVE
  NATURE
  POPULARITY
}

enum CareerType {
  STANDARD
  ACTIVE
  PART_TIME
}

enum EmploymentType {
  EMPLOYED
  SELF_EMPLOYED
}

enum LifeStage {
  NEWBORN
  INFANT
  TODDLER
  CHILD
  TEEN
  YOUNG_ADULT
  ADULT
  ELDER
}

enum Gender {
  MALE
  FEMALE
  NON_BINARY
}

enum OccultType {
  VAMPIRE
  SPELLCASTER
  MERMAID
  WEREWOLF
  FAIRY
  ALIEN
  GHOST
  PLANT_SIM
  SERVO
}

enum CauseOfDeath {
  OLD_AGE
  DROWNING
  FIRE
  ELECTROCUTION
  HUNGER
  OVEREXERTION
  EMBARRASSMENT
  ANGER
  LAUGHTER
  COWPLANT
  PUFFERFISH
  MURPHY_BED
  STEAM
  POISON
  METEOR
}

enum FamilyRelationshipType {
  PARENT
  CHILD
  GRANDPARENT
  GRANDCHILD
  GREAT_GRANDPARENT
  GREAT_GRANDCHILD
  SIBLING
  HALF_SIBLING
  STEP_SIBLING
  STEP_PARENT
  STEP_CHILD
  ADOPTIVE_PARENT
  ADOPTED_CHILD
  AUNT_UNCLE
  NIECE_NEPHEW
  COUSIN
  PARENT_IN_LAW
  CHILD_IN_LAW
  SIBLING_IN_LAW
}

enum RomanticStatus {
  NONE
  DATING
  ENGAGED
  MARRIED
  EX_PARTNER
  WIDOWED
}
```

- [ ] Run `npx prisma validate`

  Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] Run `npx prisma format`

- [ ] Commit:

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add datasource url and all domain enums"
```

---

### Task 2: Reference data models

**Files:**
- Modify: `prisma/schema.prisma`

Add `Pack` first (no FK dependencies), then the five content models that reference it. All forward-referenced back-relations (`UserPack[]`, `SimPersonalityTrait[]`, etc.) are added here even though those models come later — Prisma requires both sides of a relation to be declared.

- [ ] Add `Pack`, `PersonalityTrait`, `Trait`, `Aspiration`, `Skill`, and `Career` models:

```prisma
model Pack {
  id        String   @id @default(cuid())
  name      String   @unique
  type      PackType
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  personalityTraits PersonalityTrait[]
  traits            Trait[]
  aspirations       Aspiration[]
  skills            Skill[]
  careers           Career[]
  userPacks         UserPack[]

  @@map("packs")
}

model PersonalityTrait {
  id           String         @id @default(cuid())
  name         String         @unique
  category     TraitCategory?
  minLifeStage LifeStage?
  maxLifeStage LifeStage?
  packId       String?
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt

  pack                 Pack?                 @relation(fields: [packId], references: [id])
  simPersonalityTraits SimPersonalityTrait[]

  @@map("personality_traits")
}

model Trait {
  id        String    @id @default(cuid())
  name      String    @unique
  type      TraitType
  packId    String?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  pack        Pack?        @relation(fields: [packId], references: [id])
  simTraits   SimTrait[]
  aspirations Aspiration[] @relation("AspirationBonusTrait")

  @@map("traits")
}

model Aspiration {
  id           String             @id @default(cuid())
  name         String             @unique
  category     AspirationCategory
  bonusTraitId String?
  minLifeStage LifeStage?
  maxLifeStage LifeStage?
  packId       String?
  createdAt    DateTime           @default(now())
  updatedAt    DateTime           @updatedAt

  bonusTrait     Trait?          @relation("AspirationBonusTrait", fields: [bonusTraitId], references: [id])
  pack           Pack?           @relation(fields: [packId], references: [id])
  simAspirations SimAspiration[]

  @@map("aspirations")
}

model Skill {
  id           String     @id @default(cuid())
  name         String     @unique
  minLifeStage LifeStage?
  maxLifeStage LifeStage?
  maxLevel     Int
  packId       String?
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt

  pack      Pack?      @relation(fields: [packId], references: [id])
  simSkills SimSkill[]

  @@map("skills")
}

model Career {
  id          String     @id @default(cuid())
  name        String     @unique
  type        CareerType
  branchAName String?
  branchBName String?
  packId      String?
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  pack       Pack?       @relation(fields: [packId], references: [id])
  simCareers SimCareer[]

  @@map("careers")
}
```

- [ ] Run `npx prisma validate`

  Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] Run `npx prisma format`

- [ ] Commit:

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add reference data models"
```

---

### Task 3: NextAuth adapter models

**Files:**
- Modify: `prisma/schema.prisma`

These four models are the standard NextAuth Prisma adapter contract. Field names must match exactly — NextAuth reads them by convention.

- [ ] Add `User`, `Account`, `Session`, and `VerificationToken` models:

```prisma
model User {
  id            String    @id @default(cuid())
  name          String?
  email         String    @unique
  emailVerified DateTime?
  image         String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  accounts  Account[]
  sessions  Session[]
  userPacks UserPack[]
  legacies  Legacy[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@map("accounts")
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("sessions")
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
  @@map("verification_tokens")
}
```

- [ ] Run `npx prisma validate`

  Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] Run `npx prisma format`

- [ ] Commit:

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add NextAuth adapter models"
```

---

### Task 4: Playthrough models

**Files:**
- Modify: `prisma/schema.prisma`

`UserPack` uses a composite `@@id` (no surrogate key needed). `Sim` declares all back-relations upfront including the ones for Sim state and relationships added in later tasks.

- [ ] Add `UserPack`, `Legacy`, `Household`, and `Sim` models:

```prisma
model UserPack {
  userId    String
  packId    String
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  pack Pack @relation(fields: [packId], references: [id])

  @@id([userId, packId])
  @@map("user_packs")
}

model Legacy {
  id        String   @id @default(cuid())
  name      String
  userId    String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user       User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  households Household[]

  @@map("legacies")
}

model Household {
  id        String   @id @default(cuid())
  name      String
  legacyId  String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  legacy Legacy @relation(fields: [legacyId], references: [id], onDelete: Cascade)
  sims   Sim[]

  @@map("households")
}

model Sim {
  id                String        @id @default(cuid())
  firstName         String
  lastName          String
  householdId       String
  lifeStage         LifeStage
  gender            Gender
  pronounSubject    String
  pronounObject     String
  pronounPossessive String
  occultType        OccultType?
  causeOfDeath      CauseOfDeath?
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt

  household            Household             @relation(fields: [householdId], references: [id], onDelete: Cascade)
  personalityTraits    SimPersonalityTrait[]
  traits               SimTrait[]
  skills               SimSkill[]
  aspirations          SimAspiration[]
  careers              SimCareer[]
  familyFrom           FamilyRelationship[]  @relation("FamilyFrom")
  familyTo             FamilyRelationship[]  @relation("FamilyTo")
  socialRelationshipsA SocialRelationship[]  @relation("SocialA")
  socialRelationshipsB SocialRelationship[]  @relation("SocialB")

  @@map("sims")
}
```

- [ ] Run `npx prisma validate`

  Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] Run `npx prisma format`

- [ ] Commit:

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add playthrough models (UserPack, Legacy, Household, Sim)"
```

---

### Task 5: Sim state junction tables

**Files:**
- Modify: `prisma/schema.prisma`

`SimPersonalityTrait` and `SimTrait` use composite `@@id` (pure join tables with only `createdAt`). `SimSkill` and `SimAspiration` use composite `@@id` or a surrogate `id` depending on whether they have extra fields. `SimCareer` has a surrogate `id` for history querying.

- [ ] Add all five Sim state models:

```prisma
model SimPersonalityTrait {
  simId              String
  personalityTraitId String
  createdAt          DateTime @default(now())

  sim              Sim              @relation(fields: [simId], references: [id], onDelete: Cascade)
  personalityTrait PersonalityTrait @relation(fields: [personalityTraitId], references: [id])

  @@id([simId, personalityTraitId])
  @@map("sim_personality_traits")
}

model SimTrait {
  simId     String
  traitId   String
  createdAt DateTime @default(now())

  sim   Sim   @relation(fields: [simId], references: [id], onDelete: Cascade)
  trait Trait @relation(fields: [traitId], references: [id])

  @@id([simId, traitId])
  @@map("sim_traits")
}

model SimSkill {
  simId     String
  skillId   String
  level     Int
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  sim   Sim   @relation(fields: [simId], references: [id], onDelete: Cascade)
  skill Skill @relation(fields: [skillId], references: [id])

  @@id([simId, skillId])
  @@map("sim_skills")
}

model SimAspiration {
  id           String    @id @default(cuid())
  simId        String
  aspirationId String
  completedAt  DateTime?
  createdAt    DateTime  @default(now())

  sim        Sim        @relation(fields: [simId], references: [id], onDelete: Cascade)
  aspiration Aspiration @relation(fields: [aspirationId], references: [id])

  @@unique([simId, aspirationId])
  @@map("sim_aspirations")
}

model SimCareer {
  id             String         @id @default(cuid())
  simId          String
  careerId       String?
  employmentType EmploymentType
  level          Int?
  branch         String?
  customName     String?
  customGoal     String?
  startedAt      DateTime
  endedAt        DateTime?
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt

  sim    Sim     @relation(fields: [simId], references: [id], onDelete: Cascade)
  career Career? @relation(fields: [careerId], references: [id])

  @@map("sim_careers")
}
```

- [ ] Run `npx prisma validate`

  Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] Run `npx prisma format`

- [ ] Commit:

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add Sim state junction tables"
```

---

### Task 6: Relationship models

**Files:**
- Modify: `prisma/schema.prisma`

Both models reference `Sim` twice, requiring named `@relation` directives that match the back-relations already declared on `Sim` in Task 4.

- [ ] Add `FamilyRelationship` and `SocialRelationship` models:

```prisma
model FamilyRelationship {
  id        String                 @id @default(cuid())
  fromSimId String
  toSimId   String
  type      FamilyRelationshipType
  createdAt DateTime               @default(now())
  updatedAt DateTime               @updatedAt

  fromSim Sim @relation("FamilyFrom", fields: [fromSimId], references: [id], onDelete: Cascade)
  toSim   Sim @relation("FamilyTo", fields: [toSimId], references: [id], onDelete: Cascade)

  @@unique([fromSimId, toSimId])
  @@index([toSimId])
  @@map("family_relationships")
}

model SocialRelationship {
  id              String         @id @default(cuid())
  simAId          String
  simBId          String
  friendshipScore Int
  romanceScore    Int
  romanticStatus  RomanticStatus
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  simA Sim @relation("SocialA", fields: [simAId], references: [id], onDelete: Cascade)
  simB Sim @relation("SocialB", fields: [simBId], references: [id], onDelete: Cascade)

  @@unique([simAId, simBId])
  @@index([simBId])
  @@map("social_relationships")
}
```

- [ ] Run `npx prisma validate`

  Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] Run `npx prisma format`

- [ ] Commit:

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add relationship models (FamilyRelationship, SocialRelationship)"
```

---

### Task 7: Initial migration

**Files:** (no schema changes — runs migration tooling)

- [ ] Run:

```bash
npx prisma migrate dev --name init-schema
```

Expected output (excerpt):
```
Applying migration `20260503000000_init_schema`
Your database is now in sync with your schema.
Generated Prisma Client
```

If the command fails with a connection error, verify `DATABASE_URL` in `.env` points to a running Postgres instance.

- [ ] Confirm the migration file was created:

```bash
ls prisma/migrations/
```

Expected: one directory named `*_init_schema`

- [ ] Commit:

```bash
git add prisma/migrations/
git commit -m "feat(schema): add initial migration"
```

---

### Task 8: Seed reference data

**Files:**
- Modify: `prisma/seed.ts`

The seed uses idempotent `upsert` calls — safe to re-run at any time. Trait names must be unique across the whole `personality_traits` table, so life-stage variants that share a game name are disambiguated with a suffix (e.g., `"Clingy (Toddler)"` vs `"Clingy (Infant)"`). Bonus traits that share a name with a reward trait (e.g., "Savant") are similarly suffixed.

- [ ] Replace the body of `prisma/seed.ts` with:

```typescript
import {
  PrismaClient,
  PackType,
  TraitType,
  TraitCategory,
  AspirationCategory,
  CareerType,
  LifeStage,
} from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL environment variable is not set')
const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Seeding reference data...')

  // ── Packs ─────────────────────────────────────────────────────────────────
  const packSeed = [
    { name: 'Base Game',            type: PackType.BASE_GAME  },
    { name: 'Get to Work',          type: PackType.EXPANSION  },
    { name: 'Get Together',         type: PackType.EXPANSION  },
    { name: 'City Living',          type: PackType.EXPANSION  },
    { name: 'Cats & Dogs',          type: PackType.EXPANSION  },
    { name: 'Seasons',              type: PackType.EXPANSION  },
    { name: 'Discover University',  type: PackType.EXPANSION  },
    { name: 'Eco Lifestyle',        type: PackType.EXPANSION  },
    { name: 'Snowy Escape',         type: PackType.EXPANSION  },
    { name: 'Cottage Living',       type: PackType.EXPANSION  },
    { name: 'High School Years',    type: PackType.EXPANSION  },
    { name: 'Growing Together',     type: PackType.EXPANSION  },
    { name: 'Horse Ranch',          type: PackType.EXPANSION  },
    { name: 'For Rent',             type: PackType.EXPANSION  },
    { name: 'Lovestruck',           type: PackType.EXPANSION  },
    { name: 'Life & Death',         type: PackType.EXPANSION  },
    { name: 'Businesses & Hobbies', type: PackType.EXPANSION  },
    { name: 'Outdoor Retreat',      type: PackType.GAME_PACK  },
    { name: 'Spa Day',              type: PackType.GAME_PACK  },
    { name: 'Dine Out',             type: PackType.GAME_PACK  },
    { name: 'Vampires',             type: PackType.GAME_PACK  },
    { name: 'Parenthood',           type: PackType.GAME_PACK  },
    { name: 'Jungle Adventure',     type: PackType.GAME_PACK  },
    { name: 'StrangerVille',        type: PackType.GAME_PACK  },
    { name: 'Realm of Magic',       type: PackType.GAME_PACK  },
    { name: 'Dream Home Decorator', type: PackType.GAME_PACK  },
    { name: 'My Wedding Stories',   type: PackType.GAME_PACK  },
    { name: 'Werewolves',           type: PackType.GAME_PACK  },
    { name: 'Incheon Arrivals',     type: PackType.GAME_PACK  },
    { name: 'Crystal Creations',    type: PackType.GAME_PACK  },
  ]

  for (const p of packSeed) {
    await prisma.pack.upsert({ where: { name: p.name }, update: {}, create: p })
  }

  const pack = async (name: string) => {
    const p = await prisma.pack.findUniqueOrThrow({ where: { name } })
    return p.id
  }

  // ── Personality Traits ────────────────────────────────────────────────────
  // Adult/child traits have no life-stage bounds (available to Child+).
  // Infant and toddler traits are bounded. Name collisions across life stages
  // are disambiguated with a suffix.
  const personalityTraitSeed: Array<{
    name: string
    category: TraitCategory
    minLifeStage?: LifeStage
    maxLifeStage?: LifeStage
    packId?: string
  }> = [
    // Emotional
    { name: 'Cheerful',      category: TraitCategory.EMOTIONAL },
    { name: 'Gloomy',        category: TraitCategory.EMOTIONAL },
    { name: 'Hot-Headed',    category: TraitCategory.EMOTIONAL },
    { name: 'Good',          category: TraitCategory.EMOTIONAL },
    { name: 'Evil',          category: TraitCategory.EMOTIONAL },
    { name: 'Erratic',       category: TraitCategory.EMOTIONAL },
    { name: 'Self-Assured',  category: TraitCategory.EMOTIONAL },
    // Hobby
    { name: 'Art Lover',     category: TraitCategory.HOBBY },
    { name: 'Bookworm',      category: TraitCategory.HOBBY },
    { name: 'Creative',      category: TraitCategory.HOBBY },
    { name: 'Foodie',        category: TraitCategory.HOBBY },
    { name: 'Geek',          category: TraitCategory.HOBBY },
    { name: 'Loves Outdoors',category: TraitCategory.HOBBY },
    { name: 'Music Lover',   category: TraitCategory.HOBBY },
    // Lifestyle
    { name: 'Active',        category: TraitCategory.LIFESTYLE },
    { name: 'Ambitious',     category: TraitCategory.LIFESTYLE },
    { name: 'Clumsy',        category: TraitCategory.LIFESTYLE },
    { name: 'Genius',        category: TraitCategory.LIFESTYLE },
    { name: 'Glutton',       category: TraitCategory.LIFESTYLE },
    { name: 'Kleptomaniac',  category: TraitCategory.LIFESTYLE },
    { name: 'Lazy',          category: TraitCategory.LIFESTYLE },
    { name: 'Neat',          category: TraitCategory.LIFESTYLE },
    { name: 'Slob',          category: TraitCategory.LIFESTYLE },
    { name: 'Vegetarian',    category: TraitCategory.LIFESTYLE },
    // Social
    { name: 'Bro',           category: TraitCategory.SOCIAL },
    { name: 'Family-Oriented', category: TraitCategory.SOCIAL },
    { name: 'Jealous',       category: TraitCategory.SOCIAL },
    { name: 'Loner',         category: TraitCategory.SOCIAL },
    { name: 'Outgoing',      category: TraitCategory.SOCIAL },
    { name: 'Romantic',      category: TraitCategory.SOCIAL },
    // Infant traits — Growing Together (suffixed to avoid name collisions with toddler traits)
    { name: 'Calm (Infant)',    category: TraitCategory.EMOTIONAL, minLifeStage: LifeStage.INFANT, maxLifeStage: LifeStage.INFANT, packId: await pack('Growing Together') },
    { name: 'Clingy (Infant)',  category: TraitCategory.SOCIAL,    minLifeStage: LifeStage.INFANT, maxLifeStage: LifeStage.INFANT, packId: await pack('Growing Together') },
    { name: 'Intense (Infant)', category: TraitCategory.EMOTIONAL, minLifeStage: LifeStage.INFANT, maxLifeStage: LifeStage.INFANT, packId: await pack('Growing Together') },
    { name: 'Wiggly',           category: TraitCategory.LIFESTYLE, minLifeStage: LifeStage.INFANT, maxLifeStage: LifeStage.INFANT, packId: await pack('Growing Together') },
    { name: 'Cautious (Infant)',category: TraitCategory.EMOTIONAL, minLifeStage: LifeStage.INFANT, maxLifeStage: LifeStage.INFANT, packId: await pack('Growing Together') },
    // Toddler traits — base game
    { name: 'Angelic',          category: TraitCategory.SOCIAL,    minLifeStage: LifeStage.TODDLER, maxLifeStage: LifeStage.TODDLER },
    { name: 'Charmer',          category: TraitCategory.SOCIAL,    minLifeStage: LifeStage.TODDLER, maxLifeStage: LifeStage.TODDLER },
    { name: 'Clingy (Toddler)', category: TraitCategory.SOCIAL,    minLifeStage: LifeStage.TODDLER, maxLifeStage: LifeStage.TODDLER },
    { name: 'Fussy',            category: TraitCategory.EMOTIONAL, minLifeStage: LifeStage.TODDLER, maxLifeStage: LifeStage.TODDLER },
    { name: 'Independent',      category: TraitCategory.SOCIAL,    minLifeStage: LifeStage.TODDLER, maxLifeStage: LifeStage.TODDLER },
    { name: 'Inquisitive',      category: TraitCategory.HOBBY,     minLifeStage: LifeStage.TODDLER, maxLifeStage: LifeStage.TODDLER },
    { name: 'Silly',            category: TraitCategory.SOCIAL,    minLifeStage: LifeStage.TODDLER, maxLifeStage: LifeStage.TODDLER },
    { name: 'Wild',             category: TraitCategory.LIFESTYLE, minLifeStage: LifeStage.TODDLER, maxLifeStage: LifeStage.TODDLER },
  ]

  for (const t of personalityTraitSeed) {
    await prisma.personalityTrait.upsert({ where: { name: t.name }, update: {}, create: t })
  }

  // ── Non-personality Traits ────────────────────────────────────────────────
  // "Savant" exists as both a bonus trait (Knowledge aspirations) and a reward
  // trait (satisfaction points). Since name is unique, they are disambiguated
  // with a suffix. The aspiration seed below references "Savant (Bonus)".
  const traitSeed: Array<{ name: string; type: TraitType; packId?: string }> = [
    // Bonus traits — awarded on first aspiration selection
    { name: 'Physically Gifted',  type: TraitType.BONUS },
    { name: 'Muser',              type: TraitType.BONUS },
    { name: 'Dastardly',          type: TraitType.BONUS },
    { name: 'Domestic',           type: TraitType.BONUS },
    { name: 'Essence of Flavor',  type: TraitType.BONUS },
    { name: 'Frugal (Bonus)',     type: TraitType.BONUS },
    { name: 'Savant (Bonus)',     type: TraitType.BONUS },
    { name: 'Fertile',            type: TraitType.BONUS },
    { name: 'One With Nature',    type: TraitType.BONUS },
    { name: 'Socially Gifted',    type: TraitType.BONUS },
    // Reward traits — satisfaction points, aspiration completion, challenges
    { name: 'Business Savvy',     type: TraitType.REWARD },
    { name: 'Connections',        type: TraitType.REWARD },
    { name: 'Creative Visionary', type: TraitType.REWARD },
    { name: 'Entrepreneurial',    type: TraitType.REWARD },
    { name: 'Forever Fresh',      type: TraitType.REWARD },
    { name: 'Frugal',             type: TraitType.REWARD },
    { name: 'Gym Rat',            type: TraitType.REWARD },
    { name: 'Handy',              type: TraitType.REWARD },
    { name: 'Incredibly Friendly',type: TraitType.REWARD },
    { name: 'Inspired',           type: TraitType.REWARD },
    { name: 'Long Lived',         type: TraitType.REWARD },
    { name: 'Mentor',             type: TraitType.REWARD },
    { name: 'Never Weary',        type: TraitType.REWARD },
    { name: 'Nerd Brain',         type: TraitType.REWARD },
    { name: 'No Jealousy',        type: TraitType.REWARD },
    { name: 'Player',             type: TraitType.REWARD },
    { name: 'Savant',             type: TraitType.REWARD },
    { name: 'Seldom Sleepy',      type: TraitType.REWARD },
    { name: 'Steel Bladder',      type: TraitType.REWARD },
    { name: 'Super Green Thumb',  type: TraitType.REWARD },
    // Death traits — assigned when a Sim dies; governs ghost behavior
    { name: 'Ghost (Old Age)',       type: TraitType.DEATH },
    { name: 'Ghost (Drowning)',      type: TraitType.DEATH },
    { name: 'Ghost (Fire)',          type: TraitType.DEATH },
    { name: 'Ghost (Electrocution)', type: TraitType.DEATH },
    { name: 'Ghost (Hunger)',        type: TraitType.DEATH },
    { name: 'Ghost (Overexertion)',  type: TraitType.DEATH },
    { name: 'Ghost (Embarrassment)', type: TraitType.DEATH },
    { name: 'Ghost (Anger)',         type: TraitType.DEATH },
    { name: 'Ghost (Laughter)',      type: TraitType.DEATH },
    { name: 'Ghost (Cowplant)',      type: TraitType.DEATH },
    { name: 'Ghost (Pufferfish)',    type: TraitType.DEATH },
    { name: 'Ghost (Murphy Bed)',    type: TraitType.DEATH },
    { name: 'Ghost (Steam)',         type: TraitType.DEATH },
    { name: 'Ghost (Poison)',        type: TraitType.DEATH },
    { name: 'Ghost (Meteor)',        type: TraitType.DEATH },
  ]

  for (const t of traitSeed) {
    await prisma.trait.upsert({ where: { name: t.name }, update: {}, create: t })
  }

  // ── Aspirations ───────────────────────────────────────────────────────────
  const bt = async (name: string) => {
    const t = await prisma.trait.findUniqueOrThrow({ where: { name } })
    return t.id
  }

  const aspirationSeed: Array<{
    name: string
    category: AspirationCategory
    bonusTraitId?: string
    minLifeStage?: LifeStage
    maxLifeStage?: LifeStage
    packId?: string
  }> = [
    // Athletic
    { name: 'Bodybuilder',               category: AspirationCategory.ATHLETIC,    bonusTraitId: await bt('Physically Gifted'), minLifeStage: LifeStage.YOUNG_ADULT },
    { name: 'Extreme Sports Enthusiast', category: AspirationCategory.ATHLETIC,    bonusTraitId: await bt('Physically Gifted'), minLifeStage: LifeStage.YOUNG_ADULT, packId: await pack('Outdoor Retreat') },
    // Creativity
    { name: 'Bestselling Author',        category: AspirationCategory.CREATIVITY,  bonusTraitId: await bt('Muser'), minLifeStage: LifeStage.YOUNG_ADULT },
    { name: 'Musical Genius',            category: AspirationCategory.CREATIVITY,  bonusTraitId: await bt('Muser'), minLifeStage: LifeStage.YOUNG_ADULT },
    { name: 'Painter Extraordinaire',    category: AspirationCategory.CREATIVITY,  bonusTraitId: await bt('Muser'), minLifeStage: LifeStage.YOUNG_ADULT },
    // Deviance
    { name: 'Chief of Mischief',         category: AspirationCategory.DEVIANCE,    bonusTraitId: await bt('Dastardly'), minLifeStage: LifeStage.YOUNG_ADULT },
    { name: 'Public Enemy',              category: AspirationCategory.DEVIANCE,    bonusTraitId: await bt('Dastardly'), minLifeStage: LifeStage.YOUNG_ADULT },
    { name: 'Serial Romantic',           category: AspirationCategory.DEVIANCE,    bonusTraitId: await bt('Dastardly'), minLifeStage: LifeStage.YOUNG_ADULT },
    // Family
    { name: 'Big Happy Family',          category: AspirationCategory.FAMILY,      bonusTraitId: await bt('Domestic'), minLifeStage: LifeStage.YOUNG_ADULT },
    { name: 'Successful Lineage',        category: AspirationCategory.FAMILY,      bonusTraitId: await bt('Domestic'), minLifeStage: LifeStage.YOUNG_ADULT },
    { name: 'Super Parent',              category: AspirationCategory.FAMILY,      bonusTraitId: await bt('Domestic'), minLifeStage: LifeStage.YOUNG_ADULT, packId: await pack('Parenthood') },
    // Food
    { name: 'Culinary Librarian',        category: AspirationCategory.FOOD,        bonusTraitId: await bt('Essence of Flavor'), minLifeStage: LifeStage.YOUNG_ADULT },
    { name: 'Master Chef',               category: AspirationCategory.FOOD,        bonusTraitId: await bt('Essence of Flavor'), minLifeStage: LifeStage.YOUNG_ADULT },
    { name: 'Master Mixologist',         category: AspirationCategory.FOOD,        bonusTraitId: await bt('Essence of Flavor'), minLifeStage: LifeStage.YOUNG_ADULT },
    // Fortune
    { name: 'Fabulously Wealthy',        category: AspirationCategory.FORTUNE,     bonusTraitId: await bt('Frugal (Bonus)'), minLifeStage: LifeStage.YOUNG_ADULT },
    { name: 'Mansion Baron',             category: AspirationCategory.FORTUNE,     bonusTraitId: await bt('Frugal (Bonus)'), minLifeStage: LifeStage.YOUNG_ADULT },
    // Knowledge
    { name: 'Computer Whiz',             category: AspirationCategory.KNOWLEDGE,   bonusTraitId: await bt('Savant (Bonus)'), minLifeStage: LifeStage.YOUNG_ADULT },
    { name: 'Nerd Brain',                category: AspirationCategory.KNOWLEDGE,   bonusTraitId: await bt('Savant (Bonus)'), minLifeStage: LifeStage.YOUNG_ADULT },
    { name: 'Renaissance Sim',           category: AspirationCategory.KNOWLEDGE,   bonusTraitId: await bt('Savant (Bonus)'), minLifeStage: LifeStage.YOUNG_ADULT },
    // Love
    { name: 'Hopeless Romantic',         category: AspirationCategory.LOVE,        bonusTraitId: await bt('Fertile'), minLifeStage: LifeStage.YOUNG_ADULT },
    { name: 'Soulmate',                  category: AspirationCategory.LOVE,        bonusTraitId: await bt('Fertile'), minLifeStage: LifeStage.YOUNG_ADULT },
    // Nature
    { name: 'Freelance Botanist',        category: AspirationCategory.NATURE,      bonusTraitId: await bt('One With Nature'), minLifeStage: LifeStage.YOUNG_ADULT },
    { name: 'The Curator',               category: AspirationCategory.NATURE,      bonusTraitId: await bt('One With Nature'), minLifeStage: LifeStage.YOUNG_ADULT },
    { name: 'Outdoor Enthusiast',        category: AspirationCategory.NATURE,      bonusTraitId: await bt('One With Nature'), minLifeStage: LifeStage.YOUNG_ADULT, packId: await pack('Outdoor Retreat') },
    // Popularity
    { name: 'Friend of the World',       category: AspirationCategory.POPULARITY,  bonusTraitId: await bt('Socially Gifted'), minLifeStage: LifeStage.YOUNG_ADULT },
    { name: 'Leader of the Pack',        category: AspirationCategory.POPULARITY,  bonusTraitId: await bt('Socially Gifted'), minLifeStage: LifeStage.YOUNG_ADULT, packId: await pack('Get Together') },
    { name: 'Party Animal',              category: AspirationCategory.POPULARITY,  bonusTraitId: await bt('Socially Gifted'), minLifeStage: LifeStage.YOUNG_ADULT },
    // Child-only
    { name: 'Artistic Prodigy',          category: AspirationCategory.CREATIVITY,  minLifeStage: LifeStage.CHILD, maxLifeStage: LifeStage.CHILD },
    { name: 'Rambunctious Scamp',        category: AspirationCategory.ATHLETIC,    minLifeStage: LifeStage.CHILD, maxLifeStage: LifeStage.CHILD },
    { name: 'Social Butterfly',          category: AspirationCategory.POPULARITY,  minLifeStage: LifeStage.CHILD, maxLifeStage: LifeStage.CHILD },
    { name: 'Whiz Kid',                  category: AspirationCategory.KNOWLEDGE,   minLifeStage: LifeStage.CHILD, maxLifeStage: LifeStage.CHILD },
  ]

  for (const a of aspirationSeed) {
    await prisma.aspiration.upsert({ where: { name: a.name }, update: {}, create: a })
  }

  // ── Skills ────────────────────────────────────────────────────────────────
  const skillSeed: Array<{
    name: string
    minLifeStage?: LifeStage
    maxLifeStage?: LifeStage
    maxLevel: number
    packId?: string
  }> = [
    // Toddler (base game) — bounded TODDLER/TODDLER
    { name: 'Communication', minLifeStage: LifeStage.TODDLER, maxLifeStage: LifeStage.TODDLER, maxLevel: 5 },
    { name: 'Imagination',   minLifeStage: LifeStage.TODDLER, maxLifeStage: LifeStage.TODDLER, maxLevel: 5 },
    { name: 'Movement',      minLifeStage: LifeStage.TODDLER, maxLifeStage: LifeStage.TODDLER, maxLevel: 5 },
    { name: 'Potty',         minLifeStage: LifeStage.TODDLER, maxLifeStage: LifeStage.TODDLER, maxLevel: 3 },
    { name: 'Thinking',      minLifeStage: LifeStage.TODDLER, maxLifeStage: LifeStage.TODDLER, maxLevel: 5 },
    // Child (base game) — bounded CHILD/CHILD
    // Disambiguated from adult skill names where they overlap
    { name: 'Creativity (Child)', minLifeStage: LifeStage.CHILD, maxLifeStage: LifeStage.CHILD, maxLevel: 10 },
    { name: 'Mental',             minLifeStage: LifeStage.CHILD, maxLifeStage: LifeStage.CHILD, maxLevel: 10 },
    { name: 'Motor',              minLifeStage: LifeStage.CHILD, maxLifeStage: LifeStage.CHILD, maxLevel: 10 },
    { name: 'Social (Child)',     minLifeStage: LifeStage.CHILD, maxLifeStage: LifeStage.CHILD, maxLevel: 10 },
    // Adult skills (base game) — available TEEN onwards (no max)
    { name: 'Charisma',       minLifeStage: LifeStage.TEEN, maxLevel: 10 },
    { name: 'Comedy',         minLifeStage: LifeStage.TEEN, maxLevel: 10 },
    { name: 'Cooking',        minLifeStage: LifeStage.TEEN, maxLevel: 10 },
    { name: 'Fishing',        minLifeStage: LifeStage.TEEN, maxLevel: 10 },
    { name: 'Fitness',        minLifeStage: LifeStage.TEEN, maxLevel: 10 },
    { name: 'Gardening',      minLifeStage: LifeStage.TEEN, maxLevel: 10 },
    { name: 'Guitar',         minLifeStage: LifeStage.TEEN, maxLevel: 10 },
    { name: 'Handiness',      minLifeStage: LifeStage.TEEN, maxLevel: 10 },
    { name: 'Logic',          minLifeStage: LifeStage.TEEN, maxLevel: 10 },
    { name: 'Mischief',       minLifeStage: LifeStage.TEEN, maxLevel: 10 },
    { name: 'Painting',       minLifeStage: LifeStage.TEEN, maxLevel: 10 },
    { name: 'Photography',    minLifeStage: LifeStage.TEEN, maxLevel: 10 },
    { name: 'Piano',          minLifeStage: LifeStage.TEEN, maxLevel: 10 },
    { name: 'Programming',    minLifeStage: LifeStage.TEEN, maxLevel: 10 },
    { name: 'Rocket Science', minLifeStage: LifeStage.TEEN, maxLevel: 10 },
    { name: 'Video Gaming',   minLifeStage: LifeStage.TEEN, maxLevel: 10 },
    { name: 'Violin',         minLifeStage: LifeStage.TEEN, maxLevel: 10 },
    { name: 'Writing',        minLifeStage: LifeStage.TEEN, maxLevel: 10 },
    // Pack skills
    { name: 'Baking',             minLifeStage: LifeStage.TEEN, maxLevel: 10, packId: await pack('Get to Work') },
    { name: 'DJ Mixing',          minLifeStage: LifeStage.TEEN, maxLevel: 10, packId: await pack('Get Together') },
    { name: 'Dancing',            minLifeStage: LifeStage.TEEN, maxLevel: 5,  packId: await pack('Get Together') },
    { name: 'Flower Arranging',   minLifeStage: LifeStage.TEEN, maxLevel: 10, packId: await pack('Seasons') },
    { name: 'Skating',            minLifeStage: LifeStage.TEEN, maxLevel: 5,  packId: await pack('Seasons') },
    { name: 'Research & Debate',  minLifeStage: LifeStage.TEEN, maxLevel: 10, packId: await pack('Discover University') },
    { name: 'Fabrication',        minLifeStage: LifeStage.TEEN, maxLevel: 10, packId: await pack('Eco Lifestyle') },
    { name: 'Cross-Stitch',       minLifeStage: LifeStage.TEEN, maxLevel: 10, packId: await pack('Cottage Living') },
    { name: 'Horseback Riding',   minLifeStage: LifeStage.TEEN, maxLevel: 10, packId: await pack('Horse Ranch') },
  ]

  for (const s of skillSeed) {
    await prisma.skill.upsert({ where: { name: s.name }, update: {}, create: s })
  }

  // ── Careers ───────────────────────────────────────────────────────────────
  const careerSeed: Array<{
    name: string
    type: CareerType
    branchAName?: string
    branchBName?: string
    packId?: string
  }> = [
    // Standard careers — branch at level 5
    { name: 'Astronaut',       type: CareerType.STANDARD, branchAName: 'Space Ranger',       branchBName: 'Interstellar Smuggler' },
    { name: 'Athlete',         type: CareerType.STANDARD, branchAName: 'Professional Athlete', branchBName: 'Coach' },
    { name: 'Business',        type: CareerType.STANDARD, branchAName: 'Management',          branchBName: 'Investor' },
    { name: 'Criminal',        type: CareerType.STANDARD, branchAName: 'Boss',                branchBName: 'Oracle' },
    { name: 'Culinary',        type: CareerType.STANDARD, branchAName: 'Chef',                branchBName: 'Mixologist' },
    { name: 'Entertainer',     type: CareerType.STANDARD, branchAName: 'Musician',            branchBName: 'Comedian' },
    { name: 'Painter',         type: CareerType.STANDARD, branchAName: 'Master of the Real',  branchBName: 'Patron of the Arts' },
    { name: 'Secret Agent',    type: CareerType.STANDARD, branchAName: 'Villain',             branchBName: 'Diamond Agent' },
    { name: 'Style Influencer',type: CareerType.STANDARD, branchAName: 'Stylist',             branchBName: 'Trend Setter' },
    { name: 'Tech Guru',       type: CareerType.STANDARD, branchAName: 'eSport Gamer',        branchBName: 'Start-Up Entrepreneur' },
    { name: 'Writer',          type: CareerType.STANDARD, branchAName: 'Author',              branchBName: 'Journalist' },
    // Active careers (Get to Work) — no branching
    { name: 'Doctor',          type: CareerType.ACTIVE, packId: await pack('Get to Work') },
    { name: 'Detective',       type: CareerType.ACTIVE, packId: await pack('Get to Work') },
    { name: 'Scientist',       type: CareerType.ACTIVE, packId: await pack('Get to Work') },
    // Part-time — Teens only (base game)
    { name: 'Barista',         type: CareerType.PART_TIME },
    { name: 'Fast Food Employee', type: CareerType.PART_TIME },
    { name: 'Manual Laborer',  type: CareerType.PART_TIME },
    { name: 'Retail Employee', type: CareerType.PART_TIME },
  ]

  for (const c of careerSeed) {
    await prisma.career.upsert({ where: { name: c.name }, update: {}, create: c })
  }

  console.log('Seed complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
```

- [ ] Run:

```bash
npx prisma db seed
```

Expected: `Seed complete.`

- [ ] Open Prisma Studio and spot-check:

```bash
npm run db:studio
```

Navigate to `packs` — should show all packs. Navigate to `personality_traits` — should show adult + infant + toddler traits. Navigate to `aspirations` — should show child-only and adult aspirations with `bonusTraitId` populated.

- [ ] Commit:

```bash
git add prisma/seed.ts
git commit -m "feat(seed): populate reference data (packs, traits, aspirations, skills, careers)"
```

---

## Self-Review

**Spec coverage:**

| Spec section | Covered by task |
|---|---|
| Auth — User, Account, Session, VerificationToken | Task 3 |
| Pack + packId gating on all content | Task 2 |
| PersonalityTrait with category, minLifeStage, maxLifeStage | Task 2 |
| Trait (BONUS/REWARD/DEATH) | Task 2 |
| Aspiration with bonusTraitId, min/maxLifeStage | Task 2 |
| Skill with min/maxLifeStage, maxLevel (no SkillType enum) | Task 2 |
| Career with branchAName/branchBName | Task 2 |
| UserPack @@id composite | Task 4 |
| Legacy, Household, Sim (pronouns, occultType, causeOfDeath) | Task 4 |
| SimPersonalityTrait + SimTrait @@id composite | Task 5 |
| SimSkill @@id composite | Task 5 |
| SimAspiration completedAt (no status enum) | Task 5 |
| SimCareer with history (startedAt/endedAt, careerId nullable) | Task 5 |
| FamilyRelationship @@unique + @@index([toSimId]) | Task 6 |
| SocialRelationship @@unique([simAId,simBId]) + @@index([simBId]) | Task 6 |
| Migration | Task 7 |
| Seed for all reference data types | Task 8 |

No gaps found.

**Type consistency check:** All model names used in back-relations on `Sim` (`SimPersonalityTrait[]`, `SimTrait[]`, `SimSkill[]`, `SimAspiration[]`, `SimCareer[]`, `FamilyRelationship[]`, `SocialRelationship[]`) match the model names defined in Tasks 5 and 6. Named relation strings (`"FamilyFrom"`, `"FamilyTo"`, `"SocialA"`, `"SocialB"`, `"AspirationBonusTrait"`) match on both sides.
