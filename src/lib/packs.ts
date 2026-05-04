import { PackType } from '@prisma/client'
import type { PrismaClient } from '@prisma/client'

export const PACK_TYPE_ORDER: PackType[] = [
  PackType.EXPANSION,
  PackType.GAME_PACK,
  PackType.STUFF_PACK,
  PackType.KIT,
]

type PackWithOwned = {
  id: string
  name: string
  type: PackType
  icon: string | null
  imageUrl: string | null
  isOwned: boolean
}

export type PackGroup = {
  type: PackType
  packs: PackWithOwned[]
}

export function groupPacksByType(
  packs: Array<{
    userPacks: { userId: string }[]
    createdAt: Date
    updatedAt: Date
    id: string
    name: string
    type: PackType
    icon: string | null
    imageUrl: string | null
  }>
): PackGroup[] {
  const withOwned = packs.map(({ userPacks, createdAt: _ca, updatedAt: _ua, ...p }) => ({
    ...p,
    isOwned: userPacks.length > 0,
  }))
  return PACK_TYPE_ORDER.map(type => ({
    type,
    packs: withOwned.filter(p => p.type === type),
  })).filter(g => g.packs.length > 0)
}

export async function fetchPacksForUser(
  userId: string,
  db: PrismaClient
): Promise<PackGroup[]> {
  const packs = await db.pack.findMany({
    where: { type: { not: PackType.BASE_GAME } },
    include: { userPacks: { where: { userId } } },
    orderBy: { name: 'asc' },
  })
  return groupPacksByType(packs)
}
