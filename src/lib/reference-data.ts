import { db } from '@/server/db'
import type { Trait } from '@/app/components/trait-picker'

export async function fetchTraitsWithConflicts(): Promise<Trait[]> {
  const traits = await db.personalityTrait.findMany({
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

export async function fetchAspirations() {
  return db.aspiration.findMany({
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, category: true },
  })
}

export async function fetchCareers() {
  return db.career.findMany({
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, type: true },
  })
}

export async function fetchSkills() {
  return db.skill.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, maxLevel: true },
  })
}
