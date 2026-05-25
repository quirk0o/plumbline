/**
 * Tests for the Legacy Chronicle derivation functions.
 *
 * Strategy: Testing-Trophy philosophy — behaviour-focused, no mocking,
 * small in-memory fixture that covers edge cases.
 *
 * Fixture design:
 *   - 3 generations (gen 1, 2, 3)
 *   - A founder (gen 1, isHeir: false in DB — founder status comes from
 *     legacy.founderSimId)
 *   - An heir per generation
 *   - 2 married couples, including a reciprocal duplicate row to prove
 *     de-dup works
 *   - A sim with null imageUrl
 *   - A sim with null generationNumber
 *   - Various aspiration states (in-progress, completed, none)
 */

import { describe, expect, it } from 'vitest'
import type { FetchedLegacy } from '../types'
import {
  computeStats,
  deriveSuccession,
  deriveMilestones,
  groupByGeneration,
  ringFor,
  toChronicleSim,
} from '../derive'

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function d(isoOffset: string): Date {
  return new Date(`2024-01-${isoOffset}T00:00:00.000Z`)
}

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

const FOUNDER_ID = 'sim-founder'
const HEIR_GEN1_ID = 'sim-heir-1'
const HEIR_GEN2_ID = 'sim-heir-2'
const HEIR_GEN3_ID = 'sim-heir-3'
const SPOUSE1_ID = 'sim-spouse-1'
const SPOUSE2_ID = 'sim-spouse-2'
const NO_GEN_SIM_ID = 'sim-no-gen'

const LEGACY_ID = 'legacy-1'
const HOUSEHOLD1_ID = 'house-1'
const HOUSEHOLD2_ID = 'house-2'
const HOUSEHOLD3_ID = 'house-3'

const fixture: FetchedLegacy = {
  id: LEGACY_ID,
  name: 'The Goth Legacy',
  description: 'A very gothic legacy.',
  founderSimId: FOUNDER_ID,
  households: [
    { id: HOUSEHOLD1_ID },
    { id: HOUSEHOLD2_ID },
    { id: HOUSEHOLD3_ID },
  ],
  sims: [
    // Gen 1 — founder, not marked isHeir
    {
      id: FOUNDER_ID,
      firstName: 'Mortimer',
      lastName: 'Goth',
      imageUrl: null,
      generationNumber: 1,
      isHeir: false,
      lifeStage: 'ELDER',
      createdAt: d('01'),
      aspirations: [
        {
          id: 'asp-1',
          completedAt: new Date('2024-01-01T06:00:00Z'),
          createdAt: new Date('2024-01-01T05:00:00Z'),
          aspiration: { name: 'Renaissance Sim' },
        },
        {
          id: 'asp-2',
          completedAt: null,
          createdAt: new Date('2024-01-01T07:00:00Z'),
          aspiration: { name: 'Academic' },
        },
      ],
    },
    // Gen 1 heir
    {
      id: HEIR_GEN1_ID,
      firstName: 'Bella',
      lastName: 'Goth',
      imageUrl: 'https://example.com/bella.png',
      generationNumber: 1,
      isHeir: true,
      lifeStage: 'ADULT',
      createdAt: d('02'),
      aspirations: [],
    },
    // Spouse of heir gen 1 — no imageUrl
    {
      id: SPOUSE1_ID,
      firstName: 'Bob',
      lastName: 'Pancakes',
      imageUrl: null,
      generationNumber: 1,
      isHeir: false,
      lifeStage: 'ADULT',
      createdAt: d('03'),
      aspirations: [
        {
          id: 'asp-3',
          completedAt: new Date('2024-01-03T10:00:00Z'),
          createdAt: new Date('2024-01-03T09:00:00Z'),
          aspiration: { name: 'Chief of Mischief' },
        },
      ],
    },
    // Gen 2 heir
    {
      id: HEIR_GEN2_ID,
      firstName: 'Cassandra',
      lastName: 'Goth',
      imageUrl: null,
      generationNumber: 2,
      isHeir: true,
      lifeStage: 'YOUNG_ADULT',
      createdAt: d('10'),
      aspirations: [
        {
          id: 'asp-4',
          completedAt: null,
          createdAt: new Date('2024-01-10T08:00:00Z'),
          aspiration: { name: 'Soulmate' },
        },
      ],
    },
    // Spouse of heir gen 2
    {
      id: SPOUSE2_ID,
      firstName: 'Don',
      lastName: 'Lothario',
      imageUrl: null,
      generationNumber: 2,
      isHeir: false,
      lifeStage: 'YOUNG_ADULT',
      createdAt: d('11'),
      aspirations: [],
    },
    // Gen 3 heir — most recent, should be "Heir designate"
    {
      id: HEIR_GEN3_ID,
      firstName: 'Alexander',
      lastName: 'Goth',
      imageUrl: null,
      generationNumber: 3,
      isHeir: true,
      lifeStage: 'TEEN',
      createdAt: d('20'),
      aspirations: [
        {
          id: 'asp-5',
          completedAt: new Date('2024-01-20T10:00:00Z'),
          createdAt: new Date('2024-01-20T09:00:00Z'),
          aspiration: { name: 'Computer Whiz' },
        },
        {
          id: 'asp-6',
          completedAt: new Date('2024-01-20T14:00:00Z'),
          createdAt: new Date('2024-01-20T13:00:00Z'),
          aspiration: { name: 'Nerd Brain' },
        },
      ],
    },
    // Sim with null generationNumber
    {
      id: NO_GEN_SIM_ID,
      firstName: 'Vlad',
      lastName: 'Straud',
      imageUrl: null,
      generationNumber: null,
      isHeir: false,
      lifeStage: 'ELDER',
      createdAt: d('15'),
      aspirations: [],
    },
  ],
  socialRelationships: [
    // Marriage 1: HEIR_GEN1 ↔ SPOUSE1 — canonical pair (heir-1 < spouse-1 alphabetically? no: "sim-heir-1" vs "sim-spouse-1")
    // "sim-heir-1" < "sim-spouse-1" so simAId = HEIR_GEN1_ID
    {
      id: 'rel-1',
      simAId: HEIR_GEN1_ID,
      simBId: SPOUSE1_ID,
      romanticStatus: 'MARRIED',
      createdAt: d('05'),
    },
    // Marriage 2: HEIR_GEN2 ↔ SPOUSE2 — canonical order: "sim-heir-2" < "sim-spouse-2"
    {
      id: 'rel-2',
      simAId: HEIR_GEN2_ID,
      simBId: SPOUSE2_ID,
      romanticStatus: 'MARRIED',
      createdAt: d('12'),
    },
    // Reciprocal duplicate of marriage 2 — should be de-duplicated
    {
      id: 'rel-3',
      simAId: SPOUSE2_ID,
      simBId: HEIR_GEN2_ID,
      romanticStatus: 'MARRIED',
      createdAt: d('12'),
    },
    // Non-MARRIED relationship — should NOT appear as a milestone
    {
      id: 'rel-4',
      simAId: HEIR_GEN3_ID,
      simBId: NO_GEN_SIM_ID,
      romanticStatus: 'DATING',
      createdAt: d('21'),
    },
  ],
}

// ---------------------------------------------------------------------------
// toChronicleSim
// ---------------------------------------------------------------------------

describe('toChronicleSim', () => {
  it('marks the founder correctly', () => {
    const rawFounder = fixture.sims.find((s) => s.id === FOUNDER_ID)!
    const sim = toChronicleSim(rawFounder, FOUNDER_ID)
    expect(sim.isFounder).toBe(true)
    expect(sim.id).toBe(FOUNDER_ID)
  })

  it('marks non-founder correctly', () => {
    const rawHeir = fixture.sims.find((s) => s.id === HEIR_GEN1_ID)!
    const sim = toChronicleSim(rawHeir, FOUNDER_ID)
    expect(sim.isFounder).toBe(false)
  })

  it('passes null founderSimId without throwing', () => {
    const rawSim = fixture.sims[0]
    const sim = toChronicleSim(rawSim, null)
    expect(sim.isFounder).toBe(false)
  })

  it('picks in-progress aspiration over completed (rule 1)', () => {
    // Founder has one completed ('Renaissance Sim') and one in-progress ('Academic')
    const rawFounder = fixture.sims.find((s) => s.id === FOUNDER_ID)!
    const sim = toChronicleSim(rawFounder, FOUNDER_ID)
    expect(sim.aspirationName).toBe('Academic')
  })

  it('picks most recently completed when all are completed (rule 2)', () => {
    // Alexander has two completed: 'Computer Whiz' at 10:00, 'Nerd Brain' at 14:00
    // Most recently completed = 'Nerd Brain'
    const rawAlexander = fixture.sims.find((s) => s.id === HEIR_GEN3_ID)!
    const sim = toChronicleSim(rawAlexander, FOUNDER_ID)
    expect(sim.aspirationName).toBe('Nerd Brain')
  })

  it('picks the only completed aspiration (rule 2 / single)', () => {
    const rawBob = fixture.sims.find((s) => s.id === SPOUSE1_ID)!
    const sim = toChronicleSim(rawBob, FOUNDER_ID)
    expect(sim.aspirationName).toBe('Chief of Mischief')
  })

  it('returns null aspirationName when sim has no aspirations (rule 4)', () => {
    const rawBella = fixture.sims.find((s) => s.id === HEIR_GEN1_ID)!
    const sim = toChronicleSim(rawBella, FOUNDER_ID)
    expect(sim.aspirationName).toBeNull()
  })

  it('preserves null imageUrl', () => {
    const rawFounder = fixture.sims.find((s) => s.id === FOUNDER_ID)!
    const sim = toChronicleSim(rawFounder, FOUNDER_ID)
    expect(sim.imageUrl).toBeNull()
  })

  it('preserves non-null imageUrl', () => {
    const rawBella = fixture.sims.find((s) => s.id === HEIR_GEN1_ID)!
    const sim = toChronicleSim(rawBella, FOUNDER_ID)
    expect(sim.imageUrl).toBe('https://example.com/bella.png')
  })

  it('preserves null generationNumber', () => {
    const rawVlad = fixture.sims.find((s) => s.id === NO_GEN_SIM_ID)!
    const sim = toChronicleSim(rawVlad, FOUNDER_ID)
    expect(sim.generationNumber).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// ringFor
// ---------------------------------------------------------------------------

describe('ringFor', () => {
  it('returns "heir" for an heir (heir checked first)', () => {
    expect(ringFor({ isFounder: false, isHeir: true })).toBe('heir')
  })

  it('returns "founder" for a founder who is not an heir', () => {
    expect(ringFor({ isFounder: true, isHeir: false })).toBe('founder')
  })

  it('returns "heir" for a sim that is both founder and heir (heir wins)', () => {
    expect(ringFor({ isFounder: true, isHeir: true })).toBe('heir')
  })

  it('returns "green" for a regular sim', () => {
    expect(ringFor({ isFounder: false, isHeir: false })).toBe('green')
  })
})

// ---------------------------------------------------------------------------
// deriveMilestones
// ---------------------------------------------------------------------------

describe('deriveMilestones', () => {
  const milestones = deriveMilestones(fixture)

  it('includes one milestone per sim (births)', () => {
    const births = milestones.filter(
      (m) => m.kind === 'Birth' || m.kind === 'Founding',
    )
    expect(births).toHaveLength(fixture.sims.length)
  })

  it('includes exactly 2 marriages (de-duplicates reciprocal row)', () => {
    const marriages = milestones.filter((m) => m.kind === 'Marriage')
    expect(marriages).toHaveLength(2)
  })

  it('total count = sims + unique marriages', () => {
    expect(milestones).toHaveLength(fixture.sims.length + 2)
  })

  it('founder row is kind "Founding"', () => {
    const founding = milestones.find((m) => m.id === `birth-${FOUNDER_ID}`)
    expect(founding).toBeDefined()
    expect(founding!.kind).toBe('Founding')
    expect(founding!.title).toContain('founds the legacy')
  })

  it('non-founder birth rows are kind "Birth"', () => {
    const bella = milestones.find((m) => m.id === `birth-${HEIR_GEN1_ID}`)
    expect(bella).toBeDefined()
    expect(bella!.kind).toBe('Birth')
    expect(bella!.title).toContain('is born')
  })

  it('does NOT include DATING relationship as a milestone', () => {
    const datingMilestone = milestones.find(
      (m) =>
        m.kind === 'Marriage' &&
        m.simIds.includes(HEIR_GEN3_ID) &&
        m.simIds.includes(NO_GEN_SIM_ID),
    )
    expect(datingMilestone).toBeUndefined()
  })

  it('marriage milestone contains both partner simIds', () => {
    const marriage1 = milestones.find((m) =>
      m.id.startsWith('marriage-') &&
      m.simIds.includes(HEIR_GEN1_ID) &&
      m.simIds.includes(SPOUSE1_ID),
    )
    expect(marriage1).toBeDefined()
    expect(marriage1!.simIds).toHaveLength(2)
    expect(marriage1!.simIds).toContain(HEIR_GEN1_ID)
    expect(marriage1!.simIds).toContain(SPOUSE1_ID)
  })

  it('marriage gen = min of partner generationNumbers', () => {
    // Both HEIR_GEN2_ID and SPOUSE2_ID are gen 2 → min = 2
    const marriage2 = milestones.find(
      (m) =>
        m.kind === 'Marriage' &&
        m.simIds.includes(HEIR_GEN2_ID) &&
        m.simIds.includes(SPOUSE2_ID),
    )
    expect(marriage2).toBeDefined()
    expect(marriage2!.gen).toBe(2)
  })

  it('orders milestones newest-first (descending sortKey)', () => {
    // Verify adjacent pairs are in descending order.
    // We compare createdAt of the underlying events by checking gen 3 heir
    // (created day 20) comes before gen 2 heir (day 10) in the output.
    const gen3BirthIdx = milestones.findIndex(
      (m) => m.id === `birth-${HEIR_GEN3_ID}`,
    )
    const gen2BirthIdx = milestones.findIndex(
      (m) => m.id === `birth-${HEIR_GEN2_ID}`,
    )
    expect(gen3BirthIdx).toBeLessThan(gen2BirthIdx)
  })

  it('output order is stable (same result on two calls)', () => {
    const milestones2 = deriveMilestones(fixture)
    expect(milestones.map((m) => m.id)).toEqual(milestones2.map((m) => m.id))
  })

  it('assigns stable ids with expected prefix', () => {
    const birthIds = milestones
      .filter((m) => m.kind === 'Birth' || m.kind === 'Founding')
      .map((m) => m.id)
    birthIds.forEach((id) => expect(id).toMatch(/^birth-/))

    const marriageIds = milestones
      .filter((m) => m.kind === 'Marriage')
      .map((m) => m.id)
    marriageIds.forEach((id) => expect(id).toMatch(/^marriage-/))
  })

  it('userAuthored is always false', () => {
    milestones.forEach((m) => expect(m.userAuthored).toBe(false))
  })
})

// ---------------------------------------------------------------------------
// deriveSuccession
// ---------------------------------------------------------------------------

describe('deriveSuccession', () => {
  const chronicleSims = fixture.sims.map((s) =>
    toChronicleSim(s, FOUNDER_ID),
  )
  const succession = deriveSuccession(chronicleSims, FOUNDER_ID)

  it('founder appears first', () => {
    expect(succession[0].sim.id).toBe(FOUNDER_ID)
    expect(succession[0].role).toBe('Founder')
    expect(succession[0].isFounder).toBe(true)
  })

  it('founder is not duplicated in heirs', () => {
    const founderEntries = succession.filter((s) => s.sim.id === FOUNDER_ID)
    expect(founderEntries).toHaveLength(1)
  })

  it('heirs are sorted by generationNumber ascending', () => {
    const heirSteps = succession.filter((s) => s.isHeir)
    // Gen 1 heir, gen 2 heir, gen 3 heir (Heir designate)
    const gens = heirSteps.map((s) => s.sim.generationNumber)
    expect(gens).toEqual([1, 2, 3])
  })

  it('last heir (highest gen) gets role "Heir designate"', () => {
    const last = succession[succession.length - 1]
    expect(last.sim.id).toBe(HEIR_GEN3_ID)
    expect(last.role).toBe('Heir designate')
  })

  it('non-final heirs get role "Heir · Gen {roman}"', () => {
    const gen1Heir = succession.find((s) => s.sim.id === HEIR_GEN1_ID)
    expect(gen1Heir).toBeDefined()
    expect(gen1Heir!.role).toBe('Heir · Gen I')

    const gen2Heir = succession.find((s) => s.sim.id === HEIR_GEN2_ID)
    expect(gen2Heir).toBeDefined()
    expect(gen2Heir!.role).toBe('Heir · Gen II')
  })

  it('non-heirs are excluded from the succession line', () => {
    const spouseEntry = succession.find((s) => s.sim.id === SPOUSE1_ID)
    expect(spouseEntry).toBeUndefined()
  })

  it('handles no heirs gracefully', () => {
    const result = deriveSuccession([], null)
    expect(result).toEqual([])
  })

  it('handles no founder gracefully (founder not in list)', () => {
    const result = deriveSuccession(chronicleSims, null)
    // Founder should not appear since founderSimId is null
    const founderStep = result.find((s) => s.sim.id === FOUNDER_ID)
    expect(founderStep).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// computeStats
// ---------------------------------------------------------------------------

describe('computeStats', () => {
  const milestones = deriveMilestones(fixture)
  const stats = computeStats(fixture, milestones)

  it('sims count matches total sim count', () => {
    expect(stats.sims).toBe(fixture.sims.length)
  })

  it('generations count is DISTINCT non-null generationNumbers', () => {
    // Sims have gen 1, 1, 1, 2, 2, 3 and null — distinct non-null = {1, 2, 3}
    expect(stats.generations).toBe(3)
  })

  it('null-gen sim is excluded from generations count', () => {
    // Explicitly: fixture has one null-gen sim; count should still be 3
    expect(stats.generations).toBe(3)
  })

  it('households count matches legacy.households length', () => {
    expect(stats.households).toBe(3)
  })

  it('milestones count equals derived milestones list length', () => {
    expect(stats.milestones).toBe(milestones.length)
    // And sanity-check the actual number: 7 sims + 2 marriages = 9
    expect(stats.milestones).toBe(9)
  })
})

// ---------------------------------------------------------------------------
// groupByGeneration
// ---------------------------------------------------------------------------

describe('groupByGeneration', () => {
  const chronicleSims = fixture.sims.map((s) =>
    toChronicleSim(s, FOUNDER_ID),
  )
  const groups = groupByGeneration(chronicleSims)

  it('produces one group per distinct generationNumber', () => {
    const numericGroups = groups.filter((g) => g.gen !== null)
    expect(numericGroups).toHaveLength(3) // gens 1, 2, 3
  })

  it('null-gen group is last', () => {
    const lastGroup = groups[groups.length - 1]
    expect(lastGroup.gen).toBeNull()
    expect(lastGroup.sims.some((s) => s.id === NO_GEN_SIM_ID)).toBe(true)
  })

  it('numeric groups are sorted ascending', () => {
    const numericGens = groups
      .filter((g) => g.gen !== null)
      .map((g) => g.gen as number)
    for (let i = 1; i < numericGens.length; i++) {
      expect(numericGens[i]).toBeGreaterThan(numericGens[i - 1])
    }
  })

  it('all sims appear in exactly one group', () => {
    const allSimIds = groups.flatMap((g) => g.sims.map((s) => s.id))
    expect(new Set(allSimIds).size).toBe(fixture.sims.length)
    expect(allSimIds).toHaveLength(fixture.sims.length)
  })

  it('gen 1 group contains founder and heir and spouse', () => {
    const gen1 = groups.find((g) => g.gen === 1)
    expect(gen1).toBeDefined()
    const ids = gen1!.sims.map((s) => s.id)
    expect(ids).toContain(FOUNDER_ID)
    expect(ids).toContain(HEIR_GEN1_ID)
    expect(ids).toContain(SPOUSE1_ID)
  })

  it('sims within each group are stably ordered by id', () => {
    for (const group of groups) {
      const ids = group.sims.map((s) => s.id)
      const sorted = [...ids].sort((a, b) => a.localeCompare(b))
      expect(ids).toEqual(sorted)
    }
  })

  it('handles empty input', () => {
    expect(groupByGeneration([])).toEqual([])
  })
})
