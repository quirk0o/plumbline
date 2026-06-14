import { describe, expect } from 'vitest'
import { authedCaller } from '@/test/caller'
import {
  createTestUser,
  cleanupUser,
  createTestSim,
  getAnySkill,
} from '@/test/helpers'
import { test } from '@/test/test'
import { db } from '@/server/db'

describe('sims.skills.add / sims.skills.setLevel / sims.skills.remove', () => {
  test('adds a skill at the given level', async ({ trpcCaller, legacyId }) => {
    const sim = await createTestSim(legacyId)
    const skill = await getAnySkill()
    await trpcCaller.sims.skills.add({ simId: sim.id, skillId: skill.id, level: 1 })
    const row = await db.simSkill.findUnique({ where: { simId_skillId: { simId: sim.id, skillId: skill.id } } })
    expect(row?.level).toBe(1)
  })

  test('throws BAD_REQUEST when level exceeds maxLevel', async ({ trpcCaller, legacyId }) => {
    const sim = await createTestSim(legacyId)
    const skill = await getAnySkill()
    await expect(
      trpcCaller.sims.skills.add({ simId: sim.id, skillId: skill.id, level: skill.maxLevel + 1 })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  test('updates skill level', async ({ trpcCaller, legacyId }) => {
    const sim = await createTestSim(legacyId)
    const skill = await getAnySkill()
    await db.simSkill.create({ data: { simId: sim.id, skillId: skill.id, level: 1 } })
    await trpcCaller.sims.skills.setLevel({ simId: sim.id, skillId: skill.id, level: 3 })
    const row = await db.simSkill.findUnique({ where: { simId_skillId: { simId: sim.id, skillId: skill.id } } })
    expect(row?.level).toBe(3)
  })

  test('removes a skill', async ({ trpcCaller, legacyId }) => {
    const sim = await createTestSim(legacyId)
    const skill = await getAnySkill()
    await db.simSkill.create({ data: { simId: sim.id, skillId: skill.id, level: 2 } })
    await trpcCaller.sims.skills.remove({ simId: sim.id, skillId: skill.id })
    const row = await db.simSkill.findUnique({ where: { simId_skillId: { simId: sim.id, skillId: skill.id } } })
    expect(row).toBeNull()
  })

  test("throws NOT_FOUND for another user's sim", async ({ legacyId }) => {
    const sim = await createTestSim(legacyId)
    const other = await createTestUser()
    try {
      const skill = await getAnySkill()
      await expect(
        authedCaller(other.id).sims.skills.add({ simId: sim.id, skillId: skill.id, level: 1 })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    } finally {
      await cleanupUser(other.id)
    }
  })
})

