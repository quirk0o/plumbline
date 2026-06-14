import { PackType } from '@prisma/client'
import { db } from '@/server/db'
import { fetchPacksForUser } from '@/lib/packs'

/** Pack groups for a user — a db-owning wrapper so RSC pages don't import `db`. */
export function getPacksForUser(userId: string) {
  return fetchPacksForUser(userId, db)
}

/** Number of non-base-game packs the user owns (dashboard summary). */
export function countOwnedPacks(userId: string) {
  return db.userPack.count({
    where: { userId, pack: { type: { not: PackType.BASE_GAME } } },
  })
}
