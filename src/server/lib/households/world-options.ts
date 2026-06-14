import { TRPCError } from '@trpc/server'
import type { PrismaClient, Prisma } from '@prisma/client'

type Db = PrismaClient | Prisma.TransactionClient

/** Throw unless the world exists. The household selects filter worlds by owned
 *  packs as a UX concern; the server only requires that the world is real. */
export async function assertWorldExists(db: Db, worldId: string) {
  const world = await db.world.findUnique({ where: { id: worldId }, select: { id: true } })
  if (!world) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Unknown world' })
}

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
