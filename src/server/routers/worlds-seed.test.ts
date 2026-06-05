import { describe, it, expect } from 'vitest'
import { db } from '@/server/db'

// The test DB is seeded by `npm run db:test:setup` (pretest hook), so these
// assert the seed itself.
describe('worlds seed', () => {
  it('seeds base-game worlds with no pack', async () => {
    const willowCreek = await db.world.findUnique({
      where: { name: 'Willow Creek' },
      include: { lots: true },
    })
    expect(willowCreek).not.toBeNull()
    expect(willowCreek!.packId).toBeNull()
    expect(willowCreek!.lots.map((l) => l.name)).toContain('1 Goth Hill')
  })

  it('links pack worlds to their pack by code', async () => {
    const windenburg = await db.world.findUnique({
      where: { name: 'Windenburg' },
      include: { pack: true },
    })
    expect(windenburg).not.toBeNull()
    expect(windenburg!.pack?.code).toBe('EP02')
  })

  it('seeds all 26 defined worlds', async () => {
    const count = await db.world.count()
    expect(count).toBe(26)
  })
})
