import { db } from '@/server/db'
import type { Trait } from '@/app/components/trait-picker'

async function getOwnedPackFilter(userId: string) {
  const ownedPacks = await db.userPack.findMany({
    where: { userId },
    select: { packId: true },
  })
  const packIds = ownedPacks.map((up) => up.packId)
  return { OR: [{ packId: null }, { packId: { in: packIds } }] }
}

export async function fetchTraitsWithConflicts(userId: string): Promise<Trait[]> {
  const packFilter = await getOwnedPackFilter(userId)
  const traits = await db.personalityTrait.findMany({
    where: packFilter,
    include: {
      conflictsA: { select: { traitBId: true } },
      conflictsB: { select: { traitAId: true } },
    },
    orderBy: { name: 'asc' },
  })
  return traits.map((t) => ({
    id: t.id,
    name: t.name,
    category: t.category,
    conflictsWith: [
      ...t.conflictsA.map((c) => c.traitBId),
      ...t.conflictsB.map((c) => c.traitAId),
    ],
  }))
}

export async function fetchAspirations(userId: string) {
  const packFilter = await getOwnedPackFilter(userId)
  return db.aspiration.findMany({
    where: packFilter,
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, category: true },
  })
}

export async function fetchCareers(userId: string) {
  const packFilter = await getOwnedPackFilter(userId)
  return db.career.findMany({
    where: packFilter,
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, type: true },
  })
}

export async function fetchSkills(userId: string) {
  const packFilter = await getOwnedPackFilter(userId)
  return db.skill.findMany({
    where: packFilter,
    orderBy: { name: 'asc' },
    select: { id: true, name: true, maxLevel: true },
  })
}
