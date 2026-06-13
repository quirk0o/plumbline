import { db } from '@/server/db'

/**
 * Fetch a user's legacy by slug, or null. Non-throwing on purpose: RSC pages
 * turn the null into Next's notFound(), which the throwing
 * assertLegacyOwnedBySlug (TRPCError, for routers) cannot express.
 */
export async function getOwnedLegacyBySlug(slug: string, userId: string) {
  return db.legacy.findFirst({ where: { slug, userId } })
}
