import { db } from '@/server/db'

/** A user's legacies for the dashboard, newest first, each with its founder's name and avatar. */
export async function listUserLegacies(userId: string) {
  return db.legacy.findMany({
    where: { userId },
    include: {
      founderSim: { select: { firstName: true, lastName: true, imageUrl: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
}

/** {id, name, slug} of a user's legacies, alphabetical — for pickers (e.g. start-a-run). */
export async function listLegacyOptions(userId: string) {
  return db.legacy.findMany({
    where: { userId },
    select: { id: true, name: true, slug: true },
    orderBy: { name: 'asc' },
  })
}
