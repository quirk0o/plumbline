/**
 * View types for the Legacy Chronicle page.
 *
 * This module is server-only; no React imports.
 *
 * INPUT types describe the minimal Prisma-fetched shape that derive.ts
 * consumes. The page (a later task) must shape its Prisma select/include
 * to match these interfaces exactly.
 */

import type { CauseOfDeath, LifeStage, RomanticStatus } from '@prisma/client'

// ---------------------------------------------------------------------------
// Input types (raw Prisma rows)
// ---------------------------------------------------------------------------

/** Minimal aspiration row included on each sim. */
export interface FetchedSimAspiration {
  /** The aspiration's own ID (SimAspiration.id). */
  id: string
  completedAt: Date | null
  createdAt: Date
  aspiration: {
    name: string
  }
}

/** Minimal sim row fetched from Prisma. */
export interface FetchedSim {
  id: string
  firstName: string
  lastName: string
  imageUrl: string | null
  generationNumber: number | null
  isHeir: boolean
  lifeStage: LifeStage
  createdAt: Date
  updatedAt: Date
  causeOfDeath: CauseOfDeath | null
  aspirations: FetchedSimAspiration[]
}

/** Minimal social-relationship row (only MARRIED ones are needed). */
export interface FetchedSocialRelationship {
  id: string
  simAId: string
  simBId: string
  romanticStatus: RomanticStatus
  createdAt: Date
}

/** A parent→child link, for deciding whether a sim was born into the legacy. */
export interface FetchedFamilyRelationship {
  parentId: string
  childId: string
}

/** A persisted user-authored milestone row with its tagged sim ids. */
export interface FetchedMilestone {
  id: string
  title: string
  blurb: string | null
  sortOrder: number
  sims: { simId: string }[]
}

/** Minimal household row fetched from Prisma. */
export interface FetchedHousehold {
  id: string
}

/** The full fetched legacy shape the derivation functions consume. */
export interface FetchedLegacy {
  id: string
  name: string
  description: string | null
  founderSimId: string | null
  sims: FetchedSim[]
  /**
   * All social relationships for sims in this legacy.
   * Only rows where romanticStatus === 'MARRIED' are used for milestone
   * derivation; the rest are ignored.
   *
   * Note: the schema enforces simAId < simBId at the application layer
   * (see schema comment), but we de-duplicate by unordered pair anyway
   * to be safe.
   */
  socialRelationships: FetchedSocialRelationship[]
  households: FetchedHousehold[]
  familyRelationships: FetchedFamilyRelationship[]
  userMilestones: FetchedMilestone[]
}

// ---------------------------------------------------------------------------
// View types (rendered by UI components)
// ---------------------------------------------------------------------------

/**
 * Ring variant for PortraitAvatar.
 * Matches the `ring` prop in src/components/ui/portrait-avatar.
 */
export type AvatarRing = 'founder' | 'heir' | 'green'

/** Normalised Sim shape used by every chronicle section. */
export interface ChronicleSim {
  id: string
  firstName: string
  lastName: string
  imageUrl: string | null
  generationNumber: number | null
  lifeStage: LifeStage
  isHeir: boolean
  isFounder: boolean
  /**
   * The sim's most relevant aspiration name.
   * Pick rule (documented in derive.ts):
   *   1. The aspiration with no completedAt (i.e. in-progress / current)
   *      — if multiple, the most recently created one.
   *   2. Else the most recently completed aspiration (latest completedAt).
   *   3. Else the first aspiration by createdAt.
   *   4. Else null (sim has no aspirations).
   */
  aspirationName: string | null
}

export interface Milestone {
  /** Stable id: synthetic for derived rows ("birth-{simId}", "death-{simId}",
   *  "marriage-{aId}-{bId}"); the real cuid for user-authored rows. */
  id: string
  kind: 'Founding' | 'Birth' | 'Marriage' | 'Death' | 'Note'
  gen: number | null
  /** The sim(s) involved in this milestone event. */
  simIds: string[]
  title: string
  blurb: string | null
  /** True for user-authored notes; also gates drag/edit/delete in the UI. */
  userAuthored: boolean
  /** Position on the shared time axis (epoch ms for derived rows; stored float
   *  for user rows). Drives merge order and client-side drag math. */
  sortOrder: number
}

/** One step in the succession line. */
export interface SuccessionStep {
  sim: ChronicleSim
  role: string
  isHeir: boolean
  isFounder: boolean
}

/** Sims grouped by generation for the Roster section. */
export interface RosterGroup {
  gen: number | null
  sims: ChronicleSim[]
}

/** Aggregate stats shown in the hero area. */
export interface LegacyStats {
  sims: number
  generations: number
  households: number
  milestones: number
}
