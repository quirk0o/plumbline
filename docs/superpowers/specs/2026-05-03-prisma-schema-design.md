# Prisma Schema Design

## Context

SimsTrack-526 is a Next.js (App Router) + tRPC + Prisma app for tracking Sims 4 playthroughs. This schema covers:

- NextAuth user authentication
- Game reference data (traits, aspirations, skills, careers, packs) — seeded, rarely changes
- Playthrough structure (legacies, households, sims)
- Per-Sim state (traits, skills, aspirations, career history)
- Sim relationships (family tree + social)

**Files to modify:**
- `prisma/schema.prisma` — currently skeleton-only
- `prisma/seed.ts` — currently empty

---

## Key Design Decisions

| Decision | Choice | Reason |
|---|---|---|
| Auth | NextAuth adapter tables | Full auth support from day one |
| Personality traits | Split from `Trait` into `PersonalityTrait` | Different structure: category, life-stage slots, conflict rules |
| Infant/toddler traits | In `PersonalityTrait` with min/maxLifeStage | They are personality traits in the game |
| Hidden traits | Excluded entirely | Not tracked by players |
| Life-stage availability | `minLifeStage?` + `maxLifeStage?` on both `Skill` and `Aspiration` | Consistent approach; no separate type enum |
| DLC gating | Nullable `packId` FK on all content items | Enables JOIN-based filtering; base game = null |
| Family relationships | Store only direct parent-child edges (BIOLOGICAL / ADOPTIVE / STEP); derived labels computed at app layer | Adding a parent requires no cascading updates; recursive CTEs handle traversal at small scale (~200 Sims) |
| Social relationships | Undirected; service normalises pair order (simAId < simBId) | No duplicate rows; uniqueness enforced cleanly |
| Aspiration status | `completedAt DateTime?` — null = active | Eliminates redundant status enum |
| Career history | `SimCareer` with `startedAt`/`endedAt` | Full history; `endedAt null` = current job |
| Business rules | App layer (tRPC), not DB constraints | Conflict rules require multi-row checks; not expressible as CHECK constraints |

---

## Enums

```prisma
enum PackType          { BASE_GAME EXPANSION GAME_PACK STUFF_PACK KIT }
enum TraitType         { BONUS REWARD DEATH }
enum TraitCategory     { EMOTIONAL HOBBY LIFESTYLE SOCIAL }
enum AspirationCategory { ATHLETIC CREATIVITY DEVIANCE FAMILY FOOD FORTUNE
                          KNOWLEDGE LOVE NATURE POPULARITY }
enum CareerType        { STANDARD ACTIVE PART_TIME }
enum EmploymentType    { EMPLOYED SELF_EMPLOYED }
enum LifeStage         { NEWBORN INFANT TODDLER CHILD TEEN YOUNG_ADULT ADULT ELDER }
enum Gender            { MALE FEMALE NON_BINARY }
enum OccultType        { VAMPIRE SPELLCASTER MERMAID WEREWOLF FAIRY
                         ALIEN GHOST PLANT_SIM SERVO }
enum CauseOfDeath      { OLD_AGE DROWNING FIRE ELECTROCUTION HUNGER
                         OVEREXERTION EMBARRASSMENT ANGER LAUGHTER COWPLANT
                         PUFFERFISH MURPHY_BED STEAM POISON METEOR }
enum FamilyRelationshipType { BIOLOGICAL ADOPTIVE STEP }
enum RomanticStatus    { NONE DATING ENGAGED MARRIED EX_PARTNER WIDOWED }
```

---

## Tables

### Auth (NextAuth adapter)

| Model | Fields |
|---|---|
| `User` | `id` @cuid @id · `name?` · `email` @unique · `emailVerified DateTime?` · `image?` · timestamps |
| `Account` | `id` · `userId→User` (cascade) · `type` · `provider` · `providerAccountId` · OAuth token fields (`refresh_token?`, `access_token?`, `expires_at?`, `token_type?`, `scope?`, `id_token?`, `session_state?`) · `@@unique([provider, providerAccountId])` |
| `Session` | `id` · `sessionToken` @unique · `userId→User` (cascade) · `expires DateTime` |
| `VerificationToken` | `identifier` · `token` @unique · `expires DateTime` · `@@unique([identifier, token])` |

---

### Reference Data

| Model | Fields | Notes |
|---|---|---|
| `Pack` | `id` · `name` @unique · `type PackType` · timestamps | |
| `PersonalityTrait` | `id` · `name` @unique · `category TraitCategory?` · `minLifeStage LifeStage?` · `maxLifeStage LifeStage?` · `packId?→Pack` · timestamps | `category` null for infant/toddler traits |
| `Trait` | `id` · `name` @unique · `type TraitType` · `packId?→Pack` · timestamps | BONUS · REWARD · DEATH only |
| `Aspiration` | `id` · `name` @unique · `category AspirationCategory` · `bonusTraitId?→Trait` · `minLifeStage?` · `maxLifeStage?` · `packId?→Pack` · timestamps | `bonusTraitId` → a Trait of type BONUS |
| `Skill` | `id` · `name` @unique · `minLifeStage LifeStage?` · `maxLifeStage LifeStage?` · `maxLevel Int` · `packId?→Pack` · timestamps | No SkillType enum; grouping derived from life stage range |
| `Career` | `id` · `name` @unique · `type CareerType` · `branchAName?` · `branchBName?` · `packId?→Pack` · timestamps | Branch fields null for ACTIVE careers |

**Life-stage range examples:**

| Content type | minLifeStage | maxLifeStage |
|---|---|---|
| Infant personality traits | `INFANT` | `INFANT` |
| Toddler personality traits / skills | `TODDLER` | `TODDLER` |
| Child personality traits / skills | `CHILD` | `CHILD` |
| Teen-only aspiration | `TEEN` | `TEEN` |
| Adult skills (Teen+) | `TEEN` | `null` |
| Standard adult aspirations | `YOUNG_ADULT` | `null` |

---

### Playthrough

| Model | Fields | Notes |
|---|---|---|
| `UserPack` | `userId→User` · `packId→Pack` · `createdAt` · `@@id([userId, packId])` | Which packs a user has installed |
| `Legacy` | `id` · `name` · `userId→User` (cascade) · `founderSimId?→Sim` @unique (SetNull) · timestamps | `founderSimId` set after the founding Sim is created |
| `Household` | `id` · `name` · `legacyId→Legacy` (cascade) · timestamps | Max 8 Sims — enforced at app layer |
| `Sim` | `id` · `firstName` · `lastName` · `householdId→Household` (cascade) · `lifeStage LifeStage` · `gender Gender` · `pronounSubject String` · `pronounObject String` · `pronounPossessive String` · `occultType OccultType?` · `causeOfDeath CauseOfDeath?` · timestamps | `causeOfDeath` non-null = deceased |

---

### Sim State

| Model | Fields | Notes |
|---|---|---|
| `SimPersonalityTrait` | `simId→Sim` (cascade) · `personalityTraitId→PersonalityTrait` · `createdAt` · `@@id([simId, personalityTraitId])` | Slot limits + conflict rules enforced at app layer |
| `SimTrait` | `simId→Sim` (cascade) · `traitId→Trait` · `createdAt` · `@@id([simId, traitId])` | BONUS · REWARD · DEATH traits |
| `SimSkill` | `simId→Sim` (cascade) · `skillId→Skill` · `level Int` · `@@unique([simId, skillId])` · timestamps | |
| `SimAspiration` | `id` · `simId→Sim` (cascade) · `aspirationId→Aspiration` · `completedAt DateTime?` · `createdAt` · `@@unique([simId, aspirationId])` | `completedAt` null = active; earliest `createdAt` = first selection (source of bonus trait); one active per Sim enforced at app layer |
| `SimCareer` | `id` · `simId→Sim` (cascade) · `careerId?→Career` · `employmentType EmploymentType` · `level Int?` · `branch String?` · `customName String?` · `customGoal String?` · `startedAt DateTime` · `endedAt DateTime?` · timestamps | `careerId` null when self-employed; `endedAt` null = current; unemployed = no active record; one active per Sim enforced at app layer |

---

### Relationships

| Model | Fields | Notes |
|---|---|---|
| `FamilyRelationship` | `id` · `parentId→Sim` · `childId→Sim` · `type FamilyRelationshipType` @default(BIOLOGICAL) · `createdAt` · `@@unique([parentId, childId])` · `@@index([childId])` | Stores only direct parent-child edges; derived relationships (grandparent, sibling, in-law, etc.) are computed at the app layer |
| `SocialRelationship` | `id` · `simAId→Sim` · `simBId→Sim` · `friendshipScore Int` · `romanceScore Int` · `romanticStatus RomanticStatus` · timestamps · `@@unique([simAId, simBId])` · `@@index([simBId])` | Service layer always stores with simAId < simBId (lexicographic) to prevent duplicate pairs |

**Derived relationships (computed at app layer, not stored):**

| Label | How it's derived |
|---|---|
| Grandparent / Grandchild | 2-hop traversal up/down `FamilyRelationship` |
| Sibling | Shared `parentId` in `FamilyRelationship` |
| Half-sibling | Shared one parent only |
| Step-sibling | Shared step-parent (STEP type) |
| Aunt/Uncle · Niece/Nephew | Parent's sibling |
| Cousin | Parent's sibling's child |
| In-law | Spouse's parent / child's spouse (via `SocialRelationship`) |

---

## App-Layer Rules

These are enforced in tRPC service procedures, not DB constraints:

- Max 8 Sims per Household
- One active `SimCareer` (`endedAt = null`) per Sim at a time
- One active `SimAspiration` (`completedAt = null`) per Sim at a time
- Personality trait conflict pairs rejected before write (Good↔Evil, Neat↔Slob, etc.)
- `SimPersonalityTrait` count respects life-stage slot limits (Child: 1, Teen: 2, Young Adult+: 3, with Growing Together: up to 6)
- Monogamy: at most one `MARRIED` `romanticStatus` per Sim, unless High School Years pack installed
- `SocialRelationship` insert/upsert always normalises pair: `simAId < simBId` lexicographically

---

## Verification

```bash
npx prisma validate
npx prisma migrate dev --name init-schema
npx prisma db seed
npm run db:studio   # Prisma Studio at localhost:5555
```
