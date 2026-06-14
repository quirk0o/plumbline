import { TRPCError } from '@trpc/server'
import type { PrismaClient, Prisma } from '@prisma/client'

type Db = PrismaClient | Prisma.TransactionClient

/** Return the legacy if it exists and is owned by the user, else throw NOT_FOUND. */
export async function assertLegacyOwned(db: Db, legacyId: string, userId: string) {
  const legacy = await db.legacy.findFirst({ where: { id: legacyId, userId } })
  if (!legacy) throw new TRPCError({ code: 'NOT_FOUND', message: 'Legacy not found' })
  return legacy
}

/** Slug-keyed variant of assertLegacyOwned. */
export async function assertLegacyOwnedBySlug(db: Db, slug: string, userId: string) {
  const legacy = await db.legacy.findFirst({ where: { slug, userId } })
  if (!legacy) throw new TRPCError({ code: 'NOT_FOUND', message: 'Legacy not found' })
  return legacy
}

/** Return the sim if it belongs to a legacy owned by the user, else throw NOT_FOUND. */
export async function assertSimOwned(db: Db, simId: string, userId: string) {
  const sim = await db.sim.findFirst({ where: { id: simId, legacy: { userId } } })
  if (!sim) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sim not found' })
  return sim
}

/**
 * Return all requested sims (in input order, duplicates preserved) if every one
 * belongs to a legacy owned by the user, else throw NOT_FOUND.
 */
export async function assertSimsOwned(db: Db, simIds: string[], userId: string) {
  const uniqueIds = [...new Set(simIds)]
  const sims = await db.sim.findMany({
    where: { id: { in: uniqueIds }, legacy: { userId } },
  })
  if (sims.length !== uniqueIds.length) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Sim not found' })
  }
  const byId = new Map(sims.map((s) => [s.id, s]))
  // Safe: the length check above proves every unique id was found, and every
  // id in simIds is one of those unique ids — so every lookup hits.
  return simIds.map((id) => byId.get(id)!)
}

/** Return the household if it belongs to a legacy owned by the user, else throw NOT_FOUND. */
export async function assertHouseholdOwned(db: Db, householdId: string, userId: string) {
  const household = await db.household.findFirst({ where: { id: householdId, legacy: { userId } } })
  if (!household) throw new TRPCError({ code: 'NOT_FOUND', message: 'Household not found' })
  return household
}

/** Return the milestone if it belongs to a legacy owned by the user, else throw NOT_FOUND. */
export async function assertMilestoneOwned(db: Db, milestoneId: string, userId: string) {
  const milestone = await db.milestone.findFirst({ where: { id: milestoneId, legacy: { userId } } })
  if (!milestone) throw new TRPCError({ code: 'NOT_FOUND', message: 'Milestone not found' })
  return milestone
}

/** Return the challenge run if it belongs to a legacy owned by the user, else throw NOT_FOUND. */
export async function assertChallengeRunOwned(db: Db, runId: string, userId: string) {
  const run = await db.challengeRun.findFirst({ where: { id: runId, legacy: { userId } } })
  if (!run) throw new TRPCError({ code: 'NOT_FOUND', message: 'Challenge run not found' })
  return run
}

// --- Challenge templates (owned via challenge.ownerId) ---
//
// These traverse to an owner and distinguish "missing" (NOT_FOUND) from "exists
// but not yours" (FORBIDDEN), so they load the entity and check in code rather
// than pushing ownership into the WHERE clause like the entity asserts above.

/** Return the challenge; NOT_FOUND if missing, FORBIDDEN if not owned by the user. */
export async function assertChallengeOwned(db: Db, challengeId: string, userId: string) {
  const challenge = await db.challenge.findUnique({ where: { id: challengeId } })
  if (!challenge) throw new TRPCError({ code: 'NOT_FOUND' })
  if (challenge.ownerId !== userId) throw new TRPCError({ code: 'FORBIDDEN' })
  return challenge
}

/** Return the challenge phase (with its challenge); NOT_FOUND if missing, FORBIDDEN if not owned. */
export async function assertChallengePhaseOwned(db: Db, phaseId: string, userId: string) {
  const phase = await db.challengePhase.findUnique({
    where: { id: phaseId },
    include: { challenge: true },
  })
  if (!phase) throw new TRPCError({ code: 'NOT_FOUND' })
  if (phase.challenge.ownerId !== userId) throw new TRPCError({ code: 'FORBIDDEN' })
  return phase
}

/** Return the challenge tracker (with its phase + challenge); NOT_FOUND if missing, FORBIDDEN if not owned. */
export async function assertChallengeTrackerOwned(db: Db, trackerId: string, userId: string) {
  const tracker = await db.trackerDefinition.findUnique({
    where: { id: trackerId },
    include: { phase: { include: { challenge: true } } },
  })
  if (!tracker) throw new TRPCError({ code: 'NOT_FOUND' })
  if (tracker.phase.challenge.ownerId !== userId) throw new TRPCError({ code: 'FORBIDDEN' })
  return tracker
}

// --- Challenge runs (owned via run.legacy.userId) ---

/** Return the run phase (with run + legacy); NOT_FOUND if missing, FORBIDDEN if not owned. */
export async function assertRunPhaseOwned(db: Db, phaseId: string, userId: string) {
  const phase = await db.challengeRunPhase.findUnique({
    where: { id: phaseId },
    include: { run: { include: { legacy: true } } },
  })
  if (!phase) throw new TRPCError({ code: 'NOT_FOUND' })
  if (phase.run.legacy.userId !== userId) throw new TRPCError({ code: 'FORBIDDEN' })
  return phase
}

/** Return the run tracker (with phase + run + legacy); NOT_FOUND if missing, FORBIDDEN if not owned. */
export async function assertRunTrackerOwned(db: Db, trackerId: string, userId: string) {
  const tracker = await db.challengeRunTracker.findUnique({
    where: { id: trackerId },
    include: { phase: { include: { run: { include: { legacy: true } } } } },
  })
  if (!tracker) throw new TRPCError({ code: 'NOT_FOUND' })
  if (tracker.phase.run.legacy.userId !== userId) throw new TRPCError({ code: 'FORBIDDEN' })
  return tracker
}

/**
 * Return the tracker progress (with its tracker, the tracker's type, and the
 * owning run → legacy), keyed by challengeRunTrackerId. NOT_FOUND if missing,
 * FORBIDDEN if not owned.
 */
export async function assertProgressOwned(db: Db, challengeRunTrackerId: string, userId: string) {
  const progress = await db.trackerProgress.findUnique({
    where: { challengeRunTrackerId },
    include: {
      tracker: {
        include: {
          trackerType: true,
          phase: { include: { run: { include: { legacy: true } } } },
        },
      },
    },
  })
  if (!progress) throw new TRPCError({ code: 'NOT_FOUND' })
  if (progress.tracker.phase.run.legacy.userId !== userId) throw new TRPCError({ code: 'FORBIDDEN' })
  return progress
}
