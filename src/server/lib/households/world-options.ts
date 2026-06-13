import type { PrismaClient } from '@prisma/client'

export interface WorldOptionRow {
  id: string
  name: string
  lots: string[]
}

/** Worlds offered in the household selects: base-game worlds (no pack) plus
 *  worlds whose pack the user owns. A household's current world is merged
 *  back in client-side (preserve-current rule in the households lib). */
export async function fetchWorldOptions(db: PrismaClient, userId: string): Promise<WorldOptionRow[]> {
  const ownedPacks = await db.userPack.findMany({
    where: { userId },
    select: { packId: true },
  })
  const worlds = await db.world.findMany({
    where: {
      OR: [{ packId: null }, { packId: { in: ownedPacks.map((p) => p.packId) } }],
    },
    select: { id: true, name: true, lots: { select: { name: true }, orderBy: { name: 'asc' } } },
    orderBy: { name: 'asc' },
  })
  return worlds.map((w) => ({ id: w.id, name: w.name, lots: w.lots.map((l) => l.name) }))
}
