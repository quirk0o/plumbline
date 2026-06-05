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

/** Return the sim if it belongs to a legacy owned by the user, else throw NOT_FOUND. */
export async function assertSimOwned(db: PrismaClient, simId: string, userId: string) {
  const sim = await db.sim.findFirst({ where: { id: simId, legacy: { userId } } })
  if (!sim) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sim not found' })
  return sim
}

/**
 * Return all requested sims (in input order, duplicates preserved) if every one
 * belongs to a legacy owned by the user, else throw NOT_FOUND.
 */
export async function assertSimsOwned(db: PrismaClient, simIds: string[], userId: string) {
  const uniqueIds = [...new Set(simIds)]
  const sims = await db.sim.findMany({
    where: { id: { in: uniqueIds }, legacy: { userId } },
  })
  if (sims.length !== uniqueIds.length) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Sim not found' })
  }
  const byId = new Map(sims.map((s) => [s.id, s]))
  return simIds.map((id) => byId.get(id)!)
}
