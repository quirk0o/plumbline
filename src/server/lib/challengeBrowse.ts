import { Prisma } from '@prisma/client'
import { db } from '@/server/db'

export type ChallengeTab = 'all' | 'mine' | 'public'

/** Coerce a raw searchParams value to a known tab; anything else means 'all'. */
export function normalizeTab(raw: unknown): ChallengeTab {
  return raw === 'mine' || raw === 'public' ? raw : 'all'
}

/** Coerce a raw searchParams value to trimmed search text; arrays/missing → ''. */
export function normalizeQuery(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim() : ''
}

export async function listChallenges(
  userId: string,
  { q = '', tab = 'all' }: { q?: string; tab?: ChallengeTab } = {},
) {
  // Access control is always applied: another user's private challenge is
  // never visible regardless of tab or search.
  const conditions: Prisma.ChallengeWhereInput[] = [
    { OR: [{ isPublic: true }, { ownerId: userId }] },
  ]
  if (tab === 'mine') conditions.push({ ownerId: userId })
  if (tab === 'public') conditions.push({ isPublic: true })
  const query = q.trim()
  if (query) {
    conditions.push({
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
      ],
    })
  }
  return db.challenge.findMany({
    where: { AND: conditions },
    select: {
      id: true,
      name: true,
      description: true,
      isPublic: true,
      ownerId: true,
      _count: { select: { phases: true } },
    },
    orderBy: { name: 'asc' },
  })
}

export async function getChallengeForView(userId: string, id: string) {
  return db.challenge.findFirst({
    where: { id, OR: [{ isPublic: true }, { ownerId: userId }] },
    select: {
      id: true,
      name: true,
      description: true,
      isPublic: true,
      ownerId: true,
      phases: {
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          title: true,
          generationNumber: true,
          description: true,
          trackers: {
            orderBy: { sortOrder: 'asc' },
            select: { id: true, name: true },
          },
        },
      },
    },
  })
}

export type ChallengeListRow = Awaited<ReturnType<typeof listChallenges>>[number]
export type ChallengeView = NonNullable<Awaited<ReturnType<typeof getChallengeForView>>>
