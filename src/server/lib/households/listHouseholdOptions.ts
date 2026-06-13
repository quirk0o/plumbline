import { db } from '@/server/db'

/** {id,name} options for a legacy's households, oldest first — for selects/pickers. */
export async function listHouseholdOptions(legacyId: string) {
  return db.household.findMany({
    where: { legacyId },
    select: { id: true, name: true },
    orderBy: { createdAt: 'asc' },
  })
}
