import { TRPCError } from '@trpc/server'
import type { PrismaClient } from '@prisma/client'

/** Return the legacy if it exists and is owned by the user, else throw NOT_FOUND. */
export async function assertLegacyOwned(db: PrismaClient, legacyId: string, userId: string) {
  const legacy = await db.legacy.findFirst({ where: { id: legacyId, userId } })
  if (!legacy) throw new TRPCError({ code: 'NOT_FOUND', message: 'Legacy not found' })
  return legacy
}

/** Slug-keyed variant of assertLegacyOwned. */
export async function assertLegacyOwnedBySlug(db: PrismaClient, slug: string, userId: string) {
  const legacy = await db.legacy.findFirst({ where: { slug, userId } })
  if (!legacy) throw new TRPCError({ code: 'NOT_FOUND', message: 'Legacy not found' })
  return legacy
}
