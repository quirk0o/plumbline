# Sim Detail Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a sim detail page at `/app/legacies/[slug]/sims/[id]` with per-field inline editing (save on blur/change) covering identity, traits, career, skills, family, and social relationships.

**Architecture:** Server component fetches all data (sim + reference data) in parallel and passes it to a client component tree. Each sub-component manages its own tRPC mutation — no global edit state. Fields save on blur (text) or on change (selects/pickers).

**Tech Stack:** Next.js 16 (app router, server components), tRPC, Prisma, React hook state, CSS modules, existing `TraitPicker` and `ImageUpload` components.

---

## Task 1: createTestSim helper + spec doc

**Files:**
- Modify: `src/test/helpers.ts`
- Create: `docs/superpowers/specs/2026-05-10-sim-detail-page-design.md` ← already done

- [ ] **Add `createTestSim` to `src/test/helpers.ts`**

Add after `createTestLegacy`:

```typescript
export async function createTestSim(
  legacyId: string,
  overrides: { firstName?: string; lastName?: string; gender?: import('@prisma/client').Gender } = {},
) {
  const { Gender, LifeStage } = await import('@prisma/client')
  let household = await db.household.findFirst({ where: { legacyId } })
  if (!household) {
    household = await db.household.create({ data: { name: 'Household 1', legacyId } })
  }
  return db.sim.create({
    data: {
      legacyId,
      householdId: household.id,
      firstName: overrides.firstName ?? 'Test',
      lastName: overrides.lastName ?? 'Sim',
      gender: overrides.gender ?? Gender.FEMALE,
      lifeStage: LifeStage.YOUNG_ADULT,
    },
  })
}
```

- [ ] **Run existing tests to confirm helper compiles**

```bash
npm test -- --run src/server/routers/sims.test.ts
```

Expected: all 5 existing tests pass.

- [ ] **Commit**

```bash
git add src/test/helpers.ts docs/superpowers/specs/2026-05-10-sim-detail-page-design.md
git commit -m "feat(sim-detail): add createTestSim helper and spec doc"
```

---

## Task 2: sims.getById + sims.listByLegacy

**Files:**
- Modify: `src/server/routers/sims.ts`
- Modify: `src/server/routers/sims.test.ts`

- [ ] **Write failing tests** in `src/server/routers/sims.test.ts`

Add after the existing `describe('sims.create', ...)` block:

```typescript
describe('sims.getById', () => {
  let userId: string
  let legacyId: string
  let simId: string

  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
    const legacy = await createTestLegacy(userId)
    legacyId = legacy.id
    const sim = await createTestSim(legacyId)
    simId = sim.id
  })

  afterEach(async () => {
    await cleanupUser(userId)
  })

  it('returns the sim with nested relations for the owner', async () => {
    const caller = authedCaller(userId)
    const result = await caller.sims.getById({ id: simId })
    expect(result.id).toBe(simId)
    expect(result.personalityTraits).toBeDefined()
    expect(result.skills).toBeDefined()
  })

  it('throws NOT_FOUND when the sim belongs to a different user', async () => {
    const other = await createTestUser()
    try {
      await expect(
        authedCaller(other.id).sims.getById({ id: simId })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    } finally {
      await cleanupUser(other.id)
    }
  })
})

describe('sims.listByLegacy', () => {
  let userId: string
  let legacyId: string

  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
    const legacy = await createTestLegacy(userId)
    legacyId = legacy.id
    await createTestSim(legacyId, { firstName: 'Alice' })
    await createTestSim(legacyId, { firstName: 'Bob' })
  })

  afterEach(async () => {
    await cleanupUser(userId)
  })

  it('returns all sims in the legacy', async () => {
    const result = await authedCaller(userId).sims.listByLegacy({ legacyId })
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ firstName: expect.any(String), imageUrl: null })
  })

  it('throws NOT_FOUND for a legacy belonging to another user', async () => {
    const other = await createTestUser()
    try {
      await expect(
        authedCaller(other.id).sims.listByLegacy({ legacyId })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    } finally {
      await cleanupUser(other.id)
    }
  })
})
```

Also add `createTestSim` to the imports at the top of the file:
```typescript
import {
  createTestUser,
  cleanupUser,
  createTestLegacy,
  createTestSim,
  getAnyTrait,
  getConflictingTraits,
} from '@/test/helpers'
```

- [ ] **Run tests — verify they fail**

```bash
npm test -- --run src/server/routers/sims.test.ts
```

Expected: new tests fail with "sims.getById is not a function".

- [ ] **Implement `getById` and `listByLegacy` in `src/server/routers/sims.ts`**

Add to the `simsRouter` object, after `create`:

```typescript
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const sim = await ctx.db.sim.findFirst({
        where: { id: input.id, legacy: { userId } },
        include: {
          personalityTraits: { include: { personalityTrait: true } },
          aspirations: { include: { aspiration: true } },
          careers: { include: { career: true } },
          skills: { include: { skill: true } },
          parentsOf: {
            include: { child: { select: { id: true, firstName: true, lastName: true, imageUrl: true } } },
          },
          childOf: {
            include: { parent: { select: { id: true, firstName: true, lastName: true, imageUrl: true } } },
          },
          socialRelationshipsA: {
            include: { simB: { select: { id: true, firstName: true, lastName: true, imageUrl: true } } },
          },
          socialRelationshipsB: {
            include: { simA: { select: { id: true, firstName: true, lastName: true, imageUrl: true } } },
          },
        },
      })
      if (!sim) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sim not found' })
      return sim
    }),

  listByLegacy: protectedProcedure
    .input(z.object({ legacyId: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const legacy = await ctx.db.legacy.findFirst({ where: { id: input.legacyId, userId } })
      if (!legacy) throw new TRPCError({ code: 'NOT_FOUND', message: 'Legacy not found' })
      return ctx.db.sim.findMany({
        where: { legacyId: input.legacyId },
        select: { id: true, firstName: true, lastName: true, imageUrl: true },
        orderBy: { firstName: 'asc' },
      })
    }),
```

- [ ] **Run tests — verify they pass**

```bash
npm test -- --run src/server/routers/sims.test.ts
```

Expected: all tests pass.

- [ ] **Commit**

```bash
git add src/server/routers/sims.ts src/server/routers/sims.test.ts
git commit -m "feat(sim-detail): add sims.getById and sims.listByLegacy procedures"
```

---

## Task 3: sims.update

**Files:**
- Modify: `src/server/routers/sims.ts`
- Modify: `src/server/routers/sims.test.ts`

- [ ] **Add imports** to `sims.ts`. Replace the existing import line:

```typescript
import { Gender, LifeStage, OccultType, EmploymentType, CauseOfDeath } from '@prisma/client'
```

- [ ] **Write failing tests**

Add to `sims.test.ts`:

```typescript
describe('sims.update', () => {
  let userId: string
  let legacyId: string
  let simId: string

  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
    const legacy = await createTestLegacy(userId)
    legacyId = legacy.id
    const sim = await createTestSim(legacyId)
    simId = sim.id
  })

  afterEach(async () => {
    await cleanupUser(userId)
  })

  it('updates scalar fields', async () => {
    const { LifeStage } = await import('@prisma/client')
    await authedCaller(userId).sims.update({ id: simId, firstName: 'Nova', lifeStage: LifeStage.ELDER })
    const record = await db.sim.findUnique({ where: { id: simId } })
    expect(record?.firstName).toBe('Nova')
    expect(record?.lifeStage).toBe('ELDER')
  })

  it('sets cause of death', async () => {
    const { CauseOfDeath } = await import('@prisma/client')
    await authedCaller(userId).sims.update({ id: simId, causeOfDeath: CauseOfDeath.OLD_AGE })
    const record = await db.sim.findUnique({ where: { id: simId } })
    expect(record?.causeOfDeath).toBe('OLD_AGE')
  })

  it('swaps aspiration', async () => {
    const aspiration = await db.aspiration.findFirst()
    if (!aspiration) return
    await authedCaller(userId).sims.update({ id: simId, aspirationId: aspiration.id })
    const rows = await db.simAspiration.findMany({ where: { simId, completedAt: null } })
    expect(rows).toHaveLength(1)
    expect(rows[0].aspirationId).toBe(aspiration.id)
  })

  it('throws NOT_FOUND for another user\'s sim', async () => {
    const other = await createTestUser()
    try {
      await expect(
        authedCaller(other.id).sims.update({ id: simId, firstName: 'Hacker' })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    } finally {
      await cleanupUser(other.id)
    }
  })
})
```

- [ ] **Run tests — verify they fail**

```bash
npm test -- --run src/server/routers/sims.test.ts
```

- [ ] **Implement `sims.update` in `sims.ts`**

Add after `listByLegacy`:

```typescript
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        firstName: z.string().min(1).max(50).optional(),
        lastName: z.string().min(1).max(50).optional(),
        gender: z.nativeEnum(Gender).optional(),
        lifeStage: z.nativeEnum(LifeStage).optional(),
        pronounSubject: z.string().max(20).nullable().optional(),
        pronounObject: z.string().max(20).nullable().optional(),
        pronounPossessive: z.string().max(20).nullable().optional(),
        imageUrl: imageUrlSchema.nullable().optional(),
        occultType: z.nativeEnum(OccultType).nullable().optional(),
        causeOfDeath: z.nativeEnum(CauseOfDeath).nullable().optional(),
        aspirationId: z.string().nullable().optional(),
        careerId: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const sim = await ctx.db.sim.findFirst({ where: { id: input.id, legacy: { userId } } })
      if (!sim) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sim not found' })

      const { id, aspirationId, careerId, ...fields } = input

      if (aspirationId !== undefined) {
        await ctx.db.simAspiration.deleteMany({ where: { simId: id, completedAt: null } })
        if (aspirationId) await ctx.db.simAspiration.create({ data: { simId: id, aspirationId } })
      }

      if (careerId !== undefined) {
        await ctx.db.simCareer.deleteMany({ where: { simId: id, endedAt: null } })
        if (careerId) {
          await ctx.db.simCareer.create({
            data: { simId: id, careerId, employmentType: EmploymentType.EMPLOYED, startedAt: new Date() },
          })
        }
      }

      return ctx.db.sim.update({ where: { id }, data: fields })
    }),
```

- [ ] **Run tests — verify they pass**

```bash
npm test -- --run src/server/routers/sims.test.ts
```

- [ ] **Commit**

```bash
git add src/server/routers/sims.ts src/server/routers/sims.test.ts
git commit -m "feat(sim-detail): add sims.update procedure"
```

---

## Task 4: sims.addTrait + sims.removeTrait

**Files:**
- Modify: `src/server/routers/sims.ts`
- Modify: `src/server/routers/sims.test.ts`

- [ ] **Write failing tests**

```typescript
describe('sims.addTrait / sims.removeTrait', () => {
  let userId: string
  let legacyId: string
  let simId: string

  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
    const legacy = await createTestLegacy(userId)
    legacyId = legacy.id
    const sim = await createTestSim(legacyId)
    simId = sim.id
  })

  afterEach(async () => {
    await cleanupUser(userId)
  })

  it('adds a trait', async () => {
    const trait = await getAnyTrait()
    await authedCaller(userId).sims.addTrait({ simId, traitId: trait.id })
    const rows = await db.simPersonalityTrait.findMany({ where: { simId } })
    expect(rows).toHaveLength(1)
  })

  it('removes a trait', async () => {
    const trait = await getAnyTrait()
    await db.simPersonalityTrait.create({ data: { simId, personalityTraitId: trait.id } })
    await authedCaller(userId).sims.removeTrait({ simId, traitId: trait.id })
    const rows = await db.simPersonalityTrait.findMany({ where: { simId } })
    expect(rows).toHaveLength(0)
  })

  it('throws BAD_REQUEST when adding a conflicting trait', async () => {
    const { traitA, traitB } = await getConflictingTraits()
    await db.simPersonalityTrait.create({ data: { simId, personalityTraitId: traitA.id } })
    await expect(
      authedCaller(userId).sims.addTrait({ simId, traitId: traitB.id })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('throws BAD_REQUEST when already at 6 traits', async () => {
    const traits = await db.personalityTrait.findMany({ take: 7 })
    if (traits.length < 7) return // not enough seed data
    for (const t of traits.slice(0, 6)) {
      await db.simPersonalityTrait.create({ data: { simId, personalityTraitId: t.id } })
    }
    await expect(
      authedCaller(userId).sims.addTrait({ simId, traitId: traits[6].id })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })
})
```

- [ ] **Run tests — verify they fail**

```bash
npm test -- --run src/server/routers/sims.test.ts
```

- [ ] **Implement in `sims.ts`**

Add after `update`:

```typescript
  addTrait: protectedProcedure
    .input(z.object({ simId: z.string(), traitId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const sim = await ctx.db.sim.findFirst({
        where: { id: input.simId, legacy: { userId } },
        include: { personalityTraits: { select: { personalityTraitId: true } } },
      })
      if (!sim) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sim not found' })
      if (sim.personalityTraits.length >= 6)
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Maximum 6 traits allowed' })
      const currentIds = sim.personalityTraits.map((t) => t.personalityTraitId)
      await assertNoTraitConflicts(ctx.db, [...currentIds, input.traitId])
      return ctx.db.simPersonalityTrait.create({
        data: { simId: input.simId, personalityTraitId: input.traitId },
      })
    }),

  removeTrait: protectedProcedure
    .input(z.object({ simId: z.string(), traitId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const sim = await ctx.db.sim.findFirst({ where: { id: input.simId, legacy: { userId } } })
      if (!sim) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sim not found' })
      return ctx.db.simPersonalityTrait.delete({
        where: {
          simId_personalityTraitId: { simId: input.simId, personalityTraitId: input.traitId },
        },
      })
    }),
```

- [ ] **Run tests — verify they pass**

```bash
npm test -- --run src/server/routers/sims.test.ts
```

- [ ] **Commit**

```bash
git add src/server/routers/sims.ts src/server/routers/sims.test.ts
git commit -m "feat(sim-detail): add sims.addTrait and sims.removeTrait"
```

---

## Task 5: Skill procedures + fetchSkills

**Files:**
- Modify: `src/server/routers/sims.ts`
- Modify: `src/server/routers/sims.test.ts`
- Modify: `src/lib/reference-data.ts`

- [ ] **Add `fetchSkills()` to `src/lib/reference-data.ts`**

```typescript
export async function fetchSkills() {
  return db.skill.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, maxLevel: true },
  })
}
```

- [ ] **Write failing tests**

```typescript
describe('sims.addSkill / sims.setSkillLevel / sims.removeSkill', () => {
  let userId: string
  let legacyId: string
  let simId: string

  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
    const legacy = await createTestLegacy(userId)
    legacyId = legacy.id
    const sim = await createTestSim(legacyId)
    simId = sim.id
  })

  afterEach(async () => {
    await cleanupUser(userId)
  })

  it('adds a skill at the given level', async () => {
    const skill = await db.skill.findFirst()
    if (!skill) return
    await authedCaller(userId).sims.addSkill({ simId, skillId: skill.id, level: 1 })
    const row = await db.simSkill.findUnique({ where: { simId_skillId: { simId, skillId: skill.id } } })
    expect(row?.level).toBe(1)
  })

  it('throws BAD_REQUEST when level exceeds maxLevel', async () => {
    const skill = await db.skill.findFirst()
    if (!skill) return
    await expect(
      authedCaller(userId).sims.addSkill({ simId, skillId: skill.id, level: skill.maxLevel + 1 })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('updates skill level', async () => {
    const skill = await db.skill.findFirst()
    if (!skill) return
    await db.simSkill.create({ data: { simId, skillId: skill.id, level: 1 } })
    await authedCaller(userId).sims.setSkillLevel({ simId, skillId: skill.id, level: 3 })
    const row = await db.simSkill.findUnique({ where: { simId_skillId: { simId, skillId: skill.id } } })
    expect(row?.level).toBe(3)
  })

  it('removes a skill', async () => {
    const skill = await db.skill.findFirst()
    if (!skill) return
    await db.simSkill.create({ data: { simId, skillId: skill.id, level: 2 } })
    await authedCaller(userId).sims.removeSkill({ simId, skillId: skill.id })
    const row = await db.simSkill.findUnique({ where: { simId_skillId: { simId, skillId: skill.id } } })
    expect(row).toBeNull()
  })
})
```

- [ ] **Run tests — verify they fail**

```bash
npm test -- --run src/server/routers/sims.test.ts
```

- [ ] **Implement in `sims.ts`**

```typescript
  addSkill: protectedProcedure
    .input(z.object({ simId: z.string(), skillId: z.string(), level: z.number().int().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const sim = await ctx.db.sim.findFirst({ where: { id: input.simId, legacy: { userId } } })
      if (!sim) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sim not found' })
      const skill = await ctx.db.skill.findUnique({ where: { id: input.skillId } })
      if (!skill) throw new TRPCError({ code: 'NOT_FOUND', message: 'Skill not found' })
      if (input.level > skill.maxLevel)
        throw new TRPCError({ code: 'BAD_REQUEST', message: `Level cannot exceed ${skill.maxLevel}` })
      return ctx.db.simSkill.upsert({
        where: { simId_skillId: { simId: input.simId, skillId: input.skillId } },
        create: { simId: input.simId, skillId: input.skillId, level: input.level },
        update: { level: input.level },
      })
    }),

  setSkillLevel: protectedProcedure
    .input(z.object({ simId: z.string(), skillId: z.string(), level: z.number().int().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const sim = await ctx.db.sim.findFirst({ where: { id: input.simId, legacy: { userId } } })
      if (!sim) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sim not found' })
      const skill = await ctx.db.skill.findUnique({ where: { id: input.skillId } })
      if (!skill) throw new TRPCError({ code: 'NOT_FOUND', message: 'Skill not found' })
      if (input.level > skill.maxLevel)
        throw new TRPCError({ code: 'BAD_REQUEST', message: `Level cannot exceed ${skill.maxLevel}` })
      return ctx.db.simSkill.update({
        where: { simId_skillId: { simId: input.simId, skillId: input.skillId } },
        data: { level: input.level },
      })
    }),

  removeSkill: protectedProcedure
    .input(z.object({ simId: z.string(), skillId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const sim = await ctx.db.sim.findFirst({ where: { id: input.simId, legacy: { userId } } })
      if (!sim) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sim not found' })
      return ctx.db.simSkill.delete({
        where: { simId_skillId: { simId: input.simId, skillId: input.skillId } },
      })
    }),
```

- [ ] **Run tests — verify they pass**

```bash
npm test -- --run src/server/routers/sims.test.ts
```

- [ ] **Commit**

```bash
git add src/server/routers/sims.ts src/server/routers/sims.test.ts src/lib/reference-data.ts
git commit -m "feat(sim-detail): add skill procedures and fetchSkills helper"
```

---

## Task 6: Family relationship procedures

**Files:**
- Modify: `src/server/routers/sims.ts`
- Modify: `src/server/routers/sims.test.ts`

- [ ] **Add import** to `sims.ts`:

```typescript
import { Gender, LifeStage, OccultType, EmploymentType, CauseOfDeath, FamilyRelationshipType } from '@prisma/client'
```

- [ ] **Write failing tests**

```typescript
describe('sims.addFamilyRelationship / sims.removeFamilyRelationship', () => {
  let userId: string
  let legacyId: string
  let parentId: string
  let childId: string

  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
    const legacy = await createTestLegacy(userId)
    legacyId = legacy.id
    const parent = await createTestSim(legacyId, { firstName: 'Parent' })
    const child = await createTestSim(legacyId, { firstName: 'Child' })
    parentId = parent.id
    childId = child.id
  })

  afterEach(async () => {
    await cleanupUser(userId)
  })

  it('creates a family relationship', async () => {
    const { FamilyRelationshipType } = await import('@prisma/client')
    await authedCaller(userId).sims.addFamilyRelationship({
      parentId,
      childId,
      type: FamilyRelationshipType.BIOLOGICAL,
    })
    const row = await db.familyRelationship.findUnique({
      where: { parentId_childId: { parentId, childId } },
    })
    expect(row?.type).toBe('BIOLOGICAL')
  })

  it('removes a family relationship', async () => {
    await db.familyRelationship.create({ data: { parentId, childId, type: 'BIOLOGICAL' } })
    await authedCaller(userId).sims.removeFamilyRelationship({ parentId, childId })
    const row = await db.familyRelationship.findUnique({
      where: { parentId_childId: { parentId, childId } },
    })
    expect(row).toBeNull()
  })

  it('throws NOT_FOUND when parent belongs to another user', async () => {
    const other = await createTestUser()
    const otherLegacy = await createTestLegacy(other.id)
    const otherSim = await createTestSim(otherLegacy.id)
    try {
      const { FamilyRelationshipType } = await import('@prisma/client')
      await expect(
        authedCaller(userId).sims.addFamilyRelationship({
          parentId: otherSim.id,
          childId,
          type: FamilyRelationshipType.BIOLOGICAL,
        })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    } finally {
      await cleanupUser(other.id)
    }
  })
})
```

- [ ] **Run tests — verify they fail**

```bash
npm test -- --run src/server/routers/sims.test.ts
```

- [ ] **Implement in `sims.ts`**

```typescript
  addFamilyRelationship: protectedProcedure
    .input(
      z.object({
        parentId: z.string(),
        childId: z.string(),
        type: z.nativeEnum(FamilyRelationshipType),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const [parent, child] = await Promise.all([
        ctx.db.sim.findFirst({ where: { id: input.parentId, legacy: { userId } } }),
        ctx.db.sim.findFirst({ where: { id: input.childId, legacy: { userId } } }),
      ])
      if (!parent || !child) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sim not found' })
      return ctx.db.familyRelationship.create({
        data: { parentId: input.parentId, childId: input.childId, type: input.type },
      })
    }),

  removeFamilyRelationship: protectedProcedure
    .input(z.object({ parentId: z.string(), childId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const sim = await ctx.db.sim.findFirst({ where: { id: input.parentId, legacy: { userId } } })
      if (!sim) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sim not found' })
      return ctx.db.familyRelationship.delete({
        where: { parentId_childId: { parentId: input.parentId, childId: input.childId } },
      })
    }),
```

- [ ] **Run tests — verify they pass**

```bash
npm test -- --run src/server/routers/sims.test.ts
```

- [ ] **Commit**

```bash
git add src/server/routers/sims.ts src/server/routers/sims.test.ts
git commit -m "feat(sim-detail): add family relationship procedures"
```

---

## Task 7: Social relationship procedures

**Files:**
- Modify: `src/server/routers/sims.ts`
- Modify: `src/server/routers/sims.test.ts`

- [ ] **Add `RomanticStatus` to imports in `sims.ts`**:

```typescript
import {
  Gender, LifeStage, OccultType, EmploymentType, CauseOfDeath,
  FamilyRelationshipType, RomanticStatus,
} from '@prisma/client'
```

- [ ] **Write failing tests**

```typescript
describe('sims.addSocialRelationship / sims.updateSocialRelationship / sims.removeSocialRelationship', () => {
  let userId: string
  let legacyId: string
  let simAId: string
  let simBId: string

  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
    const legacy = await createTestLegacy(userId)
    legacyId = legacy.id
    const simA = await createTestSim(legacyId, { firstName: 'Alpha' })
    const simB = await createTestSim(legacyId, { firstName: 'Beta' })
    ;[simAId, simBId] = [simA.id, simB.id].sort()
  })

  afterEach(async () => {
    await cleanupUser(userId)
  })

  it('creates a social relationship with normalised IDs', async () => {
    await authedCaller(userId).sims.addSocialRelationship({
      simAId,
      simBId,
      romanticStatus: 'NONE',
    })
    const row = await db.socialRelationship.findUnique({
      where: { simAId_simBId: { simAId, simBId } },
    })
    expect(row).not.toBeNull()
    expect(row?.friendshipScore).toBe(0)
  })

  it('normalises ID order regardless of input order', async () => {
    await authedCaller(userId).sims.addSocialRelationship({
      simAId: simBId,
      simBId: simAId,
      romanticStatus: 'NONE',
    })
    const row = await db.socialRelationship.findUnique({
      where: { simAId_simBId: { simAId, simBId } },
    })
    expect(row).not.toBeNull()
  })

  it('updates romantic status', async () => {
    await db.socialRelationship.create({
      data: { simAId, simBId, romanticStatus: 'NONE', friendshipScore: 0, romanceScore: 0 },
    })
    await authedCaller(userId).sims.updateSocialRelationship({
      simAId,
      simBId,
      romanticStatus: 'MARRIED',
    })
    const row = await db.socialRelationship.findUnique({
      where: { simAId_simBId: { simAId, simBId } },
    })
    expect(row?.romanticStatus).toBe('MARRIED')
  })

  it('removes the relationship', async () => {
    await db.socialRelationship.create({
      data: { simAId, simBId, romanticStatus: 'NONE', friendshipScore: 0, romanceScore: 0 },
    })
    await authedCaller(userId).sims.removeSocialRelationship({ simAId, simBId })
    const row = await db.socialRelationship.findUnique({
      where: { simAId_simBId: { simAId, simBId } },
    })
    expect(row).toBeNull()
  })
})
```

- [ ] **Run tests — verify they fail**

```bash
npm test -- --run src/server/routers/sims.test.ts
```

- [ ] **Implement in `sims.ts`**

```typescript
  addSocialRelationship: protectedProcedure
    .input(
      z.object({
        simAId: z.string(),
        simBId: z.string(),
        romanticStatus: z.nativeEnum(RomanticStatus).default('NONE'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const [simA, simB] = await Promise.all([
        ctx.db.sim.findFirst({ where: { id: input.simAId, legacy: { userId } } }),
        ctx.db.sim.findFirst({ where: { id: input.simBId, legacy: { userId } } }),
      ])
      if (!simA || !simB) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sim not found' })
      const [normalA, normalB] = [input.simAId, input.simBId].sort()
      return ctx.db.socialRelationship.create({
        data: {
          simAId: normalA,
          simBId: normalB,
          romanticStatus: input.romanticStatus,
          friendshipScore: 0,
          romanceScore: 0,
        },
      })
    }),

  updateSocialRelationship: protectedProcedure
    .input(
      z.object({
        simAId: z.string(),
        simBId: z.string(),
        romanticStatus: z.nativeEnum(RomanticStatus),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const sim = await ctx.db.sim.findFirst({ where: { id: input.simAId, legacy: { userId } } })
      if (!sim) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sim not found' })
      const [normalA, normalB] = [input.simAId, input.simBId].sort()
      return ctx.db.socialRelationship.update({
        where: { simAId_simBId: { simAId: normalA, simBId: normalB } },
        data: { romanticStatus: input.romanticStatus },
      })
    }),

  removeSocialRelationship: protectedProcedure
    .input(z.object({ simAId: z.string(), simBId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const sim = await ctx.db.sim.findFirst({ where: { id: input.simAId, legacy: { userId } } })
      if (!sim) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sim not found' })
      const [normalA, normalB] = [input.simAId, input.simBId].sort()
      return ctx.db.socialRelationship.delete({
        where: { simAId_simBId: { simAId: normalA, simBId: normalB } },
      })
    }),
```

- [ ] **Run all tests + lint + types**

```bash
npm test
npx tsc --noEmit
npm run lint
```

Expected: all pass, no errors.

- [ ] **Commit**

```bash
git add src/server/routers/sims.ts src/server/routers/sims.test.ts
git commit -m "feat(sim-detail): add social relationship procedures"
```

---

## Task 8: Server component page + navigation wiring

**Files:**
- Create: `src/app/app/legacies/[slug]/sims/[id]/page.tsx`
- Create: `src/app/app/legacies/[slug]/sims/[id]/page.module.css`
- Modify: `src/app/app/legacies/[slug]/page.tsx`

- [ ] **Create the server component** at `src/app/app/legacies/[slug]/sims/[id]/page.tsx`

```tsx
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { db } from '@/server/db'
import { fetchTraitsWithConflicts, fetchAspirations, fetchCareers, fetchSkills } from '@/lib/reference-data'
import { SimDetailClient } from './sim-detail-client'

interface Props {
  params: Promise<{ slug: string; id: string }>
}

export default async function SimDetailPage({ params }: Props) {
  const { slug, id } = await params
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin')

  const userId = session.user.id

  const [sim, legacySims, traits, aspirations, careers, skills] = await Promise.all([
    db.sim.findFirst({
      where: { id, legacy: { slug, userId } },
      include: {
        personalityTraits: { include: { personalityTrait: true } },
        aspirations: { include: { aspiration: true } },
        careers: { include: { career: true } },
        skills: { include: { skill: true } },
        parentsOf: {
          include: { child: { select: { id: true, firstName: true, lastName: true, imageUrl: true } } },
        },
        childOf: {
          include: { parent: { select: { id: true, firstName: true, lastName: true, imageUrl: true } } },
        },
        socialRelationshipsA: {
          include: { simB: { select: { id: true, firstName: true, lastName: true, imageUrl: true } } },
        },
        socialRelationshipsB: {
          include: { simA: { select: { id: true, firstName: true, lastName: true, imageUrl: true } } },
        },
      },
    }),
    db.sim.findMany({
      where: { legacy: { slug, userId } },
      select: { id: true, firstName: true, lastName: true, imageUrl: true },
      orderBy: { firstName: 'asc' },
    }),
    fetchTraitsWithConflicts(),
    fetchAspirations(),
    fetchCareers(),
    fetchSkills(),
  ])

  if (!sim) notFound()

  return (
    <SimDetailClient
      sim={sim}
      slug={slug}
      legacySims={legacySims}
      traits={traits}
      aspirations={aspirations}
      careers={careers}
      skills={skills}
    />
  )
}
```

- [ ] **Create CSS module** at `src/app/app/legacies/[slug]/sims/[id]/page.module.css`

```css
.page {
  max-width: 720px;
  margin: 0 auto;
  padding: var(--space-6) var(--space-4);
}

.breadcrumb {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-bottom: var(--space-5);
}

.breadcrumb a {
  color: var(--green);
  text-decoration: none;
}

.breadcrumb a:hover {
  text-decoration: underline;
}

.section {
  margin-bottom: var(--space-7);
  padding-bottom: var(--space-7);
  border-bottom: 1px solid var(--border);
}

.section:last-child {
  border-bottom: none;
}

.sectionTitle {
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  margin-bottom: var(--space-4);
}

/* Identity hero */
.hero {
  display: flex;
  gap: var(--space-5);
  align-items: flex-start;
  margin-bottom: var(--space-7);
  padding-bottom: var(--space-7);
  border-bottom: 1px solid var(--border);
}

.heroMeta {
  flex: 1;
  min-width: 0;
}

.nameRow {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
  flex-wrap: wrap;
  margin-bottom: var(--space-3);
}

.metaRow {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
  align-items: center;
  margin-bottom: var(--space-2);
}

/* Editable primitives */
.editableText {
  font-family: var(--font-display);
  font-size: 1.625rem;
  font-weight: 600;
  background: transparent;
  border: none;
  border-bottom: 2px dashed transparent;
  padding: 0 2px;
  color: var(--text);
  cursor: pointer;
  min-width: 4ch;
  max-width: 200px;
}

.editableText:hover {
  border-bottom-color: var(--green);
}

.editableText:focus {
  outline: none;
  border-bottom-color: var(--green);
  background: var(--bg-card);
  border-radius: 3px;
}

.editableChip {
  font-size: 0.75rem;
  padding: 3px 10px;
  border-radius: 99px;
  border: 1px solid var(--border);
  cursor: pointer;
  background: transparent;
  color: var(--text);
  appearance: none;
}

.editableChip:hover {
  border-color: var(--green);
  background: var(--bg-card);
}

.inlineError {
  font-size: 0.6875rem;
  color: var(--destructive, #b91c1c);
  display: block;
  margin-top: 2px;
}

/* Trait chips */
.traitList {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
}

.traitChip {
  font-size: 0.8125rem;
  padding: 4px 10px 4px 12px;
  border-radius: 99px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 6px;
}

.traitRemove {
  cursor: pointer;
  color: var(--text-muted);
  line-height: 1;
  background: none;
  border: none;
  font-size: 1rem;
  padding: 0;
}

.traitRemove:hover {
  color: var(--destructive, #b91c1c);
}

.addChip {
  font-size: 0.8125rem;
  padding: 4px 12px;
  border-radius: 99px;
  border: 1px dashed var(--text-muted);
  cursor: pointer;
  color: var(--text-muted);
  background: transparent;
}

.addChip:hover {
  border-color: var(--green);
  color: var(--green);
}

/* Two-column goals */
.twoCol {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-5);
}

@media (max-width: 480px) {
  .twoCol { grid-template-columns: 1fr; }
}

.fieldLabel {
  font-size: 0.6875rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  margin-bottom: var(--space-1);
  display: block;
}

/* Skill pip bar */
.skillList {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.skillRow {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.skillName {
  flex: 1;
  font-size: 0.875rem;
}

.pipBar {
  display: flex;
  gap: 3px;
}

.pip {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  background: var(--border);
  cursor: pointer;
  border: none;
  padding: 0;
}

.pip.filled {
  background: var(--green);
}

.pip:hover {
  background: var(--amber);
}

.removeBtn {
  font-size: 0.75rem;
  color: var(--text-muted);
  cursor: pointer;
  background: none;
  border: none;
  padding: 0 4px;
}

.removeBtn:hover {
  color: var(--destructive, #b91c1c);
}

/* Portrait card grid — same pattern as legacy page */
.simCards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
  gap: var(--space-4);
}

.simCard {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  text-decoration: none;
  color: var(--text);
  position: relative;
}

.simPortraitWrap {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  overflow: hidden;
  position: relative;
  background: var(--green);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid transparent;
  transition: border-color 0.15s;
}

.simCard:hover .simPortraitWrap {
  border-color: var(--green);
}

.simInitials {
  font-family: var(--font-display);
  font-size: 1.25rem;
  color: white;
}

.simCardName {
  font-size: 0.75rem;
  text-align: center;
  line-height: 1.3;
}

.simCardSub {
  font-size: 0.6875rem;
  color: var(--text-muted);
  text-align: center;
}

.simCardRemove {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--bg-card);
  border: 1px solid var(--border);
  cursor: pointer;
  font-size: 0.75rem;
  display: none;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
}

.simCard:hover .simCardRemove {
  display: flex;
}

.simCardRemove:hover {
  color: var(--destructive, #b91c1c);
  border-color: var(--destructive, #b91c1c);
}

/* Add card */
.addCard .simPortraitWrap {
  background: transparent;
  border: 2px dashed var(--text-muted);
}

.addCard:hover .simPortraitWrap {
  border-color: var(--green);
}

.addCardIcon {
  font-size: 1.5rem;
  color: var(--text-muted);
}

.addCard:hover .addCardIcon {
  color: var(--green);
}

/* Modal overlay */
.modalOverlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}

.modal {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  width: min(480px, calc(100vw - var(--space-8)));
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.modalTitle {
  font-family: var(--font-display);
  font-size: 1.25rem;
  font-weight: 600;
}

.modalActions {
  display: flex;
  gap: var(--space-3);
  justify-content: flex-end;
  margin-top: var(--space-2);
}

/* Trait picker overlay */
.pickerOverlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}

.pickerBox {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  width: min(560px, calc(100vw - var(--space-8)));
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: var(--shadow-lg);
}

.pickerClose {
  display: flex;
  justify-content: flex-end;
  margin-bottom: var(--space-3);
}

/* Death section */
.deathButton {
  margin-top: var(--space-4);
}
```

- [ ] **Wrap sim portraits in Link** in `src/app/app/legacies/[slug]/page.tsx`

Replace the `<li>` block (lines 117–140) with:

```tsx
            {legacy.sims.map((sim) => (
              <li key={sim.id} className={styles.simCard}>
                <Link href={`/app/legacies/${slug}/sims/${sim.id}`} className={styles.simCardLink}>
                  <div className={styles.simPortraitWrap}>
                    {sim.imageUrl ? (
                      <Image
                        src={sim.imageUrl}
                        alt={sim.firstName}
                        fill
                        className={styles.simPortrait}
                        sizes="200px"
                      />
                    ) : (
                      <span className={styles.simInitials} aria-hidden="true">
                        {sim.firstName[0]}{sim.lastName[0]}
                      </span>
                    )}
                  </div>
                  <span className={styles.simName}>
                    {sim.firstName} {sim.lastName}
                  </span>
                </Link>
              </li>
            ))}
```

Then add `.simCardLink` to `src/app/app/legacies/[slug]/page.module.css`:

```css
.simCardLink {
  display: contents;
  text-decoration: none;
  color: inherit;
}
```

- [ ] **Run type check**

```bash
npx tsc --noEmit
```

Expected: no errors (SimDetailClient doesn't exist yet — that's fine, the page won't compile until Task 9).

- [ ] **Commit**

```bash
git add src/app/app/legacies/[slug]/sims/[id]/ src/app/app/legacies/[slug]/page.tsx src/app/app/legacies/[slug]/page.module.css
git commit -m "feat(sim-detail): server component page + navigation links"
```

---

## Task 9: SimDetailClient assembly + IdentitySection

**Files:**
- Create: `src/app/app/legacies/[slug]/sims/[id]/sim-detail-client.tsx`
- Create: `src/app/app/legacies/[slug]/sims/[id]/identity-section.tsx`

The `SimDetailClient` is the top-level `'use client'` wrapper. It renders each section. Sub-components each call their own mutations — no shared state flows through this component.

- [ ] **Create `sim-detail-client.tsx`**

```tsx
'use client'

import Link from 'next/link'
import type { Trait } from '@/app/components/trait-picker'
import { IdentitySection } from './identity-section'
import { TraitEditor } from './trait-editor'
import { GoalsSection } from './goals-section'
import { SkillEditor } from './skill-editor'
import { FamilyEditor } from './family-editor'
import { SocialEditor } from './social-editor'
import styles from './page.module.css'

type SimData = NonNullable<Awaited<ReturnType<typeof import('./page').default>>> extends never
  ? never
  : Parameters<typeof import('./identity-section').IdentitySection>[0]['sim']

// The sim type comes from Prisma include — derive it structurally.
interface Props {
  sim: {
    id: string
    firstName: string
    lastName: string
    gender: string
    lifeStage: string
    pronounSubject: string | null
    pronounObject: string | null
    pronounPossessive: string | null
    imageUrl: string | null
    occultType: string | null
    causeOfDeath: string | null
    legacyId: string
    personalityTraits: { personalityTrait: { id: string; name: string } }[]
    aspirations: { aspiration: { id: string; name: string; category: string } }[]
    careers: { career: { id: string; name: string; type: string } | null }[]
    skills: { skill: { id: string; name: string; maxLevel: number }; level: number }[]
    parentsOf: { child: { id: string; firstName: string; lastName: string; imageUrl: string | null }; type: string }[]
    childOf: { parent: { id: string; firstName: string; lastName: string; imageUrl: string | null }; type: string }[]
    socialRelationshipsA: { simB: { id: string; firstName: string; lastName: string; imageUrl: string | null }; romanticStatus: string }[]
    socialRelationshipsB: { simA: { id: string; firstName: string; lastName: string; imageUrl: string | null }; romanticStatus: string }[]
  }
  slug: string
  legacySims: { id: string; firstName: string; lastName: string; imageUrl: string | null }[]
  traits: Trait[]
  aspirations: { id: string; name: string; category: string }[]
  careers: { id: string; name: string; type: string }[]
  skills: { id: string; name: string; maxLevel: number }[]
}

export function SimDetailClient({ sim, slug, legacySims, traits, aspirations, careers, skills }: Props) {
  const legacyName = slug
    .split('-')
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(' ')

  return (
    <div className={styles.page}>
      <p className={styles.breadcrumb}>
        <Link href={`/app/legacies/${slug}`}>{legacyName}</Link>
        {' › '}
        {sim.firstName} {sim.lastName}
      </p>

      <IdentitySection sim={sim} />

      <section className={styles.section}>
        <p className={styles.sectionTitle}>Personality Traits</p>
        <TraitEditor sim={sim} traits={traits} />
      </section>

      <section className={styles.section}>
        <p className={styles.sectionTitle}>Goals &amp; Career</p>
        <GoalsSection sim={sim} aspirations={aspirations} careers={careers} />
      </section>

      <section className={styles.section}>
        <p className={styles.sectionTitle}>Skills</p>
        <SkillEditor sim={sim} allSkills={skills} />
      </section>

      <section className={styles.section}>
        <p className={styles.sectionTitle}>Family</p>
        <FamilyEditor sim={sim} slug={slug} legacySims={legacySims} />
      </section>

      <section className={styles.section}>
        <p className={styles.sectionTitle}>Social Relationships</p>
        <SocialEditor sim={sim} slug={slug} legacySims={legacySims} />
      </section>

      {sim.causeOfDeath && (
        <section className={styles.section}>
          <p className={styles.sectionTitle}>Death</p>
          <DeathSection sim={sim} />
        </section>
      )}

      {!sim.causeOfDeath && <MarkDeceasedButton simId={sim.id} />}
    </div>
  )
}

function DeathSection({ sim }: { sim: Props['sim'] }) {
  // Inline here — one select, no separate file needed
  const { trpc } = require('@/trpc/client') as typeof import('@/trpc/client')
  const update = trpc.sims.update.useMutation()
  const CAUSES = [
    'OLD_AGE','DROWNING','FIRE','ELECTROCUTION','HUNGER','OVEREXERTION',
    'EMBARRASSMENT','ANGER','LAUGHTER','COWPLANT','PUFFERFISH','MURPHY_BED','STEAM','POISON','METEOR',
  ]
  return (
    <select
      className={styles.editableChip}
      defaultValue={sim.causeOfDeath ?? ''}
      onChange={(e) => update.mutate({ id: sim.id, causeOfDeath: e.target.value as never })}
    >
      {CAUSES.map((c) => (
        <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
      ))}
    </select>
  )
}

function MarkDeceasedButton({ simId }: { simId: string }) {
  const { trpc } = require('@/trpc/client') as typeof import('@/trpc/client')
  const update = trpc.sims.update.useMutation()
  return (
    <button
      className={styles.addChip}
      onClick={() => update.mutate({ id: simId, causeOfDeath: 'OLD_AGE' as never })}
    >
      + Mark as deceased
    </button>
  )
}
```

Note: `require` in client components is not ideal — we'll fix this when editing. Use proper imports:

- [ ] **Fix imports in sim-detail-client.tsx** — replace `require` calls with proper hook usage:

`DeathSection` and `MarkDeceasedButton` are client components inside a `'use client'` file, so they can use hooks directly:

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { trpc } from '@/trpc/client'
import type { Trait } from '@/app/components/trait-picker'
import { IdentitySection } from './identity-section'
import { TraitEditor } from './trait-editor'
import { GoalsSection } from './goals-section'
import { SkillEditor } from './skill-editor'
import { FamilyEditor } from './family-editor'
import { SocialEditor } from './social-editor'
import styles from './page.module.css'

// ... Props interface as above ...

export function SimDetailClient({ sim, slug, legacySims, traits, aspirations, careers, skills }: Props) {
  const legacyName = slug
    .split('-')
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(' ')

  return (
    <div className={styles.page}>
      <p className={styles.breadcrumb}>
        <Link href={`/app/legacies/${slug}`}>{legacyName}</Link>
        {' › '}
        {sim.firstName} {sim.lastName}
      </p>

      <IdentitySection sim={sim} />

      <section className={styles.section}>
        <p className={styles.sectionTitle}>Personality Traits</p>
        <TraitEditor sim={sim} traits={traits} />
      </section>

      <section className={styles.section}>
        <p className={styles.sectionTitle}>Goals &amp; Career</p>
        <GoalsSection sim={sim} aspirations={aspirations} careers={careers} />
      </section>

      <section className={styles.section}>
        <p className={styles.sectionTitle}>Skills</p>
        <SkillEditor sim={sim} allSkills={skills} />
      </section>

      <section className={styles.section}>
        <p className={styles.sectionTitle}>Family</p>
        <FamilyEditor sim={sim} slug={slug} legacySims={legacySims} />
      </section>

      <section className={styles.section}>
        <p className={styles.sectionTitle}>Social Relationships</p>
        <SocialEditor sim={sim} slug={slug} legacySims={legacySims} />
      </section>

      {sim.causeOfDeath && <DeathSection sim={sim} />}
      {!sim.causeOfDeath && <MarkDeceasedButton simId={sim.id} />}
    </div>
  )
}

const CAUSE_OF_DEATH_OPTIONS = [
  'OLD_AGE','DROWNING','FIRE','ELECTROCUTION','HUNGER','OVEREXERTION',
  'EMBARRASSMENT','ANGER','LAUGHTER','COWPLANT','PUFFERFISH','MURPHY_BED','STEAM','POISON','METEOR',
] as const

function DeathSection({ sim }: { sim: Props['sim'] }) {
  const update = trpc.sims.update.useMutation()
  return (
    <section className={styles.section}>
      <p className={styles.sectionTitle}>Death</p>
      <select
        className={styles.editableChip}
        defaultValue={sim.causeOfDeath ?? ''}
        onChange={(e) =>
          update.mutate({ id: sim.id, causeOfDeath: e.target.value as 'OLD_AGE' })
        }
      >
        {CAUSE_OF_DEATH_OPTIONS.map((c) => (
          <option key={c} value={c}>
            {c.replace(/_/g, ' ')}
          </option>
        ))}
      </select>
    </section>
  )
}

function MarkDeceasedButton({ simId }: { simId: string }) {
  const update = trpc.sims.update.useMutation()
  return (
    <div className={styles.deathButton}>
      <button
        className={styles.addChip}
        onClick={() => update.mutate({ id: simId, causeOfDeath: 'OLD_AGE' })}
      >
        + Mark as deceased
      </button>
    </div>
  )
}
```

- [ ] **Create `identity-section.tsx`**

```tsx
'use client'

import { useState } from 'react'
import Image from 'next/image'
import { trpc } from '@/trpc/client'
import { ImageUpload } from '@/app/components/image-upload'
import styles from './page.module.css'

const GENDER_OPTIONS = ['MALE', 'FEMALE', 'NON_BINARY'] as const
const LIFE_STAGE_OPTIONS = [
  'NEWBORN','INFANT','TODDLER','CHILD','TEEN','YOUNG_ADULT','ADULT','ELDER',
] as const
const OCCULT_OPTIONS = [
  null,'VAMPIRE','SPELLCASTER','MERMAID','WEREWOLF','FAIRY','ALIEN','GHOST','PLANT_SIM','SERVO',
] as const

function formatEnum(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

interface SimProp {
  id: string
  firstName: string
  lastName: string
  gender: string
  lifeStage: string
  pronounSubject: string | null
  pronounObject: string | null
  pronounPossessive: string | null
  imageUrl: string | null
  occultType: string | null
}

export function IdentitySection({ sim }: { sim: SimProp }) {
  const update = trpc.sims.update.useMutation()

  function save(fields: Parameters<typeof update.mutate>[0]) {
    update.mutate(fields)
  }

  return (
    <div className={styles.hero}>
      <PortraitUpload sim={sim} onSave={(imageUrl) => save({ id: sim.id, imageUrl })} />

      <div className={styles.heroMeta}>
        <div className={styles.nameRow}>
          <InlineTextField
            value={sim.firstName}
            onSave={(v) => save({ id: sim.id, firstName: v })}
            aria-label="First name"
          />
          <InlineTextField
            value={sim.lastName}
            onSave={(v) => save({ id: sim.id, lastName: v })}
            aria-label="Last name"
          />
        </div>

        <div className={styles.metaRow}>
          <select
            className={styles.editableChip}
            defaultValue={sim.gender}
            aria-label="Gender"
            onChange={(e) => save({ id: sim.id, gender: e.target.value as 'MALE' })}
          >
            {GENDER_OPTIONS.map((g) => (
              <option key={g} value={g}>{formatEnum(g)}</option>
            ))}
          </select>

          <select
            className={styles.editableChip}
            defaultValue={sim.lifeStage}
            aria-label="Life stage"
            onChange={(e) => save({ id: sim.id, lifeStage: e.target.value as 'ADULT' })}
          >
            {LIFE_STAGE_OPTIONS.map((s) => (
              <option key={s} value={s}>{formatEnum(s)}</option>
            ))}
          </select>

          <select
            className={styles.editableChip}
            defaultValue={sim.occultType ?? ''}
            aria-label="Occult type"
            onChange={(e) =>
              save({ id: sim.id, occultType: (e.target.value || null) as 'VAMPIRE' | null })
            }
          >
            <option value="">None</option>
            {OCCULT_OPTIONS.filter(Boolean).map((o) => (
              <option key={o!} value={o!}>{formatEnum(o!)}</option>
            ))}
          </select>
        </div>

        <PronounEditor sim={sim} onSave={save} />
      </div>
    </div>
  )
}

function PortraitUpload({
  sim,
  onSave,
}: {
  sim: SimProp
  onSave: (url: string) => void
}) {
  const [showUpload, setShowUpload] = useState(false)

  if (showUpload) {
    return (
      <div style={{ width: 88, flexShrink: 0 }}>
        <ImageUpload
          shape="circle"
          value={sim.imageUrl ?? undefined}
          onChange={(url) => {
            onSave(url)
            setShowUpload(false)
          }}
        />
      </div>
    )
  }

  return (
    <button
      style={{
        width: 88,
        height: 88,
        borderRadius: '50%',
        overflow: 'hidden',
        position: 'relative',
        flexShrink: 0,
        background: 'var(--green)',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      aria-label="Change portrait"
      onClick={() => setShowUpload(true)}
    >
      {sim.imageUrl ? (
        <Image src={sim.imageUrl} alt={sim.firstName} fill sizes="88px" style={{ objectFit: 'cover' }} />
      ) : (
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', color: 'white' }}>
          {sim.firstName[0]}{sim.lastName[0]}
        </span>
      )}
    </button>
  )
}

function InlineTextField({
  value,
  onSave,
  'aria-label': ariaLabel,
}: {
  value: string
  onSave: (v: string) => void
  'aria-label': string
}) {
  const [current, setCurrent] = useState(value)
  const [saved, setSaved] = useState(value)
  const [error, setError] = useState('')

  function handleBlur() {
    const trimmed = current.trim()
    if (!trimmed || trimmed === saved) { setCurrent(saved); return }
    try {
      onSave(trimmed)
      setSaved(trimmed)
      setError('')
    } catch {
      setCurrent(saved)
      setError('Failed to save')
    }
  }

  return (
    <span>
      <input
        className={styles.editableText}
        value={current}
        aria-label={ariaLabel}
        onChange={(e) => setCurrent(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') { setCurrent(saved); e.currentTarget.blur() }
        }}
        style={{ width: `${Math.max(current.length, 4)}ch` }}
      />
      {error && <span className={styles.inlineError}>{error}</span>}
    </span>
  )
}

function PronounEditor({
  sim,
  onSave,
}: {
  sim: SimProp
  onSave: (fields: { id: string; pronounSubject?: string | null; pronounObject?: string | null; pronounPossessive?: string | null }) => void
}) {
  const [open, setOpen] = useState(false)
  const display = sim.pronounSubject
    ? `${sim.pronounSubject} / ${sim.pronounObject} / ${sim.pronounPossessive}`
    : 'Add pronouns'

  if (!open) {
    return (
      <div className={styles.metaRow}>
        <button className={styles.editableChip} onClick={() => setOpen(true)}>
          {display} ✎
        </button>
      </div>
    )
  }

  return (
    <div className={styles.metaRow}>
      {(['pronounSubject', 'pronounObject', 'pronounPossessive'] as const).map((field, i) => (
        <input
          key={field}
          className={styles.editableChip}
          style={{ width: '7ch' }}
          defaultValue={(sim[field] as string | null) ?? ''}
          placeholder={['she', 'her', 'her'][i]}
          aria-label={['Subject pronoun', 'Object pronoun', 'Possessive pronoun'][i]}
          onBlur={(e) => onSave({ id: sim.id, [field]: e.target.value || null })}
        />
      ))}
      <button className={styles.removeBtn} onClick={() => setOpen(false)}>done</button>
    </div>
  )
}
```

- [ ] **Run type check**

```bash
npx tsc --noEmit
```

Fix any type errors before proceeding.

- [ ] **Commit**

```bash
git add src/app/app/legacies/[slug]/sims/[id]/
git commit -m "feat(sim-detail): add SimDetailClient and IdentitySection"
```

---

## Task 10: TraitEditor

**Files:**
- Create: `src/app/app/legacies/[slug]/sims/[id]/trait-editor.tsx`

- [ ] **Create `trait-editor.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { trpc } from '@/trpc/client'
import { TraitPicker, type Trait } from '@/app/components/trait-picker'
import styles from './page.module.css'

interface SimProp {
  id: string
  personalityTraits: { personalityTrait: { id: string; name: string } }[]
}

export function TraitEditor({ sim, traits }: { sim: SimProp; traits: Trait[] }) {
  const [localTraitIds, setLocalTraitIds] = useState<string[]>(
    sim.personalityTraits.map((t) => t.personalityTrait.id),
  )
  const [picking, setPicking] = useState(false)
  const addTrait = trpc.sims.addTrait.useMutation()
  const removeTrait = trpc.sims.removeTrait.useMutation()

  function handleAdd(traitId: string) {
    setLocalTraitIds((prev) => [...prev, traitId])
    addTrait.mutate(
      { simId: sim.id, traitId },
      { onError: () => setLocalTraitIds((prev) => prev.filter((id) => id !== traitId)) },
    )
  }

  function handleRemove(traitId: string) {
    setLocalTraitIds((prev) => prev.filter((id) => id !== traitId))
    removeTrait.mutate(
      { simId: sim.id, traitId },
      { onError: () => setLocalTraitIds((prev) => [...prev, traitId]) },
    )
  }

  // TraitPicker onChange diffs old vs new to determine add/remove
  function handlePickerChange(ids: string[]) {
    const added = ids.find((id) => !localTraitIds.includes(id))
    const removed = localTraitIds.find((id) => !ids.includes(id))
    if (added) handleAdd(added)
    if (removed) handleRemove(removed)
  }

  const localTraits = localTraitIds.map((id) => {
    const found = traits.find((t) => t.id === id)
    return found ?? { id, name: id, category: null, conflictsWith: [] }
  })

  return (
    <>
      <div className={styles.traitList}>
        {localTraits.map((trait) => (
          <span key={trait.id} className={styles.traitChip}>
            {trait.name}
            <button
              className={styles.traitRemove}
              aria-label={`Remove ${trait.name}`}
              onClick={() => handleRemove(trait.id)}
            >
              ×
            </button>
          </span>
        ))}
        {localTraitIds.length < 6 && (
          <button className={styles.addChip} onClick={() => setPicking(true)}>
            + Add trait
          </button>
        )}
      </div>

      {picking && (
        <div className={styles.pickerOverlay} onClick={() => setPicking(false)}>
          <div className={styles.pickerBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.pickerClose}>
              <button className={styles.removeBtn} onClick={() => setPicking(false)}>
                Close
              </button>
            </div>
            <TraitPicker
              traits={traits}
              selected={localTraitIds}
              onChange={handlePickerChange}
              max={6}
            />
          </div>
        </div>
      )}
    </>
  )
}
```

- [ ] **Run type check**

```bash
npx tsc --noEmit
```

- [ ] **Commit**

```bash
git add src/app/app/legacies/[slug]/sims/[id]/trait-editor.tsx
git commit -m "feat(sim-detail): add TraitEditor component"
```

---

## Task 11: GoalsSection + SkillEditor

**Files:**
- Create: `src/app/app/legacies/[slug]/sims/[id]/goals-section.tsx`
- Create: `src/app/app/legacies/[slug]/sims/[id]/skill-editor.tsx`

- [ ] **Create `goals-section.tsx`**

```tsx
'use client'

import { trpc } from '@/trpc/client'
import styles from './page.module.css'

interface SimProp {
  id: string
  aspirations: { aspiration: { id: string; name: string; category: string } }[]
  careers: { career: { id: string; name: string; type: string } | null }[]
}

export function GoalsSection({
  sim,
  aspirations,
  careers,
}: {
  sim: SimProp
  aspirations: { id: string; name: string; category: string }[]
  careers: { id: string; name: string; type: string }[]
}) {
  const update = trpc.sims.update.useMutation()
  const currentAspiration = sim.aspirations[0]?.aspiration
  const currentCareer = sim.careers.find((c) => c.career)?.career

  const aspirationsByCategory = aspirations.reduce<Record<string, typeof aspirations>>((acc, a) => {
    ;(acc[a.category] ??= []).push(a)
    return acc
  }, {})

  const careersByType = careers.reduce<Record<string, typeof careers>>((acc, c) => {
    ;(acc[c.type] ??= []).push(c)
    return acc
  }, {})

  return (
    <div className={styles.twoCol}>
      <div>
        <span className={styles.fieldLabel}>Aspiration</span>
        <select
          className={styles.editableChip}
          defaultValue={currentAspiration?.id ?? ''}
          aria-label="Aspiration"
          onChange={(e) =>
            update.mutate({ id: sim.id, aspirationId: e.target.value || null })
          }
        >
          <option value="">None</option>
          {Object.entries(aspirationsByCategory).map(([cat, items]) => (
            <optgroup key={cat} label={cat}>
              {items.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div>
        <span className={styles.fieldLabel}>Career</span>
        <select
          className={styles.editableChip}
          defaultValue={currentCareer?.id ?? ''}
          aria-label="Career"
          onChange={(e) =>
            update.mutate({ id: sim.id, careerId: e.target.value || null })
          }
        >
          <option value="">None</option>
          {Object.entries(careersByType).map(([type, items]) => (
            <optgroup key={type} label={type}>
              {items.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
    </div>
  )
}
```

- [ ] **Create `skill-editor.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { trpc } from '@/trpc/client'
import styles from './page.module.css'

interface SimProp {
  id: string
  skills: { skill: { id: string; name: string; maxLevel: number }; level: number }[]
}

export function SkillEditor({
  sim,
  allSkills,
}: {
  sim: SimProp
  allSkills: { id: string; name: string; maxLevel: number }[]
}) {
  const [localSkills, setLocalSkills] = useState(sim.skills)
  const addSkill = trpc.sims.addSkill.useMutation()
  const setLevel = trpc.sims.setSkillLevel.useMutation()
  const removeSkill = trpc.sims.removeSkill.useMutation()

  const trackedIds = new Set(localSkills.map((s) => s.skill.id))
  const available = allSkills.filter((s) => !trackedIds.has(s.id))

  function handleSetLevel(skillId: string, level: number) {
    setLocalSkills((prev) =>
      prev.map((s) => (s.skill.id === skillId ? { ...s, level } : s)),
    )
    setLevel.mutate(
      { simId: sim.id, skillId, level },
      {
        onError: () =>
          setLocalSkills((prev) =>
            prev.map((s) =>
              s.skill.id === skillId
                ? { ...s, level: sim.skills.find((o) => o.skill.id === skillId)?.level ?? s.level }
                : s,
            ),
          ),
      },
    )
  }

  function handleAdd(skillId: string) {
    const skill = allSkills.find((s) => s.id === skillId)
    if (!skill) return
    setLocalSkills((prev) => [...prev, { skill, level: 1 }])
    addSkill.mutate(
      { simId: sim.id, skillId, level: 1 },
      { onError: () => setLocalSkills((prev) => prev.filter((s) => s.skill.id !== skillId)) },
    )
  }

  function handleRemove(skillId: string) {
    setLocalSkills((prev) => prev.filter((s) => s.skill.id !== skillId))
    removeSkill.mutate(
      { simId: sim.id, skillId },
      {
        onError: () => {
          const original = sim.skills.find((s) => s.skill.id === skillId)
          if (original) setLocalSkills((prev) => [...prev, original])
        },
      },
    )
  }

  return (
    <div>
      <div className={styles.skillList}>
        {localSkills.map(({ skill, level }) => (
          <div key={skill.id} className={styles.skillRow}>
            <span className={styles.skillName}>{skill.name}</span>
            <div className={styles.pipBar}>
              {Array.from({ length: skill.maxLevel }, (_, i) => (
                <button
                  key={i}
                  className={`${styles.pip} ${i < level ? styles.filled : ''}`}
                  aria-label={`Set ${skill.name} to level ${i + 1}`}
                  onClick={() => handleSetLevel(skill.id, i + 1)}
                />
              ))}
            </div>
            <button
              className={styles.removeBtn}
              aria-label={`Remove ${skill.name}`}
              onClick={() => handleRemove(skill.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {available.length > 0 && (
        <select
          className={styles.addChip}
          style={{ marginTop: '12px' }}
          value=""
          aria-label="Add skill"
          onChange={(e) => { if (e.target.value) handleAdd(e.target.value) }}
        >
          <option value="">+ Add skill</option>
          {available.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      )}
    </div>
  )
}
```

- [ ] **Run type check**

```bash
npx tsc --noEmit
```

- [ ] **Commit**

```bash
git add src/app/app/legacies/[slug]/sims/[id]/goals-section.tsx src/app/app/legacies/[slug]/sims/[id]/skill-editor.tsx
git commit -m "feat(sim-detail): add GoalsSection and SkillEditor"
```

---

## Task 12: SimPickerModal + FamilyEditor + SocialEditor

**Files:**
- Create: `src/app/app/legacies/[slug]/sims/[id]/sim-picker-modal.tsx`
- Create: `src/app/app/legacies/[slug]/sims/[id]/family-editor.tsx`
- Create: `src/app/app/legacies/[slug]/sims/[id]/social-editor.tsx`

- [ ] **Create `sim-picker-modal.tsx`**

```tsx
'use client'

import Image from 'next/image'
import styles from './page.module.css'

type SimOption = { id: string; firstName: string; lastName: string; imageUrl: string | null }

interface Props {
  sims: SimOption[]
  selected: string | null
  onSelect: (id: string) => void
  title: string
  children?: React.ReactNode
  onConfirm: () => void
  onClose: () => void
  confirmDisabled?: boolean
}

export function SimPickerModal({ sims, selected, onSelect, title, children, onConfirm, onClose, confirmDisabled }: Props) {
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <p className={styles.modalTitle}>{title}</p>

        <div className={styles.simCards} style={{ maxHeight: '240px', overflowY: 'auto' }}>
          {sims.map((sim) => (
            <button
              key={sim.id}
              className={styles.simCard}
              style={{ background: 'none', border: 'none', cursor: 'pointer', outline: selected === sim.id ? '2px solid var(--green)' : 'none', borderRadius: '50%' }}
              onClick={() => onSelect(sim.id)}
              aria-pressed={selected === sim.id}
            >
              <div className={styles.simPortraitWrap}>
                {sim.imageUrl ? (
                  <Image src={sim.imageUrl} alt={sim.firstName} fill sizes="72px" style={{ objectFit: 'cover' }} />
                ) : (
                  <span className={styles.simInitials} aria-hidden="true">
                    {sim.firstName[0]}{sim.lastName[0]}
                  </span>
                )}
              </div>
              <span className={styles.simCardName}>{sim.firstName} {sim.lastName}</span>
            </button>
          ))}
        </div>

        {children}

        <div className={styles.modalActions}>
          <button className={styles.addChip} onClick={onClose}>Cancel</button>
          <button
            className={styles.editableChip}
            style={{ background: 'var(--green)', color: 'white', borderColor: 'var(--green)' }}
            onClick={onConfirm}
            disabled={confirmDisabled}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Create `family-editor.tsx`**

```tsx
'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { trpc } from '@/trpc/client'
import { SimPickerModal } from './sim-picker-modal'
import styles from './page.module.css'

type SimMini = { id: string; firstName: string; lastName: string; imageUrl: string | null }

interface FamilyMember {
  sim: SimMini
  relType: string
  role: 'parent' | 'child'
  parentId: string
  childId: string
}

interface SimProp {
  id: string
  legacyId: string
  parentsOf: { child: SimMini; type: string }[]
  childOf: { parent: SimMini; type: string }[]
}

export function FamilyEditor({ sim, slug, legacySims }: { sim: SimProp; slug: string; legacySims: SimMini[] }) {
  const addRel = trpc.sims.addFamilyRelationship.useMutation()
  const removeRel = trpc.sims.removeFamilyRelationship.useMutation()

  const [members, setMembers] = useState<FamilyMember[]>([
    ...sim.parentsOf.map((r) => ({
      sim: r.child, relType: r.type, role: 'child' as const,
      parentId: sim.id, childId: r.child.id,
    })),
    ...sim.childOf.map((r) => ({
      sim: r.parent, relType: r.type, role: 'parent' as const,
      parentId: r.parent.id, childId: sim.id,
    })),
  ])

  const [adding, setAdding] = useState(false)
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [role, setRole] = useState<'parent' | 'child'>('child')
  const [relType, setRelType] = useState<'BIOLOGICAL' | 'ADOPTIVE' | 'STEP'>('BIOLOGICAL')

  const linkedIds = new Set([...members.map((m) => m.sim.id), sim.id])
  const available = legacySims.filter((s) => !linkedIds.has(s.id))

  function handleConfirm() {
    if (!pickedId) return
    const picked = legacySims.find((s) => s.id === pickedId)
    if (!picked) return
    const parentId = role === 'parent' ? pickedId : sim.id
    const childId = role === 'parent' ? sim.id : pickedId
    setMembers((prev) => [...prev, { sim: picked, relType, role, parentId, childId }])
    addRel.mutate(
      { parentId, childId, type: relType },
      { onError: () => setMembers((prev) => prev.filter((m) => m.sim.id !== pickedId)) },
    )
    setAdding(false)
    setPickedId(null)
  }

  function handleRemove(m: FamilyMember) {
    setMembers((prev) => prev.filter((x) => x.sim.id !== m.sim.id || x.role !== m.role))
    removeRel.mutate(
      { parentId: m.parentId, childId: m.childId },
      { onError: () => setMembers((prev) => [...prev, m]) },
    )
  }

  function relLabel(m: FamilyMember) {
    const roleLabel = m.role === 'parent' ? 'Parent' : 'Child'
    return `${roleLabel} · ${m.relType.charAt(0) + m.relType.slice(1).toLowerCase()}`
  }

  return (
    <>
      <div className={styles.simCards}>
        {members.map((m) => (
          <div key={`${m.sim.id}-${m.role}`} className={styles.simCard}>
            <Link href={`/app/legacies/${slug}/sims/${m.sim.id}`} style={{ display: 'contents' }}>
              <div className={styles.simPortraitWrap}>
                {m.sim.imageUrl ? (
                  <Image src={m.sim.imageUrl} alt={m.sim.firstName} fill sizes="72px" style={{ objectFit: 'cover' }} />
                ) : (
                  <span className={styles.simInitials} aria-hidden="true">
                    {m.sim.firstName[0]}{m.sim.lastName[0]}
                  </span>
                )}
              </div>
              <span className={styles.simCardName}>{m.sim.firstName} {m.sim.lastName}</span>
              <span className={styles.simCardSub}>{relLabel(m)}</span>
            </Link>
            <button
              className={styles.simCardRemove}
              aria-label={`Remove ${m.sim.firstName}`}
              onClick={() => handleRemove(m)}
            >
              ×
            </button>
          </div>
        ))}

        {available.length > 0 && (
          <button className={`${styles.simCard} ${styles.addCard}`} onClick={() => setAdding(true)}>
            <div className={styles.simPortraitWrap}>
              <span className={styles.addCardIcon}>+</span>
            </div>
            <span className={styles.simCardName}>Add family</span>
          </button>
        )}
      </div>

      {adding && (
        <SimPickerModal
          title="Add family member"
          sims={available}
          selected={pickedId}
          onSelect={setPickedId}
          onConfirm={handleConfirm}
          onClose={() => { setAdding(false); setPickedId(null) }}
          confirmDisabled={!pickedId}
        >
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.75rem' }}>
              Role
              <select
                className={styles.editableChip}
                value={role}
                onChange={(e) => setRole(e.target.value as 'parent' | 'child')}
              >
                <option value="parent">This sim is the parent</option>
                <option value="child">This sim is the child</option>
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.75rem' }}>
              Relationship type
              <select
                className={styles.editableChip}
                value={relType}
                onChange={(e) => setRelType(e.target.value as 'BIOLOGICAL')}
              >
                <option value="BIOLOGICAL">Biological</option>
                <option value="ADOPTIVE">Adoptive</option>
                <option value="STEP">Step</option>
              </select>
            </label>
          </div>
        </SimPickerModal>
      )}
    </>
  )
}
```

- [ ] **Create `social-editor.tsx`**

```tsx
'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { trpc } from '@/trpc/client'
import { SimPickerModal } from './sim-picker-modal'
import styles from './page.module.css'

type SimMini = { id: string; firstName: string; lastName: string; imageUrl: string | null }

const ROMANTIC_STATUS_OPTIONS = [
  'NONE','DATING','ENGAGED','MARRIED','EX_PARTNER','WIDOWED',
] as const

function formatStatus(s: string) {
  return s === 'NONE' ? 'Friends' : s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

interface SocialRel {
  sim: SimMini
  romanticStatus: string
  simAId: string
  simBId: string
}

interface SimProp {
  id: string
  socialRelationshipsA: { simB: SimMini; romanticStatus: string }[]
  socialRelationshipsB: { simA: SimMini; romanticStatus: string }[]
}

export function SocialEditor({ sim, slug, legacySims }: { sim: SimProp; slug: string; legacySims: SimMini[] }) {
  const addRel = trpc.sims.addSocialRelationship.useMutation()
  const updateRel = trpc.sims.updateSocialRelationship.useMutation()
  const removeRel = trpc.sims.removeSocialRelationship.useMutation()

  const [rels, setRels] = useState<SocialRel[]>([
    ...sim.socialRelationshipsA.map((r) => {
      const [a, b] = [sim.id, r.simB.id].sort()
      return { sim: r.simB, romanticStatus: r.romanticStatus, simAId: a, simBId: b }
    }),
    ...sim.socialRelationshipsB.map((r) => {
      const [a, b] = [sim.id, r.simA.id].sort()
      return { sim: r.simA, romanticStatus: r.romanticStatus, simAId: a, simBId: b }
    }),
  ])

  const [adding, setAdding] = useState(false)
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [newStatus, setNewStatus] = useState<string>('NONE')

  const linkedIds = new Set([...rels.map((r) => r.sim.id), sim.id])
  const available = legacySims.filter((s) => !linkedIds.has(s.id))

  function handleConfirm() {
    if (!pickedId) return
    const picked = legacySims.find((s) => s.id === pickedId)
    if (!picked) return
    const [a, b] = [sim.id, pickedId].sort()
    const rel: SocialRel = { sim: picked, romanticStatus: newStatus, simAId: a, simBId: b }
    setRels((prev) => [...prev, rel])
    addRel.mutate(
      { simAId: a, simBId: b, romanticStatus: newStatus as 'NONE' },
      { onError: () => setRels((prev) => prev.filter((r) => r.sim.id !== pickedId)) },
    )
    setAdding(false); setPickedId(null); setNewStatus('NONE')
  }

  function handleStatusChange(rel: SocialRel, romanticStatus: string) {
    setRels((prev) => prev.map((r) => r.sim.id === rel.sim.id ? { ...r, romanticStatus } : r))
    updateRel.mutate(
      { simAId: rel.simAId, simBId: rel.simBId, romanticStatus: romanticStatus as 'NONE' },
      { onError: () => setRels((prev) => prev.map((r) => r.sim.id === rel.sim.id ? { ...r, romanticStatus: rel.romanticStatus } : r)) },
    )
  }

  function handleRemove(rel: SocialRel) {
    setRels((prev) => prev.filter((r) => r.sim.id !== rel.sim.id))
    removeRel.mutate(
      { simAId: rel.simAId, simBId: rel.simBId },
      { onError: () => setRels((prev) => [...prev, rel]) },
    )
  }

  return (
    <>
      <div className={styles.simCards}>
        {rels.map((rel) => (
          <div key={rel.sim.id} className={styles.simCard}>
            <Link href={`/app/legacies/${slug}/sims/${rel.sim.id}`} style={{ display: 'contents' }}>
              <div className={styles.simPortraitWrap}>
                {rel.sim.imageUrl ? (
                  <Image src={rel.sim.imageUrl} alt={rel.sim.firstName} fill sizes="72px" style={{ objectFit: 'cover' }} />
                ) : (
                  <span className={styles.simInitials} aria-hidden="true">
                    {rel.sim.firstName[0]}{rel.sim.lastName[0]}
                  </span>
                )}
              </div>
              <span className={styles.simCardName}>{rel.sim.firstName} {rel.sim.lastName}</span>
            </Link>
            <select
              className={styles.simCardSub}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'center', fontSize: '0.6875rem', color: 'var(--text-muted)' }}
              value={rel.romanticStatus}
              aria-label={`Romantic status with ${rel.sim.firstName}`}
              onChange={(e) => handleStatusChange(rel, e.target.value)}
            >
              {ROMANTIC_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{formatStatus(s)}</option>
              ))}
            </select>
            <button
              className={styles.simCardRemove}
              aria-label={`Remove ${rel.sim.firstName}`}
              onClick={() => handleRemove(rel)}
            >
              ×
            </button>
          </div>
        ))}

        {available.length > 0 && (
          <button className={`${styles.simCard} ${styles.addCard}`} onClick={() => setAdding(true)}>
            <div className={styles.simPortraitWrap}>
              <span className={styles.addCardIcon}>+</span>
            </div>
            <span className={styles.simCardName}>Add connection</span>
          </button>
        )}
      </div>

      {adding && (
        <SimPickerModal
          title="Add social connection"
          sims={available}
          selected={pickedId}
          onSelect={setPickedId}
          onConfirm={handleConfirm}
          onClose={() => { setAdding(false); setPickedId(null) }}
          confirmDisabled={!pickedId}
        >
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.75rem' }}>
            Romantic status
            <select
              className={styles.editableChip}
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
            >
              {ROMANTIC_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{formatStatus(s)}</option>
              ))}
            </select>
          </label>
        </SimPickerModal>
      )}
    </>
  )
}
```

- [ ] **Run type check**

```bash
npx tsc --noEmit
```

- [ ] **Commit**

```bash
git add src/app/app/legacies/[slug]/sims/[id]/
git commit -m "feat(sim-detail): add SimPickerModal, FamilyEditor, SocialEditor"
```

---

## Task 13: Full type + lint check, dev test

- [ ] **Run all checks**

```bash
npx tsc --noEmit
npm run lint
npm test
```

Fix any remaining errors.

- [ ] **Start dev server and manually verify**

```bash
npm run dev
```

1. Sign in via magic link (see CLAUDE.md)
2. Open a legacy → click a sim portrait → verify `/app/legacies/[slug]/sims/[id]` loads
3. Edit a name field (click, type, blur) → reload page → verify persisted
4. Change life stage dropdown → verify persisted on reload
5. Add and remove a trait
6. Set a skill level via pip
7. Add a family relationship (requires ≥2 sims in the legacy)
8. Add a social connection

- [ ] **Commit any fixes**

```bash
git add -p
git commit -m "fix(sim-detail): address type and lint issues"
```

---

## Task 14: E2E tests

**Files:**
- Create: `e2e/sim-detail.spec.ts`

- [ ] **Create `e2e/sim-detail.spec.ts`**

```typescript
import { test, expect } from '@playwright/test'
import { db } from '../src/server/db'
import { randomUUID } from 'crypto'

// Helper: get the test user's ID and a legacy slug from the auth setup
async function getTestContext() {
  const session = await db.session.findFirst({
    include: { user: { include: { legacies: { include: { sims: true } } } } },
    orderBy: { expires: 'desc' },
  })
  return session?.user
}

test('can navigate from legacy page to sim detail page', async ({ page }) => {
  const user = await getTestContext()
  const legacy = user?.legacies[0]
  const sim = legacy?.sims[0]
  if (!legacy || !sim) test.skip()

  await page.goto(`/app/legacies/${legacy!.slug}`)
  await page.getByText(`${sim!.firstName} ${sim!.lastName}`).click()
  await expect(page).toHaveURL(`/app/legacies/${legacy!.slug}/sims/${sim!.id}`)
  await expect(page.getByRole('heading', { level: 1 })).not.toBeVisible() // no h1, name is an input
  await expect(page.getByDisplayValue(sim!.firstName)).toBeVisible()
})

test('editing first name persists after reload', async ({ page }) => {
  const user = await getTestContext()
  const legacy = user?.legacies[0]
  const sim = legacy?.sims[0]
  if (!legacy || !sim) test.skip()

  await page.goto(`/app/legacies/${legacy!.slug}/sims/${sim!.id}`)

  const nameInput = page.getByLabel('First name')
  await nameInput.fill('Renamed')
  await nameInput.blur()

  await page.reload()
  await expect(page.getByDisplayValue('Renamed')).toBeVisible()

  // restore
  await page.getByLabel('First name').fill(sim!.firstName)
  await page.getByLabel('First name').blur()
})

test('changing life stage persists', async ({ page }) => {
  const user = await getTestContext()
  const legacy = user?.legacies[0]
  const sim = legacy?.sims[0]
  if (!legacy || !sim) test.skip()

  await page.goto(`/app/legacies/${legacy!.slug}/sims/${sim!.id}`)
  await page.getByLabel('Life stage').selectOption('ELDER')
  await page.reload()
  await expect(page.getByLabel('Life stage')).toHaveValue('ELDER')

  // restore
  await page.getByLabel('Life stage').selectOption(sim!.lifeStage)
})

test('can mark sim as deceased and see death section', async ({ page }) => {
  const user = await getTestContext()
  const legacy = user?.legacies[0]
  const sim = legacy?.sims.find((s) => !s.causeOfDeath)
  if (!legacy || !sim) test.skip()

  await page.goto(`/app/legacies/${legacy!.slug}/sims/${sim!.id}`)
  await page.getByRole('button', { name: '+ Mark as deceased' }).click()

  await expect(page.getByText('Death')).toBeVisible()

  // clean up
  await db.sim.update({ where: { id: sim!.id }, data: { causeOfDeath: null } })
})
```

- [ ] **Run E2E tests**

```bash
npm run test:e2e
```

Expected: all 4 tests pass. Fix any failures.

- [ ] **Final full check**

```bash
npm test
npm run test:e2e
npx tsc --noEmit
npm run lint
```

- [ ] **Commit**

```bash
git add e2e/sim-detail.spec.ts
git commit -m "test(sim-detail): add E2E tests for sim detail page"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Route `/app/legacies/[slug]/sims/[id]` — Task 8
- ✅ Per-field inline editing (blur/change saves) — Tasks 9–12
- ✅ All tRPC procedures — Tasks 2–7
- ✅ Portrait upload — Task 9 (PortraitUpload in IdentitySection)
- ✅ Personality traits — Task 10
- ✅ Aspiration + career — Task 11
- ✅ Skills with pip bar — Task 11
- ✅ Family portrait card grid — Task 12
- ✅ Social portrait card grid — Task 12
- ✅ Death section (conditional) + mark deceased — Task 9 (sim-detail-client)
- ✅ Navigation wiring (legacy page portraits → links) — Task 8
- ✅ Breadcrumb — Task 9 (sim-detail-client)
- ✅ fetchSkills helper — Task 5
- ✅ createTestSim helper — Task 1
- ✅ Integration tests — Tasks 2–7
- ✅ E2E tests — Task 14

**Type consistency:** All component `sim` prop shapes are defined inline (structural typing). The `trpc.sims.*` calls match the procedure names and input shapes defined in Tasks 2–7.

**No placeholders found.**
