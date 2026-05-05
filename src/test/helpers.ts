import { db } from '@/server/db'
import { PackType } from '@prisma/client'
import { randomUUID } from 'crypto'

export async function createTestUser(overrides: { name?: string; email?: string } = {}) {
  return db.user.create({
    data: {
      email: overrides.email ?? `test-${randomUUID()}@simtrack-test.invalid`,
      name: overrides.name ?? 'Test User',
    },
  })
}

export async function cleanupUser(userId: string) {
  await db.user.deleteMany({ where: { id: userId } })
}

export async function getAnyPack(type?: PackType) {
  const where = type ? { type } : { type: { not: PackType.BASE_GAME } }
  const pack = await db.pack.findFirst({ where })
  if (!pack) throw new Error(`No pack found${type ? ` of type ${type}` : ''}. Is the DB seeded?`)
  return pack
}
