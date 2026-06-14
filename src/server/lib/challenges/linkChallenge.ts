import { TRPCError } from '@trpc/server'
import { Prisma, type PrismaClient } from '@prisma/client'

/**
 * Link a challenge template to a legacy: deep-copy the challenge's phases,
 * trackers, and initial progress rows into a new ChallengeRun, stamped at this
 * moment so later template edits don't affect the run.
 *
 * The caller must have already asserted the legacy is owned. The challenge must
 * be public or owned by the user (a read-access check, NOT_FOUND otherwise).
 */
export async function linkChallenge(
  db: PrismaClient,
  legacyId: string,
  challengeId: string,
  userId: string,
  name?: string,
) {
  const challenge = await db.challenge.findFirst({
    where: { id: challengeId, OR: [{ isPublic: true }, { ownerId: userId }] },
    include: {
      phases: {
        include: { trackers: { include: { trackerType: true } } },
        orderBy: { sortOrder: 'asc' },
      },
    },
  })
  if (!challenge) throw new TRPCError({ code: 'NOT_FOUND', message: 'Challenge not found' })

  return db.$transaction(async (tx) => {
    const newRun = await tx.challengeRun.create({
      data: {
        legacyId,
        sourceChallengeId: challengeId,
        name: name ?? challenge.name,
      },
    })

    for (const phase of challenge.phases) {
      const runPhase = await tx.challengeRunPhase.create({
        data: {
          challengeRunId: newRun.id,
          generationNumber: phase.generationNumber,
          title: phase.title,
          description: phase.description,
          sortOrder: phase.sortOrder,
        },
      })

      for (const tracker of phase.trackers) {
        const runTracker = await tx.challengeRunTracker.create({
          data: {
            challengeRunPhaseId: runPhase.id,
            trackerTypeId: tracker.trackerTypeId,
            name: tracker.name,
            description: tracker.description,
            config: tracker.config as Prisma.InputJsonValue,
            goalConfig: tracker.goalConfig as Prisma.InputJsonValue | undefined,
            sortOrder: tracker.sortOrder,
          },
        })
        await tx.trackerProgress.create({
          data: {
            challengeRunTrackerId: runTracker.id,
            isManual: tracker.trackerType.computationSpec === null,
            value: tracker.trackerType.valueKind === 'BOOLEAN' ? false : 0,
          },
        })
      }
    }

    return newRun
  })
}
