import { describe, expect } from 'vitest'
import {
  createTestUser,
  cleanupUser,
  createTestLegacy,
  createTestSim,
  getAnyAspiration,
  getAnyCareer,
} from '@/test/helpers'
import { test } from '@/test/test'
import { db } from '@/server/db'

describe('sims.completeAspiration', () => {
  test('sets completedAt on the SimAspiration record', async ({ trpcCaller, legacyId }) => {
    const sim = await createTestSim(legacyId)
    const simId = sim.id
    const aspiration = await getAnyAspiration()
    await db.simAspiration.create({ data: { simId, aspirationId: aspiration.id } })

    await trpcCaller.sims.completeAspiration({ simId, aspirationId: aspiration.id })

    const record = await db.simAspiration.findUnique({
      where: { simId_aspirationId: { simId, aspirationId: aspiration.id } },
    })
    expect(record?.completedAt).not.toBeNull()
  })

  test('returns NOT_FOUND when sim does not belong to the user', async ({ trpcCaller }) => {
    const other = await createTestUser()
    const otherLegacy = await createTestLegacy(other.id)
    const otherSim = await createTestSim(otherLegacy.id)
    const aspiration = await getAnyAspiration()
    await db.simAspiration.create({ data: { simId: otherSim.id, aspirationId: aspiration.id } })
    try {
      await expect(
        trpcCaller.sims.completeAspiration({ simId: otherSim.id, aspirationId: aspiration.id })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    } finally {
      await cleanupUser(other.id)
    }
  })

  test('returns NOT_FOUND when aspiration is not on the sim', async ({ trpcCaller, legacyId }) => {
    const sim = await createTestSim(legacyId)
    const aspiration = await getAnyAspiration()
    // no SimAspiration row created — aspiration not on sim
    await expect(
      trpcCaller.sims.completeAspiration({ simId: sim.id, aspirationId: aspiration.id })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  test('returns BAD_REQUEST when aspiration is already completed', async ({ trpcCaller, legacyId }) => {
    const sim = await createTestSim(legacyId)
    const aspiration = await getAnyAspiration()
    await db.simAspiration.create({ data: { simId: sim.id, aspirationId: aspiration.id, completedAt: new Date() } })

    await expect(
      trpcCaller.sims.completeAspiration({ simId: sim.id, aspirationId: aspiration.id })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })
})

describe('sims.endCareer', () => {
  test('sets endedAt on the active SimCareer record', async ({ trpcCaller, legacyId }) => {
    const sim = await createTestSim(legacyId)
    const simId = sim.id
    const career = await getAnyCareer()
    await db.simCareer.create({
      data: { simId, careerId: career.id, employmentType: 'EMPLOYED', startedAt: new Date() },
    })

    await trpcCaller.sims.endCareer({ simId })

    const record = await db.simCareer.findFirst({ where: { simId } })
    expect(record?.endedAt).not.toBeNull()
  })

  test('returns NOT_FOUND when sim does not belong to the user', async ({ trpcCaller }) => {
    const other = await createTestUser()
    const otherLegacy = await createTestLegacy(other.id)
    const otherSim = await createTestSim(otherLegacy.id)
    try {
      await expect(
        trpcCaller.sims.endCareer({ simId: otherSim.id })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    } finally {
      await cleanupUser(other.id)
    }
  })

  test('returns NOT_FOUND when there is no active career', async ({ trpcCaller, legacyId }) => {
    const sim = await createTestSim(legacyId)
    // No SimCareer row created — no active career to end
    await expect(
      trpcCaller.sims.endCareer({ simId: sim.id })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})

