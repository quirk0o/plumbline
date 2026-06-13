import { describe, expect } from 'vitest'
import { test } from '@/test/test'
import { getSimDetail, listLegacySimsBySlug } from './pageData'
import { createTestUser, cleanupUser, createTestLegacy, createTestSim } from '@/test/helpers'

describe('sims/pageData', () => {
  test('getSimDetail and listLegacySimsBySlug are scoped to the owning user', async () => {
    const owner = await createTestUser()
    const intruder = await createTestUser()
    try {
      const ownerLegacy = await createTestLegacy(owner.id, { slug: 'shared-slug' })
      const ownerSim = await createTestSim(ownerLegacy.id)
      // Intruder owns a DIFFERENT legacy that happens to share the slug.
      const intruderLegacy = await createTestLegacy(intruder.id, { slug: 'shared-slug' })
      await createTestSim(intruderLegacy.id)

      // Owner sees their own sim; intruder cannot reach it by id+slug.
      expect(await getSimDetail('shared-slug', ownerSim.id, owner.id)).not.toBeNull()
      expect(await getSimDetail('shared-slug', ownerSim.id, intruder.id)).toBeNull()

      // The list is scoped to the querying user's same-slug legacy — never the other's.
      expect(await listLegacySimsBySlug('shared-slug', owner.id)).toHaveLength(1)
      expect(await listLegacySimsBySlug('shared-slug', intruder.id)).toHaveLength(1)
      const ownerList = await listLegacySimsBySlug('shared-slug', owner.id)
      expect(ownerList[0].id).toBe(ownerSim.id)
    } finally {
      await cleanupUser(owner.id)
      await cleanupUser(intruder.id)
    }
  })
})
