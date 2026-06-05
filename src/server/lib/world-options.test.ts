import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { db } from '@/server/db'
import { fetchWorldOptions } from './world-options'
import { createTestUser, cleanupUser } from '@/test/helpers'

describe('fetchWorldOptions', () => {
  let userId: string

  beforeEach(async () => {
    const user = await createTestUser()
    userId = user.id
  })

  afterEach(async () => {
    await cleanupUser(userId)
  })

  it('offers only base-game worlds to a user with no owned packs', async () => {
    const result = await fetchWorldOptions(db, userId)
    expect(result.map((w) => w.name).sort()).toEqual(['Newcrest', 'Oasis Springs', 'Willow Creek'])
    const willowCreek = result.find((w) => w.name === 'Willow Creek')
    expect(willowCreek!.lots).toContain('1 Goth Hill')
  })

  it("includes an owned pack's worlds", async () => {
    const pack = await db.pack.findUniqueOrThrow({ where: { code: 'EP02' } })
    await db.userPack.create({ data: { userId, packId: pack.id } })
    const result = await fetchWorldOptions(db, userId)
    expect(result.map((w) => w.name)).toContain('Windenburg')
    expect(result.map((w) => w.name)).not.toContain('San Myshuno') // EP03, unowned
  })
})
